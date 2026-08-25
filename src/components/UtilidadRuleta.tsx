import { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Grupo { id: string; name: string; subject: string; }
interface OpcionRuleta { id: string; texto: string; }

type TemaRuleta = 'clasico' | 'neon' | 'pastel';

const THEMES = {
  clasico: {
    colores: ['#E53935', '#1E88E5', '#43A047', '#FDD835', '#FB8C00', '#8E24AA', '#00ACC1', '#D81B60'],
    texto: '#FFFFFF',
    sombra: 'rgba(0,0,0,0.8)'
  },
  neon: {
    colores: ['#FF00FF', '#00FF00', '#00FFFF', '#FFEA00', '#FF0055', '#7D12FF'],
    texto: '#FFFFFF',
    sombra: 'rgba(0,0,0,0.9)'
  },
  pastel: {
    colores: ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#E8BAFF', '#D5AAFF'],
    texto: '#333333',
    sombra: 'rgba(255,255,255,0.8)'
  }
};

export default function UtilidadRuleta({ onVolver }: { onVolver: () => void }) {
  const [modo, setModo] = useState<'grupo' | 'custom'>('grupo');
  const [tema, setTema] = useState<TemaRuleta>('clasico');
  
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

  useEffect(() => {
    const fetchGrupos = async () => {
      const sessionLocal = localStorage.getItem('aulaPlusSession');
      const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
      const userEmail = sessionData?.user?.email || sessionData?.email || '';

      if (!userEmail) return;

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

  const agregarOpcionCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const txt = textoCustom.trim();
    if (!txt) return;
    
    setOpciones(prev => [...prev, { id: `custom-${Date.now()}`, texto: txt }]);
    setTextoCustom(''); 
    setGanador(null);
  };

  const eliminarOpcionCustom = (id: string) => {
    setOpciones(prev => prev.filter(o => o.id !== id));
  };

  // NUEVO: Limpia todo de un solo golpe
  const limpiarTodo = () => {
    if(window.confirm("¿Seguro que deseas vaciar la ruleta y borrar el historial de ganadores?")) {
      if (modo === 'custom') setOpciones([]);
      setGanador(null);
      setHistorialGanadores([]);
    }
  };

  // NUEVO: Exportar a PDF
  const exportarPDF = () => {
    if (historialGanadores.length === 0) {
      alert("No hay ganadores para exportar.");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(28, 81, 255);
    doc.text("Historial de Ganadores - Ruleta Aula+", 14, 20);
    
    const bodyData = historialGanadores.map((g, i) => [i + 1, g.texto]);
    
    autoTable(doc, {
      startY: 30,
      head: [['#', 'Nombre / Opción Seleccionada']],
      body: bodyData,
      theme: 'grid',
      headStyles: { fillColor: [28, 81, 255] }
    });
    
    doc.save("Ganadores_Ruleta.pdf");
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

  const temaActual = THEMES[tema];
  let conicGradientString = '';
  if (opciones.length > 0) {
    const pedazo = 360 / opciones.length;
    conicGradientString = opciones.map((_, i) => `${temaActual.colores[i % temaActual.colores.length]} ${i * pedazo}deg ${(i + 1) * pedazo}deg`).join(', ');
  }

  return (
    <div className="fullscreen-bg" style={{ animation: 'fadeIn 0.3s', display: 'flex', flexDirection: 'column' }}>
      
      {/* MAGIA UX CSS: Diseño a 3 Columnas Responsivo */}
      <style>{`
        .ruleta-3-col {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
          flex: 1;
          overflow: hidden;
          padding: 0 1.5rem 1.5rem 1.5rem;
        }
        @media (min-width: 1024px) {
          .ruleta-3-col {
            grid-template-columns: 320px 1fr 320px;
          }
        }
        .panel-ruleta {
          background-color: var(--bg-panel);
          border-radius: 24px;
          border: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
        }
      `}</style>

      {/* HEADER COMPACTO Y MODERNO */}
      <div style={{ flexShrink: 0, display: 'flex', gap: '1rem', padding: '1.5rem', width: '100%', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', zIndex: 100, borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>← Salir</button>
          
          <TutorialTooltip mensaje="Alterna entre cargar la lista de un grupo oficial, o escribir tus propios textos." posicion="bottom">
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-input)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <button onClick={() => handleCambiarModo('grupo')} style={{ padding: '0.6rem 1.2rem', border: 'none', background: modo === 'grupo' ? 'var(--accent-yellow)' : 'transparent', color: modo === 'grupo' ? '#000' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>Mis Grupos</button>
              <button onClick={() => handleCambiarModo('custom')} style={{ padding: '0.6rem 1.2rem', border: 'none', background: modo === 'custom' ? 'var(--accent-yellow)' : 'transparent', color: modo === 'custom' ? '#000' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>Personalizada</button>
            </div>
          </TutorialTooltip>

          {modo === 'grupo' && (
            <select className="search-input" value={grupoSeleccionado} onChange={e => setGrupoSeleccionado(e.target.value)} style={{ width: '100%', maxWidth: '250px', margin: 0, border: '2px solid var(--accent-yellow)', backgroundColor: 'var(--bg-input)', fontWeight: 'bold' }}>
              <option value="">-- Selecciona un Grupo --</option>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {opciones.length > 0 && (
            <TutorialTooltip mensaje="Si está activo, el ganador desaparecerá de la ruleta para no repetirse." posicion="bottom">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-input)', padding: '0.6rem 1rem', borderRadius: '50px', fontSize: '0.9rem', border: '1px solid var(--border-color)', fontWeight: 'bold', color: 'var(--text-main)', cursor: 'pointer' }}>
                <input type="checkbox" checked={removerGanador} onChange={e => setRemoverGanador(e.target.checked)} style={{ transform: 'scale(1.2)' }} /> Remover al ganar
              </label>
            </TutorialTooltip>
          )}
        </div>
      </div>

      {cargando ? <div className="loader" style={{marginTop: '5rem'}}></div> : (
        <div className="ruleta-3-col">
          
          {/* COLUMNA 1: PANEL DE OPCIONES */}
          <div className="panel-ruleta">
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 193, 7, 0.05)' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-yellow)', fontSize: '1.2rem' }}>📝 Elementos ({opciones.length})</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Lista de participantes u opciones en juego.</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: '1.5rem' }}>
              {modo === 'custom' && (
                <form onSubmit={agregarOpcionCustom} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexShrink: 0 }}>
                  <input 
                    type="text" 
                    className="search-input" 
                    value={textoCustom} 
                    onChange={e => setTextoCustom(e.target.value)}
                    placeholder="Ej. Tema 1"
                    style={{ margin: 0, flex: 1, border: '2px solid var(--accent-yellow)', minWidth: 0, fontSize: '1rem', padding: '0.8rem' }}
                  />
                  <button type="submit" className="pill-btn hover-opacity" style={{ backgroundColor: 'var(--accent-yellow)', color: '#000', fontWeight: 'bold', padding: '0 1.2rem' }}>
                    Añadir
                  </button>
                </form>
              )}

              {/* Lista expansible con Scroll */}
              <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignContent: 'flex-start' }}>
                {opciones.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', margin: 'auto' }}>La ruleta está vacía.</p>
                ) : (
                  opciones.map(op => (
                    <span key={op.id} style={{ backgroundColor: 'var(--bg-input)', padding: '0.4rem 0.8rem', borderRadius: '50px', fontSize: '0.9rem', color: 'var(--text-main)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {op.texto}
                      {modo === 'custom' && (
                        <button type="button" onClick={() => eliminarOpcionCustom(op.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 0, fontSize: '1.1rem', lineHeight: 1 }}>✖</button>
                      )}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* COLUMNA 2: LA RULETA Y TEMAS */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0' }}>
            
            {/* Selector de Temas */}
            <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-panel)', padding: '0.5rem', borderRadius: '50px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
              <button onClick={() => setTema('clasico')} style={{ padding: '0.3rem 1rem', borderRadius: '50px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: tema === 'clasico' ? '#1E88E5' : 'transparent', color: tema === 'clasico' ? 'white' : 'var(--text-muted)' }}>Clásico</button>
              <button onClick={() => setTema('neon')} style={{ padding: '0.3rem 1rem', borderRadius: '50px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: tema === 'neon' ? '#FF00FF' : 'transparent', color: tema === 'neon' ? 'white' : 'var(--text-muted)' }}>Neón</button>
              <button onClick={() => setTema('pastel')} style={{ padding: '0.3rem 1rem', borderRadius: '50px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: tema === 'pastel' ? '#BAE1FF' : 'transparent', color: tema === 'pastel' ? '#333' : 'var(--text-muted)' }}>Pastel</button>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', position: 'relative', margin: '2rem 0' }}>
              {ganador && (
                <div className="confetti-container">
                  {Array.from({ length: 50 }).map((_, i) => (
                    <div key={i} className="confetti-piece" style={{ left: `${Math.random() * 100}%`, backgroundColor: temaActual.colores[i % temaActual.colores.length], animationDelay: `${Math.random() * 2}s` }}></div>
                  ))}
                </div>
              )}

              {opciones.length > 0 ? (
                <div style={{ position: 'relative', zIndex: 5, width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <div className="ruleta-flecha" style={{ borderTopColor: 'var(--text-main)', top: '-15px' }}></div>
                  <div 
                    className="ruleta-container" 
                    style={{ background: `conic-gradient(${conicGradientString})`, transform: `rotate(${rotacion}deg)`, transitionDuration: '4s', border: '8px solid var(--bg-panel)', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', width: 'min(90vw, 450px)', height: 'min(90vw, 450px)' }}
                  >
                    {opciones.map((op, i) => {
                      const rot = (360 / opciones.length) * i + (360 / opciones.length) / 2 - 90;
                      const size = opciones.length > 40 ? '10px' : opciones.length > 25 ? '12px' : '16px';

                      return (
                        <div key={op.id} style={{ position: 'absolute', top: '50%', left: '50%', width: '50%', transformOrigin: '0 0', transform: `rotate(${rot}deg)` }}>
                          <div style={{ position: 'absolute', left: '40px', top: '0', transform: 'translateY(-50%)', color: temaActual.texto, fontWeight: '800', fontSize: size, whiteSpace: 'nowrap', textShadow: `1px 1px 3px ${temaActual.sombra}` }}>
                            {op.texto.length > 25 ? op.texto.substring(0, 25) + '...' : op.texto}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem', opacity: 0.5 }}>🎡</span>
                  <h2>Ruleta Vacía</h2>
                </div>
              )}
            </div>

            <button 
              onClick={girarRuleta} 
              disabled={girando || opciones.length === 0} 
              className="pill-btn hover-opacity" 
              style={{ 
                backgroundColor: 'var(--accent-yellow)', color: '#000', fontSize: '1.4rem', padding: '1.5rem 3rem', boxShadow: '0 8px 0 #b28000', transform: girando ? 'translateY(8px)' : 'none', transition: 'all 0.1s', border: 'none', letterSpacing: '1px', width: '100%', maxWidth: '350px', fontWeight: '900', flexShrink: 0
              }}
            >
              {girando ? 'GIRANDO...' : '🎡 GIRAR RULETA'}
            </button>
          </div>

          {/* COLUMNA 3: PANEL DE GANADORES */}
          <div className="panel-ruleta">
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(28, 81, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-blue)', fontSize: '1.2rem' }}>🏆 Ganadores</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Historial de la sesión.</p>
              </div>
              <button onClick={exportarPDF} className="pill-btn" style={{ background: '#185ABD', color: 'white', padding: '0.4rem 0.8rem', fontSize: '0.85rem', fontWeight: 'bold' }}>
                📄 PDF
              </button>
            </div>

            <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {ganador && (
                <div style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)', border: '2px solid var(--accent-yellow)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', textAlign: 'center', animation: 'fadeIn 0.5s' }}>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '0.3rem' }}>Último Ganador:</span>
                  <strong style={{ fontSize: '1.3rem', color: 'var(--accent-yellow)' }}>{ganador.texto}</strong>
                </div>
              )}

              {historialGanadores.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>Aún no hay seleccionados.</p>
              ) : (
                <ol style={{ paddingLeft: '1.2rem', margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {historialGanadores.map((ganadorHist, i) => (
                    <li key={i} style={{ backgroundColor: 'var(--bg-input)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: 'bold', wordBreak: 'break-word' }}>
                      {ganadorHist.texto}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
              <button onClick={limpiarTodo} className="pill-btn" style={{ width: '100%', backgroundColor: 'transparent', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', fontWeight: 'bold' }}>
                🗑 Limpiar Todo (Ruleta y Ganadores)
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}