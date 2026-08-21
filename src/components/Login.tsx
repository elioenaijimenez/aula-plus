import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { signInWithPopup, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth'; 
import { db, auth, googleProvider } from '../services/firebase'; 
import TutorialTooltip from './TutorialTooltip';

export default function Login({ onLogin }: { onLogin: (role: 'docente' | 'admin', user: any) => void }) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [keyPlus, setKeyPlus] = useState('');
  const [aceptoTerminos, setAceptoTerminos] = useState(false);
  const [cargando, setCargando] = useState(false);
  
  const [verificandoSesion, setVerificandoSesion] = useState(true);
  
  const [forzarCierre, setForzarCierre] = useState(() => {
    return sessionStorage.getItem('forzarCierreAulaPlus') === 'true';
  });

  googleProvider.setCustomParameters({ prompt: 'select_account' });

  const resetearForzarCierre = () => {
    setForzarCierre(false);
    sessionStorage.removeItem('forzarCierreAulaPlus');
  };

  useEffect(() => {
    if (forzarCierre) {
      setVerificandoSesion(false);
      return;
    }

    const desuscribir = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userEmail = user.email || '';
        setEmail(userEmail);
        if (user.displayName) setNombre(user.displayName);

        if (userEmail === 'eliojimenezm@gmail.com' || userEmail === 'blaneguapo@gmail.com') { 
           onLogin('admin', { nombre: user.displayName || 'Admin', email: userEmail, telefono: '', keyPlus: 'SUPER-ADMIN-MASTER' });
           return;
        }

        try {
          // Buscamos CUALQUIER llave asociada a este correo (activa o caducada)
          const q = query(collection(db, 'keys'), where('correo', '==', userEmail));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            // Revisamos si alguna de sus llaves sigue 'en uso'
            const llavesActivas = querySnapshot.docs.filter(d => d.data().estado === 'en uso');
            
            if (llavesActivas.length > 0) {
              const docSnap = llavesActivas[0];
              const data = docSnap.data();
              
              const expira = new Date(data.fechaCaducidad);
              expira.setMinutes(expira.getMinutes() + expira.getTimezoneOffset());
              const hoy = new Date();

              if (hoy > expira) {
                await updateDoc(doc(db, 'keys', docSnap.id), { estado: 'caducada' });
                alert("⏳ Tu licencia KeyPlus ha expirado por tiempo.\nPor favor, contacta al Administrador para adquirir una nueva.");
                setPaso(2);
                setVerificandoSesion(false);
              } else {
                onLogin('docente', { nombre: data.usuario, email: userEmail, telefono: data.telefono, keyPlus: data.codigo });
              }
            } else {
              // Tiene llaves, pero TODAS están caducadas/revocadas
              alert("🛑 Acceso Denegado.\nTu licencia KeyPlus actual ha expirado o fue revocada por el Administrador. Ingresa una nueva licencia válida.");
              setPaso(2);
              setVerificandoSesion(false);
            }
          } else {
            setPaso(2);
            setVerificandoSesion(false);
          }
        } catch (error) {
          console.error("Error validando licencia:", error);
          setVerificandoSesion(false);
        }
      } else {
        setVerificandoSesion(false);
      }
    });

    return () => desuscribir();
  }, [onLogin, forzarCierre]);

  const iniciarSesionGoogle = async () => {
    resetearForzarCierre(); 
    setCargando(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Error Popup:", error);
      setCargando(false);
      if (error.code === 'auth/popup-blocked') {
        alert("⚠️ Tu navegador bloqueó la ventana. Por favor, permite las ventanas emergentes o usa 'Añadir a la pantalla de inicio'.");
      } else if (error.code !== 'auth/popup-closed-by-user') {
        alert(`Error técnico de Firebase:\nCódigo: ${error.code}\nMensaje: ${error.message}`);
      }
    }
  };

  const procesarIngreso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aceptoTerminos) return alert("Debes aceptar los términos y condiciones de privacidad.");
    if (keyPlus === 'SUPER-ADMIN-MASTER') return onLogin('admin', { nombre, email, telefono, keyPlus });

    setCargando(true);
    try {
      const q = query(collection(db, 'keys'), where('codigo', '==', keyPlus));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("La KeyPlus ingresada no existe. Verifica los caracteres.");
        setCargando(false);
        return;
      }

      const docSnap = querySnapshot.docs[0];
      const data = docSnap.data();
      const keyId = docSnap.id;
      const hoy = new Date();
      const fechaLocal = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().split('T')[0];

      if (data.estado === 'disponible') {
        let dias = 7;
        if (data.duracion === '1 Mes') dias = 30;
        if (data.duracion === '1 Año') dias = 365;
        
        const fechaExp = new Date();
        fechaExp.setDate(fechaExp.getDate() + dias);
        const caducidadLocal = new Date(fechaExp.getTime() - fechaExp.getTimezoneOffset() * 60000).toISOString().split('T')[0];

        await updateDoc(doc(db, 'keys', keyId), {
          estado: 'en uso', usuario: nombre, correo: email, telefono: telefono,
          fechaActivacion: fechaLocal, fechaCaducidad: caducidadLocal
        });
        onLogin('docente', { nombre, email, telefono, keyPlus });

      } else if (data.estado === 'caducada') {
        alert("❌ Esta KeyPlus ya está caducada o fue revocada. No puede usarse.");
      } else if (data.estado === 'en uso') {
        alert("⚠️ Esta KeyPlus ya está siendo usada por otro docente.");
      }
    } catch (error) {
      alert("Hubo un problema al validar tu licencia.");
    }
    setCargando(false);
  };

  if (verificandoSesion) {
    return (
      <div className="login-bg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
         <div className="loader" style={{ borderTopColor: 'var(--accent-blue)', width: '50px', height: '50px', marginBottom: '1.5rem' }}></div>
         <h2 style={{ color: 'white', margin: 0 }}>Validando credenciales...</h2>
         <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Conectando de forma segura con Google</p>
      </div>
    );
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--accent-blue)', color: '#fff', width: '70px', height: '70px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '2rem', margin: '0 auto 1rem auto', boxShadow: '0 4px 15px rgba(28, 81, 255, 0.4)' }}>
            <span style={{ marginRight: '-4px' }}>A</span><span style={{ color: 'var(--accent-yellow)' }}>+</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '2.2rem', letterSpacing: '-1px' }}>Aula+</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0', fontSize: '0.95rem' }}>Sistema de Gestión Escolar Avanzado</p>
        </div>

        {paso === 1 ? (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <TutorialTooltip mensaje="Inicia sesión usando tu cuenta de Google." esBloque={true} posicion="top">
              <button onClick={iniciarSesionGoogle} disabled={cargando} className="pill-btn" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', backgroundColor: 'white', color: '#333', display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center', border: '1px solid #ddd', opacity: cargando ? 0.7 : 1 }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="22px" height="22px">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                </svg>
                {cargando ? 'Conectando...' : 'Ingresar con Google'}
              </button>
            </TutorialTooltip>
          </div>
        ) : (
          <form onSubmit={procesarIngreso} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.3s' }}>
            <div style={{ backgroundColor: 'rgba(255, 77, 79, 0.1)', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--accent-red)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-main)', margin: '0 0 0.3rem 0', fontSize: '0.9rem' }}>Se requiere una licencia para la cuenta:</p>
              <b style={{ color: 'var(--accent-red)', fontSize: '1.1rem' }}>{email}</b>
            </div>
            
            <input type="text" required placeholder="Nombre Completo" className="search-input" value={nombre} onChange={e => setNombre(e.target.value)} disabled={cargando} />
            <input type="tel" required placeholder="Teléfono Celular" className="search-input" value={telefono} onChange={e => setTelefono(e.target.value)} disabled={cargando} />
            <input type="text" required placeholder="Introduce tu KeyPlus" className="search-input" style={{ borderLeft: '4px solid var(--accent-yellow)' }} value={keyPlus} onChange={e => setKeyPlus(e.target.value)} disabled={cargando} />
            
            <div className="legal-box" style={{ marginTop: '0.5rem' }}>
              <b>🛡️ Aviso de Privacidad y Uso de Datos:</b><br/>
              Aula+ recopila su nombre, correo y teléfono para la gestión de su licencia.<br/>
              <b>📁 Drive:</b> Aula+ se vinculará con sus enlaces personales en la nube.
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={aceptoTerminos} onChange={e => setAceptoTerminos(e.target.checked)} disabled={cargando} />
              Acepto el aviso de privacidad.
            </label>

            <button type="submit" disabled={cargando} className="pill-btn" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', backgroundColor: 'var(--accent-blue)', color: 'white', marginTop: '1rem' }}>
              {cargando ? 'Validando Licencia...' : 'Activar e Ingresar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}