import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import CalificarEvidencia from './CalificarEvidencia';
import TutorialTooltip from './TutorialTooltip';

interface Evidencia { 
  id: string; titulo: string; descripcion: string; tipo: string;
  enlaceDrive: string; publicada: boolean; vistas: number; likes: number;
  puntajeMinimo?: number; puntajeMaximo?: number; fechaActividad: string; 
  fechaFinAviso?: string; 
  trimestre?: string; numero?: number; createdAt?: any; calificaciones?: Record<string, number>; 
}

export default function TabGestorActividades({ idGrupo }: { idGrupo: string }) {
  const [vista, setVista] = useState<'panel' | 'formulario' | 'calificar'>('panel');
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [evidenciaActiva, setEvidenciaActiva] = useState<Evidencia | null>(null);
  const [filtroTrimestre, setFiltroTrimestre] = useState<'Todos' | '1' | '2' | '3'>('Todos');
  const [ahora, setAhora] = useState(new Date().getTime());
  
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState('Tarea');
  const [tipoOtro, setTipoOtro] = useState('');
  const [enlaceDrive, setEnlaceDrive] = useState('');
  const [puntajeMin, setPuntajeMin] = useState(5);
  const [puntajeMax, setPuntajeMax] = useState(10);
  const [trimestre, setTrimestre] = useState('1'); 
  const [publicada, setPublicada] = useState(true);
  const [guardando, setGuardando] = useState(false);
  
  const obtenerFechaLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().split('T')[0]; };
  const [fechaActividad, setFechaActividad] = useState(obtenerFechaLocal());
  const [fechaFinAviso, setFechaFinAviso] = useState('');

  // Actualizar el reloj para los vencimientos cada minuto
  useEffect(() => {
    const int = setInterval(() => setAhora(new Date().getTime()), 60000);
    return () => clearInterval(int);
  }, []);

  useEffect(() => {
    const qActs = query(collection(db, `groups/${idGrupo}/evidences`));
    const desuscribir = onSnapshot(qActs, (snapshot) => {
      const lista: Evidencia[] = [];
      snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() } as Evidencia));
      lista.sort((a, b) => {
        const comp = a.fechaActividad.localeCompare(b.fechaActividad);
        if (comp === 0) return (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0) - (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
        return comp;
      });
      let counter = 1;
      const procesadas = lista.map(ev => {
        if (ev.tipo === 'Aviso') return ev;
        return { ...ev, numero: counter++, trimestre: ev.trimestre || '1' };
      });
      setEvidencias(procesadas);
    });
    return () => desuscribir();
  }, [idGrupo]);

  const abrirFormulario = (ev?: Evidencia) => {
    if (ev) {
      setEditandoId(ev.id); setTitulo(ev.titulo); setDescripcion(ev.descripcion);
      setEnlaceDrive(ev.enlaceDrive || ''); setPublicada(ev.publicada ?? true);
      setFechaActividad(ev.fechaActividad);
      
      if (ev.tipo === 'Aviso') {
        setTipo('Aviso'); setTipoOtro(''); setFechaFinAviso(ev.fechaFinAviso || '');
      } else {
        setPuntajeMin(ev.puntajeMinimo || 5); setPuntajeMax(ev.puntajeMaximo || 10); setTrimestre(ev.trimestre || '1');
        if (['Tarea', 'Trabajo en clase', 'Anotación', 'Proyecto'].includes(ev.tipo)) { setTipo(ev.tipo); setTipoOtro(''); } 
        else { setTipo('Otro'); setTipoOtro(ev.tipo); }
      }
    } else {
      setEditandoId(null); setTitulo(''); setDescripcion(''); setEnlaceDrive(''); setPublicada(true);
      setTipo('Tarea'); setTipoOtro(''); setPuntajeMin(5); setPuntajeMax(10);
      setFechaActividad(obtenerFechaLocal()); setTrimestre('1'); setFechaFinAviso('');
    }
    setVista('formulario');
  };

  const guardarEvidencia = async (e: React.FormEvent) => {
    e.preventDefault();
    const tipoFinal = tipo === 'Otro' ? tipoOtro : tipo;
    if (!tipoFinal.trim()) { alert("Especifica el tipo de actividad."); return; }

    setGuardando(true);
    const datosEvidencia: any = { titulo, descripcion, tipo: tipoFinal, enlaceDrive, publicada, fechaActividad };
    
    if (tipoFinal === 'Aviso') {
      datosEvidencia.fechaFinAviso = fechaFinAviso;
      datosEvidencia.trimestre = 'Avisos'; 
    } else {
      if (Number(puntajeMin) >= Number(puntajeMax)) { alert("El máximo debe ser mayor al mínimo."); setGuardando(false); return; }
      datosEvidencia.puntajeMinimo = Number(puntajeMin);
      datosEvidencia.puntajeMaximo = Number(puntajeMax);
      datosEvidencia.trimestre = trimestre;
    }
    
    try {
      if (editandoId) await updateDoc(doc(db, `groups/${idGrupo}/evidences`, editandoId), datosEvidencia); 
      else await addDoc(collection(db, `groups/${idGrupo}/evidences`), { ...datosEvidencia, createdAt: serverTimestamp(), calificaciones: {}, vistas: 0, likes: 0 }); 
      setVista('panel');
    } catch (error) { alert("Error al guardar."); }
    setGuardando(false);
  };

  const eliminarEvidencia = async (id: string, nombre: string) => {
    if(window.confirm(`⚠️ ¿Eliminar permanentemente "${nombre}"? Los alumnos ya no podrán verla.`)) await deleteDoc(doc(db, `groups/${idGrupo}/evidences`, id));
  };

  const togglePublicacion = async (id: string, estadoActual: boolean) => {
    await updateDoc(doc(db, `groups/${idGrupo}/evidences`, id), { publicada: !estadoActual });
  };

  if (vista === 'calificar' && evidenciaActiva) return <CalificarEvidencia idGrupo={idGrupo} evidencia={evidenciaActiva as any} onVolver={() => setVista('panel')} />;
  
  if (vista === 'formulario') {
    return (
      <div style={{ animation: 'fadeIn 0.3s' }}>
        <button onClick={() => setVista('panel')} className="pill-btn" style={{ marginBottom: '1rem', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>← Volver al Aula</button>
        <form onSubmit={guardarEvidencia} style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: tipo === 'Aviso' ? 'var(--accent-yellow)' : 'var(--accent-purple)' }}>
            {editandoId ? '✏️ Editar Registro' : '✨ Crear Nuevo Registro'}
          </h3>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Tipo de Registro</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: tipo === 'Otro' ? '0.8rem' : '0' }}>
              {['Tarea', 'Trabajo en clase', 'Anotación', 'Proyecto', 'Otro', 'Aviso'].map(t => (
                <div key={t} onClick={() => setTipo(t)} style={{ padding: '0.5rem 1rem', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s', border: tipo === t ? `2px solid ${t==='Aviso'?'var(--accent-yellow)':'var(--accent-blue)'}` : '1px solid var(--border-color)', backgroundColor: tipo === t ? (t==='Aviso'?'rgba(255, 193, 7, 0.1)':'rgba(28, 81, 255, 0.1)') : 'transparent', color: tipo === t ? (t==='Aviso'?'var(--accent-yellow)':'var(--accent-blue)') : 'var(--text-muted)' }}>
                  {t === 'Aviso' ? '🔔 Aviso / Recordatorio' : t}
                </div>
              ))}
            </div>
            {tipo === 'Otro' && <input type="text" className="search-input" required placeholder="Especificar (Ej. Maqueta)..." value={tipoOtro} onChange={e => setTipoOtro(e.target.value)} style={{ animation: 'fadeIn 0.2s' }} />}
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '250px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{tipo === 'Aviso' ? 'Título del Aviso' : 'Título de la Actividad'}</label>
              <input type="text" className="search-input" required value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej. Resumen de la Revolución..." style={{ borderLeft: `4px solid ${tipo==='Aviso'?'var(--accent-yellow)':'var(--accent-purple)'}` }}/>
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Fecha Inicial</label>
              <input type="date" className="search-input" required value={fechaActividad} onChange={e => setFechaActividad(e.target.value)} />
            </div>
            {tipo === 'Aviso' && (
              <div style={{ flex: 1, minWidth: '150px', animation: 'fadeIn 0.3s' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--accent-yellow)', fontWeight: 'bold' }}>Caducidad (Opcional)</label>
                <input type="datetime-local" className="search-input" value={fechaFinAviso} onChange={e => setFechaFinAviso(e.target.value)} style={{ borderColor: 'var(--accent-yellow)' }} />
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{tipo === 'Aviso' ? 'Mensaje o Instrucciones' : 'Descripción / Instrucciones'}</label>
            <textarea className="search-input" required value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Escribe aquí las instrucciones detalladas que verá el alumno..." style={{ minHeight: '80px', resize: 'vertical' }} />
          </div>

          <div style={{ backgroundColor: 'rgba(28, 81, 255, 0.05)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(28, 81, 255, 0.2)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--accent-blue)', fontWeight: 'bold' }}><span>🔗 Documento PDF de Apoyo (Drive) - Opcional</span></label>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>💡 <b>Ayuda rápida:</b> Sube tu archivo a Google Drive, compártelo como <b>"Cualquier usuario con el enlace"</b> y pégalo aquí abajo.</p>
            <input type="url" className="search-input" value={enlaceDrive} onChange={e => setEnlaceDrive(e.target.value)} placeholder="https://drive.google.com/file/d/..." />
          </div>

          {tipo !== 'Aviso' && (
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', backgroundColor: 'var(--bg-app)', padding: '1.5rem', borderRadius: '16px', animation: 'fadeIn 0.3s' }}>
              <div style={{ flex: 1, minWidth: '150px' }}><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Trimestre</label><select className="search-input" value={trimestre} onChange={e => setTrimestre(e.target.value)}><option value="1">Trimestre 1</option><option value="2">Trimestre 2</option><option value="3">Trimestre 3</option></select></div>
              <div style={{ flex: 1, minWidth: '100px' }}><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Cal. Mínima</label><input type="number" className="search-input" required value={puntajeMin} onChange={e => setPuntajeMin(Number(e.target.value))} min="0" /></div>
              <div style={{ flex: 1, minWidth: '100px' }}><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Cal. Máxima</label><input type="number" className="search-input" required value={puntajeMax} onChange={e => setPuntajeMax(Number(e.target.value))} min="1" style={{ borderColor: 'var(--accent-yellow)' }} /></div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={publicada} onChange={e => setPublicada(e.target.checked)} style={{ transform: 'scale(1.5)' }} />
              <span style={{ fontWeight: 'bold', color: publicada ? 'var(--accent-green)' : 'var(--text-muted)' }}>{publicada ? '📢 Visible en la Pizarra Alumno' : '🙈 Oculto (Borrador)'}</span>
            </label>
            <button type="submit" disabled={guardando} className="pill-btn" style={{ background: tipo === 'Aviso' ? 'var(--accent-yellow)' : 'var(--accent-purple)', color: tipo === 'Aviso' ? '#000' : 'white', padding: '1rem 3rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
              {guardando ? 'Guardando...' : `💾 Guardar ${tipo === 'Aviso' ? 'Aviso' : 'Actividad'}`}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // --- SEPARACIÓN DE ACTIVIDADES, AVISOS ACTIVOS Y AVISOS VENCIDOS ---
  const avisosVencidos = evidencias.filter(e => {
    if (e.tipo !== 'Aviso' || !e.fechaFinAviso) return false;
    const target = new Date(e.fechaFinAviso).getTime();
    return target <= ahora;
  });

  const actividadesYAvisosActivos = evidencias.filter(e => !avisosVencidos.includes(e));
  const evidenciasFiltradas = filtroTrimestre === 'Todos' ? actividadesYAvisosActivos : actividadesYAvisosActivos.filter(e => e.trimestre === filtroTrimestre || e.tipo === 'Aviso');

  // Tarjeta Reutilizable
  const renderTarjeta = (ev: Evidencia, esVencido = false) => {
    const esAviso = ev.tipo === 'Aviso';
    return (
      <div key={ev.id} className="activity-card" style={{ display: 'flex', flexDirection: 'column', backgroundColor: esAviso ? 'rgba(255, 193, 7, 0.05)' : 'var(--bg-panel)', margin: 0, borderTop: `4px solid ${esAviso ? 'var(--accent-yellow)' : 'var(--accent-purple)'}`, boxShadow: esAviso && !esVencido ? '0 0 15px rgba(255, 193, 7, 0.15)' : 'none', opacity: esVencido ? 0.7 : 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: esAviso ? '#000' : 'var(--text-main)', backgroundColor: esAviso ? 'var(--accent-yellow)' : 'var(--bg-input)', padding: '0.3rem 0.6rem', borderRadius: '6px', border: esAviso ? 'none' : '1px solid var(--border-color)' }}>
            {esAviso ? (esVencido ? '🔔 AVISO VENCIDO' : '🔔 AVISO') : ev.tipo}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
            {esAviso ? (ev.fechaFinAviso ? `Venció: ${new Date(ev.fechaFinAviso).toLocaleDateString()}` : 'Aviso General') : `T-${ev.trimestre}`}
          </span>
        </div>
        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.2rem' }}>
          {!esAviso && <span style={{ color: 'var(--accent-purple)', marginRight: '0.3rem' }}>#{ev.numero}</span>}
          {ev.titulo}
        </h4>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ev.descripcion}</p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', backgroundColor: 'var(--bg-input)', padding: '0.8rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label className="switch"><input type="checkbox" checked={ev.publicada} onChange={() => togglePublicacion(ev.id, ev.publicada)} /><span className="slider"></span></label>
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: ev.publicada ? 'var(--accent-green)' : 'var(--text-muted)' }}>Pizarra</span>
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
            <span title="Vistas en Pizarra">👁️ {ev.vistas || 0}</span>
            <span title="Likes de Alumnos">❤️ {ev.likes || 0}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
          {!esAviso && <button onClick={() => { setEvidenciaActiva(ev); setVista('calificar'); }} className="pill-btn" style={{ flex: 1, background: 'var(--accent-blue)', color: 'white', padding: '0.6rem' }}>📝 Calificar</button>}
          <button onClick={() => abrirFormulario(ev)} className="pill-btn" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.6rem' }} title="Editar">✏️</button>
          <button onClick={() => eliminarEvidencia(ev.id, ev.titulo)} className="pill-btn" style={{ background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', border: 'none', padding: '0.6rem' }} title="Eliminar">🗑</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', backgroundColor: 'var(--bg-panel)', padding: '0.4rem', borderRadius: '50px', border: '1px solid var(--border-color)' }}>
          {['Todos', '1', '2', '3'].map(t => (
            <button key={t} onClick={() => setFiltroTrimestre(t as any)} style={{ padding: '0.4rem 1.2rem', borderRadius: '50px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', backgroundColor: filtroTrimestre === t ? 'var(--accent-purple)' : 'transparent', color: filtroTrimestre === t ? 'white' : 'var(--text-muted)' }}>
              {t === 'Todos' ? 'Todos' : `Trim. ${t}`}
            </button>
          ))}
        </div>
        <TutorialTooltip mensaje="¡Ojo! Las actividades que crees aquí pueden enviarse a la pizarra de los alumnos para que las vean.">
          <button onClick={() => abrirFormulario()} className="pill-btn" style={{ background: 'var(--accent-purple)', color: 'white', padding: '0.8rem 1.5rem' }}>✨ Crear Registro</button>
        </TutorialTooltip>
      </div>

      {evidenciasFiltradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '24px' }}>No tienes actividades o avisos activos.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {evidenciasFiltradas.map(ev => renderTarjeta(ev, false))}
        </div>
      )}

      {/* ACORDEÓN DE AVISOS VENCIDOS */}
      {avisosVencidos.length > 0 && (
        <details className="vark-accordion" style={{ marginTop: '3rem', backgroundColor: 'rgba(255, 77, 79, 0.05)', border: '1px dashed var(--accent-red)' }}>
          <summary style={{ fontSize: '1.1rem', color: 'var(--accent-red)', fontWeight: 'bold' }}>
            <span>🗄️ Historial de Avisos Vencidos ({avisosVencidos.length})</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Los alumnos ya no pueden verlos.</span>
          </summary>
          <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {avisosVencidos.map(ev => renderTarjeta(ev, true))}
          </div>
        </details>
      )}
    </div>
  );
}