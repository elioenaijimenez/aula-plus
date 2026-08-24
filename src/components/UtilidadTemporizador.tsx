import { useState, useEffect } from 'react';


type ModoTemporizador = 'bomba' | 'zen';

export default function UtilidadTemporizador({ onVolver }: { onVolver: () => void }) {
  const [horas, setHoras] = useState(0);
  const [minutos, setMinutos] = useState(5); 
  const [segundos, setSegundos] = useState(0);
  
  const [tiempoRestante, setTiempoRestante] = useState(0);
  const [tiempoTotal, setTiempoTotal] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [terminado, setTerminado] = useState(false);
  
  const [modo, setModo] = useState<ModoTemporizador>('bomba');
  const [conSonido, setConSonido] = useState(true);
  const [errorValidacion, setErrorValidacion] = useState('');

  const reproducirTic = () => {
    if (!conSonido || modo === 'zen') return; 
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    } catch (e) { console.error("Audio block"); }
  };

  const reproducirAlarma = () => {
    if (!conSonido) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      if (modo === 'zen') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.5); 
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 2);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 2);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 1.5);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 1.5);
      }
    } catch (e) {}
  };

  useEffect(() => {
    let intervalo: any;
    if (corriendo && tiempoRestante > 0) {
      intervalo = setInterval(() => {
        setTiempoRestante(t => t - 1);
        reproducirTic();
      }, 1000);
    } else if (corriendo && tiempoRestante === 0) {
      setCorriendo(false);
      setTerminado(true);
      reproducirAlarma();
    }
    return () => clearInterval(intervalo);
  }, [corriendo, tiempoRestante]);

  const aplicarPreset = (m: number) => {
    setHoras(0); setMinutos(m); setSegundos(0);
    setErrorValidacion('');
  };

  const iniciar = () => {
    setErrorValidacion('');
    const totalSegundos = (horas * 3600) + (minutos * 60) + segundos;
    
    if (totalSegundos === 0) { setErrorValidacion('¡Ups! El tiempo no puede ser cero.'); return; }
    if (totalSegundos > 10800) { setErrorValidacion('Límite excedido. El máximo es de 3 horas.'); return; }
    
    setTiempoTotal(totalSegundos);
    setTiempoRestante(totalSegundos);
    setTerminado(false);
    setCorriendo(true);
  };

  const pausar = () => setCorriendo(false);
  const reanudar = () => setCorriendo(true);
  
  const reiniciar = () => {
    setCorriendo(false);
    setTerminado(false);
    setTiempoRestante(tiempoTotal);
  };

  const modificarTiempo = (cantidadSegundos: number) => {
    setTiempoRestante(prev => {
      let nuevoTiempo = prev + cantidadSegundos;
      if (nuevoTiempo < 0) nuevoTiempo = 0;
      if (nuevoTiempo > 10800) nuevoTiempo = 10800; 
      if (nuevoTiempo > tiempoTotal) setTiempoTotal(nuevoTiempo); 
      return nuevoTiempo;
    });
  };

  const formatoTiempo = (segs: number) => {
    const h = Math.floor(segs / 3600);
    const m = Math.floor((segs % 3600) / 60);
    const s = segs % 60;
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const porcentaje = tiempoTotal > 0 ? (tiempoRestante / tiempoTotal) * 100 : 100;
  
  let colorPrimario = 'var(--accent-blue)';
  let colorPeligro = 'var(--accent-red)';
  let colorAdvertencia = 'var(--accent-yellow)';
  let emojiModo = '⏱️';

  if (modo === 'bomba') { colorPrimario = '#E53935'; colorAdvertencia = '#FB8C00'; emojiModo = '💣'; }
  if (modo === 'zen') { colorPrimario = '#4CAF50'; colorAdvertencia = '#8BC34A'; colorPeligro = '#FFB300'; emojiModo = '🧘'; }

  let colorActual = colorPrimario;
  let emojiEstado = emojiModo;
  if (porcentaje <= 30) { colorActual = colorAdvertencia; emojiEstado = modo === 'zen' ? '🔔' : '⚠️'; }
  if (tiempoRestante <= 10 && tiempoRestante > 0) { colorActual = colorPeligro; emojiEstado = modo === 'zen' ? '⏳' : '🔥'; }
  if (terminado) { colorActual = colorPeligro; emojiEstado = '💥'; }

  return (
    <div className="fullscreen-bg" style={{ animation: 'fadeIn 0.3s' }}>
      
      {/* VISTA DE CONFIGURACIÓN */}
      {!corriendo && !terminado && tiempoRestante === 0 && (
        <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '30px', border: '1px solid var(--border-color)', animation: 'fadeIn 0.4s', maxWidth: '600px', width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.8rem' }}>⏳ Ajustar Temporizador</h2>
            <button onClick={onVolver} className="pill-btn" style={{ background: 'var(--bg-input)', border: 'none', padding: '0.5rem 1rem', color: 'var(--text-muted)' }}>✕ Salir</button>
          </div>
          
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '0.8rem' }}>1. Selecciona el Modo</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.8rem' }}>
              <div onClick={() => setModo('bomba')} style={{ backgroundColor: modo === 'bomba' ? 'rgba(229, 57, 53, 0.1)' : 'var(--bg-input)', border: `2px solid ${modo === 'bomba' ? '#E53935' : 'transparent'}`, padding: '1rem', borderRadius: '16px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>💣</span>
                <span style={{ fontWeight: 'bold', color: modo === 'bomba' ? '#E53935' : 'var(--text-main)' }}>Bomba</span>
              </div>
              <div onClick={() => setModo('zen')} style={{ backgroundColor: modo === 'zen' ? 'rgba(76, 175, 80, 0.1)' : 'var(--bg-input)', border: `2px solid ${modo === 'zen' ? '#4CAF50' : 'transparent'}`, padding: '1rem', borderRadius: '16px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🧘</span>
                <span style={{ fontWeight: 'bold', color: modo === 'zen' ? '#4CAF50' : 'var(--text-main)' }}>Examen (Zen)</span>
              </div>
            </div>
          </div>

          <label style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '0.8rem' }}>2. Configura el Tiempo</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {[1, 3, 5, 10, 15, 25].map(m => (
              <button key={m} onClick={() => aplicarPreset(m)} style={{ flex: 1, padding: '0.6rem', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', fontWeight: 'bold', cursor: 'pointer', minWidth: '40px' }}>{m}m</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem', backgroundColor: 'var(--bg-app)', padding: '1.5rem', borderRadius: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>Horas</label>
              <input type="number" value={horas} onChange={e => setHoras(Math.min(3, Math.max(0, Number(e.target.value))))} style={{ fontSize: '2rem', width: '60px', textAlign: 'center', backgroundColor: 'transparent', border: 'none', borderBottom: '3px solid var(--text-muted)', color: 'var(--text-main)', fontWeight: 'bold', outline: 'none' }} />
            </div>
            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-muted)', marginTop: '1rem' }}>:</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>Minutos</label>
              <input type="number" value={minutos} onChange={e => setMinutos(Math.min(59, Math.max(0, Number(e.target.value))))} style={{ fontSize: '2rem', width: '60px', textAlign: 'center', backgroundColor: 'transparent', border: 'none', borderBottom: `3px solid ${colorPrimario}`, color: 'var(--text-main)', fontWeight: 'bold', outline: 'none' }} />
            </div>
            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-muted)', marginTop: '1rem' }}>:</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>Segundos</label>
              <input type="number" value={segundos} onChange={e => setSegundos(Math.min(59, Math.max(0, Number(e.target.value))))} style={{ fontSize: '2rem', width: '60px', textAlign: 'center', backgroundColor: 'transparent', border: 'none', borderBottom: '3px solid var(--text-muted)', color: 'var(--text-main)', fontWeight: 'bold', outline: 'none' }} />
            </div>
          </div>
          
          {errorValidacion && <div style={{ backgroundColor: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 'bold', textAlign: 'center' }}>{errorValidacion}</div>}

          <button onClick={iniciar} className="pill-btn hover-opacity" style={{ backgroundColor: colorPrimario, color: 'white', padding: '1rem', fontSize: '1.2rem', width: '100%', fontWeight: '900', letterSpacing: '1px', boxShadow: `0 6px 0 ${colorPrimario}80` }}>
            ▶ INICIAR
          </button>
        </div>
      )}

      {/* VISTA DEL CRONÓMETRO CORRIENDO */}
      {(corriendo || tiempoRestante > 0 || terminado) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', backgroundColor: 'var(--bg-app)', padding: '1rem', boxSizing: 'border-box' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '800px', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ backgroundColor: 'var(--bg-panel)', padding: '0.4rem 0.8rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '1.2rem' }}>{emojiEstado}</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-main)', textTransform: 'uppercase', fontSize: '0.9rem' }}>Modo {modo}</span>
            </div>
            <button onClick={() => setConSonido(!conSonido)} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '50px', padding: '0.4rem 0.8rem', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              {conSonido ? '🔊 Sonido ON' : '🔇 Muteado'}
            </button>
          </div>

          {/* RELOJ GIGANTE Y BARRA DE PROGRESO */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '800px', flex: 1 }}>
            
            <div className={terminado || (tiempoRestante <= 10 && tiempoRestante > 0) ? 'pulse-fast' : ''} style={{ 
              fontSize: 'clamp(4rem, 18vw, 15rem)', 
              fontWeight: 900, 
              color: colorActual, 
              lineHeight: 1, 
              fontFamily: 'monospace', 
              textShadow: `0 0 40px ${colorActual}60`,
              transition: 'color 0.5s ease',
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'center'
            }}>
              {terminado ? "00:00" : formatoTiempo(tiempoRestante)}
            </div>

            {/* BARRA DE PROGRESO DEBAJO DE LOS NÚMEROS */}
            <div style={{ width: '90%', height: '24px', backgroundColor: 'var(--bg-input)', borderRadius: '12px', overflow: 'hidden', marginTop: '1rem', marginBottom: '1rem', border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.1)' }}>
              <div style={{ width: `${porcentaje}%`, height: '100%', backgroundColor: colorActual, transition: 'width 1s linear, background-color 0.5s ease', boxShadow: `0 0 15px ${colorActual}` }}></div>
            </div>

            {terminado && <h1 className="shake" style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)', color: colorPeligro, margin: '1rem 0', textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center' }}>¡TIEMPO AGOTADO!</h1>}
          </div>

          {/* CONTROLES DEL MAESTRO */}
          <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-panel)', padding: '1rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
            
            {!terminado && (
              <div>
                <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '0.85rem', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px' }}>Comodines del Maestro</p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => modificarTiempo(60)} className="pill-btn" style={{ backgroundColor: 'rgba(46, 229, 92, 0.1)', border: '2px solid var(--accent-green)', color: 'var(--accent-green)', fontWeight: 'bold', flex: 1, minWidth: '100px', padding: '0.6rem' }}>⭐ +1 Min</button>
                  <button onClick={() => modificarTiempo(30)} className="pill-btn" style={{ backgroundColor: 'rgba(28, 81, 255, 0.1)', border: '2px solid var(--accent-blue)', color: 'var(--accent-blue)', fontWeight: 'bold', flex: 1, minWidth: '100px', padding: '0.6rem' }}>✨ +30 Seg</button>
                  <button onClick={() => modificarTiempo(-30)} className="pill-btn" style={{ backgroundColor: 'rgba(255, 77, 79, 0.1)', border: '2px dashed var(--accent-red)', color: 'var(--accent-red)', fontWeight: 'bold', flex: 1, minWidth: '100px', padding: '0.6rem' }}>⚡ -30 Seg</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {corriendo ? (
                <button onClick={pausar} className="pill-btn" style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-app)', fontSize: '1rem', padding: '0.8rem 1rem', flex: 1, minWidth: '120px', fontWeight: 'bold' }}>⏸ Pausar</button>
              ) : (
                !terminado && <button onClick={reanudar} className="pill-btn" style={{ backgroundColor: colorActual, color: 'white', fontSize: '1rem', padding: '0.8rem 1rem', flex: 1, minWidth: '120px', fontWeight: 'bold' }}>▶ Reanudar</button>
              )}
              <button onClick={reiniciar} className="pill-btn" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '1rem', padding: '0.8rem 1rem', flex: 1, minWidth: '120px', fontWeight: 'bold' }}>⏹ Reiniciar</button>
              <button onClick={() => { reiniciar(); setTiempoRestante(0); }} className="pill-btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-muted)', fontSize: '1rem', padding: '0.8rem 1rem', flex: 1, minWidth: '120px', fontWeight: 'bold' }}>⚙️ Ajustes</button>
            </div>
          </div>
          
          <style>{`
            .pulse-fast { animation: pulse 1s infinite; }
            @keyframes pulse {
              0% { transform: scale(1); }
              50% { transform: scale(1.02); }
              100% { transform: scale(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}