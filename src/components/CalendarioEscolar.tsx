import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

// Interfaces
interface EventoOficial {
  id: string;
  fecha: string;
  fechaFin?: string;
  titulo: string;
  tipo: 'CTE' | 'Festivo' | 'Evaluacion' | 'InicioFin' | 'Descarga' | 'Vacaciones' | 'SEP';
}

interface AvisoGlobal {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  titulo: string;
  descripcion: string;
}

interface NotaPersonal {
  id: string;
  fecha: string;
  texto: string;
  color: string;
  docenteEmail: string;
}

const COLORES_OFICIALES = {
  CTE: '#E91E63',
  Festivo: '#757575',
  Vacaciones: '#00BCD4',
  Evaluacion: '#FF9800',
  InicioFin: '#4CAF50',
  Descarga: '#9C27B0',
  SEP: '#009688'
};

const COLORES_NOTAS = [
  { nombre: 'Amarillo', hex: '#FFD54F' },
  { nombre: 'Azul', hex: '#64B5F6' },
  { nombre: 'Verde', hex: '#81C784' },
  { nombre: 'Rojo', hex: '#E57373' },
  { nombre: 'Morado', hex: '#BA68C8' }
];

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function CalendarioEscolar({ onVolver }: { onVolver: () => void }) {
  const [userEmail, setUserEmail] = useState('');
  const [eventosOficiales, setEventosOficiales] = useState<EventoOficial[]>([]);
  const [avisosGlobales, setAvisosGlobales] = useState<AvisoGlobal[]>([]);
  const [notasPersonales, setNotasPersonales] = useState<NotaPersonal[]>([]);
  
  const [fechaActual, setFechaActual] = useState(new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>('');
  const [viendoAvisosGenerales, setViendoAvisosGenerales] = useState(false);

  const [textoNota, setTextoNota] = useState('');
  const [colorNota, setColorNota] = useState(COLORES_NOTAS[0].hex);
  const [guardando, setGuardando] = useState(false);

  // Fecha local estricta
  const obtenerFechaLocalString = (fecha: Date) => {
    const offset = fecha.getTimezoneOffset() * 60000;
    return (new Date(fecha.getTime() - offset)).toISOString().split('T')[0];
  };

  const hoyLocalString = obtenerFechaLocalString(new Date());

  useEffect(() => {
    const sessionLocal = localStorage.getItem('aulaPlusSession');
    const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
    const email = sessionData?.user?.email || sessionData?.email || '';
    setUserEmail(email);

    const qOficiales = query(collection(db, 'calendario_oficial'));
    const unsubOficiales = onSnapshot(qOficiales, (snapshot) => {
      const lista: EventoOficial[] = [];
      snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() } as EventoOficial));
      setEventosOficiales(lista);
    });

    const qAvisos = query(collection(db, 'calendario_avisos'));
    const unsubAvisos = onSnapshot(qAvisos, (snapshot) => {
      const lista: AvisoGlobal[] = [];
      snapshot.forEach(doc => {
        const aviso = { id: doc.id, ...doc.data() } as AvisoGlobal;
        if (aviso.fechaFin >= hoyLocalString) {
          lista.push(aviso);
        }
      });
      setAvisosGlobales(lista);
    });

    if (email) {
      const qNotas = query(collection(db, 'teacher_notes_calendar'), where('docenteEmail', '==', email));
      const unsubNotas = onSnapshot(qNotas, (snapshot) => {
        const lista: NotaPersonal[] = [];
        snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() } as NotaPersonal));
        setNotasPersonales(lista);
      });
      
      return () => {
        unsubOficiales();
        unsubAvisos();
        unsubNotas();
      };
    }

    return () => {
      unsubOficiales();
      unsubAvisos();
    };
  }, [hoyLocalString]);

  const formatearFechaDisplay = (fechaStr: string) => {
    if (!fechaStr) return '';
    const [year, month, day] = fechaStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const obtenerDiasDelMes = (año: number, mes: number) => new Date(año, mes + 1, 0).getDate();
  const obtenerPrimerDiaDelMes = (año: number, mes: number) => new Date(año, mes, 1).getDay();

  const añoActual = fechaActual.getFullYear();
  const mesActual = fechaActual.getMonth();
  const diasEnMes = obtenerDiasDelMes(añoActual, mesActual);
  const primerDia = obtenerPrimerDiaDelMes(añoActual, mesActual);

  const cambiarMes = (incremento: number) => {
    setFechaActual(new Date(añoActual, mesActual + incremento, 1));
  };

  const seleccionarDiaParaNota = (fechaAString: string) => {
    setDiaSeleccionado(fechaAString);
    setViendoAvisosGenerales(false); 
    setTextoNota(''); 
    if (window.innerWidth < 768) {
      setTimeout(() => {
        document.getElementById('panel-detalles')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const verAvisosGenerales = () => {
    setViendoAvisosGenerales(true);
    setDiaSeleccionado(''); 
    if (window.innerWidth < 768) {
      setTimeout(() => {
        document.getElementById('panel-detalles')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const guardarNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diaSeleccionado || !textoNota.trim() || !userEmail) return;

    setGuardando(true);
    try {
      await addDoc(collection(db, 'teacher_notes_calendar'), {
        fecha: diaSeleccionado,
        texto: textoNota,
        color: colorNota,
        docenteEmail: userEmail,
        createdAt: serverTimestamp()
      });
      setTextoNota('');
      setDiaSeleccionado(''); 
    } catch (error) {
      alert("Error al guardar la nota.");
    }
    setGuardando(false);
  };

  const borrarNota = async (id: string) => {
    if (window.confirm("¿Borrar este Post-it?")) {
      await deleteDoc(doc(db, 'teacher_notes_calendar', id));
    }
  };

  const verificarEventosDelDia = (fechaIteracion: string) => {
    return eventosOficiales.filter(evento => {
      const inicio = evento.fecha;
      const fin = evento.fechaFin || evento.fecha;
      return fechaIteracion >= inicio && fechaIteracion <= fin; 
    });
  };

  const verificarAvisosDelDia = (fechaIteracion: string) => {
    return avisosGlobales.filter(aviso => {
       const inicio = aviso.fechaInicio;
       const fin = aviso.fechaFin || aviso.fechaInicio;
       return fechaIteracion >= inicio && fechaIteracion <= fin;
    });
  };

  const celdas = [];
  for (let i = 0; i < primerDia; i++) {
    celdas.push(<div key={`empty-${i}`} className="cal-cell empty"></div>);
  }

  for (let d = 1; d <= diasEnMes; d++) {
    const mesStr = (mesActual + 1).toString().padStart(2, '0');
    const diaStr = d.toString().padStart(2, '0');
    const fechaIteracion = `${añoActual}-${mesStr}-${diaStr}`;
    
    const eventosDelDia = verificarEventosDelDia(fechaIteracion);
    const avisosDelDia = verificarAvisosDelDia(fechaIteracion);
    const notasDelDia = notasPersonales.filter(n => n.fecha === fechaIteracion);
    
    const esHoy = hoyLocalString === fechaIteracion;
    const estaSeleccionado = diaSeleccionado === fechaIteracion;
    
    const tieneAviso = avisosDelDia.length > 0;
    const esAvisoVigenteHoyEnAdelante = tieneAviso && (fechaIteracion >= hoyLocalString);
    
    const eventoPrincipal = eventosDelDia.length > 0 ? eventosDelDia[0] : null;

    let bgColor = 'transparent';
    if (esAvisoVigenteHoyEnAdelante) bgColor = 'rgba(255, 193, 7, 0.1)'; 
    else if (notasDelDia.length > 0) bgColor = `${notasDelDia[0].color}15`; 
    else if (eventoPrincipal?.tipo === 'Vacaciones') bgColor = `${COLORES_OFICIALES.Vacaciones}15`; 
    else if (eventoPrincipal?.tipo === 'SEP') bgColor = `${COLORES_OFICIALES.SEP}10`; 

    celdas.push(
      <div 
        key={d} 
        className={`cal-cell ${estaSeleccionado ? 'selected' : ''}`}
        onClick={() => seleccionarDiaParaNota(fechaIteracion)}
        style={{ 
          backgroundColor: bgColor,
          border: estaSeleccionado ? '2px solid var(--accent-blue)' : (esAvisoVigenteHoyEnAdelante ? '1px solid rgba(255, 193, 7, 0.5)' : '1px solid #e0e0e0'),
          borderTop: eventoPrincipal ? `4px solid ${COLORES_OFICIALES[eventoPrincipal.tipo]}` : (esAvisoVigenteHoyEnAdelante ? '4px solid #FFC107' : '1px solid #e0e0e0')
        }}
      >
        {tieneAviso && (
          <div style={{ position: 'absolute', top: '6px', left: '6px', zIndex: 5 }} title="¡Aviso en este día!">
             <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#FFC107', animation: 'avisoPulse 1.5s infinite', boxShadow: '0 0 4px rgba(255,193,7,0.8)' }}></div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginBottom: '4px' }}>
          <span className="cal-number" style={{ 
            color: esHoy ? 'white' : '#333', 
            backgroundColor: esHoy ? 'var(--accent-blue)' : 'transparent',
            borderRadius: esHoy ? '50%' : '0',
            width: esHoy ? '24px' : 'auto',
            height: esHoy ? '24px' : 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {d}
          </span>
        </div>
        
        <div className="cal-indicators">
          {eventoPrincipal && (
            <div className="cal-badge official" style={{ backgroundColor: COLORES_OFICIALES[eventoPrincipal.tipo] }}>
              {eventoPrincipal.tipo}
            </div>
          )}
          
          {notasDelDia.length > 0 && (
            <div className="cal-notes-wrapper">
              {notasDelDia.map(n => (
                <div key={n.id} className="cal-note-dot" style={{ backgroundColor: n.color }} title="Tienes un post-it aquí"></div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const eventosSeleccionados = diaSeleccionado ? verificarEventosDelDia(diaSeleccionado) : [];
  const avisosSeleccionados = diaSeleccionado ? verificarAvisosDelDia(diaSeleccionado) : [];
  const notasSeleccionadas = diaSeleccionado ? notasPersonales.filter(n => n.fecha === diaSeleccionado) : [];
  const formatoFechaPanel = diaSeleccionado ? new Date(diaSeleccionado + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Selecciona un día';

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      
      <style>{`
        .calendar-container {
          background-color: #F8F9FA;
          border-radius: 16px;
          padding: 1.5rem;
          color: #333;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          width: 100%;
          overflow: hidden;
        }
        .cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
          width: 100%;
        }
        .cal-header-day {
          text-align: center;
          font-weight: bold;
          color: #666;
          padding: 0.5rem 0;
          font-size: 0.9rem;
        }
        .cal-cell {
          min-height: 90px;
          background: #fff;
          border-radius: 8px;
          padding: 0.4rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }
        .cal-cell:hover:not(.empty) {
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transform: translateY(-2px);
          z-index: 10;
        }
        .cal-cell.selected {
          transform: scale(1.02);
          box-shadow: 0 4px 15px rgba(28, 81, 255, 0.3);
          z-index: 11;
        }
        .cal-cell.empty { background: transparent; border: none; cursor: default; }
        .cal-number { font-size: 1rem; font-weight: 600; margin-left: auto; }
        .cal-indicators { display: flex; flex-direction: column; gap: 3px; flex: 1; margin-top: 2px; }
        .cal-badge.official {
          color: white;
          font-size: 0.65rem;
          font-weight: bold;
          padding: 2px 4px;
          border-radius: 4px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cal-notes-wrapper { display: flex; gap: 3px; flex-wrap: wrap; margin-top: auto; padding-bottom: 0.2rem; }
        .cal-note-dot { width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }

        .agenda-layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 1.5rem;
          align-items: start;
        }
        
        @media (max-width: 900px) {
          .agenda-layout { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .calendar-container { padding: 0.8rem; border-radius: 12px; }
          .cal-grid { gap: 2px; }
          .cal-header-day { font-size: 0.75rem; padding: 0.3rem 0; }
          .cal-cell { min-height: 65px; padding: 0.2rem; border-radius: 6px; }
          .cal-number { font-size: 0.85rem; }
          .cal-badge.official { font-size: 0.5rem; padding: 1px 2px; letter-spacing: -0.5px; }
          .cal-note-dot { width: 8px; height: 8px; }
        }

        @keyframes avisoPulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(255, 193, 7, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0); }
        }
        .bell-icon {
          font-size: 1.5rem;
          cursor: pointer;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
          background: rgba(255, 193, 7, 0.15);
          border-radius: 50%;
          border: 1px solid rgba(255, 193, 7, 0.5);
          transition: transform 0.2s;
        }
        .bell-icon:hover { transform: scale(1.1); }
        .bell-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          background: #E91E63;
          color: white;
          font-size: 0.7rem;
          font-weight: bold;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginBottom: '1rem', padding: '0.3rem 0.8rem' }}>
            ← Volver al Inicio
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontWeight: 600, fontSize: '1.8rem', color: '#FFC107' }}>📅 Mi Agenda Escolar</h3>
            
            {avisosGlobales.length > 0 && (
              <TutorialTooltip mensaje="¡Tienes avisos activos! Toca la campana para leerlos." posicion="right">
                <div className="bell-icon" onClick={verAvisosGenerales}>
                  🔔
                  <div className="bell-badge">{avisosGlobales.length}</div>
                </div>
              </TutorialTooltip>
            )}
          </div>
        </div>
      </div>

      <div className="agenda-layout">
        
        {/* PANEL PRINCIPAL: CALENDARIO */}
        <section className="calendar-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.3rem', textTransform: 'capitalize' }}>
              {MESES[mesActual]} {añoActual}
            </h2>
            
            <TutorialTooltip mensaje="Navega entre los meses para revisar eventos futuros o pasados." posicion="bottom">
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button onClick={() => cambiarMes(-1)} className="pill-btn" style={{ background: '#e0e0e0', color: '#333', border: 'none', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>◀ Ant.</button>
                <button onClick={() => setFechaActual(new Date())} className="pill-btn" style={{ background: 'var(--accent-blue)', color: 'white', border: 'none', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Hoy</button>
                <button onClick={() => cambiarMes(1)} className="pill-btn" style={{ background: '#e0e0e0', color: '#333', border: 'none', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Sig. ▶</button>
              </div>
            </TutorialTooltip>
          </div>

          <div className="cal-grid">
            {DIAS_SEMANA.map(dia => (
              <div key={dia} className="cal-header-day">{dia}</div>
            ))}
            {celdas}
          </div>
        </section>

        {/* PANEL LATERAL */}
        <aside id="panel-detalles" style={{ position: 'sticky', top: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', animation: 'fadeIn 0.2s' }}>
            
            {viendoAvisosGenerales ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#FFC107', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🔔 Todos los Avisos Activos
                </h4>
                {avisosGlobales.map(aviso => (
                  <div key={aviso.id} style={{ padding: '1rem', backgroundColor: 'rgba(255, 193, 7, 0.1)', borderRadius: '8px', borderLeft: '4px solid #FFC107' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1rem' }}>{aviso.titulo}</h5>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{aviso.descripcion}</p>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#FFC107', fontWeight: 'bold' }}>
                      Del {formatearFechaDisplay(aviso.fechaInicio)} al {formatearFechaDisplay(aviso.fechaFin)}
                    </div>
                  </div>
                ))}
                <button onClick={() => setViendoAvisosGenerales(false)} className="pill-btn" style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginTop: '1rem' }}>Cerrar Avisos</button>
              </div>
            ) : 
            
            (
              <>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent-blue)', textTransform: 'capitalize' }}>
                  {diaSeleccionado ? formatoFechaPanel : 'Panel de Detalles'}
                </h4>
                
                {!diaSeleccionado ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>
                    👆 Toca un día en el calendario para ver sus eventos o agregar una nota.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    {avisosSeleccionados.map(aviso => (
                      <div key={aviso.id} style={{ padding: '1rem', backgroundColor: 'rgba(255, 193, 7, 0.15)', borderRadius: '8px', border: '1px solid #FFC107' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                          <span style={{ fontSize: '1.2rem' }}>🚨</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#FFC107' }}>AVISO IMPORTANTE</span>
                        </div>
                        <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1rem' }}>{aviso.titulo}</h5>
                        <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{aviso.descripcion}</p>
                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#FFC107', fontWeight: 'bold' }}>
                          Del {formatearFechaDisplay(aviso.fechaInicio)} al {formatearFechaDisplay(aviso.fechaFin)}
                        </div>
                      </div>
                    ))}

                    {eventosSeleccionados.map(evt => (
                      <div key={evt.id} style={{ padding: '0.8rem', backgroundColor: 'var(--bg-input)', borderRadius: '8px', borderLeft: `4px solid ${COLORES_OFICIALES[evt.tipo]}` }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: COLORES_OFICIALES[evt.tipo] }}>OFICIAL: {evt.tipo}</span>
                        <p style={{ margin: '0.3rem 0 0 0', color: 'var(--text-main)', fontSize: '0.9rem' }}>{evt.titulo}</p>
                      </div>
                    ))}

                    {notasSeleccionadas.map(nota => (
                      <div key={nota.id} style={{ padding: '0.8rem', backgroundColor: nota.color, borderRadius: '8px', color: '#000', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', opacity: 0.7 }}>📌 MI POST-IT</span>
                          <button onClick={() => borrarNota(nota.id)} style={{ background: 'none', border: 'none', color: '#000', cursor: 'pointer', fontWeight: 'bold', padding: 0 }} title="Borrar">✕</button>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{nota.texto}</p>
                      </div>
                    ))}

                    {eventosSeleccionados.length === 0 && notasSeleccionadas.length === 0 && avisosSeleccionados.length === 0 && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>El día está libre.</p>
                    )}

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />

                    <TutorialTooltip mensaje="Elige un color para tu post-it y presiona Guardar. Se sincronizará en todos tus dispositivos." posicion="top" esBloque={true}>
                      <form onSubmit={guardarNota} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Añadir recordatorio:</label>
                        <textarea 
                          required 
                          value={textoNota} 
                          onChange={e => setTextoNota(e.target.value)} 
                          className="search-input" 
                          style={{ resize: 'vertical', minHeight: '80px', width: '100%', backgroundColor: colorNota, color: '#000', border: 'none' }} 
                          placeholder="Escribe aquí..."
                        ></textarea>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {COLORES_NOTAS.map(c => (
                              <button 
                                key={c.hex} 
                                type="button" 
                                onClick={() => setColorNota(c.hex)}
                                style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: c.hex, border: colorNota === c.hex ? '2px solid white' : 'none', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}
                                title={c.nombre}
                              />
                            ))}
                          </div>
                          <button type="submit" disabled={guardando} className="pill-btn" style={{ background: '#333', color: 'white', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                            {guardando ? '...' : 'Guardar'}
                          </button>
                        </div>
                      </form>
                    </TutorialTooltip>

                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ backgroundColor: 'var(--bg-input)', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h5 style={{ margin: '0 0 0.8rem 0', color: 'var(--text-muted)' }}>Simbología Oficial</h5>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', fontSize: '0.8rem', color: 'var(--text-main)' }}>
              {Object.entries(COLORES_OFICIALES).map(([tipo, color]) => (
                <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '45%' }}>
                  <div style={{ width: '10px', height: '10px', backgroundColor: color, borderRadius: '2px' }}></div>
                  {tipo}
                </div>
              ))}
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}