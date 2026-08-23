import { useState, useEffect } from 'react';
import FormularioGrupo from '../components/FormularioGrupo';
import MisGrupos from '../components/MisGrupos';
import VistaGrupo from '../components/VistaGrupo';
import PerfilDocente from '../components/PerfilDocente';
import ModuloReportes from '../components/ModuloReportes';
import Biblioteca from '../components/Biblioteca';
import Utilidades from '../components/Utilidades';
import ModuloIA from '../components/ModuloIA';
import CalendarioEscolar from '../components/CalendarioEscolar'; // NUEVO COMPONENTE
import { useTutorial } from '../context/TutorialContext'; 
import TutorialTooltip from '../components/TutorialTooltip';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

interface VarkInfo { visible: boolean; v: number; a: number; r: number; k: number; }

export default function Dashboard({ onLogout, onSwitchToAdmin }: { onLogout?: () => void, onSwitchToAdmin?: () => void }) {
  // AÑADIDO: 'calendario' a los estados de vista
  const [vistaActual, setVistaActual] = useState<'inicio' | 'crear-grupo' | 'mis-grupos' | 'vista-grupo' | 'reportes' | 'utilidades' | 'biblioteca' | 'modulo-ia' | 'calendario'>('inicio');
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<{id: string, nombre: string, tab: 'alumnos' | 'asistencia' | 'evidencias'} | null>(null);
  const [userEmail, setUserEmail] = useState('');
  
  const [varkInfo, setVarkInfo] = useState<VarkInfo>({ visible: false, v: 0, a: 0, r: 0, k: 0 });
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [perfilObligatorio, setPerfilObligatorio] = useState(false);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [guiaConductual, setGuiaConductual] = useState(false);

  const { ayudaActiva, toggleAyuda } = useTutorial();

  const verificarVigenciaKeyPlus = async (emailToVerify: string) => {
    if (!emailToVerify || emailToVerify === 'eliojimenezm@gmail.com' || emailToVerify === 'blaneguapo@gmail.com') return;
    
    try {
      const q = query(collection(db, 'keys'), where('correo', '==', emailToVerify), where('estado', '==', 'en uso'));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("🛑 Tu sesión fue revocada por el administrador o tu KeyPlus caducó.\nSerás redirigido al inicio.");
        if (onLogout) onLogout();
      }
    } catch (error) {
      console.error("Error al verificar vigencia silenciosa:", error);
    }
  };

  useEffect(() => {
    const inicializarDashboard = async () => {
      const sessionLocal = localStorage.getItem('aulaPlusSession');
      if (sessionLocal) {
        const sessionData = JSON.parse(sessionLocal);
        const email = sessionData?.user?.email || sessionData?.email || 'default';
        setUserEmail(email);
        
        await verificarVigenciaKeyPlus(email);

        try {
          const docRef = doc(db, 'teacher_settings', email);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists() && docSnap.data().memoriaEscolar?.escuela) {
             localStorage.setItem(`aulaPlusPerfil_${email}`, JSON.stringify(docSnap.data().memoriaEscolar));
          } else {
             setPerfilObligatorio(true);
             setMostrarPerfil(true);
          }
        } catch (error) {
           const dataGuardadaLocal = localStorage.getItem(`aulaPlusPerfil_${email}`);
           if (!dataGuardadaLocal) {
             setPerfilObligatorio(true);
             setMostrarPerfil(true);
           }
        }
      }
    };
    
    inicializarDashboard();
  }, []);

  const manejarCierrePerfil = () => {
    setMostrarPerfil(false);
    setPerfilObligatorio(false);
  };

  const abrirGrupo = (id: string, nombre: string, tab: 'alumnos' | 'asistencia' | 'evidencias' = 'alumnos') => {
    verificarVigenciaKeyPlus(userEmail); 
    setGrupoSeleccionado({ id, nombre, tab });
    setVistaActual('vista-grupo');
  };

  const navegarModulo = (modulo: any) => {
    verificarVigenciaKeyPlus(userEmail); 
    setVistaActual(modulo);
    limpiarPaneles();
    setMenuMovilAbierto(false); 
  };

  const maxVark = Math.max(varkInfo.v, varkInfo.a, varkInfo.r, varkInfo.k, 1);
  
  // AÑADIDO: El módulo de Calendario a la cuadrícula de inicio
  const modulos = [
    { id: 'mis-grupos', titulo: 'Mis Grupos', subtitulo: 'Ver y gestionar listas de alumnos', color: 'var(--accent-blue)', inicial: 'G' },
    { id: 'calendario', titulo: 'Calendario Escolar', subtitulo: 'Planea el ciclo con tus post-its', color: '#FFC107', inicial: 'C' }, // NUEVO MÓDULO (Amarillo/Dorado)
    { id: 'reportes', titulo: 'Reportes y Estadísticas', subtitulo: 'Reportes que comunican mejor', color: 'var(--accent-green)', inicial: 'R' },
    { id: 'biblioteca', titulo: 'Biblioteca Docente', subtitulo: 'Entra y sorprendete con el contenido', color: 'var(--accent-purple)', inicial: 'B' },
    { id: 'utilidades', titulo: 'Utilidades Docentes', subtitulo: 'Haz de tu clase una experiencia', color: 'var(--accent-red)', inicial: 'U' },
    { id: 'modulo-ia', titulo: 'Ahorra tiempo, pregúntale a la IA', subtitulo: 'Asistente pedagógico y generador de actividades', color: 'var(--accent-yellow)', inicial: 'IA' }
  ];

  const limpiarPaneles = () => {
    setVarkInfo(p => ({...p, visible: false}));
    setGuiaConductual(false);
  };

  const mostrarSidebar = vistaActual === 'inicio' || vistaActual === 'vista-grupo';

  return (
    <>
      {mostrarPerfil && <PerfilDocente onClose={manejarCierrePerfil} obligarLlenado={perfilObligatorio} />}
      
      <header className="top-bar" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          
          <button className="mobile-menu-btn" onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}>
            {menuMovilAbierto ? '✕' : '☰'}
          </button>
          
          <div onClick={() => navegarModulo('inicio')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'opacity 0.2s' }} className="hover-opacity">
            <div style={{ background: 'var(--accent-blue)', color: '#fff', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              <span style={{ marginRight: '-2px' }}>A</span><span style={{ color: 'var(--accent-yellow)' }}>+</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: '1.2rem', letterSpacing: '1px' }}>AULA+</span>
          </div>

          {/* Menú Superior de Escritorio */}
          <nav className="desktop-nav" style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
            <span style={{ color: vistaActual === 'inicio' ? 'var(--text-main)' : 'inherit', cursor: 'pointer' }} onClick={() => navegarModulo('inicio')}>Inicio</span>
            <span style={{ color: vistaActual === 'mis-grupos' || vistaActual === 'vista-grupo' ? 'var(--text-main)' : 'inherit', cursor: 'pointer' }} onClick={() => navegarModulo('mis-grupos')}>Grupos</span>
            <span style={{ color: vistaActual === 'calendario' ? 'var(--text-main)' : 'inherit', cursor: 'pointer' }} onClick={() => navegarModulo('calendario')}>Calendario</span>
            <span style={{ color: vistaActual === 'reportes' ? 'var(--text-main)' : 'inherit', cursor: 'pointer' }} onClick={() => navegarModulo('reportes')}>Reportes</span>
            <span style={{ color: vistaActual === 'biblioteca' ? 'var(--text-main)' : 'inherit', cursor: 'pointer' }} onClick={() => navegarModulo('biblioteca')}>Biblioteca</span>
            <span style={{ color: vistaActual === 'utilidades' ? 'var(--text-main)' : 'inherit', cursor: 'pointer' }} onClick={() => navegarModulo('utilidades')}>Utilidades</span>
            <span style={{ color: vistaActual === 'modulo-ia' ? 'var(--text-main)' : 'inherit', cursor: 'pointer' }} onClick={() => navegarModulo('modulo-ia')}>IA</span>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          <button onClick={toggleAyuda} className="pill-btn desktop-nav" style={{ background: ayudaActiva ? 'var(--accent-purple)' : 'var(--bg-input)', color: ayudaActiva ? 'white' : 'var(--text-muted)', border: ayudaActiva ? 'none' : '1px solid var(--border-color)', transition: 'all 0.3s ease' }}>
            {ayudaActiva ? '💡 Ayuda: ON' : '💡 Ayuda: OFF'}
          </button>
          {onSwitchToAdmin && (
            <button onClick={onSwitchToAdmin} className="pill-btn desktop-nav" style={{ background: 'var(--accent-red)', color: 'white' }}>👑 Panel Admin</button>
          )}
          {onLogout && (
            <button onClick={onLogout} className="pill-btn desktop-nav" style={{ background: 'transparent', border: '1px solid var(--accent-red)', color: 'var(--accent-red)' }}>Salir</button>
          )}
          <div onClick={() => { if(!perfilObligatorio) setMostrarPerfil(true); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--bg-panel)', padding: '0.4rem 1rem', borderRadius: '50px', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
            <img src={`https://ui-avatars.com/api/?name=${userEmail.charAt(0)}&background=1C51FF&color=fff`} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />
            <span className="desktop-nav" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Mi Perfil</span>
          </div>
        </div>

        {/* Menú Desplegable Móvil */}
        {menuMovilAbierto && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', padding: '1.5rem', zIndex: 1000, gap: '1.2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', animation: 'fadeIn 0.2s' }}>
            <span style={{ color: vistaActual === 'inicio' ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={() => navegarModulo('inicio')}>🏠 Inicio</span>
            <span style={{ color: vistaActual === 'mis-grupos' ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={() => navegarModulo('mis-grupos')}>👥 Mis Grupos</span>
            <span style={{ color: vistaActual === 'calendario' ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={() => navegarModulo('calendario')}>📅 Calendario Escolar</span>
            <span style={{ color: vistaActual === 'reportes' ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={() => navegarModulo('reportes')}>📊 Reportes y Estadísticas</span>
            <span style={{ color: vistaActual === 'biblioteca' ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={() => navegarModulo('biblioteca')}>📚 Biblioteca Docente</span>
            <span style={{ color: vistaActual === 'utilidades' ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={() => navegarModulo('utilidades')}>🛠️ Utilidades</span>
            <span style={{ color: vistaActual === 'modulo-ia' ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={() => navegarModulo('modulo-ia')}>🤖 Pregúntale a la IA</span>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />
            <span style={{ color: 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={() => { if(!perfilObligatorio) { setMostrarPerfil(true); setMenuMovilAbierto(false); } }}>👤 Mi Perfil</span>
            <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={toggleAyuda}>{ayudaActiva ? '💡 Desactivar Ayuda' : '💡 Activar Ayuda'}</span>
            {onSwitchToAdmin && <span style={{ color: 'var(--accent-red)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={onSwitchToAdmin}>👑 Panel Admin</span>}
            {onLogout && <span style={{ color: 'var(--accent-red)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={onLogout}>🚪 Cerrar Sesión</span>}
          </div>
        )}
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
                    <button onClick={() => navegarModulo('mis-grupos')} className="pill-btn" style={{ backgroundColor: 'white', color: 'var(--accent-blue)' }}>Ver mis Grupos</button>
                  </TutorialTooltip>
                  <TutorialTooltip mensaje="Genera gráficos y concentra las calificaciones.">
                    <button onClick={() => navegarModulo('reportes')} className="pill-btn" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}>Ver Reportes</button>
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
                    <div className="activity-card" onClick={() => navegarModulo(mod.id)} style={{ cursor: 'pointer', margin: 0 }}>
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

          {vistaActual === 'modulo-ia' && <ModuloIA onVolver={() => navegarModulo('inicio')} />}
          {vistaActual === 'biblioteca' && <Biblioteca onVolver={() => navegarModulo('inicio')} />}
          {vistaActual === 'utilidades' && <Utilidades onVolver={() => navegarModulo('inicio')} />}
          {vistaActual === 'crear-grupo' && <FormularioGrupo onVolver={() => navegarModulo('mis-grupos')} />}
          {vistaActual === 'mis-grupos' && <MisGrupos onCrearGrupo={() => navegarModulo('crear-grupo')} onAbrirGrupo={abrirGrupo} />}
          {vistaActual === 'reportes' && <ModuloReportes onVolver={() => navegarModulo('inicio')} setGuiaConductual={setGuiaConductual} />}
          
          {/* AÑADIDO: Renderizar el nuevo módulo CalendarioEscolar */}
          {vistaActual === 'calendario' && <CalendarioEscolar onVolver={() => navegarModulo('inicio')} />}
          
          {vistaActual === 'vista-grupo' && grupoSeleccionado && (
            <VistaGrupo key={`${grupoSeleccionado.id}-${grupoSeleccionado.tab}`} idGrupo={grupoSeleccionado.id} nombreGrupo={grupoSeleccionado.nombre} tabInicial={grupoSeleccionado.tab} onVolver={() => navegarModulo('mis-grupos')} onVarkChange={setVarkInfo} />
          )}
        </section>
      </main>
    </>
  );
}