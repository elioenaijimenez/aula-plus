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
  
  const [vistaAdmin, setVistaAdmin] = useState<'admin' | 'docente'>('admin');

  useEffect(() => {
    const sesionGuardada = localStorage.getItem('aulaPlusSession');
    if (sesionGuardada) {
      const data = JSON.parse(sesionGuardada);
      setSession(data);
      if (data.role === 'admin') setVistaAdmin('admin');
    }
    setCargando(false);
  }, []);

  const handleLogin = (role: 'docente' | 'admin', user: any) => {
    const data = { isLoggedIn: true, role, user };
    localStorage.setItem('aulaPlusSession', JSON.stringify(data));
    setSession(data);
    if (role === 'admin') setVistaAdmin('admin');
  };

  const handleLogout = async () => {
    try {
      // 1. Bandera para que Login.tsx sepa que fue un cierre intencional
      sessionStorage.setItem('forzarCierreAulaPlus', 'true');
      
      // 2. Cerramos la sesión directamente en los servidores de Google/Firebase
      await signOut(auth);
      
      // 3. Limpiamos la memoria local de Aula+
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