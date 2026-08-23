import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

export interface FechaOficial {
  id: string;
  fecha: string; 
  fechaFin?: string; 
  titulo: string;
  tipo: 'CTE' | 'Festivo' | 'Evaluacion' | 'InicioFin' | 'Descarga' | 'Vacaciones';
}

export interface AvisoGlobal {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  titulo: string;
  descripcion: string;
  createdAt?: any;
}

export const COLORES_OFICIALES = {
  CTE: '#E91E63', 
  Festivo: '#757575', 
  Vacaciones: '#00BCD4', 
  Evaluacion: '#FF9800', 
  InicioFin: '#4CAF50', 
  Descarga: '#9C27B0' 
};

export default function GestorCalendarioAdmin() {
  const [tabActiva, setTabActiva] = useState<'oficiales' | 'avisos'>('oficiales');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Estados para Fechas Oficiales
  const [fechas, setFechas] = useState<FechaOficial[]>([]);
  const [eventoEditando, setEventoEditando] = useState<string | null>(null); // NUEVO: Estado para saber qué editamos
  const [tipoDuracion, setTipoDuracion] = useState<'dia' | 'periodo'>('dia');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaFechaFin, setNuevaFechaFin] = useState('');
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState<FechaOficial['tipo']>('Festivo');

  // Estados para Avisos Globales
  const [avisos, setAvisos] = useState<AvisoGlobal[]>([]);
  const [avisoTitulo, setAvisoTitulo] = useState('');
  const [avisoDesc, setAvisoDesc] = useState('');
  const [avisoInicio, setAvisoInicio] = useState('');
  const [avisoFin, setAvisoFin] = useState('');

  // Fecha local para cálculos de vencimiento
  const obtenerFechaLocalString = () => {
    const fecha = new Date();
    const offset = fecha.getTimezoneOffset() * 60000;
    return (new Date(fecha.getTime() - offset)).toISOString().split('T')[0];
  };
  const hoyLocalString = obtenerFechaLocalString();

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const qOficiales = query(collection(db, 'calendario_oficial'));
      const snapOficiales = await getDocs(qOficiales);
      const listaFechas: FechaOficial[] = [];
      snapOficiales.forEach(d => listaFechas.push({ id: d.id, ...d.data() } as FechaOficial));
      listaFechas.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      setFechas(listaFechas);

      const qAvisos = query(collection(db, 'calendario_avisos'), orderBy('createdAt', 'desc'));
      const snapAvisos = await getDocs(qAvisos);
      const listaAvisos: AvisoGlobal[] = [];
      snapAvisos.forEach(d => listaAvisos.push({ id: d.id, ...d.data() } as AvisoGlobal));
      setAvisos(listaAvisos);

    } catch (error) {
      console.error("Error al cargar datos:", error);
    }
    setCargando(false);
  };

  // --- LÓGICA DE FECHAS OFICIALES ---
  const iniciarEdicion = (evento: FechaOficial) => {
    setEventoEditando(evento.id);
    setNuevoTitulo(evento.titulo);
    setNuevoTipo(evento.tipo);
    setNuevaFecha(evento.fecha);
    
    if (evento.fechaFin) {
      setTipoDuracion('periodo');
      setNuevaFechaFin(evento.fechaFin);
    } else {
      setTipoDuracion('dia');
      setNuevaFechaFin('');
    }
    
    // Hacemos scroll suave hacia arriba para ver el formulario
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicion = () => {
    setEventoEditando(null);
    setNuevoTitulo('');
    setNuevaFecha('');
    setNuevaFechaFin('');
    setTipoDuracion('dia');
    setNuevoTipo('Festivo');
  };

  const guardarFechaOficial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaFecha || !nuevoTitulo) return;
    if (tipoDuracion === 'periodo' && !nuevaFechaFin) return alert('Debes seleccionar una fecha de fin.');
    if (tipoDuracion === 'periodo' && nuevaFechaFin < nuevaFecha) return alert('La fecha de fin no puede ser anterior a la de inicio.');
    
    setGuardando(true);
    try {
      // Si estamos editando, usamos el ID existente; si no, creamos uno nuevo
      const idDoc = eventoEditando ? eventoEditando : `evt_${Date.now()}`;
      const docRef = doc(db, 'calendario_oficial', idDoc);
      
      const dataFecha: any = { 
        fecha: nuevaFecha, 
        titulo: nuevoTitulo, 
        tipo: nuevoTipo 
      };
      
      if (tipoDuracion === 'periodo') {
        dataFecha.fechaFin = nuevaFechaFin;
      } else {
        // En caso de que haya cambiado de periodo a día, vaciamos la fecha de fin
        dataFecha.fechaFin = '';
      }
      
      // setDoc con merge permite actualizar si existe o crear si no existe
      await setDoc(docRef, dataFecha, { merge: true });
      
      const nuevoEvento = { id: idDoc, ...dataFecha };
      let nuevaLista;
      
      if (eventoEditando) {
        nuevaLista = fechas.map(f => f.id === eventoEditando ? nuevoEvento : f);
      } else {
        nuevaLista = [...fechas, nuevoEvento];
      }
      
      nuevaLista.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      setFechas(nuevaLista);
      
      // Limpiamos el formulario
      cancelarEdicion();
    } catch (error) {
      alert("Error al guardar la fecha oficial.");
    }
    setGuardando(false);
  };

  const eliminarFechaOficial = async (id: string) => {
    if (window.confirm("¿Seguro que deseas eliminar este evento oficial?")) {
      await deleteDoc(doc(db, 'calendario_oficial', id));
      setFechas(fechas.filter(f => f.id !== id));
      if (eventoEditando === id) cancelarEdicion(); // Si borra el que estaba editando, limpiamos el form
    }
  };

  const borrarTodoElCalendario = async () => {
    const confirmacion = window.prompt("⚠️ ATENCIÓN: Estás a punto de borrar TODO el calendario oficial. Escribe 'BORRAR' para confirmar.");
    if (confirmacion === 'BORRAR') {
      setCargando(true);
      try {
        for (const fecha of fechas) {
          await deleteDoc(doc(db, 'calendario_oficial', fecha.id));
        }
        setFechas([]);
        cancelarEdicion();
        alert("El calendario oficial ha sido reiniciado.");
      } catch (error) {
        alert("Hubo un error al limpiar el calendario.");
      }
      setCargando(false);
    }
  };

  // --- LÓGICA DE AVISOS GLOBALES ---
  const guardarAviso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!avisoInicio || !avisoFin || !avisoTitulo || !avisoDesc) return;
    if (avisoFin < avisoInicio) return alert("La fecha de término no puede ser antes de la fecha de inicio.");

    setGuardando(true);
    try {
      const idUnico = `aviso_${Date.now()}`;
      const docRef = doc(db, 'calendario_avisos', idUnico);
      const dataAviso = {
        fechaInicio: avisoInicio,
        fechaFin: avisoFin,
        titulo: avisoTitulo,
        descripcion: avisoDesc,
        createdAt: serverTimestamp()
      };

      await setDoc(docRef, dataAviso);
      setAvisos([{ id: idUnico, ...dataAviso }, ...avisos]);
      
      setAvisoTitulo(''); setAvisoDesc(''); setAvisoInicio(''); setAvisoFin('');
    } catch (error) {
      alert("Error al publicar el aviso.");
    }
    setGuardando(false);
  };

  const eliminarAviso = async (id: string) => {
    if (window.confirm("¿Seguro que deseas eliminar este aviso permanentemente?")) {
      await deleteDoc(doc(db, 'calendario_avisos', id));
      setAvisos(avisos.filter(a => a.id !== id));
    }
  };

  const formatearFechaDisplay = (fecha: string) => {
    const [year, month, day] = fecha.split('-');
    return `${day}/${month}/${year}`;
  };

  const avisosVigentes = avisos.filter(a => a.fechaFin >= hoyLocalString);
  const avisosPasados = avisos.filter(a => a.fechaFin < hoyLocalString);

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      
      {/* NAVEGACIÓN INTERNA */}
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => { setTabActiva('oficiales'); cancelarEdicion(); }} 
          style={{ background: 'none', border: 'none', fontSize: '1.2rem', fontWeight: tabActiva === 'oficiales' ? 'bold' : 'normal', color: tabActiva === 'oficiales' ? 'var(--accent-blue)' : 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
        >
          📅 Días Oficiales
        </button>
        <button 
          onClick={() => { setTabActiva('avisos'); cancelarEdicion(); }} 
          style={{ background: 'none', border: 'none', fontSize: '1.2rem', fontWeight: tabActiva === 'avisos' ? 'bold' : 'normal', color: tabActiva === 'avisos' ? '#FFC107' : 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
        >
          🚨 Avisos Importantes
        </button>
      </div>

      {tabActiva === 'oficiales' && (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--accent-blue)' }}>
              {eventoEditando ? '✏️ Editar Evento Oficial' : 'Configurar Calendario Base'}
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              {eventoEditando 
                ? 'Modifica los datos del evento y guarda los cambios.' 
                : 'Añade los CTE, días festivos y evaluaciones. Los periodos vacacionales pintarán todos los días seleccionados en la agenda del docente.'}
            </p>
            
            <form onSubmit={guardarFechaOficial} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Clasificación</label>
                  <select value={nuevoTipo} onChange={e => setNuevoTipo(e.target.value as any)} className="search-input" style={{ borderLeft: `4px solid ${COLORES_OFICIALES[nuevoTipo]}` }}>
                    <option value="Festivo">Festivo / Suspensión</option>
                    <option value="Vacaciones">Receso / Vacaciones</option>
                    <option value="CTE">CTE / Fase Intensiva</option>
                    <option value="Evaluacion">Evaluación / Boletas</option>
                    <option value="Descarga">Descarga Administrativa</option>
                    <option value="InicioFin">Inicio / Fin de Clases</option>
                  </select>
                </div>
                <div style={{ flex: 2, minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Título del Evento Oficial</label>
                  <input type="text" required placeholder="Ej. Consejo Técnico Escolar - Fase Intensiva" value={nuevoTitulo} onChange={e => setNuevoTitulo(e.target.value)} className="search-input" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Duración del Evento</label>
                  <select value={tipoDuracion} onChange={e => setTipoDuracion(e.target.value as any)} className="search-input">
                    <option value="dia">Un solo día</option>
                    <option value="periodo">Periodo (Rango de fechas)</option>
                  </select>
                </div>

                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{tipoDuracion === 'periodo' ? 'Fecha de Inicio' : 'Fecha'}</label>
                  <input type="date" required value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} className="search-input" />
                </div>

                {tipoDuracion === 'periodo' && (
                  <div style={{ flex: 1, minWidth: '150px', animation: 'fadeIn 0.2s' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Fecha de Fin</label>
                    <input type="date" required value={nuevaFechaFin} onChange={e => setNuevaFechaFin(e.target.value)} className="search-input" />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '150px' }}>
                  <button type="submit" disabled={guardando} className="pill-btn" style={{ flex: 1, background: 'var(--accent-blue)', color: 'white', height: 'fit-content', padding: '0.8rem 1rem' }}>
                    {guardando ? 'Guardando...' : (eventoEditando ? '💾 Guardar' : '➕ Añadir')}
                  </button>
                  {eventoEditando && (
                    <button type="button" onClick={cancelarEdicion} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', height: 'fit-content', padding: '0.8rem 1rem' }}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          <div style={{ backgroundColor: 'var(--bg-app)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0 }}>Eventos Oficiales Guardados ({fechas.length})</h3>
              <TutorialTooltip mensaje="Utiliza este botón al final del ciclo escolar para vaciar el calendario y empezar el siguiente año limpio." posicion="left">
                <button onClick={borrarTodoElCalendario} className="pill-btn" style={{ background: 'transparent', border: '1px solid var(--accent-red)', color: 'var(--accent-red)' }}>
                  ⚠️ Reiniciar Calendario Oficial
                </button>
              </TutorialTooltip>
            </div>

            {cargando ? <div className="loader"></div> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {fechas.length === 0 ? (
                   <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay fechas oficiales configuradas.</div>
                ) : (
                  fechas.map(f => (
                    <div key={f.id} className="activity-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0, borderLeft: `4px solid ${COLORES_OFICIALES[f.tipo]}`, opacity: eventoEditando === f.id ? 0.5 : 1 }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: COLORES_OFICIALES[f.tipo], textTransform: 'uppercase' }}>{f.tipo}</span>
                        <h4 style={{ margin: '0.2rem 0', color: 'var(--text-main)', fontSize: '1rem' }}>{f.titulo}</h4>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {f.fechaFin 
                            ? `${formatearFechaDisplay(f.fecha)} al ${formatearFechaDisplay(f.fechaFin)}`
                            : formatearFechaDisplay(f.fecha)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => iniciarEdicion(f)} className="pill-btn" style={{ padding: '0.5rem', background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }} title="Editar Evento">✏️</button>
                        <button onClick={() => eliminarFechaOficial(f.id)} className="pill-btn" style={{ padding: '0.5rem', background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', border: 'none' }} title="Eliminar">🗑</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tabActiva === 'avisos' && (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <div style={{ backgroundColor: 'rgba(255, 193, 7, 0.05)', padding: '2rem', borderRadius: '24px', border: '1px solid rgba(255, 193, 7, 0.3)', marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#FFC107' }}>🚨 Emitir Nuevo Aviso</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Los avisos parpadearán en el calendario de los docentes y desaparecerán automáticamente a medianoche del día de término.</p>
            
            <form onSubmit={guardarAviso} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Título del Aviso</label>
                  <input type="text" required placeholder="Ej. Evento Día de Muertos TEC 5" value={avisoTitulo} onChange={e => setAvisoTitulo(e.target.value)} className="search-input" style={{ borderLeft: '4px solid #FFC107' }} />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Inicio de Vigencia</label>
                  <input type="date" required value={avisoInicio} onChange={e => setAvisoInicio(e.target.value)} className="search-input" />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Término de Vigencia</label>
                  <input type="date" required value={avisoFin} onChange={e => setAvisoFin(e.target.value)} className="search-input" />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Especificaciones o detalles (Horarios, ubicaciones, etc.)</label>
                <textarea required placeholder="Detalla aquí la información del aviso..." value={avisoDesc} onChange={e => setAvisoDesc(e.target.value)} className="search-input" style={{ resize: 'vertical', minHeight: '80px', width: '100%' }}></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={guardando} className="pill-btn" style={{ background: '#FFC107', color: '#000', padding: '0.8rem 2rem', fontWeight: 'bold' }}>
                  {guardando ? 'Publicando...' : '📢 Emitir Aviso Global'}
                </button>
              </div>
            </form>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
            {/* AVISOS VIGENTES */}
            <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 1.5rem 0', color: '#4CAF50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: '#4CAF50', borderRadius: '50%', animation: 'pulse 2s infinite' }}></span>
                Avisos Vigentes ({avisosVigentes.length})
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {avisosVigentes.length === 0 ? <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No hay avisos circulando actualmente.</p> : null}
                {avisosVigentes.map(a => (
                  <div key={a.id} className="activity-card" style={{ margin: 0, borderLeft: '4px solid #FFC107', backgroundColor: 'var(--bg-panel)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.05rem' }}>{a.titulo}</h5>
                      <button onClick={() => eliminarAviso(a.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer' }} title="Borrar">🗑</button>
                    </div>
                    <p style={{ margin: '0 0 0.8rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{a.descripcion}</p>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#FFC107', backgroundColor: 'rgba(255, 193, 7, 0.1)', padding: '0.3rem 0.6rem', borderRadius: '6px', display: 'inline-block' }}>
                      Vence el: {formatearFechaDisplay(a.fechaFin)} a las 23:59
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AVISOS PASADOS */}
            <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)', opacity: 0.8 }}>
              <h4 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted)' }}>🗄️ Avisos Vencidos ({avisosPasados.length})</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {avisosPasados.length === 0 ? <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No hay historial de avisos.</p> : null}
                {avisosPasados.map(a => (
                  <div key={a.id} className="activity-card" style={{ margin: 0, borderLeft: '4px solid var(--text-muted)', backgroundColor: 'var(--bg-panel)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.05rem', textDecoration: 'line-through' }}>{a.titulo}</h5>
                      <button onClick={() => eliminarAviso(a.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer' }} title="Borrar">🗑</button>
                    </div>
                    <p style={{ margin: '0 0 0.8rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{a.descripcion}</p>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Finalizó el: {formatearFechaDisplay(a.fechaFin)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Animación de pulso para el indicador de vigentes */}
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(76, 175, 80, 0); }
          100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
        }
      `}</style>
    </div>
  );
}