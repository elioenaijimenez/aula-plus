import { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';
import SuperAdmin from './pages/SuperAdmin';
import { TutorialProvider } from './context/TutorialContext';

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

  const handleLogout = () => {
    localStorage.removeItem('aulaPlusSession');
    setSession({ isLoggedIn: false, role: null, user: null });
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