import { useState, useEffect } from 'react';
import { collection, doc, query, orderBy, getDocs, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

interface Alumno { id: string; fullName: string; studentNumber: number; }
type AsistenciaEstado = 'P' | 'R' | 'F' | 'J';

export default function TabAsistencia({ idGrupo }: { idGrupo: string }) {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);

  const obtenerFechaLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };

  const [fecha, setFecha] = useState(obtenerFechaLocal());
  const [asistencia, setAsistencia] = useState<Record<string, AsistenciaEstado>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const fetchAlumnos = async () => {
      const q = query(collection(db, `groups/${idGrupo}/students`), orderBy('studentNumber', 'asc'));
      const snap = await getDocs(q);
      const lista: Alumno[] = [];
      snap.forEach(d => lista.push({ id: d.id, ...d.data() } as Alumno));
      setAlumnos(lista);
    };
    fetchAlumnos();
  }, [idGrupo]);

  useEffect(() => {
    if (alumnos.length === 0) return;
    const fetchAsistencia = async () => {
      setCargando(true);
      const docRef = doc(db, `groups/${idGrupo}/attendance`, fecha);
      const snap = await getDoc(docRef);
      
      if (snap.exists()) {
        setAsistencia(snap.data().records);
      } else {
        const defaultAsistencia: Record<string, AsistenciaEstado> = {};
        alumnos.forEach(a => defaultAsistencia[a.id] = 'P');
        setAsistencia(defaultAsistencia);
      }
      setCargando(false);
    };
    fetchAsistencia();
  }, [idGrupo, fecha, alumnos]);

  const marcarEstado = (idAlumno: string, estado: AsistenciaEstado) => {
    setAsistencia(prev => ({ ...prev, [idAlumno]: estado }));
  };

  const guardarEnNube = async () => {
    setGuardando(true);
    try {
      await setDoc(doc(db, `groups/${idGrupo}/attendance`, fecha), {
        records: asistencia,
        updatedAt: serverTimestamp()
      });
      alert('¡Asistencia guardada en la nube!');
    } catch (error) {
      console.error(error);
      alert('Error al guardar. Revisa tu conexión.');
    }
    setGuardando(false);
  };

  const presentes = Object.values(asistencia).filter(e => e === 'P').length;
  const retardos = Object.values(asistencia).filter(e => e === 'R').length;
  const faltas = Object.values(asistencia).filter(e => e === 'F').length;
  const justificados = Object.values(asistencia).filter(e => e === 'J').length;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Fecha de Pase de Lista</label>
          <TutorialTooltip mensaje="Elige la fecha exacta de tu clase para revisar historiales pasados.">
            <input type="date" className="search-input" value={fecha} onChange={e => setFecha(e.target.value)} style={{ width: 'auto', color: 'var(--text-main)', cursor: 'pointer' }} />
          </TutorialTooltip>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}><span style={{ color: 'var(--accent-green)', fontWeight: 'bold', fontSize: '1.2rem' }}>{presentes}</span><p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Asisten</p></div>
          <div style={{ textAlign: 'center' }}><span style={{ color: 'var(--accent-yellow)', fontWeight: 'bold', fontSize: '1.2rem' }}>{retardos}</span><p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Retardos</p></div>
          <div style={{ textAlign: 'center' }}><span style={{ color: 'var(--accent-red)', fontWeight: 'bold', fontSize: '1.2rem' }}>{faltas}</span><p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Faltas</p></div>
          <div style={{ textAlign: 'center' }}><span style={{ color: 'var(--accent-blue)', fontWeight: 'bold', fontSize: '1.2rem' }}>{justificados}</span><p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Justificados</p></div>
        </div>
        
        <TutorialTooltip mensaje="Guarda la asistencia en Firebase para sincronizarla en tus dispositivos.">
          <button onClick={guardarEnNube} disabled={guardando} className="pill-btn" style={{ backgroundColor: 'var(--accent-blue)', color: 'white', padding: '0.8rem 2rem' }}>{guardando ? 'Guardando...' : '☁️ Guardar Asistencia'}</button>
        </TutorialTooltip>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {cargando ? <div className="loader"></div> : alumnos.map((alumno) => (
          <div key={alumno.id} className="student-item" style={{ borderLeft: `4px solid ${asistencia[alumno.id] === 'P' ? 'var(--accent-green)' : asistencia[alumno.id] === 'R' ? 'var(--accent-yellow)' : asistencia[alumno.id] === 'J' ? 'var(--accent-blue)' : 'var(--accent-red)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600, width: '25px' }}>{alumno.studentNumber.toString().padStart(2, '0')}</span>
              <span style={{ fontWeight: 500 }}>{alumno.fullName}</span>
            </div>
            
            <TutorialTooltip mensaje="Asigna: P (Presente), R (Retardo), J (Justificado), F (Falta)">
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => marcarEstado(alumno.id, 'P')} className={`attendance-btn presente ${asistencia[alumno.id] === 'P' ? 'active' : ''}`} title="Presente">P</button>
                <button onClick={() => marcarEstado(alumno.id, 'R')} className={`attendance-btn retardo ${asistencia[alumno.id] === 'R' ? 'active' : ''}`} title="Retardo">R</button>
                <button onClick={() => marcarEstado(alumno.id, 'J')} className={`attendance-btn justificado ${asistencia[alumno.id] === 'J' ? 'active' : ''}`} title="Justificado">J</button>
                <button onClick={() => marcarEstado(alumno.id, 'F')} className={`attendance-btn falta ${asistencia[alumno.id] === 'F' ? 'active' : ''}`} title="Falta">F</button>
              </div>
            </TutorialTooltip>
          </div>
        ))}
      </div>
    </div>
  );
}