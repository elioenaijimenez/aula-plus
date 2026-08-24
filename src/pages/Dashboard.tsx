import { useState, useEffect, useRef } from 'react';
import FormularioGrupo from '../components/FormularioGrupo';
import MisGrupos from '../components/MisGrupos';
import VistaGrupo from '../components/VistaGrupo';
import PerfilDocente from '../components/PerfilDocente';
import ModuloReportes from '../components/ModuloReportes';
import Biblioteca from '../components/Biblioteca';
import Utilidades from '../components/Utilidades';
import ModuloIA from '../components/ModuloIA';
import CalendarioEscolar from '../components/CalendarioEscolar'; 
import MiAula from '../components/MiAula'; 
import { useTutorial } from '../context/TutorialContext'; 
import TutorialTooltip from '../components/TutorialTooltip';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

interface VarkInfo { visible: boolean; v: number; a: number; r: number; k: number; }

export default function Dashboard({ onLogout, onSwitchToAdmin }: { onLogout?: () => void, onSwitchToAdmin?: () => void }) {
  const [vistaActual, setVistaActual] = useState<'inicio' | 'crear-grupo' | 'mis-grupos' | 'vista-grupo' | 'reportes' | 'utilidades' | 'biblioteca' | 'modulo-ia' | 'calendario' | 'mis-grupos-aula' | 'mi-aula'>('inicio');
  
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<{id: string, nombre: string, tab: 'alumnos' | 'asistencia'} | null>(null);
  const [aulaSeleccionada, setAulaSeleccionada] = useState<{id: string, nombre: string} | null>(null);
  
  // AÑADIDO: Estado para saber qué grupo vamos a editar
  const [grupoAEditar, setGrupoAEditar] = useState<any>(null);

  const [userEmail, setUserEmail] = useState('');
  const [varkInfo, setVarkInfo] = useState<VarkInfo>({ visible: false, v: 0, a: 0, r: 0, k: 0 });
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [perfilObligatorio, setPerfilObligatorio] = useState(false);
  
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [perfilMenuAbierto, setPerfilMenuAbierto] = useState(false);
  const [guiaConductual, setGuiaConductual] = useState(false);

  const { ayudaActiva, toggleAyuda } = useTutorial();

  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setPerfilMenuAbierto(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#inicio');
    } else {
      const hash = window.location.hash.replace('#', '');
      if (['inicio', 'crear-grupo', 'mis-grupos', 'vista-grupo', 'reportes', 'utilidades', 'biblioteca', 'modulo-ia', 'calendario', 'mis-grupos-aula', 'mi-aula'].includes(hash)) {
        setVistaActual(hash as any);
      }
    }

    const handlePopState = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        setVistaActual(hash as any);
      } else {
        setVistaActual('inicio');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (vistaActual === 'mi-aula' && !aulaSeleccionada) {
      setVistaActual('mis-grupos-aula');
      window.history.replaceState(null, '', '#mis-grupos-aula');
    } else if (vistaActual === 'vista-grupo' && !grupoSeleccionado) {
      setVistaActual('mis-grupos');
      window.history.replaceState(null, '', '#mis-grupos');
    }
  }, [vistaActual, aulaSeleccionada, grupoSeleccionado]);

  const navegarModulo = (modulo: any) => {
    verificarVigenciaKeyPlus(userEmail); 
    if (window.location.hash.replace('#', '') !== modulo) {
      window.history.pushState(null, '', `#${modulo}`);
    }
    setVistaActual(modulo);
    limpiarPaneles();
    setMenuMovilAbierto(false); 
  };

  const verificarVigenciaKeyPlus = async (emailToVerify: string) => {
    if (!emailToVerify || emailToVerify === 'eliojimenezm@gmail.com' || emailToVerify === 'blaneguapo@gmail.com') return;
    try {
      const q = query(collection(db, 'keys'), where('correo', '==', emailToVerify), where('estado', '==', 'en uso'));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        alert("🛑 Tu sesión fue revocada por el administrador o tu KeyPlus caducó.\nSerás redirigido al inicio.");
        if (onLogout) onLogout();
      }
    } catch (error) { console.error("Error al verificar vigencia silenciosa:", error); }
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

  const manejarCierrePerfil = () => { setMostrarPerfil(false); setPerfilObligatorio(false); };

  const abrirGrupo = (id: string, nombre: string) => {
    verificarVigenciaKeyPlus(userEmail); 
    setGrupoSeleccionado({ id, nombre, tab: 'alumnos' });
    window.history.pushState(null, '', `#vista-grupo`);
    setVistaActual('vista-grupo');
  };

  const abrirMiAula = (id: string, nombre: string) => {
    verificarVigenciaKeyPlus(userEmail); 
    setAulaSeleccionada({ id, nombre });
    window.history.pushState(null, '', `#mi-aula`);
    setVistaActual('mi-aula');
  };

  const maxVark = Math.max(varkInfo.v, varkInfo.a, varkInfo.r, varkInfo.k, 1);
  
  // AÑADIDO: Textos informativos con ejemplos detallados para el icono "i"
  const modulos = [
    { id: 'mis-grupos-aula', titulo: 'Mi Aula Virtual', subtitulo: 'Actividades, Pizarra y Biblioteca', color: 'var(--accent-purple)', inicial: 'A', info: '💻 ¿Qué hacer aquí?\nCrea actividades y avisos para que tus alumnos los vean en su Pizarra.\n\n✨ Ejemplo:\nPublica una tarea con enlace a un PDF en Drive, o manda un Aviso Dorado pidiendo material para mañana.' },
    { id: 'mis-grupos', titulo: 'Gestión y Asistencia', subtitulo: 'Ver listas, VARK y asistencia', color: 'var(--accent-blue)', inicial: 'G', info: '👥 ¿Qué hacer aquí?\nAdministra tus grupos, edita su información, pasa asistencia diaria y registra el estilo de aprendizaje de tus alumnos.\n\n✨ Ejemplo:\nEntra a 1°A, toma asistencia rápida con un clic y visualiza qué porcentaje de tu grupo es Visual o Kinestésico.' },
    { id: 'calendario', titulo: 'Calendario Escolar', subtitulo: 'Planea el ciclo con tus post-its', color: '#FFC107', inicial: 'C', info: '📅 ¿Qué hacer aquí?\nOrganiza tus eventos, juntas de CTE, días festivos y exámenes en un calendario interactivo.\n\n✨ Ejemplo:\nAgrega un post-it amarillo el 15 de mayo para recordar la entrega de calificaciones del trimestre.' }, 
    { id: 'reportes', titulo: 'Reportes y Estadísticas', subtitulo: 'Reportes que comunican mejor', color: 'var(--accent-green)', inicial: 'R', info: '📊 ¿Qué hacer aquí?\nGenera reportes de conducta, incidencias y estadísticas de rendimiento listos para imprimir o enviar a orientación.\n\n✨ Ejemplo:\nCrea un reporte de indisciplina para un alumno que interrumpió la clase, y expórtalo en PDF.' },
    { id: 'biblioteca', titulo: 'Biblioteca Docente', subtitulo: 'Entra y sorprendete con el contenido', color: 'var(--accent-darkred)', inicial: 'B', info: '📚 ¿Qué hacer aquí?\nExplora libros de texto, normativas, y formatos oficiales subidos por toda la comunidad.\n\n✨ Ejemplo:\nBusca "Plan de Estudios 2022", guárdalo en tus Favoritos (⭐) y tenlo a la mano en tu Aula Virtual.' },
    { id: 'modulo-ia', titulo: 'Ahorra tiempo, pregúntale a la IA', subtitulo: 'Asistente pedagógico y generador', color: 'var(--accent-yellow)', inicial: 'IA', info: '🤖 ¿Qué hacer aquí?\nUsa Inteligencia Artificial para redactar planeaciones, exámenes o rúbricas en segundos.\n\n✨ Ejemplo:\nPídele: "Crea una rúbrica de 5 puntos para evaluar una maqueta sobre el ciclo del agua" y cópiala a Word.' },
    { id: 'utilidades', titulo: 'Utilidades Docentes', subtitulo: 'Haz de tu clase una experiencia', color: '#607D8B', inicial: 'U', info: '🛠️ ¿Qué hacer aquí?\nHerramientas prácticas para gamificar tu clase y hacerla dinámica.\n\n✨ Ejemplo:\nUsa la Ruleta para elegir alumnos al azar para participar, o el Cronómetro gigante para una dinámica de equipos.' }
  ];

  const limpiarPaneles = () => { setVarkInfo(p => ({...p, visible: false})); setGuiaConductual(false); };

  const mostrarSidebar = vistaActual === 'inicio' || vistaActual === 'vista-grupo' || vistaActual === 'reportes';

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

          <nav className="desktop-nav" style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, overflowX: 'auto', whiteSpace: 'nowrap' }}>
            <span style={{ color: vistaActual === 'inicio' ? 'var(--text-main)' : 'inherit', cursor: 'pointer' }} onClick={() => navegarModulo('inicio')}>Inicio</span>
            <span style={{ color: vistaActual === 'mis-grupos-aula' || vistaActual === 'mi-aula' ? 'var(--accent-purple)' : 'inherit', cursor: 'pointer' }} onClick={() => navegarModulo('mis-grupos-aula')}>Mi Aula</span>
            <span style={{ color: vistaActual === 'mis-grupos' || vistaActual === 'vista-grupo' ? 'var(--accent-blue)' : 'inherit', cursor: 'pointer' }} onClick={() => navegarModulo('mis-grupos')}>Gestión y Asistencia</span>
            <span style={{ color: vistaActual === 'calendario' ? 'var(--accent-yellow)' : 'inherit', cursor: 'pointer' }} onClick={() => navegarModulo('calendario')}>Calendario</span>
            <span style={{ color: vistaActual === 'reportes' ? 'var(--accent-green)' : 'inherit', cursor: 'pointer' }} onClick={() => navegarModulo('reportes')}>Reportes</span>
            <span style={{ color: vistaActual === 'biblioteca' ? 'var(--accent-darkred)' : 'inherit', cursor: 'pointer' }} onClick={() => navegarModulo('biblioteca')}>Biblioteca</span>
            <span style={{ color: vistaActual === 'modulo-ia' ? '#FF9800' : 'inherit', cursor: 'pointer' }} onClick={() => navegarModulo('modulo-ia')}>Asistente IA</span>
            <span style={{ color: vistaActual === 'utilidades' ? '#607D8B' : 'inherit', cursor: 'pointer' }} onClick={() => navegarModulo('utilidades')}>Utilidades</span>
          </nav>
        </div>

        <div style={{ position: 'relative' }} ref={menuRef}>
          <div onClick={() => setPerfilMenuAbierto(!perfilMenuAbierto)} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--bg-panel)', padding: '0.3rem 1rem 0.3rem 0.3rem', borderRadius: '50px', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.2s' }} className="hover-opacity">
            <img src={`https://ui-avatars.com/api/?name=${userEmail.charAt(0)}&background=1C51FF&color=fff`} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />
            <span className="desktop-nav" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>Mi Perfil ▼</span>
          </div>

          {perfilMenuAbierto && (
            <div style={{ position: 'absolute', top: '120%', right: 0, backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '220px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 1000, animation: 'fadeIn 0.2s' }}>
              <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Conectado como:</span>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)', wordBreak: 'break-all' }}>{userEmail}</strong>
              </div>
              
              <button onClick={() => { if(!perfilObligatorio) { setMostrarPerfil(true); setPerfilMenuAbierto(false); } }} className="pill-btn" style={{ background: 'transparent', textAlign: 'left', padding: '0.6rem', color: 'var(--text-main)', width: '100%' }}>👤 Configurar Perfil</button>
              <button onClick={() => { toggleAyuda(); setPerfilMenuAbierto(false); }} className="pill-btn" style={{ background: ayudaActiva ? 'rgba(156, 39, 176, 0.1)' : 'transparent', color: ayudaActiva ? 'var(--accent-purple)' : 'var(--text-main)', textAlign: 'left', padding: '0.6rem', width: '100%' }}>💡 {ayudaActiva ? 'Desactivar Guías' : 'Activar Guías'}</button>
              {onSwitchToAdmin && <button onClick={onSwitchToAdmin} className="pill-btn" style={{ background: 'rgba(255, 193, 7, 0.1)', color: 'var(--accent-yellow)', textAlign: 'left', padding: '0.6rem', width: '100%', border: 'none' }}>👑 Panel SuperAdmin</button>}
              {onLogout && <button onClick={onLogout} className="pill-btn" style={{ background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', textAlign: 'left', padding: '0.6rem', width: '100%', border: 'none' }}>🚪 Cerrar Sesión</button>}
            </div>
          )}
        </div>

        {menuMovilAbierto && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', padding: '1.5rem', zIndex: 1000, gap: '1.2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', animation: 'fadeIn 0.2s' }}>
            <span style={{ color: vistaActual === 'inicio' ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={() => navegarModulo('inicio')}>🏠 Inicio</span>
            <span style={{ color: vistaActual === 'mis-grupos-aula' ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={() => navegarModulo('mis-grupos-aula')}>🎓 Mi Aula Virtual</span>
            <span style={{ color: vistaActual === 'mis-grupos' ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={() => navegarModulo('mis-grupos')}>👥 Gestión y Asistencia</span>
            <span style={{ color: vistaActual === 'calendario' ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={() => navegarModulo('calendario')}>📅 Calendario Escolar</span>
            <span style={{ color: vistaActual === 'reportes' ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={() => navegarModulo('reportes')}>📊 Reportes y Estadísticas</span>
            <span style={{ color: vistaActual === 'biblioteca' ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={() => navegarModulo('biblioteca')}>📚 Biblioteca Docente</span>
            <span style={{ color: vistaActual === 'modulo-ia' ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={() => navegarModulo('modulo-ia')}>🤖 Asistente IA</span>
            <span style={{ color: vistaActual === 'utilidades' ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 'bold', fontSize: '1.1rem' }} onClick={() => navegarModulo('utilidades')}>🛠️ Utilidades</span>
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
                <h2 style={{ fontSize: '1.8rem', margin: '0.5rem 0 1.5rem 0', fontWeight: 700 }}>Mi Aula</h2>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <TutorialTooltip mensaje="Gestiona tus actividades y la Pizarra Alumno.">
                    <button onClick={() => navegarModulo('mis-grupos-aula')} className="pill-btn" style={{ backgroundColor: 'white', color: 'var(--accent-blue)' }}>Entrar al Aula</button>
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

            {guiaConductual && vistaActual === 'reportes' && (
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
                  <div key={mod.id} className="activity-card hover-scale" style={{ margin: 0, transition: 'all 0.2s', position: 'relative' }}>
                    <div onClick={() => navegarModulo(mod.id)} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', cursor: 'pointer', paddingRight: '2rem' }}>
                      <div className="circle-icon" style={{ backgroundColor: 'var(--bg-app)', color: mod.color, border: `1px solid ${mod.color}` }}>{mod.inicial}</div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{mod.titulo}</h4>
                        <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{mod.subtitulo}</p>
                      </div>
                    </div>
                    {/* BOTÓN "i" DE INFORMACIÓN (Se abre con clic o se ve al pasar el ratón) */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); alert(mod.info); }}
                      title={mod.info}
                      style={{ position: 'absolute', top: '15px', right: '15px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'help', fontSize: '1rem' }}
                    >
                      ℹ️
                    </button>
                  </div>
                ))}
              </div>
              <style>{`.hover-scale:hover { transform: scale(1.03); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }`}</style>
            </div>
          )}

          {vistaActual === 'modulo-ia' && <ModuloIA onVolver={() => navegarModulo('inicio')} />}
          {vistaActual === 'biblioteca' && <Biblioteca onVolver={() => navegarModulo('inicio')} />}
          {vistaActual === 'utilidades' && <Utilidades onVolver={() => navegarModulo('inicio')} />}
          {vistaActual === 'calendario' && <CalendarioEscolar onVolver={() => navegarModulo('inicio')} />}
          {vistaActual === 'reportes' && <ModuloReportes onVolver={() => navegarModulo('inicio')} setGuiaConductual={setGuiaConductual} />}
          
          {/* AÑADIDO: Pasamos el grupoAEditar al Formulario para pre-rellenarlo */}
          {vistaActual === 'crear-grupo' && <FormularioGrupo onVolver={() => navegarModulo('mis-grupos')} grupoAEditar={grupoAEditar} />}
          
          {vistaActual === 'mis-grupos' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-blue)' }}>📋 Gestión y Asistencia</h2>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>Selecciona un grupo para pasar lista o ver el registro VARK.</p>
              </div>
              {/* AÑADIDO: Conectamos onEditarGrupo */}
              <MisGrupos 
                onCrearGrupo={() => { setGrupoAEditar(null); navegarModulo('crear-grupo'); }} 
                onAbrirGrupo={abrirGrupo} 
                onEditarGrupo={(grupo) => { setGrupoAEditar(grupo); navegarModulo('crear-grupo'); }} 
              />
            </div>
          )}

          {vistaActual === 'vista-grupo' && grupoSeleccionado && (
            <VistaGrupo key={`${grupoSeleccionado.id}-${grupoSeleccionado.tab}`} idGrupo={grupoSeleccionado.id} nombreGrupo={grupoSeleccionado.nombre} tabInicial={grupoSeleccionado.tab as any} onVolver={() => navegarModulo('mis-grupos')} onVarkChange={setVarkInfo} />
          )}

          {vistaActual === 'mis-grupos-aula' && (
            <div className="mi-aula-theme" style={{ animation: 'fadeIn 0.3s', backgroundColor: 'var(--bg-app)', padding: '2rem', borderRadius: '24px', border: '2px dashed var(--accent-purple)' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <span style={{ fontSize: '3rem' }}>🚀</span>
                <h2 style={{ margin: '0.5rem 0', color: 'var(--accent-purple)', fontSize: '2rem' }}>Acceso a Mi Aula Virtual</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Selecciona un grupo para gestionar su Pizarra y sus Actividades.</p>
              </div>
              <style>{`
                .mi-aula-theme .activity-card { border-top: 4px solid var(--accent-purple) !important; background-color: var(--bg-panel) !important; }
                .mi-aula-theme h3 { color: var(--accent-purple) !important; }
                .mi-aula-theme button.pill-btn { background-color: var(--accent-purple) !important; }
                .mi-aula-theme > div > div:first-child > button { display: none !important; }
                .mi-aula-theme .activity-card button:nth-of-type(n+2) { display: none !important; }
              `}</style>
              <MisGrupos onCrearGrupo={() => { setGrupoAEditar(null); navegarModulo('crear-grupo'); }} onAbrirGrupo={abrirMiAula} modoAula={true} />
            </div>
          )}

          {vistaActual === 'mi-aula' && aulaSeleccionada && (
            <MiAula idGrupo={aulaSeleccionada.id} nombreGrupo={aulaSeleccionada.nombre} onVolver={() => navegarModulo('mis-grupos-aula')} />
          )}

        </section>
      </main>
    </>
  );
}