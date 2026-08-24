import { useState } from 'react';
import UtilidadRuleta from './UtilidadRuleta';
import UtilidadTemporizador from './UtilidadTemporizador';
import UtilidadEquipos from './UtilidadEquipos';
import TutorialTooltip from './TutorialTooltip';

export default function Utilidades({ onVolver }: { onVolver: () => void }) {
  const [herramienta, setHerramienta] = useState<'menu' | 'ruleta' | 'temporizador' | 'equipos'>('menu');

  if (herramienta === 'ruleta') return <UtilidadRuleta onVolver={() => setHerramienta('menu')} />;
  if (herramienta === 'temporizador') return <UtilidadTemporizador onVolver={() => setHerramienta('menu')} />;
  if (herramienta === 'equipos') return <UtilidadEquipos onVolver={() => setHerramienta('menu')} />;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out', backgroundColor: 'var(--bg-panel)', padding: '2.5rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
      <style>{`
        .util-card {
          transition: all 0.3s ease;
          border-top: 5px solid var(--card-color);
          background-color: var(--bg-app);
          border-radius: 20px;
          padding: 2rem;
          border-left: 1px solid var(--border-color);
          border-right: 1px solid var(--border-color);
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
        }
        .util-card:hover {
          transform: translateY(-5px) scale(1.02);
          box-shadow: 0 12px 25px var(--glow-color);
          border-left-color: transparent;
          border-right-color: transparent;
          border-bottom-color: transparent;
          z-index: 10;
        }
      `}</style>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginBottom: '1rem', padding: '0.4rem 1rem' }}>
            ← Volver al Dashboard
          </button>
          <h3 style={{ margin: 0, fontWeight: 800, fontSize: '2.2rem', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>🛠️ Utilidades Docentes</h3>
          <p style={{ color: 'var(--text-muted)', margin: '0.4rem 0 0 0', fontSize: '1.1rem' }}>Herramientas dinámicas para gamificar y organizar tu clase</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
        
        <TutorialTooltip mensaje="Inyecta los nombres de tus alumnos automáticamente o usa textos libres para rifar dinámicas y tareas." posicion="top" esBloque={true}>
          <div className="util-card" onClick={() => setHerramienta('ruleta')} style={{ '--card-color': 'var(--accent-yellow)', '--glow-color': 'rgba(255, 193, 7, 0.2)' } as any}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎡</div>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', color: 'var(--text-main)' }}>Ruleta de Participación</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0, lineHeight: '1.5' }}>Elige alumnos al azar. Modo inmersivo con sonidos y animación de victoria.</p>
          </div>
        </TutorialTooltip>

        <TutorialTooltip mensaje="Controla el tiempo de exámenes y actividades. Puedes bonificar o penalizar segundos durante la cuenta." posicion="top" esBloque={true}>
          <div className="util-card" onClick={() => setHerramienta('temporizador')} style={{ '--card-color': 'var(--accent-red)', '--glow-color': 'rgba(255, 77, 79, 0.2)' } as any}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>⏱️</div>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', color: 'var(--text-main)' }}>Temporizador Bomba</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0, lineHeight: '1.5' }}>Cronómetro visual con cambios de estado, emojis dinámicos y alarma final.</p>
          </div>
        </TutorialTooltip>

        <TutorialTooltip mensaje="Mezcla a tus alumnos en mesas de trabajo de forma balanceada y descarga la lista en formato Word." posicion="top" esBloque={true}>
          <div className="util-card" onClick={() => setHerramienta('equipos')} style={{ '--card-color': 'var(--accent-blue)', '--glow-color': 'rgba(28, 81, 255, 0.2)' } as any}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🧩</div>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', color: 'var(--text-main)' }}>Creador de Equipos</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0, lineHeight: '1.5' }}>Divide a tus grupos automática o manualmente y exporta las listas de trabajo.</p>
          </div>
        </TutorialTooltip>

      </div>
    </div>
  );
}