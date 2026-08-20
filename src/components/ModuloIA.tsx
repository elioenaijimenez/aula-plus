import { useState } from 'react';
import ChatIA from './ChatIA';
import PlaneadorDidactico from './PlaneadorDidactico';

export default function ModuloIA({ onVolver }: { onVolver?: () => void }) {
  const [vistaActiva, setVistaActiva] = useState<'consultas' | 'planeacion'>('consultas');

  return (
    <div style={{ animation: 'fadeIn 0.3s', height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          {onVolver && <button onClick={onVolver} className="pill-btn" style={{ marginBottom: '1rem', background: 'var(--bg-input)', color: 'var(--text-muted)' }}>← Volver al Inicio</button>}
          <h2 style={{ margin: 0, color: 'var(--accent-purple)', fontSize: '1.8rem' }}>🤖 Asistente Pedagógico con IA</h2>
          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)' }}>Consultas rápidas y generación de planeaciones en formato oficial.</p>
        </div>
      </div>

      <div className="tabs-nav" style={{ marginBottom: '1.5rem' }}>
        <span className={`tab ${vistaActiva === 'consultas' ? 'active' : ''}`} onClick={() => setVistaActiva('consultas')}>💬 Consultas IA</span>
        <span className={`tab ${vistaActiva === 'planeacion' ? 'active' : ''}`} onClick={() => setVistaActiva('planeacion')}>📄 Planeación con IA</span>
      </div>

      <div style={{ flex: 1 }}>
        {vistaActiva === 'consultas' && <ChatIA />}
        {vistaActiva === 'planeacion' && <PlaneadorDidactico />}
      </div>

    </div>
  );
}