import { useState, useEffect } from 'react';
import { collection, doc, query, orderBy, getDocs, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

interface Alumno { id: string; fullName: string; studentNumber: number; }
interface Evidencia { id: string; titulo: string; descripcion: string; fechaActividad: string; puntajeMinimo: number; puntajeMaximo: number; trimestre: string; numero?: number; calificaciones?: Record<string, number>; }

export default function CalificarEvidencia({ idGrupo, evidencia, onVolver }: { idGrupo: string, evidencia: Evidencia, onVolver: () => void }) {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [calificaciones, setCalificaciones] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(true);
  
  // CORRECCIÓN: Se eliminó la variable datosGrupo que no se usaba

  useEffect(() => {
    const fetchData = async () => {
      setCargando(true);
      
      const q = query(collection(db, `groups/${idGrupo}/students`), orderBy('studentNumber', 'asc'));
      const snapAlumnos = await getDocs(q);
      const lista: Alumno[] = [];
      snapAlumnos.forEach(d => lista.push({ id: d.id, ...d.data() } as Alumno));
      setAlumnos(lista);

      const refEvidencia = doc(db, `groups/${idGrupo}/evidences`, evidencia.id);
      const docEv = await getDoc(refEvidencia);
      
      let datosCargados: Record<string, number> = {};
      if (docEv.exists()) {
        datosCargados = docEv.data().calificaciones || {};
      }

      let huboCambiosNuevos = false;
      const calificacionesIniciales: Record<string, number> = {};

      lista.forEach(alumno => {
        if (datosCargados[alumno.id] === undefined) {
          calificacionesIniciales[alumno.id] = evidencia.puntajeMinimo;
          huboCambiosNuevos = true;
        } else {
          calificacionesIniciales[alumno.id] = datosCargados[alumno.id];
        }
      });

      setCalificaciones(calificacionesIniciales);

      if (huboCambiosNuevos) {
        await updateDoc(refEvidencia, { calificaciones: calificacionesIniciales });
      }
      setCargando(false);
    };
    fetchData();
  }, [idGrupo, evidencia]);

  const guardarCalificacionNube = async (idAlumno: string, puntaje: number) => {
    setCalificaciones(prev => ({ ...prev, [idAlumno]: puntaje }));
    const refEvidencia = doc(db, `groups/${idGrupo}/evidences`, evidencia.id);
    await updateDoc(refEvidencia, {
      [`calificaciones.${idAlumno}`]: puntaje
    });
  };

  const isRangoPequeno = (evidencia.puntajeMaximo - evidencia.puntajeMinimo) <= 15;

  const renderControlesCalificacion = (idAlumno: string, calActual: number) => {
    if (isRangoPequeno) {
      const botones = [];
      for (let i = evidencia.puntajeMinimo; i <= evidencia.puntajeMaximo; i++) {
        botones.push(
          <button
            key={i}
            onClick={() => guardarCalificacionNube(idAlumno, i)}
            className={`btn-calif ${calActual === i ? 'active' : ''}`}
          >
            {i}
          </button>
        );
      }
      return <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>{botones}</div>;
    } else {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input 
            type="number" 
            className="score-input"
            min={evidencia.puntajeMinimo}
            max={evidencia.puntajeMaximo}
            value={calActual}
            onChange={(e) => guardarCalificacionNube(idAlumno, Number(e.target.value))}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>/ {evidencia.puntajeMaximo}</span>
        </div>
      );
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      
      <style>{`
        .btn-calif {
          width: 38px; height: 38px; border-radius: 8px; border: 1px solid var(--border-color);
          background: var(--bg-panel); color: var(--text-muted); font-weight: bold; cursor: pointer;
          transition: all 0.2s; font-size: 1rem;
        }
        .btn-calif.active {
          background: var(--accent-blue); color: white; border-color: var(--accent-blue);
          transform: scale(1.1); box-shadow: 0 4px 10px rgba(28, 81, 255, 0.3); z-index: 2;
        }
        .btn-calif:hover:not(.active) { background: var(--bg-input); }
      `}</style>

      <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <button onClick={onVolver} className="pill-btn" style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>← Volver a Mi Aula</button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <span style={{ backgroundColor: 'var(--accent-blue)', color: 'white', padding: '0.3rem 0.8rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.2rem' }}>
            #{evidencia.numero || '-'}
          </span>
          <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.8rem' }}>{evidencia.titulo}</h3>
        </div>
        
        <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)' }}>{evidencia.descripcion}</p>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ backgroundColor: 'var(--bg-input)', padding: '0.4rem 1rem', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-main)' }}>📍 Trimestre: <strong style={{ color: 'var(--accent-blue)' }}>{evidencia.trimestre}</strong></span>
          <span style={{ backgroundColor: 'var(--bg-input)', padding: '0.4rem 1rem', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-main)' }}>📅 Impartida: <strong style={{ color: 'var(--accent-green)' }}>{evidencia.fechaActividad}</strong></span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0, color: 'var(--text-muted)' }}>Evaluación Rápida</h4>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Se guarda automáticamente en la nube.</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {cargando ? <div className="loader"></div> : alumnos.map((alumno) => {
          const calActual = calificaciones[alumno.id] !== undefined ? calificaciones[alumno.id] : evidencia.puntajeMinimo;
          return (
            <div key={alumno.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', backgroundColor: 'var(--bg-input)', borderRadius: '12px', borderLeft: `4px solid ${calActual === evidencia.puntajeMaximo ? 'var(--accent-green)' : calActual === evidencia.puntajeMinimo ? 'var(--accent-red)' : 'var(--accent-yellow)'}`, flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, width: '25px' }}>{alumno.studentNumber.toString().padStart(2, '0')}</span>
                <span style={{ fontWeight: 500 }}>{alumno.fullName}</span>
              </div>
              
              <TutorialTooltip mensaje="Toca la calificación y se guardará al instante.">
                {renderControlesCalificacion(alumno.id, calActual)}
              </TutorialTooltip>
            </div>
          )
        })}
      </div>
    </div>
  );
}