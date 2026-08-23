import { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';
import SuperAdmin from './pages/SuperAdmin';
import PizarraAlumno from './pages/PizarraAlumno';
import { TutorialProvider } from './context/TutorialContext';
import { signOut } from 'firebase/auth'; 
import { auth } from './services/firebase'; 

interface SessionInfo {
  isLoggedIn: boolean;
  role: 'docente' | 'admin' | 'alumno' | null; 
  user: any;
}

export default function App() {
  const [session, setSession] = useState<SessionInfo>({ isLoggedIn: false, role: null, user: null });
  const [cargando, setCargando] = useState(true);
  
  const [vistaAdmin, setVistaAdmin] = useState<'admin' | 'docente'>('docente');

  useEffect(() => {
    const sesionGuardada = localStorage.getItem('aulaPlusSession');
    const sesionAlumno = sessionStorage.getItem('aulaPlusAlumnoSession'); // Recuperamos memoria temporal
    
    if (sesionGuardada) {
      const data = JSON.parse(sesionGuardada);
      setSession(data);
      if (data.role === 'admin') setVistaAdmin('docente');
    } else if (sesionAlumno) {
      const data = JSON.parse(sesionAlumno);
      setSession(data);
    }
    setCargando(false);
  }, []);

  const handleLogin = (role: 'docente' | 'admin' | 'alumno', user: any) => {
    const data = { isLoggedIn: true, role, user };
    
    if (role !== 'alumno') {
      localStorage.setItem('aulaPlusSession', JSON.stringify(data));
    } else {
      // Guardamos al alumno solo mientras la pestaña esté abierta
      sessionStorage.setItem('aulaPlusAlumnoSession', JSON.stringify(data));
    }
    setSession(data);
    if (role === 'admin') setVistaAdmin('docente');
  };

  const handleLogout = async () => {
    try {
      sessionStorage.setItem('forzarCierreAulaPlus', 'true');
      await signOut(auth);
      localStorage.removeItem('aulaPlusSession');
      sessionStorage.removeItem('aulaPlusAlumnoSession');
      setSession({ isLoggedIn: false, role: null, user: null });
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const salirPizarra = () => {
    sessionStorage.removeItem('aulaPlusAlumnoSession');
    setSession({ isLoggedIn: false, role: null, user: null });
  };

  if (cargando) return <div className="loader" style={{marginTop: '20vh'}}></div>;

  return (
    <TutorialProvider>
      {!session.isLoggedIn ? (
        <Login onLogin={handleLogin} />
      ) : session.role === 'alumno' ? (
        <PizarraAlumno onVolver={salirPizarra} />
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