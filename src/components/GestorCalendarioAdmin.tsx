import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

interface FechaOficial {
  id: string;
  fecha: string; // Formato YYYY-MM-DD
  titulo: string;
  tipo: 'CTE' | 'Festivo' | 'Evaluacion' | 'InicioFin' | 'Descarga';
}

const COLORES_OFICIALES = {
  CTE: '#E91E63', // Rosa vibrante
  Festivo: '#757575', // Gris (Suspensión de labores)
  Evaluacion: '#FF9800', // Naranja (Entrega de boletas)
  InicioFin: '#4CAF50', // Verde
  Descarga: '#9C27B0' // Morado
};

export default function GestorCalendarioAdmin() {
  const [fechas, setFechas] = useState<FechaOficial[]>([]);
  const [cargando, setCargando] = useState(true);
  
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState<FechaOficial['tipo']>('Festivo');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarFechas();
  }, []);

  const cargarFechas = async () => {
    setCargando(true);
    try {
      const q = query(collection(db, 'calendario_oficial'));
      const snap = await getDocs(q);
      const lista: FechaOficial[] = [];
      snap.forEach(d => {
        lista.push({ id: d.id, ...d.data() } as FechaOficial);
      });
      // Ordenar cronológicamente
      lista.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      setFechas(lista);
    } catch (error) {
      console.error("Error al cargar fechas oficiales:", error);
    }
    setCargando(false);
  };

  const guardarFecha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaFecha || !nuevoTitulo) return;
    
    setGuardando(true);
    try {
      // Usamos la misma fecha como ID para que sea fácil de buscar y no se dupliquen
      const docRef = doc(db, 'calendario_oficial', nuevaFecha);
      const dataFecha: Omit<FechaOficial, 'id'> = {
        fecha: nuevaFecha,
        titulo: nuevoTitulo,
        tipo: nuevoTipo
      };
      
      await setDoc(docRef, dataFecha);
      
      // Actualizamos estado local
      const existe = fechas.find(f => f.id === nuevaFecha);
      let nuevaLista;
      if (existe) {
        nuevaLista = fechas.map(f => f.id === nuevaFecha ? { id: nuevaFecha, ...dataFecha } : f);
      } else {
        nuevaLista = [...fechas, { id: nuevaFecha, ...dataFecha }];
      }
      nuevaLista.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      
      setFechas(nuevaLista);
      setNuevoTitulo('');
      setNuevaFecha('');
    } catch (error) {
      alert("Error al guardar la fecha oficial.");
    }
    setGuardando(false);
  };

  const eliminarFecha = async (id: string) => {
    if (window.confirm("¿Seguro que deseas eliminar este evento del calendario global?")) {
      try {
        await deleteDoc(doc(db, 'calendario_oficial', id));
        setFechas(fechas.filter(f => f.id !== id));
      } catch (error) {
        alert("Error al eliminar la fecha.");
      }
    }
  };

  const borrarTodoElCalendario = async () => {
    const confirmacion = window.prompt("⚠️ ATENCIÓN: Estás a punto de borrar TODO el calendario oficial (ideal para el cambio de ciclo escolar). Escribe 'BORRAR' para confirmar.");
    if (confirmacion === 'BORRAR') {
      setCargando(true);
      try {
        // Borramos uno por uno (en Firebase no hay un "drop table")
        for (const fecha of fechas) {
          await deleteDoc(doc(db, 'calendario_oficial', fecha.id));
        }
        setFechas([]);
        alert("El calendario oficial ha sido reiniciado con éxito.");
      } catch (error) {
        alert("Hubo un error al limpiar el calendario.");
      }
      setCargando(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--accent-blue)' }}>📅 Configurar Días Oficiales</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Añade los CTE, días festivos y evaluaciones. Estos días aparecerán marcados en el calendario de todos los docentes.</p>
        
        <form onSubmit={guardarFecha} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Fecha</label>
            <input type="date" required value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} className="search-input" />
          </div>
          
          <div style={{ flex: 2, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Título del Evento</label>
            <input type="text" required placeholder="Ej. Consejo Técnico Escolar" value={nuevoTitulo} onChange={e => setNuevoTitulo(e.target.value)} className="search-input" />
          </div>

          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Tipo de Día</label>
            <select value={nuevoTipo} onChange={e => setNuevoTipo(e.target.value as any)} className="search-input" style={{ borderLeft: `4px solid ${COLORES_OFICIALES[nuevoTipo]}` }}>
              <option value="Festivo">Festivo / Suspensión</option>
              <option value="CTE">CTE / Fase Intensiva</option>
              <option value="Evaluacion">Evaluación / Calificaciones</option>
              <option value="Descarga">Descarga Administrativa</option>
              <option value="InicioFin">Inicio / Fin de Clases</option>
            </select>
          </div>

          <button type="submit" disabled={guardando} className="pill-btn" style={{ background: 'var(--accent-blue)', color: 'white', height: 'fit-content', padding: '0.8rem 2rem' }}>
            {guardando ? 'Guardando...' : '➕ Añadir Día'}
          </button>
        </form>
      </div>

      <div style={{ backgroundColor: 'var(--bg-app)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ margin: 0 }}>Eventos Oficiales Guardados ({fechas.length})</h3>
          <TutorialTooltip mensaje="Utiliza este botón al final del ciclo escolar para vaciar el calendario y empezar el siguiente año limpio." posicion="left">
            <button onClick={borrarTodoElCalendario} className="pill-btn" style={{ background: 'transparent', border: '1px solid var(--accent-red)', color: 'var(--accent-red)' }}>
              ⚠️ Reiniciar Calendario
            </button>
          </TutorialTooltip>
        </div>

        {cargando ? <div className="loader"></div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {fechas.length === 0 ? (
               <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay fechas oficiales configuradas.</div>
            ) : (
              fechas.map(f => (
                <div key={f.id} className="activity-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0, borderLeft: `4px solid ${COLORES_OFICIALES[f.tipo]}` }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: COLORES_OFICIALES[f.tipo], textTransform: 'uppercase' }}>{f.tipo}</span>
                    <h4 style={{ margin: '0.2rem 0', color: 'var(--text-main)', fontSize: '1rem' }}>{f.titulo}</h4>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <button onClick={() => eliminarFecha(f.id)} className="pill-btn" style={{ padding: '0.5rem', background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', border: 'none' }} title="Eliminar">🗑</button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}