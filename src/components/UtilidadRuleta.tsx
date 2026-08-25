import { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

interface Grupo { id: string; name: string; subject: string; }
interface OpcionRuleta { id: string; texto: string; }

export default function UtilidadRuleta({ onVolver }: { onVolver: () => void }) {
  const [modo, setModo] = useState<'grupo' | 'custom'>('grupo');
  
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState('');
  
  const [opciones, setOpciones] = useState<OpcionRuleta[]>([]);
  const [textoCustom, setTextoCustom] = useState('');
  
  const [cargando, setCargando] = useState(false);
  const [removerGanador, setRemoverGanador] = useState(true);

  const [girando, setGirando] = useState(false);
  const [rotacion, setRotacion] = useState(0);
  const [ganador, setGanador] = useState<OpcionRuleta | null>(null);
  const [historialGanadores, setHistorialGanadores] = useState<OpcionRuleta[]>([]);

  // MAGIA SEGURIDAD: Obtenemos el email para filtrar
  useEffect(() => {
    const fetchGrupos = async () => {
      const sessionLocal = localStorage.getItem('aulaPlusSession');
      const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
      const userEmail = sessionData?.user?.email || sessionData?.email || '';

      if (!userEmail) return;

      // FILTRO ESTRICTO: Solo grupos del maestro actual
      const q = query(collection(db, 'groups'), where('docenteEmail', '==', userEmail));
      const snap = await getDocs(q);
      const lista: Grupo[] = [];
      snap.forEach(d => lista.push({ id: d.id, name: d.data().name, subject: d.data().subject }));
      setGrupos(lista);
    };
    fetchGrupos();
  }, []);

  useEffect(() => {
    if (modo === 'grupo' && grupoSeleccionado) {
      const fetchAlumnos = async () => {
        setCargando(true);
        const snap = await getDocs(collection(db, `groups/${grupoSeleccionado}/students`));
        const lista: OpcionRuleta[] = [];
        snap.forEach(d => {
          lista.push({ id: d.id, texto: d.data().fullName });
        });
        setOpciones(lista);
        setGanador(null);
        setHistorialGanadores([]);
        setCargando(false);
      };
      fetchAlumnos();
    } else if (modo === 'grupo' && !grupoSeleccionado) {
      setOpciones([]);
      setHistorialGanadores([]);
    }
  }, [grupoSeleccionado, modo]);

  const handleCambiarModo = (nuevoModo: 'grupo' | 'custom') => {
    if (modo === nuevoModo) return;
    if (opciones.length > 0 || historialGanadores.length > 0) {
      if (!window.confirm("Se perderá la ruleta actual, ¿Desea continuar?")) return;
    }
    setModo(nuevoModo);
    setOpciones([]);
    setHistorialGanadores([]);
    setGanador(null);
    setGrupoSeleccionado('');
  };

  // NUEVA LÓGICA ERGONÓMICA PARA AGREGAR OPCIONES CUSTOM
  const agregarOpcionCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const txt = textoCustom.trim();
    if (!txt) return;
    
    setOpciones(prev => [...prev, { id: `custom-${Date.now()}`, texto: txt }]);
    setTextoCustom(''); // Limpiar el input automáticamente
    setGanador(null);
  };

  const eliminarOpcionCustom = (id: string) => {
    setOpciones(prev => prev.filter(o => o.id !== id));
  };

  const limpiarCustom = () => {
    if(window.confirm("¿Vaciar toda la ruleta personalizada?")) {
      setOpciones([]);
      setGanador(null);
      setHistorialGanadores([]);
    }
  };

  const reproducirVictoria = () => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.5);
    osc.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
  };

  const girarRuleta = () => {
    if (opciones.length === 0 || girando) return;
    setGanador(null);
    setGirando(true);
    
    const indiceGanador = Math.floor(Math.random() * opciones.length);
    const gradosPorPedazo = 360 / opciones.length;
    const gradosParada = 1800 + (360 - (indiceGanador * gradosPorPedazo)) - (gradosPorPedazo / 2);
    
    const nuevaRotacion = rotacion + gradosParada;
    setRotacion(nuevaRotacion);

    setTimeout(() => {
      const ganadorElegido = opciones[indiceGanador];
      setGanador(ganadorElegido);
      setHistorialGanadores(prev => [...prev, ganadorElegido]);
      reproducirVictoria();
      setGirando(false);

      if (removerGanador) {
        setTimeout(() => {
          setOpciones(prev => prev.filter(o => o.id !== ganadorElegido.id));
        }, 2000); 
      }
    }, 4000); 
  };

  const colores = ['#E53935', '#1E88E5', '#43A047', '#FDD835', '#FB8C00', '#8E24AA', '#00ACC1', '#D81B60'];
  let conicGradientString = '';
  if (opciones.length > 0) {
    const pedazo = 360 / opciones.length;
    conicGradientString = opciones.map((_, i) => `${colores[i % colores.length]} ${i * pedazo}deg ${(i + 1) * pedazo}deg`).join(', ');
  }

  return (
    <div className="fullscreen-bg" style={{ animation: 'fadeIn 0.3s' }}>
      
      {/* HEADER */}
      <div style={{ flexShrink: 0, display: 'flex', gap: '1rem', padding: '1.5rem', width: '100%', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', alignItems: 'center', flexWrap: 'wrap', zIndex: 100, borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px', marginBottom: '1rem' }}>
        <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>← Salir</button>
        
        <TutorialTooltip mensaje="Alterna entre cargar la lista de un grupo oficial, o escribir tus propios textos para rifar temas o actividades." posicion="bottom">
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-input)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <button onClick={() => handleCambiarModo('grupo')} style={{ padding: '0.6rem 1.2rem', border: 'none', background: modo === 'grupo' ? 'var(--accent-yellow)' : 'transparent', color: modo === 'grupo' ? '#000' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>Mis Grupos</button>
            <button onClick={() => handleCambiarModo('custom')} style={{ padding: '0.6rem 1.2rem', border: 'none', background: modo === 'custom' ? 'var(--accent-yellow)' : 'transparent', color: modo === 'custom' ? '#000' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>Personalizada</button>
          </div>
        </TutorialTooltip>

        {modo === 'grupo' && (
          <select className="search-input" value={grupoSeleccionado} onChange={e => setGrupoSeleccionado(e.target.value)} style={{ width: '100%', maxWidth: '300px', margin: 0, border: '2px solid var(--accent-yellow)', backgroundColor: 'var(--bg-input)', fontWeight: 'bold' }}>
            <option value="">-- Selecciona un Grupo --</option>
            {grupos.map(g => <option key={g.id} value={g.id}>{g.name} - {g.subject}</option>)}
          </select>
        )}

        {opciones.length > 0 && (
          <TutorialTooltip mensaje="Si está activo, el alumno o elemento seleccionado desaparecerá de la ruleta para no repetir ganadores." posicion="bottom">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-input)', padding: '0.6rem 1rem', borderRadius: '50px', fontSize: '0.9rem', border: '1px solid var(--border-color)', fontWeight: 'bold', color: 'var(--text-main)', cursor: 'pointer' }}>
              <input type="checkbox" checked={removerGanador} onChange={e => setRemoverGanador(e.target.checked)} style={{ transform: 'scale(1.2)' }} /> Remover al ganar
            </label>
          </TutorialTooltip>
        )}
      </div>

      {cargando ? <div className="loader" style={{marginTop: '5rem'}}></div> : (
        <div className="ruleta-grid-layout">
          
          <div className="ruleta-lista-area" style={{ backgroundColor: 'var(--bg-panel)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
            
            {/* PANEL CUSTOM ERGONÓMICO */}
            {modo === 'custom' && (
              <div style={{ marginBottom: '1.5rem', width: '100%' }}>
                <h3 style={{ margin: '0 0 0.8rem 0', color: 'var(--accent-yellow)', fontSize: '1.2rem' }}>📝 Elementos de la Ruleta</h3>
                
                <form onSubmit={agregarOpcionCustom} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input 
                    type="text" 
                    className="search-input" 
                    value={textoCustom} 
                    onChange={e => setTextoCustom(e.target.value)}
                    placeholder="Escribe una opción y pulsa Enter..."
                    style={{ margin: 0, flex: 1, border: '2px solid var(--accent-yellow)' }}
                  />
                  <button type="submit" className="pill-btn hover-opacity" style={{ backgroundColor: 'var(--accent-yellow)', color: '#000', fontWeight: 'bold', padding: '0 1.2rem' }}>
                    Añadir
                  </button>
                </form>

                {opciones.length > 0 && (
                  <div className="custom-scrollbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', maxHeight: '180px', overflowY: 'auto', padding: '0.8rem', backgroundColor: 'var(--bg-app)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    {opciones.map(op => (
                      <span key={op.id} style={{ backgroundColor: 'var(--bg-input)', padding: '0.3rem 0.8rem', borderRadius: '50px', fontSize: '0.85rem', color: 'var(--text-main)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {op.texto}
                        <button type="button" onClick={() => eliminarOpcionCustom(op.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 0, fontSize: '1.1rem', lineHeight: 1 }}>✖</button>
                      </span>
                    ))}
                  </div>
                )}
                
                {opciones.length > 0 && (
                  <button onClick={limpiarCustom} className="pill-btn" style={{ width: '100%', backgroundColor: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', border: 'none', fontWeight: 'bold' }}>
                    🗑 Vaciar Ruleta
                  </button>
                )}
              </div>
            )}

            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '1.2rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>🏆 Historial de Ganadores</h3>
            {historialGanadores.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>Aún no hay seleccionados.</p>
            ) : (
              <ol style={{ paddingLeft: '1.2rem', margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {historialGanadores.map((ganadorHist, i) => (
                  <li key={i} style={{ backgroundColor: 'var(--bg-input)', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: 'bold', wordBreak: 'break-word' }}>
                    {ganadorHist.texto}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="ruleta-centro-area">
            {ganador && (
              <div className="confetti-container">
                {Array.from({ length: 50 }).map((_, i) => (
                  <div key={i} className="confetti-piece" style={{ left: `${Math.random() * 100}%`, backgroundColor: colores[i % colores.length], animationDelay: `${Math.random() * 2}s` }}></div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '0 1rem', minHeight: '80px', marginBottom: '1rem' }}>
              {ganador ? (
                <h1 className="shake" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', margin: 0, color: 'var(--accent-yellow)', textShadow: '0 4px 10px rgba(0,0,0,0.5)', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.2', textAlign: 'center' }}>
                  🎉 ¡{ganador.texto}! 🎉
                </h1>
              ) : (
                <h2 style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', margin: 0 }}>
                  {modo === 'grupo' ? '👆 Selecciona un grupo arriba' : '👆 Ingresa opciones en el panel izquierdo'}
                </h2>
              )}
            </div>

            {opciones.length > 0 && (
              <div style={{ position: 'relative', zIndex: 5, width: '100%', display: 'flex', justifyContent: 'center' }}>
                <div className="ruleta-flecha" style={{ borderTopColor: 'var(--text-main)', top: '-15px' }}></div>
                <div 
                  className="ruleta-container" 
                  style={{ background: `conic-gradient(${conicGradientString})`, transform: `rotate(${rotacion}deg)`, transitionDuration: '4s', border: '8px solid var(--bg-panel)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}
                >
                  {opciones.map((op, i) => {
                    // CORRECCIÓN MAGISTRAL: El "- 90" alinea perfectamente el texto con el gradiente cónico en CSS
                    const rot = (360 / opciones.length) * i + (360 / opciones.length) / 2 - 90;
                    const size = opciones.length > 40 ? '10px' : opciones.length > 25 ? '12px' : '15px';

                    return (
                      <div key={op.id} style={{ position: 'absolute', top: '50%', left: '50%', width: '50%', transformOrigin: '0 0', transform: `rotate(${rot}deg)` }}>
                        <div style={{ position: 'absolute', left: '40px', top: '0', transform: 'translateY(-50%)', color: '#FFFFFF', fontWeight: '800', fontSize: size, whiteSpace: 'nowrap', textShadow: '1px 1px 3px rgba(0,0,0,0.8)' }}>
                          {op.texto.length > 25 ? op.texto.substring(0, 25) + '...' : op.texto}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="ruleta-boton-area">
            <button 
              onClick={girarRuleta} 
              disabled={girando || opciones.length === 0} 
              className="pill-btn hover-opacity" 
              style={{ 
                backgroundColor: 'var(--accent-yellow)', color: '#000', fontSize: '1.4rem', padding: '1.5rem 3rem', boxShadow: '0 8px 0 #b28000', transform: girando ? 'translateY(8px)' : 'none', transition: 'all 0.1s', border: 'none', letterSpacing: '1px', width: '100%', maxWidth: '350px', fontWeight: '900'
              }}
            >
              {girando ? 'GIRANDO...' : '🎡 GIRAR RULETA'}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}