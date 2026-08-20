import { useState, useEffect } from 'react';
import TutorialTooltip from './TutorialTooltip';

export default function UtilidadTemporizador({ onVolver }: { onVolver: () => void }) {
  const [horas, setHoras] = useState(0);
  const [minutos, setMinutos] = useState(5); 
  const [segundos, setSegundos] = useState(0);
  
  const [tiempoRestante, setTiempoRestante] = useState(0);
  const [tiempoTotal, setTiempoTotal] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [terminado, setTerminado] = useState(false);
  const [conSonido, setConSonido] = useState(true);
  const [errorValidacion, setErrorValidacion] = useState('');

  const reproducirTic = () => {
    if (!conSonido) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.05);
  };

  const reproducirAlarma = () => {
    if (!conSonido) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 1);
    osc.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 1);
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

  const iniciar = () => {
    setErrorValidacion('');
    let totalSegundos = (horas * 3600) + (minutos * 60) + segundos;
    
    if (totalSegundos === 0) {
      setErrorValidacion('Error: El tiempo configurado no puede ser cero.');
      return;
    }
    if (totalSegundos > 10800) {
      setErrorValidacion('Error: El tiempo máximo permitido es de 3 horas.');
      return;
    }
    
    setTiempoTotal(totalSegundos);
    setTiempoRestante(totalSegundos);
    setTerminado(false);
    setCorriendo(true);
  };

  const pausar = () => setCorriendo(false);
  
  const reiniciar = () => {
    setCorriendo(false);
    setTerminado(false);
    setTiempoRestante(0);
  };

  const modificarTiempo = (cantidadSegundos: number) => {
    setTiempoRestante(prev => {
      let nuevoTiempo = prev + cantidadSegundos;
      if (nuevoTiempo < 0) nuevoTiempo = 0;
      if (nuevoTiempo > 10800) nuevoTiempo = 10800; 
      
      if (nuevoTiempo > tiempoTotal) {
        setTiempoTotal(nuevoTiempo);
      }
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
  
  let colorActual = 'var(--accent-green)';
  let emojiActual = '🟢😎';
  if (porcentaje <= 50) { colorActual = 'var(--accent-yellow)'; emojiActual = '🟡😬'; }
  if (tiempoRestante <= 10 && tiempoRestante > 0) { colorActual = 'var(--accent-red)'; emojiActual = '🔴⏳'; }
  if (terminado) { colorActual = 'var(--accent-red)'; emojiActual = '💥💥'; }

  return (
    <div className="fullscreen-bg">
      
      {/* VISTA DE CONFIGURACIÓN */}
      {!corriendo && !terminado && tiempoRestante === 0 && (
        <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', textAlign: 'center', border: '1px solid var(--border-color)', animation: 'fadeIn 0.3s', maxWidth: '90%', width: '400px' }}>
          <h2 style={{ margin: '0 0 1.5rem 0', color: 'var(--accent-red)' }}>⏱️ Temporizador Bomba</h2>
          
          <TutorialTooltip mensaje="El temporizador permite un máximo de 3 horas (10,800 segundos)." posicion="top">
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <label style={{ color: 'var(--text-muted)' }}>Hrs</label>
                <input type="number" value={horas} onChange={e => setHoras(Math.min(3, Math.max(0, Number(e.target.value))))} className="score-input" style={{ fontSize: '1.5rem', width: '70px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <label style={{ color: 'var(--text-muted)' }}>Min</label>
                <input type="number" value={minutos} onChange={e => setMinutos(Math.min(59, Math.max(0, Number(e.target.value))))} className="score-input" style={{ fontSize: '1.5rem', width: '70px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <label style={{ color: 'var(--text-muted)' }}>Seg</label>
                <input type="number" value={segundos} onChange={e => setSegundos(Math.min(59, Math.max(0, Number(e.target.value))))} className="score-input" style={{ fontSize: '1.5rem', width: '70px' }} />
              </div>
            </div>
          </TutorialTooltip>
          
          {errorValidacion && (
            <div style={{ backgroundColor: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
              {errorValidacion}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexDirection: 'column' }}>
            <button onClick={iniciar} className="pill-btn" style={{ backgroundColor: 'var(--accent-red)', color: 'white', padding: '1rem', fontSize: '1.2rem', width: '100%' }}>▶ Iniciar Tiempo</button>
            <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', color: 'var(--text-muted)' }}>Cancelar y Salir</button>
          </div>
        </div>
      )}

      {/* VISTA DEL CRONÓMETRO CORRIENDO */}
      {(corriendo || tiempoRestante > 0 || terminado) && (
        <div className="timer-layout">
          
          <button className="timer-side-btn" onClick={() => modificarTiempo(-10)} style={{ display: window.innerWidth > 900 ? 'flex' : 'none' }} title="Penalizar (-10s)">-10s</button>
          
          <div className="timer-main">
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '3rem' }}>{emojiActual}</span>
              <TutorialTooltip mensaje="El temporizador emite un sonido de 'bomba' y una alarma aguda al finalizar." posicion="right">
                <button onClick={() => setConSonido(!conSonido)} style={{ background: 'none', border: 'none', fontSize: '2.5rem', cursor: 'pointer' }}>
                  {conSonido ? '🔊' : '🔇'}
                </button>
              </TutorialTooltip>
            </div>

            <div style={{ width: '100%', height: '20px', backgroundColor: 'var(--bg-input)', borderRadius: '10px', overflow: 'hidden', marginBottom: '2rem' }}>
              <div style={{ width: `${porcentaje}%`, height: '100%', backgroundColor: colorActual, transition: 'width 1s linear, background-color 0.5s ease' }}></div>
            </div>

            <div className={`timer-display ${terminado ? 'shake' : ''}`} style={{ color: colorActual, width: '100%' }}>
              {terminado ? "00:00" : formatoTiempo(tiempoRestante)}
            </div>

            {terminado && <h1 className="shake" style={{ fontSize: 'clamp(2rem, 8vw, 4rem)', color: 'var(--accent-red)', margin: '1rem 0 3rem 0', textAlign: 'center' }}>¡TERMINÓ EL TIEMPO!</h1>}

            <div className="timer-sides-mobile" style={{ display: window.innerWidth <= 900 ? 'flex' : 'none' }}>
              <button className="timer-side-btn" onClick={() => modificarTiempo(-10)} title="Penalizar (-10s)">-10s</button>
              <button className="timer-side-btn" onClick={() => modificarTiempo(10)} title="Bonificar (+10s)">+10s</button>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
              {corriendo ? (
                <button onClick={pausar} className="pill-btn" style={{ backgroundColor: 'var(--accent-yellow)', color: '#000', fontSize: '1.2rem', padding: '1rem 2rem', flex: 1, minWidth: '150px' }}>⏸ Pausar</button>
              ) : (
                !terminado && <button onClick={() => setCorriendo(true)} className="pill-btn" style={{ backgroundColor: 'var(--accent-green)', color: '#000', fontSize: '1.2rem', padding: '1rem 2rem', flex: 1, minWidth: '150px' }}>▶ Reanudar</button>
              )}
              <button onClick={reiniciar} className="pill-btn" style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '1.2rem', padding: '1rem 2rem', flex: 1, minWidth: '150px' }}>⏹ Reiniciar</button>
              <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', color: 'var(--text-muted)', flex: 1, minWidth: '150px' }}>Salir</button>
            </div>
          </div>

          <button className="timer-side-btn" onClick={() => modificarTiempo(10)} style={{ display: window.innerWidth > 900 ? 'flex' : 'none' }} title="Bonificar (+10s)">+10s</button>

        </div>
      )}
    </div>
  );
}