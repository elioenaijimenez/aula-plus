import { createContext, useState, useContext, ReactNode } from 'react';

interface TutorialContextType {
  ayudaActiva: boolean;
  toggleAyuda: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [ayudaActiva, setAyudaActiva] = useState(false);

  const toggleAyuda = () => setAyudaActiva(prev => !prev);

  return (
    <TutorialContext.Provider value={{ ayudaActiva, toggleAyuda }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) throw new Error('useTutorial debe usarse dentro de un TutorialProvider');
  return context;
}