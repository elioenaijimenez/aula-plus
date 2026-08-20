import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import ReporteAcademico from './ReporteAcademico';
import ReporteAsistencia from './ReporteAsistencia';
import ReporteConductual from './ReporteConductual';
import TutorialTooltip from './TutorialTooltip';

interface Grupo { id: string; name: string; subject: string; schoolYear: string; emphasis?: string; }

export default function ModuloReportes({ onVolver, setGuiaConductual }: { onVolver: () => void, setGuiaConductual: (v: boolean) => void }) {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<string>('');
  
  const [tipoReporte, setTipoReporte] = useState<'menu' | 'academico' | 'asistencia' | 'conductual'>('menu');

  useEffect(() => {
    const q = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
    const desuscribir = onSnapshot(q, (snapshot) => {
      const lista: Grupo[] = [];
      snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() } as Grupo));
      setGrupos(lista);
      if (lista.length > 0 && !grupoSeleccionado) setGrupoSeleccionado(lista[0].id);
    });
    return () => desuscribir();
  }, [grupoSeleccionado]);

  const grupoActual = grupos.find(g => g.id === grupoSeleccionado);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginBottom: '1rem', padding: '0.3rem 0.8rem' }}>← Volver al Inicio</button>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: '1.8rem' }}>Centro de Análisis</h3>
          <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>Estadísticas, calificaciones e incidencias</p>
        </div>

        {tipoReporte === 'menu' && grupos.length > 0 && (
          <TutorialTooltip mensaje="Elige el grupo del que deseas analizar su rendimiento o asistencia." posicion="left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'var(--bg-panel)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Analizando Grupo:</label>
              <select className="search-input" value={grupoSeleccionado} onChange={e => setGrupoSeleccionado(e.target.value)} style={{ width: 'auto', border: 'none', backgroundColor: 'var(--bg-input)' }}>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.name} - {g.subject}</option>)}
              </select>
            </div>
          </TutorialTooltip>
        )}
      </div>

      {grupos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Debes crear grupos para ver reportes.</div>
      ) : (
        <>
          {tipoReporte === 'menu' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
              <TutorialTooltip mensaje="Descubre qué actividades tienen menor entrega (cuellos de botella) y revisa el kardex individual." esBloque={true} posicion="top">
                <div className="group-card" onClick={() => setTipoReporte('academico')} style={{ '--card-color': 'var(--accent-blue)' } as any}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📊</div>
                  <h4 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-main)' }}>Avance Académico</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Genera reportes de calificaciones por trimestre y promedios.</p>
                </div>
              </TutorialTooltip>
              
              <TutorialTooltip mensaje="Detecta alumnos con ausentismo crítico e imprime citatorios automáticos." esBloque={true} posicion="top">
                <div className="group-card" onClick={() => setTipoReporte('asistencia')} style={{ '--card-color': 'var(--accent-green)' } as any}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📅</div>
                  <h4 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-main)' }}>Estadísticas de Asistencia</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Porcentajes de ausentismo e historial detallado.</p>
                </div>
              </TutorialTooltip>

              <TutorialTooltip mensaje="Lleva un registro con valor legal de las faltas al reglamento escolar." esBloque={true} posicion="top">
                <div className="group-card" onClick={() => setTipoReporte('conductual')} style={{ '--card-color': 'var(--accent-yellow)' } as any}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚠️</div>
                  <h4 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-main)' }}>Bitácora Conductual</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Registra incidencias, citatorios y acuerdos formales.</p>
                </div>
              </TutorialTooltip>
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