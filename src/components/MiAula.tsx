import React, { useState, useEffect } from 'react';
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
      <style>{`
        .switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0;}
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .3s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--accent-green); }
        input:checked + .slider:before { transform: translateX(18px); }
        .biblioteca-card { transition: all 0.3s ease; border: 1px solid var(--border-color); }
        .biblioteca-card:hover { box-shadow: 0 4px 20px var(--glow-color-shadow); border-color: var(--glow-color-border); transform: translateY(-3px); }
      `}</style>

      {/* HEADER MI AULA */}
      <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button onClick={onVolver} className="pill-btn" style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginBottom: '1rem', padding: '0.3rem 0.8rem' }}>← Salir del Aula</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '2.5rem' }}>🎓</span>
            <div><h2 style={{ margin: 0, color: 'var(--accent-purple)', fontSize: '2rem' }}>Mi Aula Virtual</h2><p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '1rem' }}>Grupo {nombreGrupo}</p></div>
          </div>
        </div>
        <div style={{ textAlign: 'right', backgroundColor: 'rgba(28, 81, 255, 0.05)', padding: '1rem', borderRadius: '16px', border: '1px dashed var(--accent-blue)' }}>
          <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Clave de Acceso Alumnos:</span>
          <strong style={{ fontSize: '1.5rem', color: 'var(--accent-blue)', letterSpacing: '2px' }}>{pizarraCode}</strong>
        </div>
      </div>

      {/* TABS DE NAVEGACIÓN */}
      <div className="tabs-nav" style={{ marginBottom: '2rem' }}>
        <span className={`tab ${tab === 'actividades' ? 'active' : ''}`} onClick={() => setTab('actividades')} style={{ borderBottomColor: tab === 'actividades' ? 'var(--accent-purple)' : '' }}>📋 Gestor de Actividades</span>
        <span className={`tab ${tab === 'biblioteca' ? 'active' : ''}`} onClick={() => setTab('biblioteca')} style={{ borderBottomColor: tab === 'biblioteca' ? 'var(--accent-purple)' : '' }}>⭐ Biblioteca Favoritos</span>
        <span className={`tab ${tab === 'drive' ? 'active' : ''}`} onClick={() => setTab('drive')} style={{ borderBottomColor: tab === 'drive' ? 'var(--accent-purple)' : '' }}>📁 Mi Nube Drive</span>
      </div>

      {/* RENDERIZADO DE COMPONENTES HIJOS */}
      {tab === 'actividades' && <TabGestorActividades idGrupo={idGrupo} />}
      
      {(tab === 'biblioteca' || tab === 'drive') && (
        <TabBibliotecaNube userEmail={userEmail} tabActiva={tab} />
      )}
      
    </div>
  );
}