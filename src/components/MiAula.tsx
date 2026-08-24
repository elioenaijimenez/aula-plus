import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import TabGestorActividades from './TabGestorActividades';
import TabBibliotecaNube from './TabBibliotecaNube';

export default function MiAula({ idGrupo, nombreGrupo, onVolver }: { idGrupo: string, nombreGrupo: string, onVolver: () => void }) {
  const [tab, setTab] = useState<'actividades' | 'biblioteca' | 'drive'>('actividades');
  const [pizarraCode, setPizarraCode] = useState<string>('Generando...');
  
  const [userEmail] = useState(() => {
    const sessionLocal = localStorage.getItem('aulaPlusSession');
    return sessionLocal ? (JSON.parse(sessionLocal)?.user?.email || JSON.parse(sessionLocal)?.email || '') : '';
  });

  useEffect(() => {
    const inicializarPizarra = async () => {
      const refGrupo = doc(db, 'groups', idGrupo);
      const docSnap = await getDoc(refGrupo);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.pizarraCode) setPizarraCode(data.pizarraCode);
        else {
          const newCode = 'AULA-' + Math.random().toString(36).substring(2, 6).toUpperCase();
          await updateDoc(refGrupo, { pizarraCode: newCode });
          setPizarraCode(newCode);
        }
      }
    };
    inicializarPizarra();
  }, [idGrupo]);

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      
      {/* HEADER MI AULA PREMIUM */}
      <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
        <div>
          <button onClick={onVolver} className="pill-btn" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginBottom: '1rem', padding: '0.4rem 1rem', fontWeight: 'bold', transition: 'all 0.2s' }}>
            ← Salir del Aula
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
            <div style={{ fontSize: '3rem', backgroundColor: 'rgba(156, 39, 176, 0.1)', width: '70px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>
              🎓
            </div>
            <div>
              <h2 style={{ margin: 0, color: 'var(--accent-purple)', fontSize: '2.2rem', letterSpacing: '-0.5px' }}>Mi Aula Virtual</h2>
              <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '1.1rem', fontWeight: '500' }}>Grupo {nombreGrupo}</p>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', backgroundColor: 'rgba(28, 81, 255, 0.05)', padding: '1.2rem 1.5rem', borderRadius: '16px', border: '2px dashed var(--accent-blue)', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '200px' }}>
          <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.3rem', fontWeight: 'bold' }}>Clave de Acceso Alumnos:</span>
          <strong style={{ fontSize: '1.8rem', color: 'var(--accent-blue)', letterSpacing: '3px' }}>{pizarraCode}</strong>
        </div>
      </div>

      {/* TABS DE NAVEGACIÓN ESTILO BOTONES (PILLS) */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setTab('actividades')} 
          className="pill-btn hover-opacity" 
          style={{ 
            flex: 1, minWidth: '200px', padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold', 
            border: tab === 'actividades' ? 'none' : '1px solid var(--border-color)', 
            backgroundColor: tab === 'actividades' ? 'var(--accent-purple)' : 'var(--bg-panel)', 
            color: tab === 'actividades' ? 'white' : 'var(--text-muted)', 
            boxShadow: tab === 'actividades' ? '0 4px 15px rgba(156, 39, 176, 0.3)' : 'none', 
            transition: 'all 0.2s' 
          }}
        >
          📋 Gestor de Actividades
        </button>
        
        <button 
          onClick={() => setTab('biblioteca')} 
          className="pill-btn hover-opacity" 
          style={{ 
            flex: 1, minWidth: '200px', padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold', 
            border: tab === 'biblioteca' ? 'none' : '1px solid var(--border-color)', 
            backgroundColor: tab === 'biblioteca' ? '#FFC107' : 'var(--bg-panel)', 
            color: tab === 'biblioteca' ? '#000' : 'var(--text-muted)', 
            boxShadow: tab === 'biblioteca' ? '0 4px 15px rgba(255, 193, 7, 0.3)' : 'none', 
            transition: 'all 0.2s' 
          }}
        >
          ⭐ Biblioteca Favoritos
        </button>

        <button 
          onClick={() => setTab('drive')} 
          className="pill-btn hover-opacity" 
          style={{ 
            flex: 1, minWidth: '200px', padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold', 
            border: tab === 'drive' ? 'none' : '1px solid var(--border-color)', 
            backgroundColor: tab === 'drive' ? '#185ABD' : 'var(--bg-panel)', 
            color: tab === 'drive' ? 'white' : 'var(--text-muted)', 
            boxShadow: tab === 'drive' ? '0 4px 15px rgba(24, 90, 189, 0.3)' : 'none', 
            transition: 'all 0.2s' 
          }}
        >
          📂 Mi Nube Drive
        </button>
      </div>

      {/* RENDERIZADO DE COMPONENTES HIJOS */}
      <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
        {tab === 'actividades' && <TabGestorActividades idGrupo={idGrupo} />}
        
        {(tab === 'biblioteca' || tab === 'drive') && (
          <TabBibliotecaNube userEmail={userEmail} tabActiva={tab} />
        )}
      </div>
      
    </div>
  );
}