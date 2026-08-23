import { useState } from 'react';
import TabAlumnos from './TabAlumnos';
import TabAsistencia from './TabAsistencia';

export default function VistaGrupo({ idGrupo, nombreGrupo, tabInicial = 'alumnos', onVolver, onVarkChange }: { idGrupo: string, nombreGrupo: string, tabInicial?: 'alumnos' | 'asistencia', onVolver: () => void, onVarkChange: (data: any) => void }) {
  
  const [tabActiva, setTabActiva] = useState<'alumnos' | 'asistencia'>(tabInicial);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginBottom: '1rem', padding: '0.3rem 0.8rem' }}>
            ← Volver a Grupos
          </button>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: '1.8rem' }}>Grupo {nombreGrupo}</h3>
        </div>
      </div>

      <div className="tabs-nav" style={{ marginBottom: '1.5rem' }}>
        <span className={`tab ${tabActiva === 'alumnos' ? 'active' : ''}`} onClick={() => setTabActiva('alumnos')}>
          👥 Gestión y VARK
        </span>
        <span className={`tab ${tabActiva === 'asistencia' ? 'active' : ''}`} onClick={() => setTabActiva('asistencia')}>
          📅 Pase de Lista Oficial
        </span>
      </div>

      {tabActiva === 'alumnos' && <TabAlumnos idGrupo={idGrupo} nombreGrupo={nombreGrupo} onVarkChange={onVarkChange} />}
      {tabActiva === 'asistencia' && <TabAsistencia idGrupo={idGrupo} grupo={{name: nombreGrupo}} onVolver={onVolver} />}
      
    </div>
  );
}