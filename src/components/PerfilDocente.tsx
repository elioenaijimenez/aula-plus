import { useState, useEffect } from 'react';
import TutorialTooltip from './TutorialTooltip';

export default function PerfilDocente({ onClose }: { onClose: () => void }) {
  const [nombre, setNombre] = useState('');
  const [escuela, setEscuela] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [userEmail, setUserEmail] = useState('default');

  useEffect(() => {
    // 1. Saber quién está logueado
    const sessionLocal = localStorage.getItem('aulaPlusSession');
    let email = 'default';
    if (sessionLocal) {
      const sessionData = JSON.parse(sessionLocal);
      email = sessionData?.user?.email || 'default';
      setUserEmail(email);
    }

    // 2. Buscar si ESTE usuario en específico ya guardó datos
    const dataGuardada = localStorage.getItem(`aulaPlusPerfil_${email}`);
    if (dataGuardada) {
      const p = JSON.parse(dataGuardada);
      setNombre(p.nombre); setEscuela(p.escuela); setUbicacion(p.ubicacion);
    }
  }, []);

  const guardarPerfil = (e: React.FormEvent) => {
    e.preventDefault();
    // Guardar específicamente para el correo del maestro activo
    localStorage.setItem(`aulaPlusPerfil_${userEmail}`, JSON.stringify({ nombre, escuela, ubicacion }));
    alert('¡Perfil actualizado con éxito!');
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ animation: 'fadeIn 0.2s' }}>
        <h3 style={{ marginTop: 0, fontSize: '1.4rem', color: 'var(--accent-blue)' }}>Perfil del Docente</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Estos datos se usarán para generar los encabezados oficiales de tus reportes en Word y Excel.</p>
        
        <form onSubmit={guardarPerfil} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nombre del Docente</label>
            <input type="text" className="search-input" value={nombre} onChange={e => setNombre(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nombre de la Institución</label>
            <input type="text" className="search-input" value={escuela} onChange={e => setEscuela(e.target.value)} required />
          </div>
          
          <TutorialTooltip mensaje="Esta ubicación aparecerá en los encabezados y reportes legales generados." esBloque={true} posicion="top">
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ubicación</label>
              <input type="text" className="search-input" value={ubicacion} onChange={e => setUbicacion(e.target.value)} required style={{ margin: 0, width: '100%' }} />
            </div>
          </TutorialTooltip>
          
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" className="pill-btn" style={{ flex: 1, backgroundColor: 'var(--accent-blue)', color: 'white' }}>Guardar</button>
            <button type="button" onClick={onClose} className="pill-btn" style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>Cerrar</button>
          </div>
        </form>
      </div>
    </div>
  );
}