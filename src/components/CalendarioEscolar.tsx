import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

// Interfaces
interface EventoOficial {
  id: string;
  fecha: string;
  titulo: string;
  tipo: 'CTE' | 'Festivo' | 'Evaluacion' | 'InicioFin' | 'Descarga';
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

    // 1. Sincronización en Tiempo Real: Eventos Oficiales (SuperAdmin)
    const qOficiales = query(collection(db, 'calendario_oficial'));
    const unsubOficiales = onSnapshot(qOficiales, (snapshot) => {
      const lista: EventoOficial[] = [];
      snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() } as EventoOficial));
      setEventosOficiales(lista);
    });

    // 2. Sincronización en Tiempo Real: Notas Privadas del Docente
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

  // Lógica del Calendario
  const obtenerDiasDelMes = (año: number, mes: number) => new Date(año, mes + 1, 0).getDate();
  const obtenerPrimerDiaDelMes = (año: number, mes: number) => new Date(año, mes, 1).getDay();

  const añoActual = fechaActual.getFullYear();
  const mesActual = fechaActual.getMonth();
  const diasEnMes = obtenerDiasDelMes(añoActual, mesActual);
  const primerDia = obtenerPrimerDiaDelMes(añoActual, mesActual);

  const cambiarMes = (incremento: number) => {
    setFechaActual(new Date(añoActual, mesActual + incremento, 1));
    setDiaSeleccionado('');
  };

  const seleccionarDiaParaNota = (fechaAString: string) => {
    setDiaSeleccionado(fechaAString);
    setTextoNota('');
    // En móviles, hacer scroll suave al formulario si está abajo
    if (window.innerWidth < 768) {
      setTimeout(() => {
        document.getElementById('panel-postit')?.scrollIntoView({ behavior: 'smooth' });
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
      // No necesitamos actualizar el estado manual, onSnapshot lo hará al instante
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

  // Generar celdas del calendario
  const celdas = [];
  for (let i = 0; i < primerDia; i++) {
    celdas.push(<div key={`empty-${i}`} className="cal-cell empty"></div>);
  }

  for (let d = 1; d <= diasEnMes; d++) {
    const mesStr = (mesActual + 1).toString().padStart(2, '0');
    const diaStr = d.toString().padStart(2, '0');
    const fechaIteracion = `${añoActual}-${mesStr}-${diaStr}`;
    
    // Buscar si hay eventos o notas este día
    const eventoOficial = eventosOficiales.find(e => e.fecha === fechaIteracion);
    const notasDelDia = notasPersonales.filter(n => n.fecha === fechaIteracion);
    
    const esHoy = new Date().toISOString().split('T')[0] === fechaIteracion;
    const estaSeleccionado = diaSeleccionado === fechaIteracion;

    celdas.push(
      <div 
        key={d} 
        className={`cal-cell ${estaSeleccionado ? 'selected' : ''} ${esHoy ? 'today' : ''}`}
        onClick={() => seleccionarDiaParaNota(fechaIteracion)}
        style={{ 
          backgroundColor: notasDelDia.length > 0 ? `${notasDelDia[0].color}1A` : 'transparent', // Fondo súper tenue si hay nota personal
          border: estaSeleccionado ? '2px solid var(--accent-blue)' : '1px solid #e0e0e0',
          borderTop: eventoOficial ? `4px solid ${COLORES_OFICIALES[eventoOficial.tipo]}` : '1px solid #e0e0e0'
        }}
      >
        <span className="cal-number" style={{ color: esHoy ? 'var(--accent-blue)' : '#333', fontWeight: esHoy ? 'bold' : 'normal' }}>{d}</span>
        
        {/* Indicadores Visuales */}
        <div className="cal-indicators">
          {eventoOficial && (
            <div className="cal-badge official" style={{ backgroundColor: COLORES_OFICIALES[eventoOficial.tipo] }}>
              {eventoOficial.tipo}
            </div>
          )}
          
          {/* Tooltip personalizado de Notas */}
          {notasDelDia.length > 0 && (
            <div className="cal-notes-wrapper">
              {notasDelDia.map(n => (
                <div key={n.id} className="cal-note-dot tooltip-container" style={{ backgroundColor: n.color }}>
                  <div className="tooltip-postit" style={{ backgroundColor: n.color, color: '#000' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <b>📌 Post-it</b>
                      <span onClick={(e) => { e.stopPropagation(); borrarNota(n.id); }} style={{ cursor: 'pointer', fontWeight: 'bold' }}>✕</span>
                    </div>
                    {n.texto}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      
      {/* MAGIA CSS: Estilos encapsulados para el calendario claro y responsivo */}
      <style>{`
        .calendar-container {
          background-color: #F8F9FA; /* Blanco suave anti-reflejo */
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
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transform: translateY(-2px);
        }
        .cal-cell.empty { background: transparent; border: none; cursor: default; }
        .cal-number { font-size: 1.1rem; align-self: flex-end; margin-bottom: 0.3rem; }
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
          position: relative;
        }
        /* Tooltip del Post-it */
        .tooltip-container .tooltip-postit {
          visibility: hidden;
          opacity: 0;
          position: absolute;
          bottom: 150%;
          left: 50%;
          transform: translateX(-50%);
          width: 200px;
          padding: 0.8rem;
          border-radius: 8px;
          box-shadow: 2px 4px 15px rgba(0,0,0,0.3);
          font-size: 0.85rem;
          z-index: 100;
          transition: opacity 0.2s;
        }
        .tooltip-container:hover .tooltip-postit { visibility: visible; opacity: 1; }
        /* Flecha del tooltip */
        .tooltip-container .tooltip-postit::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          margin-left: -8px;
          border-width: 8px;
          border-style: solid;
          border-color: inherit transparent transparent transparent;
        }

        /* Layout Responsivo */
        .agenda-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 1.5rem;
          align-items: start;
        }
        @media (max-width: 900px) {
          .agenda-layout { grid-template-columns: 1fr; }
          .cal-cell { min-height: 70px; }
          .cal-badge.official { font-size: 0.55rem; }
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
        
        {/* PANEL IZQUIERDO: POST-ITS (Fijo en escritorio) */}
        <aside id="panel-postit" style={{ position: 'sticky', top: '2rem' }}>
          <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)' }}>📌 Crear Anotación</h4>
            
            <TutorialTooltip mensaje="Toca un día en el calendario de la derecha y luego escribe tu nota aquí. Aparecerá como un post-it." posicion="bottom">
              <form onSubmit={guardarNota} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Día seleccionado:</label>
                  <input type="date" required value={diaSeleccionado} onChange={e => setDiaSeleccionado(e.target.value)} className="search-input" style={{ width: '100%' }} />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Nota para este día:</label>
                  <textarea required value={textoNota} onChange={e => setTextoNota(e.target.value)} className="search-input" style={{ resize: 'vertical', minHeight: '80px', width: '100%', backgroundColor: colorNota, color: '#000' }} placeholder="Escribe un recordatorio..."></textarea>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Color del Post-it:</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {COLORES_NOTAS.map(c => (
                      <button 
                        key={c.hex} 
                        type="button" 
                        onClick={() => setColorNota(c.hex)}
                        style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: c.hex, border: colorNota === c.hex ? '3px solid white' : 'none', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}
                        title={c.nombre}
                      />
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={guardando || !diaSeleccionado} className="pill-btn" style={{ background: 'var(--accent-blue)', color: 'white', marginTop: '0.5rem' }}>
                  {guardando ? 'Guardando...' : 'Pegar Post-it'}
                </button>
              </form>
            </TutorialTooltip>
          </div>

          {/* LEYENDA OFICIAL */}
          <div style={{ marginTop: '1.5rem', backgroundColor: 'var(--bg-input)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h5 style={{ margin: '0 0 0.8rem 0', color: 'var(--text-muted)' }}>Simbología Oficial</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-main)' }}>
              {Object.entries(COLORES_OFICIALES).map(([tipo, color]) => (
                <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: color, borderRadius: '3px' }}></div>
                  {tipo}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* PANEL DERECHO: CALENDARIO BLANCO (ESTILO APP) */}
        <section className="calendar-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', textTransform: 'capitalize' }}>
              {MESES[mesActual]} {añoActual}
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => cambiarMes(-1)} className="pill-btn" style={{ background: '#eee', color: '#333', border: 'none', padding: '0.5rem 1rem' }}>◀ Mes Ant.</button>
              <button onClick={() => cambiarMes(1)} className="pill-btn" style={{ background: '#eee', color: '#333', border: 'none', padding: '0.5rem 1rem' }}>Sig. Mes ▶</button>
            </div>
          </div>

          <div className="cal-grid">
            {DIAS_SEMANA.map(dia => (
              <div key={dia} className="cal-header-day">{dia}</div>
            ))}
            {celdas}
          </div>
        </section>

      </div>
    </div>
  );
}