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
    // 1. Obtener el correo del maestro activo
    const sessionLocal = localStorage.getItem('aulaPlusSession');
    const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
    const userEmail = sessionData?.user?.email || sessionData?.email || '';

    // 2. Consulta a Firebase: Traer SOLO los grupos de este maestro
    const q = query(collection(db, 'groups'), where('docenteEmail', '==', userEmail));
    
    const desuscribir = onSnapshot(q, (snapshot) => {
      const lista: Grupo[] = [];
      snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() } as Grupo));
      
      // Ordenar localmente para evitar errores de índices en Firebase
      lista.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      
      setGrupos(lista);
    });
    return () => desuscribir();
  }, []);

  // Encontrar el grupo actual correctamente sin errores de TypeScript
  const grupoActual = grupos.find(g => g.id === grupoSeleccionado);
  const haySeleccion = grupoSeleccionado !== '';

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'var(--bg-panel)', padding: '0.5rem 1rem', borderRadius: '12px', border: haySeleccion ? '2px solid var(--accent-blue)' : '2px solid var(--accent-red)' }}>
              <label style={{ fontSize: '0.9rem', color: haySeleccion ? 'var(--text-main)' : 'var(--accent-red)', fontWeight: 'bold' }}>📂 Analizando Grupo:</label>
              <select className="search-input" value={grupoSeleccionado} onChange={e => setGrupoSeleccionado(e.target.value)} style={{ width: 'auto', border: 'none', backgroundColor: 'var(--bg-input)', fontWeight: 'bold', color: 'var(--accent-blue)' }}>
                <option value="">-- Selecciona un grupo --</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.name} - {g.subject}</option>)}
              </select>
            </div>
          </TutorialTooltip>
        )}
      </div>

      {grupos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '1rem' }}>No tienes grupos registrados en este momento.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Crea tu primer grupo en el módulo "Grupos" para habilitar los reportes analíticos.</p>
        </div>
      ) : (
        <>
          {tipoReporte === 'menu' && (
            <div>
              {!haySeleccion && (
                <div style={{ backgroundColor: 'rgba(255, 77, 79, 0.1)', border: '1px solid var(--accent-red)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', textAlign: 'center', color: 'var(--accent-red)', fontWeight: 'bold' }}>
                  ⚠️ Selecciona un grupo en el menú desplegable superior para habilitar los reportes.
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '1rem', opacity: haySeleccion ? 1 : 0.4, pointerEvents: haySeleccion ? 'auto' : 'none', transition: 'all 0.3s' }}>
                
                <TutorialTooltip mensaje="Descubre qué actividades tienen menor entrega (cuellos de botella) y revisa el kardex individual." esBloque={true} posicion="top">
                  <div className="group-card" onClick={() => haySeleccion && setTipoReporte('academico')} style={{ '--card-color': 'var(--accent-blue)', cursor: haySeleccion ? 'pointer' : 'not-allowed' } as any}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📊</div>
                    <h4 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-main)' }}>Avance Académico</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Genera reportes de calificaciones por trimestre y promedios.</p>
                  </div>
                </TutorialTooltip>
                
                <TutorialTooltip mensaje="Detecta alumnos con ausentismo crítico e imprime citatorios automáticos." esBloque={true} posicion="top">
                  <div className="group-card" onClick={() => haySeleccion && setTipoReporte('asistencia')} style={{ '--card-color': 'var(--accent-green)', cursor: haySeleccion ? 'pointer' : 'not-allowed' } as any}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📅</div>
                    <h4 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-main)' }}>Estadísticas de Asistencia</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Porcentajes de ausentismo e historial detallado.</p>
                  </div>
                </TutorialTooltip>

                <TutorialTooltip mensaje="Lleva un registro con valor legal de las faltas al reglamento escolar." esBloque={true} posicion="top">
                  <div className="group-card" onClick={() => haySeleccion && setTipoReporte('conductual')} style={{ '--card-color': 'var(--accent-yellow)', cursor: haySeleccion ? 'pointer' : 'not-allowed' } as any}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚠️</div>
                    <h4 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-main)' }}>Bitácora Conductual</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Registra incidencias, citatorios y acuerdos formales.</p>
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