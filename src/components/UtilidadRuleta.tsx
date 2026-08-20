import { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
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

  useEffect(() => {
    const fetchGrupos = async () => {
      const q = query(collection(db, 'groups'));
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

  const aplicarListaCustom = () => {
    const lineas = textoCustom.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lineas.length === 0) return;
    const nuevasOpciones = lineas.map((linea, index) => ({ id: `custom-${Date.now()}-${index}`, texto: linea }));
    setOpciones(nuevasOpciones);
    setGanador(null);
    setHistorialGanadores([]);
    setTextoCustom('');
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
    conicGradientString = opciones.map((op, i) => `${colores[i % colores.length]} ${i * pedazo}deg ${(i + 1) * pedazo}deg`).join(', ');
  }

  return (
    <div className="fullscreen-bg">
      
      <div style={{ flexShrink: 0, display: 'flex', gap: '1rem', padding: '1rem 2rem', width: '100%', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', alignItems: 'center', flexWrap: 'wrap', zIndex: 100 }}>
        <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'var(--bg-input)', color: 'white', border: '1px solid var(--border-color)' }}>← Salir</button>
        
        <TutorialTooltip mensaje="Alterna entre cargar la lista de un grupo oficial, o escribir tus propios textos para rifar temas o actividades." posicion="bottom">
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-input)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <button onClick={() => handleCambiarModo('grupo')} style={{ padding: '0.5rem 1rem', border: 'none', background: modo === 'grupo' ? 'var(--accent-blue)' : 'transparent', color: modo === 'grupo' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}>Mis Grupos</button>
            <button onClick={() => handleCambiarModo('custom')} style={{ padding: '0.5rem 1rem', border: 'none', background: modo === 'custom' ? 'var(--accent-purple)' : 'transparent', color: modo === 'custom' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}>Personalizada</button>
          </div>
        </TutorialTooltip>

        {modo === 'grupo' && (
          <select className="search-input" value={grupoSeleccionado} onChange={e => setGrupoSeleccionado(e.target.value)} style={{ width: '100%', maxWidth: '300px' }}>
            <option value="">Selecciona un Grupo</option>
            {grupos.map(g => <option key={g.id} value={g.id}>{g.name} - {g.subject}</option>)}
          </select>
        )}

        {opciones.length > 0 && (
          <TutorialTooltip mensaje="Si está activo, el alumno o elemento seleccionado desaparecerá de la ruleta para no repetir ganadores." posicion="bottom">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-input)', padding: '0.5rem 1rem', borderRadius: '50px', fontSize: '0.9rem', border: '1px solid var(--border-color)' }}>
              <input type="checkbox" checked={removerGanador} onChange={e => setRemoverGanador(e.target.checked)} /> Remover al ganar
            </label>
          </TutorialTooltip>
        )}
      </div>

      {cargando ? <div className="loader" style={{marginTop: '5rem'}}></div> : (
        <div className="ruleta-grid-layout">
          
          <div className="ruleta-lista-area">
            {modo === 'custom' && (
              <div style={{ marginBottom: '1.5rem', width: '100%' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-purple)', fontSize: '1rem' }}>Escribe opciones (Una por línea)</h3>
                <textarea 
                  className="search-input" 
                  value={textoCustom} 
                  onChange={e => setTextoCustom(e.target.value)}
                  placeholder="Ej.&#10;Exponer Tema 1&#10;Revisar Tarea&#10;Dinámica de grupo"
                  style={{ minHeight: '150px', resize: 'vertical', marginBottom: '0.8rem', fontSize: '0.9rem', width: '100%' }}
                />
                <button onClick={aplicarListaCustom} className="pill-btn" style={{ width: '100%', backgroundColor: 'var(--accent-purple)', color: 'white' }}>Agregar a la ruleta</button>
              </div>
            )}

            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '1.1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>📝 Lista de Ganadores</h3>
            {historialGanadores.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Aún no hay seleccionados.</p>
            ) : (
              <ol style={{ paddingLeft: '1.2rem', margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {historialGanadores.map((ganadorHist, i) => (
                  <li key={i} style={{ backgroundColor: 'var(--bg-input)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: 'bold', wordBreak: 'break-word' }}>
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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '0 1rem', minHeight: '60px' }}>
              {ganador ? (
                <h1 className="shake" style={{ fontSize: 'clamp(1.2rem, 3vw, 1.8rem)', margin: 0, color: 'var(--text-main)', textShadow: '0 4px 10px rgba(0,0,0,0.5)', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.2', textAlign: 'center' }}>
                  🎉 ¡{ganador.texto}! 🎉
                </h1>
              ) : (
                <h2 style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: 'clamp(1rem, 4vw, 1.2rem)', margin: 0 }}>
                  {modo === 'grupo' ? '👆 Selecciona un grupo arriba' : '👆 Ingresa opciones en el panel'}
                </h2>
              )}
            </div>

            {opciones.length > 0 && (
              <div style={{ position: 'relative', zIndex: 5, width: '100%', display: 'flex', justifyContent: 'center' }}>
                <div className="ruleta-flecha"></div>
                <div 
                  className="ruleta-container" 
                  style={{ background: `conic-gradient(${conicGradientString})`, transform: `rotate(${rotacion}deg)`, transitionDuration: '4s' }}
                >
                  {opciones.map((op, i) => {
                    const rot = (360 / opciones.length) * i + (360 / opciones.length) / 2;
                    const size = opciones.length > 40 ? '9px' : opciones.length > 25 ? '11px' : '14px';

                    return (
                      <div key={op.id} style={{ position: 'absolute', top: '50%', left: '50%', width: '50%', transformOrigin: '0 0', transform: `rotate(${rot}deg)` }}>
                        <div style={{ position: 'absolute', left: '35px', top: '0', transform: 'translateY(-50%)', color: '#FFFFFF', fontWeight: '700', fontSize: size, whiteSpace: 'nowrap', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
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
              className="pill-btn" 
              style={{ 
                backgroundColor: 'var(--accent-blue)', color: 'white', fontSize: '1.2rem', padding: '1.5rem 3rem', boxShadow: '0 8px 0 #1036B5', transform: girando ? 'translateY(8px)' : 'none', transition: 'all 0.1s', border: 'none', letterSpacing: '1px', width: '100%', maxWidth: '300px'
              }}
            >
              {girando ? 'GIRANDO...' : 'GIRAR RULETA'}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}