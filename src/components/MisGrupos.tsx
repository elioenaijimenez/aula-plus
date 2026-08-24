import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

// AÑADIDO: Propiedad onEditarGrupo para mandar los datos al formulario
export default function MisGrupos({ 
  onCrearGrupo, 
  onAbrirGrupo, 
  onEditarGrupo, 
  modoAula = false 
}: { 
  onCrearGrupo: () => void, 
  onAbrirGrupo: (id: string, nombre: string, tab: 'alumnos' | 'asistencia' | 'evidencias') => void, 
  onEditarGrupo?: (grupo: any) => void,
  modoAula?: boolean 
}) {
  const [grupos, setGrupos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const sessionLocal = localStorage.getItem('aulaPlusSession');
    const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
    const userEmail = sessionData?.user?.email || sessionData?.email || '';

    const q = query(collection(db, 'groups'), where('docenteEmail', '==', userEmail));
    
    const desuscribir = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      lista.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setGrupos(lista);
      setCargando(false);
    });
    return () => desuscribir();
  }, []);

  const eliminarGrupo = async (id: string, nombre: string) => {
    if (window.confirm(`¿Estás seguro de eliminar el grupo ${nombre} de forma permanente?`)) {
      await deleteDoc(doc(db, 'groups', id));
    }
  };

  const obtenerColorGrado = (nombre: string) => {
    if (nombre.startsWith('1')) return 'var(--accent-green)';
    if (nombre.startsWith('2')) return 'var(--accent-blue)';
    if (nombre.startsWith('3')) return 'var(--accent-red)';
    return 'var(--accent-blue)';
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>{modoAula ? 'Selecciona un aula virtual' : 'Tus Grupos Registrados'}</h2>
        {!modoAula && (
          <button onClick={onCrearGrupo} className="pill-btn" style={{ background: 'var(--accent-blue)', color: 'white' }}>+ Nuevo Grupo</button>
        )}
      </div>

      {cargando ? <div className="loader"></div> : grupos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No tienes grupos registrados.</div>
      ) : (
        <div className="group-grid">
          {grupos.map(g => {
            const colorGrado = obtenerColorGrado(g.name);
            const tituloCompleto = g.emphasis ? `${g.name} - ${g.subject} (${g.emphasis})` : `${g.name} - ${g.subject}`;

            return (
              <div key={g.id} className="group-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', '--card-color': modoAula ? 'var(--accent-purple)' : colorGrado } as React.CSSProperties}>
                
                <div 
                  style={{ flex: 1, cursor: 'pointer', paddingBottom: modoAula ? '0' : '1rem' }} 
                  onClick={() => onAbrirGrupo(g.id, tituloCompleto, 'alumnos')}
                >
                  <h3 style={{ color: modoAula ? 'var(--accent-purple)' : colorGrado, margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>{g.name}</h3>
                  <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>
                    {g.subject} {g.emphasis && <span style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}><br/>({g.emphasis})</span>}
                  </p>
                  <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{g.schoolYear}</p>
                </div>
                
                {!modoAula && (
                  <div style={{ display: 'flex', gap: '0.8rem', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', width: '100%' }}>
                    <button onClick={(e) => { e.stopPropagation(); onAbrirGrupo(g.id, tituloCompleto, 'asistencia'); }} className="pill-btn" style={{ flex: 1, background: colorGrado, color: colorGrado === 'var(--accent-green)' ? '#000' : 'white' }}>
                      📅 Asistencia
                    </button>
                    {/* BOTÓN EDITAR HABILITADO */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); if (onEditarGrupo) onEditarGrupo(g); }} 
                      className="pill-btn" 
                      style={{ background: 'var(--bg-input)', color: 'var(--text-main)' }} 
                      title="Editar Grupo"
                    >
                      ✏️
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); eliminarGrupo(g.id, g.name); }} className="pill-btn" style={{ background: 'var(--accent-red)', color: 'white' }} title="Eliminar Grupo">🗑️</button>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}