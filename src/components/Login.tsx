import { useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { signInWithPopup } from 'firebase/auth'; // <- Importamos la función de ventana emergente
import { db, auth, googleProvider } from '../services/firebase'; // <- Importamos nuestras herramientas
import TutorialTooltip from './TutorialTooltip';

export default function Login({ onLogin }: { onLogin: (role: 'docente' | 'admin', user: any) => void }) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  
  // Datos de registro
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [keyPlus, setKeyPlus] = useState('');
  const [aceptoTerminos, setAceptoTerminos] = useState(false);
  const [cargando, setCargando] = useState(false);

  // NUEVA FUNCIÓN: Inicio de sesión real con Google
  const iniciarSesionGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      // Extraemos el correo real del usuario
      setEmail(result.user.email || '');
      
      // Como un "bonus", autocompletamos el nombre si Google nos lo proporciona
      if (result.user.displayName) {
        setNombre(result.user.displayName);
      }
      
      setPaso(2);
    } catch (error) {
      console.error("Error en autenticación:", error);
      alert("No se pudo iniciar sesión con Google. Es posible que hayas cerrado la ventana emergente.");
    }
  };

  const procesarIngreso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aceptoTerminos) {
      alert("Debes aceptar los términos y condiciones de privacidad.");
      return;
    }
    
    // Bypass para el Administrador
    if (keyPlus === 'SUPER-ADMIN-MASTER') {
      onLogin('admin', { nombre, email, telefono, keyPlus });
      return;
    }

    setCargando(true);

    try {
      // 1. Buscar la llave en Firebase
      const q = query(collection(db, 'keys'), where('codigo', '==', keyPlus));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("La KeyPlus ingresada no existe. Verifica que esté escrita correctamente.");
        setCargando(false);
        return;
      }

      const docSnap = querySnapshot.docs[0];
      const data = docSnap.data();
      const keyId = docSnap.id;

      const hoy = new Date();
      const fechaLocal = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().split('T')[0];

      // 2. Si la llave está nueva y disponible
      if (data.estado === 'disponible') {
        let dias = 7;
        if (data.duracion === '1 Mes') dias = 30;
        if (data.duracion === '1 Año') dias = 365;
        
        const fechaExp = new Date();
        fechaExp.setDate(fechaExp.getDate() + dias);
        const caducidadLocal = new Date(fechaExp.getTime() - fechaExp.getTimezoneOffset() * 60000).toISOString().split('T')[0];

        // Se activa la llave y se vincula al docente
        await updateDoc(doc(db, 'keys', keyId), {
          estado: 'en uso',
          usuario: nombre,
          correo: email,
          telefono: telefono,
          fechaActivacion: fechaLocal,
          fechaCaducidad: caducidadLocal
        });

        onLogin('docente', { nombre, email, telefono, keyPlus });

      // 3. Si la llave ya está en uso
      } else if (data.estado === 'en uso') {
        if (data.correo === email) {
          const expira = new Date(data.fechaCaducidad);
          // Permite paso temporal ajustando la zona horaria a medianoche
          expira.setMinutes(expira.getMinutes() + expira.getTimezoneOffset());
          
          if (hoy > expira) {
            await updateDoc(doc(db, 'keys', keyId), { estado: 'caducada' });
            alert("Tu KeyPlus ha caducado. Contacta al administrador de Aula+.");
          } else {
            onLogin('docente', { nombre, email, telefono, keyPlus });
          }
        } else {
          alert("Esta KeyPlus ya se encuentra registrada y en uso por otro correo.");
        }
      
      // 4. Si la llave está caducada o revocada
      } else {
        alert("Esta KeyPlus ha caducado o fue revocada.");
      }

    } catch (error) {
      console.error("Error al validar la llave:", error);
      alert("Hubo un problema al validar tu licencia. Revisa tu conexión a internet.");
    }
    
    setCargando(false);
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--accent-blue)', color: '#fff', width: '60px', height: '60px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.5rem', margin: '0 auto 1rem auto' }}>A+</div>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>Aula+</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0' }}>Sistema de Gestión Escolar Avanzado</p>
        </div>

        {paso === 1 ? (
          <div>
            <TutorialTooltip mensaje="Inicia sesión usando tu cuenta de Google para garantizar la seguridad de tu información." esBloque={true} posicion="top">
              <button onClick={iniciarSesionGoogle} className="pill-btn" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', backgroundColor: 'white', color: '#333', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google" width="20" />
                Ingresar con Google
              </button>
            </TutorialTooltip>
          </div>
        ) : (
          <form onSubmit={procesarIngreso} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ color: 'var(--accent-green)', textAlign: 'center', margin: 0 }}>Autenticado como: <b>{email}</b></p>
            
            <input type="text" required placeholder="Nombre Completo" className="search-input" value={nombre} onChange={e => setNombre(e.target.value)} disabled={cargando} />
            <input type="tel" required placeholder="Teléfono Celular" className="search-input" value={telefono} onChange={e => setTelefono(e.target.value)} disabled={cargando} />
            
            <TutorialTooltip mensaje="Ingresa la licencia KeyPlus proporcionada por el administrador." esBloque={true} posicion="top">
              <input type="text" required placeholder="Introduce tu KeyPlus" className="search-input" style={{ borderLeft: '4px solid var(--accent-yellow)', margin: 0, width: '100%' }} value={keyPlus} onChange={e => setKeyPlus(e.target.value)} disabled={cargando} />
            </TutorialTooltip>
            
            <div className="legal-box" style={{ marginTop: '0.5rem' }}>
              <b>🛡️ Aviso de Privacidad y Uso de Datos:</b><br/>
              Aula+ recopila su nombre, correo y número telefónico exclusivamente para la gestión de su licencia y soporte técnico. <br/><br/>
              <b>📁 Almacenamiento en la Nube:</b> Al utilizar los módulos de "Biblioteca" o generar "Reportes", el sistema se vinculará con su espacio personal de Google Drive para almacenar sus evidencias e infografías sin consumir almacenamiento local. Aula+ no leerá ni alterará archivos ajenos a la plataforma.
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={aceptoTerminos} onChange={e => setAceptoTerminos(e.target.checked)} disabled={cargando} />
              He leído y acepto el aviso de privacidad y uso de Drive.
            </label>

            <button type="submit" disabled={cargando} className="pill-btn" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', backgroundColor: 'var(--accent-blue)', color: 'white', marginTop: '1rem' }}>
              {cargando ? 'Validando Licencia...' : 'Activar Licencia e Ingresar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}