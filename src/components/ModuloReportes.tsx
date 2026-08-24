import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import ReporteAcademico from './ReporteAcademico';
import ReporteAsistencia from './ReporteAsistencia';
import ReporteConductual from './ReporteConductual';
import TutorialTooltip from './TutorialTooltip';

interface Grupo { 
  id: string; 
  name: string; 
  subject: string; 
  schoolYear?: string; 
  emphasis?: string; 
  docenteEmail?: string;
  createdAt?: any;
}

export default function ModuloReportes({ onVolver, setGuiaConductual }: { onVolver: () => void, setGuiaConductual: (v: boolean) => void }) {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<string>('');
  
  const [tipoReporte, setTipoReporte] = useState<'menu' | 'academico' | 'asistencia' | 'conductual'>('menu');

  useEffect(() => {
    const sessionLocal = localStorage.getItem('aulaPlusSession');
    const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
    const userEmail = sessionData?.user?.email || sessionData?.email || '';

    const q = query(collection(db, 'groups'), where('docenteEmail', '==', userEmail));
    
    const desuscribir = onSnapshot(q, (snapshot) => {
      const lista: Grupo[] = [];
      snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() } as Grupo));
      lista.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setGrupos(lista);
    });
    return () => desuscribir();
  }, []);

  const grupoActual = grupos.find(g => g.id === grupoSeleccionado);
  const haySeleccion = grupoSeleccionado !== '';

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      
      <style>{`
        .report-card {
          transition: all 0.3s ease;
          border-top: 5px solid var(--card-color);
          background-color: var(--bg-panel);
          border-radius: 20px;
          padding: 2rem;
          border-left: 1px solid var(--border-color);
          border-right: 1px solid var(--border-color);
          border-bottom: 1px solid var(--border-color);
          position: relative;
        }
        .report-card.active-hover:hover {
          transform: translateY(-5px) scale(1.02);
          box-shadow: 0 12px 25px var(--glow-color);
          border-left-color: transparent;
          border-right-color: transparent;
          border-bottom-color: transparent;
          z-index: 10;
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', backgroundColor: 'var(--bg-panel)', padding: '1.5rem 2rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
        <div>
          <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginBottom: '1rem', padding: '0.3rem 0.8rem' }}>← Volver al Dashboard</button>
          <h3 style={{ margin: 0, fontWeight: 800, fontSize: '2rem', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>Centro de Análisis y Reportes</h3>
          <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0 0', fontSize: '1.05rem' }}>Estadísticas de rendimiento, asistencia diaria e incidencias conductuales</p>
        </div>

        {tipoReporte === 'menu' && grupos.length > 0 && (
          <TutorialTooltip mensaje="Paso 1: Elige el grupo que deseas analizar para desbloquear las tarjetas." posicion="left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: haySeleccion ? 'rgba(28, 81, 255, 0.05)' : 'var(--bg-input)', padding: '0.8rem 1.5rem', borderRadius: '16px', border: haySeleccion ? '2px solid var(--accent-blue)' : '2px solid var(--border-color)', transition: 'all 0.3s' }}>
              <label style={{ fontSize: '1rem', color: haySeleccion ? 'var(--accent-blue)' : 'var(--text-muted)', fontWeight: 'bold' }}>📂 Analizando Grupo:</label>
              <select className="search-input" value={grupoSeleccionado} onChange={e => setGrupoSeleccionado(e.target.value)} style={{ width: 'auto', border: 'none', backgroundColor: 'transparent', fontWeight: 'bold', color: haySeleccion ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', outline: 'none' }}>
                <option value="">-- Selecciona un grupo --</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.name} - {g.subject}</option>)}
              </select>
            </div>
          </TutorialTooltip>
        )}
      </div>

      {grupos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'var(--bg-panel)', borderRadius: '24px', border: '2px dashed var(--border-color)' }}>
          <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>📭</span>
          <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>No tienes grupos registrados</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Crea tu primer grupo en el módulo de "Gestión y Asistencia" para habilitar los reportes analíticos.</p>
        </div>
      ) : (
        <>
          {tipoReporte === 'menu' && (
            <div>
              {!haySeleccion && (
                <div style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)', border: '1px solid var(--accent-yellow)', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem', textAlign: 'center', color: '#b28000', fontWeight: 'bold', fontSize: '1.1rem', animation: 'pulseGlow 2s infinite' }}>
                  👆 Selecciona un grupo en el menú superior para desbloquear los reportes.
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', opacity: haySeleccion ? 1 : 0.4, pointerEvents: haySeleccion ? 'auto' : 'none', transition: 'all 0.3s' }}>
                
                <TutorialTooltip mensaje="Genera promedios y descarga el Kardex de calificaciones (PDF/Word) por alumno." esBloque={true} posicion="top">
                  <div className={`report-card ${haySeleccion ? 'active-hover' : ''}`} onClick={() => haySeleccion && setTipoReporte('academico')} style={{ '--card-color': 'var(--accent-blue)', '--glow-color': 'rgba(28, 81, 255, 0.2)', cursor: haySeleccion ? 'pointer' : 'not-allowed' } as React.CSSProperties}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', color: 'var(--text-main)' }}>Rendimiento Académico</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0, lineHeight: '1.5' }}>Descarga el <b>Kardex de calificaciones</b> en formato PDF/Word y detecta cuellos de botella en la entrega de tareas.</p>
                  </div>
                </TutorialTooltip>
                
                <TutorialTooltip mensaje="Detecta alumnos con ausentismo crítico e imprime citatorios automáticos o historiales de asistencia mensual." esBloque={true} posicion="top">
                  <div className={`report-card ${haySeleccion ? 'active-hover' : ''}`} onClick={() => haySeleccion && setTipoReporte('asistencia')} style={{ '--card-color': 'var(--accent-green)', '--glow-color': 'rgba(46, 229, 92, 0.2)', cursor: haySeleccion ? 'pointer' : 'not-allowed' } as React.CSSProperties}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', color: 'var(--text-main)' }}>Estadísticas de Asistencia</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0, lineHeight: '1.5' }}>Visualiza porcentajes de ausentismo y exporta <b>Citatorios</b> por faltas acumuladas o el historial mensual.</p>
                  </div>
                </TutorialTooltip>

                <TutorialTooltip mensaje="Lleva un registro de hechos con valor legal de las faltas al reglamento escolar." esBloque={true} posicion="top">
                  <div className={`report-card ${haySeleccion ? 'active-hover' : ''}`} onClick={() => haySeleccion && setTipoReporte('conductual')} style={{ '--card-color': 'var(--accent-yellow)', '--glow-color': 'rgba(255, 193, 7, 0.2)', cursor: haySeleccion ? 'pointer' : 'not-allowed' } as React.CSSProperties}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', color: 'var(--text-main)' }}>Bitácora Conductual</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0, lineHeight: '1.5' }}>Redacta y exporta <b>Actas de Incidencia</b> formales para firmar acuerdos con padres de familia o trabajo social.</p>
                  </div>
                </TutorialTooltip>
              </div>
            </div>
          )}

          {tipoReporte === 'academico' && grupoActual && <ReporteAcademico idGrupo={grupoActual.id} grupo={grupoActual} onVolver={() => setTipoReporte('menu')} />}
          {tipoReporte === 'asistencia' && grupoActual && <ReporteAsistencia idGrupo={grupoActual.id} grupo={grupoActual} onVolver={() => setTipoReporte('menu')} />}
          
          {tipoReporte === 'conductual' && grupoActual && (
            <ReporteConductual 
              idGrupo={grupoActual.id} 
              grupo={grupoActual} 
              onVolver={() => setTipoReporte('menu')} 
              setGuiaConductual={setGuiaConductual} 
            />
          )}
        </>
      )}
    </div>
  );
}