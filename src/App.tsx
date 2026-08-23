import { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';
import SuperAdmin from './pages/SuperAdmin';
import PizarraAlumno from './pages/PizarraAlumno'; // IMPORTAMOS LA NUEVA PIZARRA
import { TutorialProvider } from './context/TutorialContext';
import { signOut } from 'firebase/auth'; 
import { auth } from './services/firebase'; 

interface SessionInfo {
  isLoggedIn: boolean;
  role: 'docente' | 'admin' | 'alumno' | null; // AÑADIDO 'alumno'
  user: any;
}

export default function App() {
  const [session, setSession] = useState<SessionInfo>({ isLoggedIn: false, role: null, user: null });
  const [cargando, setCargando] = useState(true);
  
  const [vistaAdmin, setVistaAdmin] = useState<'admin' | 'docente'>('docente');

  useEffect(() => {
    const sesionGuardada = localStorage.getItem('aulaPlusSession');
    if (sesionGuardada) {
      const data = JSON.parse(sesionGuardada);
      setSession(data);
      if (data.role === 'admin') setVistaAdmin('docente');
    }
    setCargando(false);
  }, []);

  const handleLogin = (role: 'docente' | 'admin' | 'alumno', user: any) => {
    const data = { isLoggedIn: true, role, user };
    // Guardamos en memoria solo si no es alumno, para que el alumno no se quede logueado por error
    if (role !== 'alumno') {
      localStorage.setItem('aulaPlusSession', JSON.stringify(data));
    }
    setSession(data);
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

  // Función exclusiva para que los alumnos regresen al login
  const salirPizarra = () => {
    setSession({ isLoggedIn: false, role: null, user: null });
  };

  if (cargando) return <div className="loader" style={{marginTop: '20vh'}}></div>;

  return (
    <TutorialProvider>
      {!session.isLoggedIn ? (
        <Login onLogin={handleLogin} />
      ) : session.role === 'alumno' ? (
        // ENRUTAMIENTO HACIA LA PIZARRA
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