import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTutorial } from '../context/TutorialContext';

interface Props {
  mensaje: string;
  children: ReactNode;
  posicion?: 'top' | 'bottom' | 'left' | 'right';
  esBloque?: boolean;
}

export default function TutorialTooltip({ mensaje, children, posicion = 'bottom', esBloque = false }: Props) {
  const { ayudaActiva } = useTutorial();
  const [hover, setHover] = useState(false);

  if (!ayudaActiva) return <>{children}</>;

  const posiciones = {
    top: { bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)' },
    bottom: { top: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)' },
    left: { right: 'calc(100% + 10px)', top: '50%', transform: 'translateY(-50%)' },
    right: { left: 'calc(100% + 10px)', top: '50%', transform: 'translateY(-50%)' }
  };

  return (
    <div 
      style={{ 
        position: 'relative', 
        // Usamos flex en bloque para que la cápsula se adapte perfecto al Grid sin márgenes ocultos
        display: esBloque ? 'flex' : 'inline-flex',
        flexDirection: 'column',
        width: esBloque ? '100%' : 'fit-content',
        height: esBloque ? '100%' : 'fit-content'
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
      
      {hover && (
        <div style={{
          position: 'absolute',
          ...posiciones[posicion],
          backgroundColor: 'var(--accent-purple)',
          color: 'white',
          padding: '0.8rem 1rem',
          borderRadius: '12px',
          fontSize: '0.85rem',
          fontWeight: 500,
          whiteSpace: 'normal',
          maxWidth: '250px',
          textAlign: 'center',
          lineHeight: '1.4',
          zIndex: 9999,
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          animation: 'fadeIn 0.2s ease-in-out',
          pointerEvents: 'none'
        }}>
          💡 {mensaje}
        </div>
      )}
    </div>
  );
}