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
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginBottom: '1rem', padding: '0.3rem 0.8rem' }}>
            ← Volver al Inicio
          </button>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: '1.8rem', color: 'var(--accent-red)' }}>🛠️ Utilidades Docentes</h3>
          <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>Herramientas dinámicas para gamificar tu clase</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
        
        <TutorialTooltip mensaje="Inyecta los nombres de tus alumnos automáticamente o usa textos libres para rifar dinámicas y tareas." posicion="top" esBloque={true}>
          <div className="group-card" onClick={() => setHerramienta('ruleta')} style={{ '--card-color': 'var(--accent-yellow)' } as any}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎡</div>
            <h4 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)' }}>Ruleta de Participación</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Elige alumnos al azar. Modo pantalla completa con sonidos y animación de victoria.</p>
          </div>
        </TutorialTooltip>

        <TutorialTooltip mensaje="Controla el tiempo de exámenes y actividades. Puedes bonificar o penalizar segundos durante la cuenta." posicion="top" esBloque={true}>
          <div className="group-card" onClick={() => setHerramienta('temporizador')} style={{ '--card-color': 'var(--accent-red)' } as any}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⏱️</div>
            <h4 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)' }}>Temporizador Bomba</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Cronómetro visual con cambios de estado, emojis dinámicos y alarma final.</p>
          </div>
        </TutorialTooltip>

        <TutorialTooltip mensaje="Mezcla a tus alumnos en mesas de trabajo de forma balanceada y descarga la lista en formato Word." posicion="top" esBloque={true}>
          <div className="group-card" onClick={() => setHerramienta('equipos')} style={{ '--card-color': 'var(--accent-blue)' } as any}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🧩</div>
            <h4 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)' }}>Creador de Equipos</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Divide a tus grupos automática o manualmente y exporta las listas de trabajo.</p>
          </div>
        </TutorialTooltip>

      </div>
    </div>
  );
}