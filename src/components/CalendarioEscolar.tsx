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
  tipo: 'CTE' | 'Festivo' | 'Evaluacion' | 'InicioFin' | 'Descarga' | 'Vacaciones';
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
  Descarga: '#9C27B0'
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
  const [notasPersonales, setNotasPersonales] = useState<NotaPersonal[]>([]);
  
  // Controles del calendario
  const [fechaActual, setFechaActual] = useState(new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>('');
  
  // Formulario Post-it
  const [textoNota, setTextoNota] = useState('');
  const [colorNota, setColorNota] = useState(COLORES_NOTAS[0].hex);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const sessionLocal = localStorage.getItem('aulaPlusSession');
    const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
    const email = sessionData?.user?.email || sessionData?.email || '';
    setUserEmail(email);

    // 1. Sincronización en Tiempo Real: Eventos Oficiales
    const qOficiales = query(collection(db, 'calendario_oficial'));
    const unsubOficiales = onSnapshot(qOficiales, (snapshot) => {
      const lista: EventoOficial[] = [];
      snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() } as EventoOficial));
      setEventosOficiales(lista);
    });

    // 2. Sincronización en Tiempo Real: Notas Privadas
    if (email) {
      const qNotas = query(collection(db, 'teacher_notes_calendar'), where('docenteEmail', '==', email));
      const unsubNotas = onSnapshot(qNotas, (snapshot) => {
        const lista: NotaPersonal[] = [];
        snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() } as NotaPersonal));
        setNotasPersonales(lista);
      });
      
      return () => {
        unsubOficiales();
        unsubNotas();
      };
    }

    return () => unsubOficiales();
  }, []);

  // Función para obtener la fecha local estricta (evita el desfase por zona horaria)
  const obtenerFechaLocalString = (fecha: Date) => {
    // Formato YYYY-MM-DD forzado a la zona horaria del dispositivo
    const offset = fecha.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(fecha.getTime() - offset)).toISOString().split('T')[0];
    return localISOTime;
  };

  const hoyLocalString = obtenerFechaLocalString(new Date());

  // Lógica del Calendario
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
    setTextoNota(''); // Limpia el form al tocar otro día
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
      setDiaSeleccionado(''); // Desactiva el form obligando a tocar otra fecha
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

  // Función para determinar si una fecha iterada cae dentro de un periodo oficial
  const verificarEventosDelDia = (fechaIteracion: string) => {
    return eventosOficiales.filter(evento => {
      if (!evento.fechaFin) {
        return evento.fecha === fechaIteracion; 
      } else {
        return fechaIteracion >= evento.fecha && fechaIteracion <= evento.fechaFin; 
      }
    });
  };

  // Generar celdas del calendario
  const celdas = [];
  for (let i = 0; i < primerDia; i++) {
    celdas.push(<div key={`empty-${i}`} className="cal-cell empty"></div>);
  }

  for (let d = 1; d <= diasEnMes; d++) {
    const mesStr = (mesActual + 1).toString().padStart(2, '0');
    const diaStr = d.toString().padStart(2, '0');
    const fechaIteracion = `${añoActual}-${mesStr}-${diaStr}`;
    
    const eventosDelDia = verificarEventosDelDia(fechaIteracion);
    const notasDelDia = notasPersonales.filter(n => n.fecha === fechaIteracion);
    
    const esHoy = hoyLocalString === fechaIteracion;
    const estaSeleccionado = diaSeleccionado === fechaIteracion;
    
    const eventoPrincipal = eventosDelDia.length > 0 ? eventosDelDia[0] : null;

    celdas.push(
      <div 
        key={d} 
        className={`cal-cell ${estaSeleccionado ? 'selected' : ''}`}
        onClick={() => seleccionarDiaParaNota(fechaIteracion)}
        style={{ 
          backgroundColor: notasDelDia.length > 0 ? `${notasDelDia[0].color}15` : (eventoPrincipal?.tipo === 'Vacaciones' ? `${COLORES_OFICIALES.Vacaciones}15` : 'transparent'),
          border: estaSeleccionado ? '2px solid var(--accent-blue)' : '1px solid #e0e0e0',
          borderTop: eventoPrincipal ? `4px solid ${COLORES_OFICIALES[eventoPrincipal.tipo]}` : '1px solid #e0e0e0'
        }}
      >
        <span className="cal-number" style={{ 
          color: esHoy ? 'white' : '#333', 
          backgroundColor: esHoy ? 'var(--accent-blue)' : 'transparent',
          borderRadius: esHoy ? '50%' : '0',
          width: esHoy ? '28px' : 'height',
          height: esHoy ? '28px' : 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {d}
        </span>
        
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
        }
        .cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
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
          padding: 0.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          display: flex;
          flex-direction: column;
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
        .cal-number { font-size: 1.1rem; align-self: flex-end; margin-bottom: 0.3rem; font-weight: 600; }
        .cal-indicators { display: flex; flex-direction: column; gap: 4px; flex: 1; }
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
        .cal-notes-wrapper { display: flex; gap: 4px; flex-wrap: wrap; margin-top: auto; }
        .cal-note-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .agenda-layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 1.5rem;
          align-items: start;
        }
        @media (max-width: 900px) {
          .agenda-layout { 
            grid-template-columns: 1fr; 
          }
          .cal-cell { min-height: 70px; padding: 0.3rem; }
          .cal-badge.official { font-size: 0.55rem; }
          .cal-number { font-size: 1rem; }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginBottom: '1rem', padding: '0.3rem 0.8rem' }}>
            ← Volver al Inicio
          </button>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: '1.8rem', color: '#FFC107' }}>📅 Mi Agenda Escolar</h3>
        </div>
      </div>

      <div className="agenda-layout">
        
        {/* PANEL PRINCIPAL: CALENDARIO */}
        <section className="calendar-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', textTransform: 'capitalize' }}>
              {MESES[mesActual]} {añoActual}
            </h2>
            
            <TutorialTooltip mensaje="Navega entre los meses para revisar eventos futuros o pasados." posicion="bottom">
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => cambiarMes(-1)} className="pill-btn" style={{ background: '#e0e0e0', color: '#333', border: 'none', padding: '0.5rem 1rem' }}>◀ Mes Ant.</button>
                <button onClick={() => setFechaActual(new Date())} className="pill-btn" style={{ background: 'var(--accent-blue)', color: 'white', border: 'none', padding: '0.5rem 1rem' }}>Hoy</button>
                <button onClick={() => cambiarMes(1)} className="pill-btn" style={{ background: '#e0e0e0', color: '#333', border: 'none', padding: '0.5rem 1rem' }}>Sig. Mes ▶</button>
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

        {/* PANEL LATERAL: DETALLES DEL DÍA Y POST-ITS */}
        <aside id="panel-detalles" style={{ position: 'sticky', top: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', animation: 'fadeIn 0.2s' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent-blue)', textTransform: 'capitalize' }}>
              {diaSeleccionado ? formatoFechaPanel : 'Panel de Detalles'}
            </h4>
            
            {!diaSeleccionado ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>
                👆 Toca un día en el calendario para ver sus eventos o agregar una nota.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Eventos Oficiales del Día */}
                {eventosSeleccionados.map(evt => (
                  <div key={evt.id} style={{ padding: '0.8rem', backgroundColor: 'var(--bg-input)', borderRadius: '8px', borderLeft: `4px solid ${COLORES_OFICIALES[evt.tipo]}` }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: COLORES_OFICIALES[evt.tipo] }}>OFICIAL: {evt.tipo}</span>
                    <p style={{ margin: '0.3rem 0 0 0', color: 'var(--text-main)', fontSize: '0.9rem' }}>{evt.titulo}</p>
                  </div>
                ))}

                {/* Notas Personales del Día */}
                {notasSeleccionadas.map(nota => (
                  <div key={nota.id} style={{ padding: '0.8rem', backgroundColor: nota.color, borderRadius: '8px', color: '#000', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', opacity: 0.7 }}>📌 MI POST-IT</span>
                      <button onClick={() => borrarNota(nota.id)} style={{ background: 'none', border: 'none', color: '#000', cursor: 'pointer', fontWeight: 'bold', padding: 0 }} title="Borrar">✕</button>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{nota.texto}</p>
                  </div>
                ))}

                {eventosSeleccionados.length === 0 && notasSeleccionadas.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>El día está libre.</p>
                )}

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />

                {/* Formulario de Nueva Nota */}
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
          </div>

          {/* Leyenda Oficial para Referencia Rápida */}
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