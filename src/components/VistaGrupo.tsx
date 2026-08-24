import { useState, useEffect } from 'react';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import TabAlumnos from './TabAlumnos';
import TabAsistencia from './TabAsistencia';

export default function VistaGrupo({ idGrupo, nombreGrupo, tabInicial, onVolver, onVarkChange }: { idGrupo: string, nombreGrupo: string, tabInicial?: 'alumnos' | 'asistencia', onVolver: () => void, onVarkChange: (data: any) => void }) {
  
  const [tabActiva, setTabActiva] = useState<'alumnos' | 'asistencia'>('alumnos');
  const [cargando, setCargando] = useState(true);

  // MAGIA UX: Pestaña Inteligente. Si hay alumnos -> Asistencia. Si no -> Alumnos.
  useEffect(() => {
    const determinarTab = async () => {
      if (tabInicial) {
        setTabActiva(tabInicial);
        setCargando(false);
        return;
      }
      
      try {
        const q = query(collection(db, `groups/${idGrupo}/students`), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setTabActiva('asistencia'); // Ya tiene alumnos, va directo al pase de lista
        } else {
          setTabActiva('alumnos'); // Grupo vacío, va a gestión para agregarlos
        }
      } catch (e) {
        setTabActiva('alumnos');
      }
      setCargando(false);
    };
    determinarTab();
  }, [idGrupo, tabInicial]);

  if (cargando) return <div className="loader" style={{ marginTop: '3rem' }}></div>;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      
      {/* HEADER MEJORADO UX */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
        <div>
          <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginBottom: '0.8rem', padding: '0.3rem 0.8rem' }}>
            ← Volver a Grupos
          </button>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.8rem', color: 'var(--accent-blue)' }}>Grupo {nombreGrupo}</h3>
          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.95rem' }}>Gestión Oficial y Pase de Lista</p>
        </div>
      </div>

      <div className="tabs-nav" style={{ marginBottom: '1.5rem' }}>
        <span className={`tab ${tabActiva === 'asistencia' ? 'active' : ''}`} onClick={() => setTabActiva('asistencia')} style={{ borderBottomColor: tabActiva === 'asistencia' ? 'var(--accent-blue)' : '' }}>
          📅 Pase de Lista Diario
        </span>
        <span className={`tab ${tabActiva === 'alumnos' ? 'active' : ''}`} onClick={() => setTabActiva('alumnos')} style={{ borderBottomColor: tabActiva === 'alumnos' ? 'var(--accent-blue)' : '' }}>
          👥 Gestión de Alumnos y VARK
        </span>
      </div>

      {tabActiva === 'alumnos' && <TabAlumnos idGrupo={idGrupo} nombreGrupo={nombreGrupo} onVarkChange={onVarkChange} />}
      {tabActiva === 'asistencia' && <TabAsistencia idGrupo={idGrupo} />}
      
    </div>
  );
}