import { useState } from 'react';
import FormularioGrupo from '../components/FormularioGrupo';
import MisGrupos from '../components/MisGrupos';
import VistaGrupo from '../components/VistaGrupo';
import PerfilDocente from '../components/PerfilDocente';
import ModuloReportes from '../components/ModuloReportes';
import Biblioteca from '../components/Biblioteca';
import Utilidades from '../components/Utilidades';
import ModuloIA from '../components/ModuloIA';
import { useTutorial } from '../context/TutorialContext'; 
import TutorialTooltip from '../components/TutorialTooltip'; 

interface VarkInfo { visible: boolean; v: number; a: number; r: number; k: number; }

export default function Dashboard({ onLogout, onSwitchToAdmin }: { onLogout?: () => void, onSwitchToAdmin?: () => void }) {
  const [vistaActual, setVistaActual] = useState<'inicio' | 'crear-grupo' | 'mis-grupos' | 'vista-grupo' | 'reportes' | 'utilidades' | 'biblioteca' | 'modulo-ia'>('inicio');
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<{id: string, nombre: string, tab: 'alumnos' | 'asistencia' | 'evidencias'} | null>(null);
  
  const [varkInfo, setVarkInfo] = useState<VarkInfo>({ visible: false, v: 0, a: 0, r: 0, k: 0 });
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [guiaConductual, setGuiaConductual] = useState(false);

  const { ayudaActiva, toggleAyuda } = useTutorial();

  const abrirGrupo = (id: string, nombre: string, tab: 'alumnos' | 'asistencia' | 'evidencias' = 'alumnos') => {
    setGrupoSeleccionado({ id, nombre, tab });
    setVistaActual('vista-grupo');
  };

  const maxVark = Math.max(varkInfo.v, varkInfo.a, varkInfo.r, varkInfo.k, 1);
  
  const modulos = [
    { id: 'mis-grupos', titulo: 'Mis Grupos', subtitulo: 'Ver y gestionar listas de alumnos', color: 'var(--accent-blue)', inicial: 'G' },
    { id: 'reportes', titulo: 'Reportes y Estadísticas', subtitulo: 'Asistencia, Calificaciones y Conducta', color: 'var(--accent-green)', inicial: 'R' },
    { id: 'biblioteca', titulo: 'Biblioteca Docente', subtitulo: 'Normativos, Mis Recursos y Lectura', color: 'var(--accent-purple)', inicial: 'B' },
    { id: 'utilidades', titulo: 'Utilidades Docentes', subtitulo: 'Ruleta, cronómetro y herramientas globales', color: 'var(--accent-red)', inicial: 'U' },
    { id: 'modulo-ia', titulo: 'Pregúntale a la IA', subtitulo: 'Asistente pedagógico y generador de actividades', color: 'var(--accent-yellow)', inicial: 'IA' }
  ];

  const limpiarPaneles = () => {
    setVarkInfo(p => ({...p, visible: false}));
    setGuiaConductual(false);
  };

  const mostrarSidebar = vistaActual === 'inicio' || vistaActual === 'vista-grupo';

  return (
    <>
      {mostrarPerfil && <PerfilDocente onClose={() => setMostrarPerfil(false)} />}
      
      <header className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <button className="mobile-menu-btn">☰</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'var(--accent-yellow)', color: '#000', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>A+</div>
            <span style={{ fontWeight: 700, fontSize: '1.2rem', letterSpacing: '1px' }}>AULA+</span>
          </div>
          <nav className="desktop-nav" style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
            <span style={{ color: vistaActual === 'inicio' ? 'var(--text-main)' : 'inherit', cursor: 'pointer' }} onClick={() => { setVistaActual('inicio'); limpiarPaneles(); }}>Inicio</span>
            <span style={{ color: vistaActual === 'mis-grupos' || vistaActual === 'vista-grupo' ? 'var(--text-main)' : 'inherit', cursor: 'pointer' }} onClick={() => { setVistaActual('mis-grupos'); limpiarPaneles(); }}>Grupos</span>
            <span style={{ color: vistaActual === 'reportes' ? 'var(--text-main)' : 'inherit', cursor: 'pointer' }} onClick={() => { setVistaActual('reportes'); limpiarPaneles(); }}>Reportes</span>
            <span style={{ color: vistaActual === 'biblioteca' ? 'var(--text-main)' : 'inherit', cursor: 'pointer' }} onClick={() => { setVistaActual('biblioteca'); limpiarPaneles(); }}>Biblioteca</span>
            <span style={{ color: vistaActual === 'utilidades' ? 'var(--text-main)' : 'inherit', cursor: 'pointer' }} onClick={() => { setVistaActual('utilidades'); limpiarPaneles(); }}>Utilidades</span>
            <span style={{ color: vistaActual === 'modulo-ia' ? 'var(--text-main)' : 'inherit', cursor: 'pointer' }} onClick={() => { setVistaActual('modulo-ia'); limpiarPaneles(); }}>IA</span>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          
          <button 
            onClick={toggleAyuda} 
            className="pill-btn desktop-nav" 
            style={{ 
              background: ayudaActiva ? 'var(--accent-purple)' : 'var(--bg-input)', 
              color: ayudaActiva ? 'white' : 'var(--text-muted)',
              border: ayudaActiva ? 'none' : '1px solid var(--border-color)',
              transition: 'all 0.3s ease'
            }}
          >
            {ayudaActiva ? '💡 Modo Ayuda: ON' : '💡 Modo Ayuda: OFF'}
          </button>

          {onSwitchToAdmin && (
            <button onClick={onSwitchToAdmin} className="pill-btn desktop-nav" style={{ background: 'var(--accent-red)', color: 'white' }}>👑 Panel Admin</button>
          )}
          {onLogout && (
            <button onClick={onLogout} className="pill-btn desktop-nav" style={{ background: 'transparent', border: '1px solid var(--accent-red)', color: 'var(--accent-red)' }}>Cerrar Sesión</button>
          )}
          <div onClick={() => setMostrarPerfil(true)} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--bg-panel)', padding: '0.4rem 1rem', borderRadius: '50px', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
            <img src="https://ui-avatars.com/api/?name=Profe+Elio&background=1C51FF&color=fff" alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />
            <span className="desktop-nav" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Mi Perfil</span>
          </div>
        </div>
      </header>

      <main className="dashboard-layout" style={{ gridTemplateColumns: mostrarSidebar ? '300px 1fr' : '1fr' }}>
        
        {mostrarSidebar && (
          <aside className="snapshot-sidebar" style={{ animation: 'fadeIn 0.3s' }}>
            <div>
              <h1 style={{ fontSize: '2.5rem', margin: '0 0 0.5rem 0', fontWeight: 700, letterSpacing: '-1px' }}>Dashboard</h1>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Ciclo Escolar 2026-2027</p>
            </div>
            {vistaActual === 'inicio' && (
              <div className="hero-card">
                <span style={{ opacity: 0.8, fontSize: '0.9rem', fontWeight: 500 }}>Accesos Rápidos</span>
                <h2 style={{ fontSize: '1.8rem', margin: '0.5rem 0 1.5rem 0', fontWeight: 700 }}>Gestión Escolar</h2>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  
                  <TutorialTooltip mensaje="Revisa tus listas, asistencias y evidencias.">
                    <button onClick={() => { setVistaActual('mis-grupos'); limpiarPaneles(); }} className="pill-btn" style={{ backgroundColor: 'white', color: 'var(--accent-blue)' }}>Ver mis Grupos</button>
                  </TutorialTooltip>

                  <TutorialTooltip mensaje="Genera gráficos y concentra las calificaciones.">
                    <button onClick={() => { setVistaActual('reportes'); limpiarPaneles(); }} className="pill-btn" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}>Ver Reportes</button>
                  </TutorialTooltip>

                </div>
              </div>
            )}

            {varkInfo.visible && vistaActual === 'vista-grupo' && (
              <div className="vark-stats-card">
                <h4 style={{ margin: '0 0 1rem 0' }}>Análisis VARK del Grupo</h4>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div className="vark-bar-container"><span className="vark-bar-label">V</span><div className="vark-bar-track"><div className="vark-bar-fill" style={{ width: `${(varkInfo.v / maxVark) * 100}%`, backgroundColor: 'var(--accent-blue)' }}></div></div><span className="vark-bar-count">{varkInfo.v}</span></div>
                  <div className="vark-bar-container"><span className="vark-bar-label">A</span><div className="vark-bar-track"><div className="vark-bar-fill" style={{ width: `${(varkInfo.a / maxVark) * 100}%`, backgroundColor: 'var(--accent-yellow)' }}></div></div><span className="vark-bar-count">{varkInfo.a}</span></div>
                  <div className="vark-bar-container"><span className="vark-bar-label">R</span><div className="vark-bar-track"><div className="vark-bar-fill" style={{ width: `${(varkInfo.r / maxVark) * 100}%`, backgroundColor: 'var(--accent-green)' }}></div></div><span className="vark-bar-count">{varkInfo.r}</span></div>
                  <div className="vark-bar-container"><span className="vark-bar-label">K</span><div className="vark-bar-track"><div className="vark-bar-fill" style={{ width: `${(varkInfo.k / maxVark) * 100}%`, backgroundColor: 'var(--accent-red)' }}></div></div><span className="vark-bar-count">{varkInfo.k}</span></div>
                </div>
              </div>
            )}

            {guiaConductual && vistaActual === 'vista-grupo' && (
              <div className="vark-stats-card" style={{ borderLeft: '4px solid var(--accent-yellow)' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent-yellow)', fontSize: '1.2rem' }}>💡 Guía de Llenado</h4>
                <details className="vark-accordion"><summary>📌 Eventualidades</summary><div><p>Vocabulario inadecuado, interrumpir clase, etc.</p></div></details>
              </div>
            )}
          </aside>
        )}

        <section className="workspace-main">
          {vistaActual === 'inicio' && (
            <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
              <div className="tabs-nav"><span className="tab active">Módulos Globales</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
                {modulos.map((mod) => (
                  <TutorialTooltip key={mod.id} mensaje={`Da clic para acceder al módulo de ${mod.titulo}`} esBloque={true} posicion="top">
                    <div className="activity-card" onClick={() => { setVistaActual(mod.id as any); limpiarPaneles(); }} style={{ cursor: 'pointer', margin: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div className="circle-icon" style={{ backgroundColor: 'var(--bg-app)', color: mod.color, border: `1px solid ${mod.color}` }}>{mod.inicial}</div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{mod.titulo}</h4>
                          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{mod.subtitulo}</p>
                        </div>
                      </div>
                    </div>
                  </TutorialTooltip>
                ))}
              </div>
            </div>
          )}

          {vistaActual === 'modulo-ia' && <ModuloIA onVolver={() => setVistaActual('inicio')} />}
          {vistaActual === 'biblioteca' && <Biblioteca onVolver={() => setVistaActual('inicio')} />}
          {vistaActual === 'utilidades' && <Utilidades onVolver={() => setVistaActual('inicio')} />}
          {vistaActual === 'crear-grupo' && <FormularioGrupo onVolver={() => setVistaActual('mis-grupos')} />}
          {vistaActual === 'mis-grupos' && <MisGrupos onCrearGrupo={() => setVistaActual('crear-grupo')} onAbrirGrupo={abrirGrupo} />}
          {vistaActual === 'reportes' && <ModuloReportes onVolver={() => { setVistaActual('inicio'); limpiarPaneles(); }} setGuiaConductual={setGuiaConductual} />}
          
          {vistaActual === 'vista-grupo' && grupoSeleccionado && (
            <VistaGrupo key={`${grupoSeleccionado.id}-${grupoSeleccionado.tab}`} idGrupo={grupoSeleccionado.id} nombreGrupo={grupoSeleccionado.nombre} tabInicial={grupoSeleccionado.tab} onVolver={() => { setVistaActual('mis-grupos'); limpiarPaneles(); }} onVarkChange={setVarkInfo} />
          )}
        </section>
      </main>
    </>
  );
}