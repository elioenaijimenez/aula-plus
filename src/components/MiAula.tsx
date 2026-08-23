import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import CalificarEvidencia from './CalificarEvidencia';
import TutorialTooltip from './TutorialTooltip';

interface Evidencia { 
  id: string; 
  titulo: string; 
  descripcion: string; 
  tipo: string;
  enlaceDrive: string;
  publicada: boolean;
  vistas: number;
  likes: number;
  puntajeMinimo: number; 
  puntajeMaximo: number; 
  fechaActividad: string; 
  trimestre: string; 
  numero?: number; 
  createdAt?: any; 
  calificaciones?: Record<string, number>; 
}

export default function MiAula({ idGrupo, nombreGrupo, onVolver }: { idGrupo: string, nombreGrupo: string, onVolver: () => void }) {
  const [vista, setVista] = useState<'panel' | 'formulario' | 'calificar'>('panel');
  const [tab, setTab] = useState<'actividades' | 'biblioteca' | 'drive'>('actividades');
  const [filtroTrimestre, setFiltroTrimestre] = useState<'Todos' | '1' | '2' | '3'>('Todos');
  
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [evidenciaActiva, setEvidenciaActiva] = useState<Evidencia | null>(null);
  const [pizarraCode, setPizarraCode] = useState<string>('Generando...');
  
  // Estados del Formulario
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
  
  const obtenerFechaLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().split('T')[0]; };
  const [fechaActividad, setFechaActividad] = useState(obtenerFechaLocal());
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    // 1. Generar o recuperar la Clave de la Pizarra Alumno
    const inicializarPizarra = async () => {
      const refGrupo = doc(db, 'groups', idGrupo);
      const docSnap = await getDoc(refGrupo);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.pizarraCode) {
          setPizarraCode(data.pizarraCode);
        } else {
          // Genera una clave aleatoria corta (ej. AULA-Y6T9)
          const newCode = 'AULA-' + Math.random().toString(36).substring(2, 6).toUpperCase();
          await updateDoc(refGrupo, { pizarraCode: newCode });
          setPizarraCode(newCode);
        }
      }
    };
    inicializarPizarra();

    // 2. Cargar Actividades
    const q = query(collection(db, `groups/${idGrupo}/evidences`));
    const desuscribir = onSnapshot(q, (snapshot) => {
      const lista: Evidencia[] = [];
      snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() } as Evidencia));
      
      lista.sort((a, b) => {
        const comp = a.fechaActividad.localeCompare(b.fechaActividad);
        if (comp === 0) {
           const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
           const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
           return timeA - timeB;
        }
        return comp;
      });
      const listaNumerada = lista.map((ev, index) => ({ ...ev, numero: index + 1, trimestre: ev.trimestre || '1' }));
      setEvidencias(listaNumerada);
    });
    return () => desuscribir();
  }, [idGrupo]);

  const abrirFormulario = (ev?: Evidencia) => {
    if (ev) {
      setEditandoId(ev.id); setTitulo(ev.titulo); setDescripcion(ev.descripcion);
      setEnlaceDrive(ev.enlaceDrive || ''); setPublicada(ev.publicada ?? true);
      setPuntajeMin(ev.puntajeMinimo || 5); setPuntajeMax(ev.puntajeMaximo || 10);
      setFechaActividad(ev.fechaActividad || obtenerFechaLocal()); setTrimestre(ev.trimestre || '1');
      if (['Tarea', 'Trabajo en clase', 'Anotación', 'Proyecto'].includes(ev.tipo)) {
        setTipo(ev.tipo); setTipoOtro('');
      } else {
        setTipo('Otro'); setTipoOtro(ev.tipo);
      }
    } else {
      setEditandoId(null); setTitulo(''); setDescripcion(''); setEnlaceDrive(''); setPublicada(true);
      setTipo('Tarea'); setTipoOtro(''); setPuntajeMin(5); setPuntajeMax(10);
      setFechaActividad(obtenerFechaLocal()); setTrimestre('1');
    }
    setVista('formulario');
  };

  const guardarEvidencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(puntajeMin) >= Number(puntajeMax)) { alert("El máximo debe ser mayor al mínimo."); return; }
    
    const tipoFinal = tipo === 'Otro' ? tipoOtro : tipo;
    if (!tipoFinal.trim()) { alert("Especifica el tipo de actividad."); return; }

    setGuardando(true);
    const datosEvidencia = { 
      titulo, descripcion, tipo: tipoFinal, enlaceDrive, publicada,
      puntajeMinimo: Number(puntajeMin), puntajeMaximo: Number(puntajeMax), 
      fechaActividad, trimestre 
    };
    
    try {
      if (editandoId) { 
        await updateDoc(doc(db, `groups/${idGrupo}/evidences`, editandoId), datosEvidencia); 
      } else { 
        await addDoc(collection(db, `groups/${idGrupo}/evidences`), { 
          ...datosEvidencia, createdAt: serverTimestamp(), calificaciones: {},
          vistas: 0, likes: 0 // Campos preparados para la Pizarra Alumno
        }); 
      }
      setVista('panel');
    } catch (error) { alert("Error al guardar."); }
    setGuardando(false);
  };

  const eliminarEvidencia = async (id: string, nombre: string) => {
    if(window.confirm(`⚠️ ¿Eliminar permanentemente "${nombre}"? Los alumnos ya no podrán verla.`)) {
      await deleteDoc(doc(db, `groups/${idGrupo}/evidences`, id));
    }
  };

  const togglePublicacion = async (id: string, estadoActual: boolean) => {
    await updateDoc(doc(db, `groups/${idGrupo}/evidences`, id), { publicada: !estadoActual });
  };

  if (vista === 'calificar' && evidenciaActiva) {
    return <CalificarEvidencia idGrupo={idGrupo} evidencia={evidenciaActiva as any} onVolver={() => setVista('panel')} />;
  }
  
  if (vista === 'formulario') {
    return (
      <div style={{ animation: 'fadeIn 0.3s' }}>
        <button onClick={() => setVista('panel')} className="pill-btn" style={{ marginBottom: '1rem', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>← Volver al Aula</button>
        <form onSubmit={guardarEvidencia} style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent-purple)' }}>{editandoId ? '✏️ Editar Actividad' : '✨ Crear Nueva Actividad'}</h3>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '250px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Título de la Actividad</label>
              <input type="text" className="search-input" required value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej. Resumen de la Revolución Mexicana..." style={{ borderLeft: '4px solid var(--accent-purple)' }}/>
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Fecha de Aplicación</label>
              <input type="date" className="search-input" required value={fechaActividad} onChange={e => setFechaActividad(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Tipo de Actividad</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: tipo === 'Otro' ? '0.8rem' : '0' }}>
              {['Tarea', 'Trabajo en clase', 'Anotación', 'Proyecto', 'Otro'].map(t => (
                <div 
                  key={t} onClick={() => setTipo(t)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s', border: tipo === t ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)', backgroundColor: tipo === t ? 'rgba(28, 81, 255, 0.1)' : 'transparent', color: tipo === t ? 'var(--accent-blue)' : 'var(--text-muted)' }}
                >
                  {t}
                </div>
              ))}
            </div>
            {tipo === 'Otro' && (
              <input type="text" className="search-input" required placeholder="Escribe la categoría (Ej. Exposición, Maqueta...)" value={tipoOtro} onChange={e => setTipoOtro(e.target.value)} style={{ animation: 'fadeIn 0.2s' }} />
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Descripción o Instrucciones para el Alumno</label>
            <textarea className="search-input" required value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Escribe aquí las instrucciones detalladas que verá el alumno en su pizarra..." style={{ minHeight: '80px', resize: 'vertical' }} />
          </div>

          <div style={{ backgroundColor: 'rgba(28, 81, 255, 0.05)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(28, 81, 255, 0.2)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--accent-blue)', fontWeight: 'bold' }}>
              <span>🔗 Documento PDF de Apoyo (Drive) - Opcional</span>
            </label>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>💡 <b>Ayuda rápida:</b> Sube tu archivo a Google Drive, da clic derecho &gt; Compartir &gt; Cambia el acceso a <b>"Cualquier usuario con el enlace"</b> y pega el enlace largo aquí abajo.</p>
            <input type="url" className="search-input" value={enlaceDrive} onChange={e => setEnlaceDrive(e.target.value)} placeholder="https://drive.google.com/file/d/..." />
          </div>

          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', backgroundColor: 'var(--bg-app)', padding: '1.5rem', borderRadius: '16px' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Trimestre</label>
              <select className="search-input" value={trimestre} onChange={e => setTrimestre(e.target.value)}>
                <option value="1">Trimestre 1</option>
                <option value="2">Trimestre 2</option>
                <option value="3">Trimestre 3</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '100px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Cal. Mínima</label>
              <input type="number" className="search-input" required value={puntajeMin} onChange={e => setPuntajeMin(Number(e.target.value))} min="0" />
            </div>
            <div style={{ flex: 1, minWidth: '100px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Cal. Máxima</label>
              <input type="number" className="search-input" required value={puntajeMax} onChange={e => setPuntajeMax(Number(e.target.value))} min="1" style={{ borderColor: 'var(--accent-yellow)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={publicada} onChange={e => setPublicada(e.target.checked)} style={{ transform: 'scale(1.5)' }} />
              <span style={{ fontWeight: 'bold', color: publicada ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                {publicada ? '📢 Visible en la Pizarra Alumno' : '🙈 Oculto para alumnos (Borrador)'}
              </span>
            </label>
            <button type="submit" disabled={guardando} className="pill-btn" style={{ background: 'var(--accent-purple)', color: 'white', padding: '1rem 3rem', fontSize: '1.1rem' }}>
              {guardando ? 'Guardando...' : '💾 Guardar Actividad'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  const evidenciasFiltradas = filtroTrimestre === 'Todos' ? evidencias : evidencias.filter(e => e.trimestre === filtroTrimestre);

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      
      <style>{`
        /* Toggle Switch CSS Minimalista */
        .switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0;}
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .3s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--accent-green); }
        input:checked + .slider:before { transform: translateX(18px); }
      `}</style>

      {/* HEADER MI AULA */}
      <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button onClick={onVolver} className="pill-btn" style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginBottom: '1rem', padding: '0.3rem 0.8rem' }}>← Salir del Aula</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '2.5rem' }}>🎓</span>
            <div>
              <h2 style={{ margin: 0, color: 'var(--accent-purple)', fontSize: '2rem' }}>Mi Aula Virtual</h2>
              <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '1rem' }}>Grupo {nombreGrupo}</p>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', backgroundColor: 'rgba(28, 81, 255, 0.05)', padding: '1rem', borderRadius: '16px', border: '1px dashed var(--accent-blue)' }}>
          <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Clave de Acceso Alumnos:</span>
          <strong style={{ fontSize: '1.5rem', color: 'var(--accent-blue)', letterSpacing: '2px' }}>{pizarraCode}</strong>
        </div>
      </div>

      {/* TABS DE NAVEGACIÓN */}
      <div className="tabs-nav" style={{ marginBottom: '2rem' }}>
        <span className={`tab ${tab === 'actividades' ? 'active' : ''}`} onClick={() => setTab('actividades')} style={{ borderBottomColor: tab === 'actividades' ? 'var(--accent-purple)' : '' }}>
          📋 Gestor de Actividades
        </span>
        <span className={`tab ${tab === 'biblioteca' ? 'active' : ''}`} onClick={() => setTab('biblioteca')} style={{ borderBottomColor: tab === 'biblioteca' ? 'var(--accent-purple)' : '' }}>
          ⭐ Biblioteca Favoritos
        </span>
        <span className={`tab ${tab === 'drive' ? 'active' : ''}`} onClick={() => setTab('drive')} style={{ borderBottomColor: tab === 'drive' ? 'var(--accent-purple)' : '' }}>
          📁 Mi Nube Drive
        </span>
      </div>

      {/* CONTENIDO TABS */}
      {tab === 'biblioteca' && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', border: '2px dashed var(--border-color)', borderRadius: '24px' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📚</span>
          <h3>Tus libros y recursos favoritos aparecerán aquí</h3>
          <p>Próximamente podrás enviar material directamente desde la Biblioteca a tu Pizarra Alumno.</p>
        </div>
      )}

      {tab === 'drive' && (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', border: '2px dashed var(--border-color)', borderRadius: '24px' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>☁️</span>
          <h3>Integración con Google Drive</h3>
          <p>Próximamente podrás examinar tus carpetas y anexar PDFs sin salir de Aula+.</p>
        </div>
      )}

      {tab === 'actividades' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            
            {/* Filtros en forma de Pill */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', backgroundColor: 'var(--bg-panel)', padding: '0.4rem', borderRadius: '50px', border: '1px solid var(--border-color)' }}>
              {['Todos', '1', '2', '3'].map(t => (
                <button 
                  key={t} onClick={() => setFiltroTrimestre(t as any)}
                  style={{ padding: '0.4rem 1.2rem', borderRadius: '50px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', backgroundColor: filtroTrimestre === t ? 'var(--accent-purple)' : 'transparent', color: filtroTrimestre === t ? 'white' : 'var(--text-muted)' }}
                >
                  {t === 'Todos' ? 'Todos' : `Trim. ${t}`}
                </button>
              ))}
            </div>

            <button onClick={() => abrirFormulario()} className="pill-btn" style={{ background: 'var(--accent-purple)', color: 'white', padding: '0.8rem 1.5rem' }}>
              ✨ Crear Actividad
            </button>
          </div>

          {evidenciasFiltradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '24px' }}>No tienes actividades en este trimestre.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {evidenciasFiltradas.map(ev => (
                <div key={ev.id} className="activity-card" style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-panel)', margin: 0, borderTop: `4px solid var(--accent-purple)` }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-main)', backgroundColor: 'var(--bg-input)', padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      {ev.tipo}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>T-{ev.trimestre}</span>
                  </div>

                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.2rem' }}>
                    <span style={{ color: 'var(--accent-purple)', marginRight: '0.3rem' }}>#{ev.numero}</span> 
                    {ev.titulo}
                  </h4>
                  
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {ev.descripcion}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', backgroundColor: 'var(--bg-input)', padding: '0.8rem', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label className="switch">
                        <input type="checkbox" checked={ev.publicada} onChange={() => togglePublicacion(ev.id, ev.publicada)} />
                        <span className="slider"></span>
                      </label>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: ev.publicada ? 'var(--accent-green)' : 'var(--text-muted)' }}>Pizarra</span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                      <span title="Vistas en Pizarra">👁️ {ev.vistas || 0}</span>
                      <span title="Likes de Alumnos">❤️ {ev.likes || 0}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                    <button onClick={() => { setEvidenciaActiva(ev); setVista('calificar'); }} className="pill-btn" style={{ flex: 1, background: 'var(--accent-blue)', color: 'white', padding: '0.6rem' }}>📝 Calificar</button>
                    <button onClick={() => abrirFormulario(ev)} className="pill-btn" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.6rem' }} title="Editar">✏️</button>
                    <button onClick={() => eliminarEvidencia(ev.id, ev.titulo)} className="pill-btn" style={{ background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', border: 'none', padding: '0.6rem' }} title="Eliminar">🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}