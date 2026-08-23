import { useState } from 'react';
import GestorBibliotecaGlobal from '../components/GestorBibliotecaGlobal';
import GestorLlaves from '../components/GestorLlaves';
import GestorCalendarioAdmin from '../components/GestorCalendarioAdmin';

export default function SuperAdmin({ onLogout, onSwitchView }: { onLogout: () => void, onSwitchView?: () => void }) {
  const [tabActiva, setTabActiva] = useState<'llaves' | 'biblioteca' | 'calendario'>('llaves');

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', animation: 'fadeIn 0.3s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--accent-red)' }}>👑 Panel SuperAdmin</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Gestión maestra del sistema Aula+</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {onSwitchView && <button onClick={onSwitchView} className="pill-btn" style={{ background: 'var(--accent-blue)', color: 'white' }}>👨‍🏫 Vista Docente</button>}
          <button onClick={onLogout} className="pill-btn" style={{ border: '1px solid var(--accent-red)', color: 'var(--accent-red)', background: 'transparent' }}>Cerrar Sesión Segura</button>
        </div>
      </div>

      <div className="tabs-nav" style={{ marginBottom: '2rem', overflowX: 'auto', display: 'flex', flexWrap: 'nowrap', paddingBottom: '5px' }}>
        <span className={`tab ${tabActiva === 'calendario' ? 'active' : ''}`} onClick={() => setTabActiva('calendario')} style={{ whiteSpace: 'nowrap' }}>📅 Calendario Oficial</span>
        <span className={`tab ${tabActiva === 'llaves' ? 'active' : ''}`} onClick={() => setTabActiva('llaves')} style={{ whiteSpace: 'nowrap' }}>🔑 Gestor de KeyPlus</span>
        <span className={`tab ${tabActiva === 'biblioteca' ? 'active' : ''}`} onClick={() => setTabActiva('biblioteca')} style={{ whiteSpace: 'nowrap' }}>📚 Gestión de Biblioteca Global</span>
      </div>

      {tabActiva === 'calendario' && <GestorCalendarioAdmin />}
      {tabActiva === 'llaves' && <GestorLlaves />}
      {tabActiva === 'biblioteca' && <GestorBibliotecaGlobal />}
      
    </div>
  );
}