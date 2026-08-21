import { useState, useEffect } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

export default function PerfilDocente({ onClose, obligarLlenado = false }: { onClose: () => void, obligarLlenado?: boolean }) {
  const [nombre, setNombre] = useState('');
  const [escuela, setEscuela] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [userEmail, setUserEmail] = useState('default');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const cargarPerfil = async () => {
      // 1. Saber quién está logueado
      const sessionLocal = localStorage.getItem('aulaPlusSession');
      let email = 'default';
      if (sessionLocal) {
        const sessionData = JSON.parse(sessionLocal);
        email = sessionData?.user?.email || sessionData?.email || 'default';
        setUserEmail(email);
      }

      // 2. Extraer SIEMPRE la versión más reciente de la nube (Firestore)
      try {
        const docRef = doc(db, 'teacher_settings', email);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().memoriaEscolar) {
          const p = docSnap.data().memoriaEscolar;
          setNombre(p.nombre || '');
          setEscuela(p.escuela || '');
          setUbicacion(p.ubicacion || '');
          
          // Mantenemos sincronizada la memoria local para la generación de reportes
          localStorage.setItem(`aulaPlusPerfil_${email}`, JSON.stringify(p));
        } else {
          // Si no hay nada en la nube (nuevo dispositivo), revisamos si por casualidad hay algo local
          const dataGuardada = localStorage.getItem(`aulaPlusPerfil_${email}`);
          if (dataGuardada) {
            const p = JSON.parse(dataGuardada);
            setNombre(p.nombre); setEscuela(p.escuela); setUbicacion(p.ubicacion);
          }
        }
      } catch (error) {
        console.error("Error conectando con la nube:", error);
        // Respaldo en caso de mala conexión a internet
        const dataGuardada = localStorage.getItem(`aulaPlusPerfil_${email}`);
        if (dataGuardada) {
          const p = JSON.parse(dataGuardada);
          setNombre(p.nombre); setEscuela(p.escuela); setUbicacion(p.ubicacion);
        }
      }
    };

    cargarPerfil();
  }, []);

  const guardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const datosPerfil = { nombre, escuela, ubicacion };

      // Guardar en la nube (Firestore) para persistencia en cualquier dispositivo
      await setDoc(doc(db, 'teacher_settings', userEmail), {
        memoriaEscolar: datosPerfil
      }, { merge: true });

      // Guardar localmente para que los botones de PDF reaccionen al instante
      localStorage.setItem(`aulaPlusPerfil_${userEmail}`, JSON.stringify(datosPerfil));
      
      alert('¡Perfil actualizado con éxito!');
      onClose();
    } catch (error) {
      console.error("Error al guardar perfil:", error);
      alert("Hubo un error al guardar tu perfil. Revisa tu conexión.");
    }
    setGuardando(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ animation: 'fadeIn 0.2s' }}>
        <h3 style={{ marginTop: 0, fontSize: '1.4rem', color: 'var(--accent-blue)' }}>Perfil del Docente</h3>
        
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--accent-blue)', color: 'white', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
            {userEmail.charAt(0).toUpperCase()}
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Cuenta vinculada:</span>
            <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>{userEmail}</strong>
          </div>
        </div>

        {obligarLlenado ? (
          <p style={{ color: 'var(--accent-red)', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
            ⚠️ Configuración Inicial Obligatoria: Por favor, completa los datos de tu escuela para poder generar reportes oficiales y desbloquear el Dashboard.
          </p>
        ) : (
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Estos datos se usarán para generar los encabezados oficiales de tus reportes en Word y Excel.
          </p>
        )}
        
        <form onSubmit={guardarPerfil} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nombre del Docente</label>
            <input type="text" className="search-input" value={nombre} onChange={e => setNombre(e.target.value)} required disabled={guardando} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nombre de la Institución</label>
            <input type="text" className="search-input" value={escuela} onChange={e => setEscuela(e.target.value)} required disabled={guardando} />
          </div>
          
          <TutorialTooltip mensaje="Esta ubicación aparecerá en los encabezados y reportes legales generados." esBloque={true} posicion="top">
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ubicación</label>
              <input type="text" className="search-input" value={ubicacion} onChange={e => setUbicacion(e.target.value)} required style={{ margin: 0, width: '100%' }} disabled={guardando} />
            </div>
          </TutorialTooltip>
          
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" disabled={guardando} className="pill-btn" style={{ flex: 1, backgroundColor: 'var(--accent-blue)', color: 'white' }}>
              {guardando ? 'Guardando...' : obligarLlenado ? 'Guardar y Desbloquear' : 'Guardar'}
            </button>
            {!obligarLlenado && (
              <button type="button" disabled={guardando} onClick={onClose} className="pill-btn" style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>Cerrar</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}