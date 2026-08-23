import { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';
import SuperAdmin from './pages/SuperAdmin';
import { TutorialProvider } from './context/TutorialContext';
import { signOut } from 'firebase/auth'; 
import { auth } from './services/firebase'; 

interface SessionInfo {
  isLoggedIn: boolean;
  role: 'docente' | 'admin' | null;
  user: any;
}

export default function App() {
  const [session, setSession] = useState<SessionInfo>({ isLoggedIn: false, role: null, user: null });
  const [cargando, setCargando] = useState(true);
  
  // CAMBIO CLAVE 1: Por defecto, todos inician en la vista 'docente'
  const [vistaAdmin, setVistaAdmin] = useState<'admin' | 'docente'>('docente');

  useEffect(() => {
    const sesionGuardada = localStorage.getItem('aulaPlusSession');
    if (sesionGuardada) {
      const data = JSON.parse(sesionGuardada);
      setSession(data);
      // CAMBIO CLAVE 2: Si el admin recarga la página, lo devolvemos a su Dashboard de docente
      if (data.role === 'admin') setVistaAdmin('docente');
    }
    setCargando(false);
  }, []);

  const handleLogin = (role: 'docente' | 'admin', user: any) => {
    const data = { isLoggedIn: true, role, user };
    localStorage.setItem('aulaPlusSession', JSON.stringify(data));
    setSession(data);
    // CAMBIO CLAVE 3: Al iniciar sesión como admin, aterriza directo en la vista docente
    if (role === 'admin') setVistaAdmin('docente');
  };

  const handleLogout = async () => {
    try {
      sessionStorage.setItem('forzarCierreAulaPlus', 'true');
      await signOut(auth);
      localStorage.removeItem('aulaPlusSession');
      setSession({ isLoggedIn: false, role: null, user: null });
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  if (cargando) return <div className="loader" style={{marginTop: '20vh'}}></div>;

  return (
    <TutorialProvider>
      {!session.isLoggedIn ? (
        <Login onLogin={handleLogin} />
      ) : session.role === 'admin' && vistaAdmin === 'admin' ? (
        <SuperAdmin onLogout={handleLogout} onSwitchView={() => setVistaAdmin('docente')} />
      ) : (
        <Dashboard 
          onLogout={handleLogout} 
          onSwitchToAdmin={session.role === 'admin' ? () => setVistaAdmin('admin') : undefined} 
        />
      )}
    </TutorialProvider>
  );
}