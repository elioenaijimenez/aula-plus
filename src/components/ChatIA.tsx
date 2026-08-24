import { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, doc, getDoc, where, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

interface Mensaje { rol: 'user' | 'ia'; texto: string; }
interface GrupoInfo { name: string; grade: string; subject: string; emphasis?: string; }
interface MemoriaEscolar { escuela: string; ubicacion: string; docente: string; revisor: string; }
interface ChatGuardado { id: string; titulo: string; mensajes: Mensaje[]; updatedAt: any; }
interface ContextoAula { entorno: string; grupo: string; reglas: string; }

export default function ChatIA() {
  const [userEmail, setUserEmail] = useState('');
  const [docenteNombre, setDocenteNombre] = useState('Colega Docente');
  const [contextoDocente, setContextoDocente] = useState('');
  const [memoria, setMemoria] = useState<MemoriaEscolar>({ escuela: 'Escuela Secundaria', ubicacion: 'México', docente: 'Docente', revisor: 'Dirección' });
  const [contextoDUA, setContextoDUA] = useState<ContextoAula | null>(null);
  
  const [tieneGrupos, setTieneGrupos] = useState<boolean | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [objetivo, setObjetivo] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  
  const [historial, setHistorial] = useState<ChatGuardado[]>([]);
  const [chatActivoId, setChatActivoId] = useState<string | null>(null);
  const [menuHistorialAbierto, setMenuHistorialAbierto] = useState(false);

  const mensajesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    mensajesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensajes, escribiendo]);

  // SOLUCIÓN AL BUG DE FIREBASE: Ordenamiento local para evitar el error de Índice Compuesto
  const cargarHistorialNube = async (email: string) => {
    try {
      const qHistorial = query(collection(db, 'teacher_chats'), where('docenteEmail', '==', email));
      const snapHistorial = await getDocs(qHistorial);
      const listaHistorial: ChatGuardado[] = [];
      
      snapHistorial.forEach(d => {
        listaHistorial.push({ id: d.id, ...d.data() } as ChatGuardado);
      });

      // Ordenamos localmente por fecha (los más recientes primero)
      listaHistorial.sort((a, b) => {
        const timeA = a.updatedAt?.seconds || 0;
        const timeB = b.updatedAt?.seconds || 0;
        return timeB - timeA;
      });

      // Limitamos a los últimos 15 chats para no saturar la vista
      setHistorial(listaHistorial.slice(0, 15));
    } catch (e) { 
      console.error("Error al cargar historial", e); 
    }
  };

  useEffect(() => {
    const inicializarIA = async () => {
      const sessionLocal = localStorage.getItem('aulaPlusSession');
      const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
      const email = sessionData?.user?.email || 'docente_default';
      let nombre = sessionData?.user?.nombre || '';
      setUserEmail(email);

      let resumenGrupos = '';
      try {
        const qGrupos = query(collection(db, 'groups'), where('docenteEmail', '==', email));
        const snap = await getDocs(qGrupos);
        
        if (snap.empty) {
          setTieneGrupos(false);
          return; 
        }
        
        setTieneGrupos(true);
        const lista: GrupoInfo[] = [];
        snap.forEach(d => {
          const data = d.data();
          lista.push({ name: data.name, grade: data.grade, subject: data.subject, emphasis: data.emphasis });
        });
        resumenGrupos = lista.map(g => `${g.name} en ${g.subject}${g.emphasis ? ` (Énfasis: ${g.emphasis})` : ''}`).join(', ');
      } catch (e) {
        console.error("Error al leer grupos:", e);
      }

      let datosMemoria: MemoriaEscolar = { escuela: 'Escuela Secundaria', ubicacion: 'México', docente: nombre || 'Docente', revisor: 'Dirección' };
      let datosContextoAula: ContextoAula | null = null;

      try {
        const docMemoria = await getDoc(doc(db, 'teacher_settings', email));
        if (docMemoria.exists()) {
          if (docMemoria.data().memoriaEscolar) {
            const m = docMemoria.data().memoriaEscolar;
            datosMemoria = { escuela: m.escuela || 'Escuela', ubicacion: m.ubicacion || 'México', docente: m.docente || nombre || 'Docente', revisor: m.revisor || 'Dirección' };
            if (m.docente) nombre = m.docente;
          }
          if (docMemoria.data().contextoAula) {
            datosContextoAula = docMemoria.data().contextoAula;
            setContextoDUA(datosContextoAula);
          }
        }
      } catch (e) { console.error("Error al leer datos de la nube:", e); }
      
      setMemoria(datosMemoria);
      const primerNombre = nombre ? nombre.split(' ')[0] : 'Docente';
      setDocenteNombre(nombre || 'Docente');

      const directiva = `
[CONTEXTO DEL USUARIO]:
- Nombre del Docente: ${nombre || 'Profesor/a'}
- Nivel Educativo: Educación Secundaria (Nueva Escuela Mexicana)
- Escuela: ${datosMemoria.escuela} (${datosMemoria.ubicacion})
- Grupos y Asignaturas a su cargo: ${resumenGrupos}

[CONTEXTO BASE DEL AULA (DUA E INCLUSIÓN)]:
${datosContextoAula ? `
- Infraestructura y Entorno: ${datosContextoAula.entorno || 'No especificado'}
- Barreras y Ritmos del Grupo: ${datosContextoAula.grupo || 'No especificado'}
- Reglas Pedagógicas del Docente: ${datosContextoAula.reglas || 'No especificadas'}
` : '- El docente no ha especificado un contexto base aún. Sugiere actividades estándar.'}

[INSTRUCCIONES DE TONO Y RESPUESTA]:
1. Dirígete al docente de manera respetuosa y empática llamándolo por su nombre (${nombre ? `Prof. ${primerNombre}` : 'Profesor'}).
2. Tus respuestas deben ser técnicamente precisas y fundamentadas en la Nueva Escuela Mexicana.
3. Toma en cuenta ABSOLUTAMENTE el [CONTEXTO BASE DEL AULA] para proponer ajustes razonables, metodologías o consejos que se adapten a las limitaciones de recursos o a las barreras de aprendizaje reales del maestro.
4. Al final de tu explicación, incluye SIEMPRE una breve sección titulada "💡 Consejo de aplicación en clase", ofreciendo una recomendación didáctica aterrizada a SUS asignaturas registradas y su contexto particular.
      `.trim();
      setContextoDocente(directiva);

      iniciarNuevaConversacion(nombre);
      cargarHistorialNube(email);
    };

    inicializarIA();
  }, []);

  const iniciarNuevaConversacion = (nombreDocente?: string) => {
    setChatActivoId(null);
    setMensajes([{ 
      rol: 'ia', 
      texto: `¡Hola, ${nombreDocente || docenteNombre}! 🧠\n\nSoy tu asistente pedagógico Aula+. He analizado tu contexto escolar y tus grupos actuales. ¿Qué tema, duda curricular o estrategia te gustaría consultar hoy?` 
    }]);
    setMenuHistorialAbierto(false);
  };

  const cargarConversacionPrevia = (chat: ChatGuardado) => {
    setChatActivoId(chat.id);
    setMensajes(chat.mensajes);
    setMenuHistorialAbierto(false);
  };

  // NUEVO: Eliminar chats antiguos
  const eliminarChat = async (idChat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Seguro que deseas eliminar esta conversación permanentemente?")) {
      try {
        await deleteDoc(doc(db, 'teacher_chats', idChat));
        setHistorial(prev => prev.filter(c => c.id !== idChat));
        if (chatActivoId === idChat) {
          iniciarNuevaConversacion();
        }
      } catch (error) {
        alert("Error al intentar eliminar el chat.");
      }
    }
  };

  const enviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objetivo.trim()) return;

    const textoUsuario = objetivo;
    const nuevosMensajes: Mensaje[] = [...mensajes, { rol: 'user', texto: textoUsuario }];
    setMensajes(nuevosMensajes);
    setObjetivo('');
    setEscribiendo(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const promptCompleto = nuevosMensajes.length <= 2 
        ? `${contextoDocente}\n\n[CONSULTA DEL DOCENTE]:\n${textoUsuario}`
        : textoUsuario;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptCompleto }] }] })
      });

      const data = await response.json();
      let textoIA = '⚠️ Hubo un detalle al procesar la respuesta. Por favor intenta de nuevo.';
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        textoIA = data.candidates[0].content.parts[0].text;
      }
      
      const mensajesFinales: Mensaje[] = [...nuevosMensajes, { rol: 'ia', texto: textoIA }];
      setMensajes(mensajesFinales);

      if (!chatActivoId) {
        const nuevoDoc = await addDoc(collection(db, 'teacher_chats'), {
          docenteEmail: userEmail,
          titulo: textoUsuario.substring(0, 40) + '...',
          mensajes: mensajesFinales,
          updatedAt: serverTimestamp()
        });
        setChatActivoId(nuevoDoc.id);
        cargarHistorialNube(userEmail);
      } else {
        await updateDoc(doc(db, 'teacher_chats', chatActivoId), {
          mensajes: mensajesFinales,
          updatedAt: serverTimestamp()
        });
        cargarHistorialNube(userEmail);
      }

    } catch (error) {
      setMensajes(prev => [...prev, { rol: 'ia', texto: '⚠️ No se pudo establecer conexión con el asistente pedagógico.' }]);
    }
    setEscribiendo(false);
  };

  const copiarPortapapeles = (texto: string) => {
    navigator.clipboard.writeText(texto);
    alert("📋 ¡Respuesta copiada al portapapeles!");
  };

  const exportarChatPDF = () => {
    if (mensajes.length <= 1) return alert("No hay suficientes mensajes en el chat para exportar.");

    const historialHtml = mensajes.map(m => {
      const remitente = m.rol === 'user' ? `<b>${memoria.docente} (Docente):</b>` : `<b>Asistente Pedagógico Aula+:</b>`;
      const contenidoFormateado = m.texto.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>').replace(/\n/g, '<br/>');
      const estiloCaja = m.rol === 'user' ? 'background-color: #f0f4ff; border-left: 4px solid #1c51ff;' : 'background-color: #f9fafb; border-left: 4px solid #8b5cf6;';
      
      return `
        <div style="margin-bottom: 20px; padding: 15px; ${estiloCaja} font-size: 12pt; line-height: 1.6; border-radius: 8px;">
          <div style="margin-bottom: 8px; color: #333; font-size: 11pt;">${remitente}</div>
          <div>${contenidoFormateado}</div>
        </div>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset='utf-8'><title>Consulta Pedagógica IA</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12pt; color: #333; padding: 40px; max-width: 800px; margin: 0 auto; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 11pt; }
          td { border: 1px solid #ddd; padding: 10px; }
          .title { text-align: center; font-size: 18pt; font-weight: bold; margin-bottom: 20px; color: #1c51ff; text-transform: uppercase; letter-spacing: 1px; }
          .signatures td { border: none; text-align: center; padding-top: 70px; width: 50%; font-size: 11pt; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="title">REPORTE DE CONSULTA PEDAGÓGICA (IA)</div>
        <table>
          <tr><td><b>Escuela:</b> ${memoria.escuela}</td><td><b>Ubicación:</b> ${memoria.ubicacion}</td></tr>
          <tr><td><b>Docente Consultor:</b> ${memoria.docente}</td><td><b>Fecha:</b> ${new Date().toLocaleDateString()}</td></tr>
        </table>
        <div style="margin-top: 30px;">${historialHtml}</div>
        <table class="signatures">
          <tr>
            <td>___________________________<br/><br/><b>Docente</b><br/>${memoria.docente}</td>
            <td>___________________________<br/><br/><b>Sello / Revisa</b><br/>${memoria.revisor}</td>
          </tr>
        </table>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body></html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } else {
      alert("⚠️ Tu navegador bloqueó la ventana emergente. Por favor, permítela para generar el PDF.");
    }
  };

  if (tieneGrupos === false) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'var(--bg-app)', borderRadius: '24px', border: '2px dashed var(--accent-red)', animation: 'fadeIn 0.4s' }}>
        <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>🛑</span>
        <h2 style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>Configuración Incompleta</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          Para que el Asistente Aula+ funcione correctamente y no "alucine" o te dé respuestas incorrectas, necesita conocer el contexto de tu escuela. <br/><br/>
          Ve a la pestaña <b>"Gestión y Asistencia"</b> y crea al menos un grupo con su asignatura correspondiente.
        </p>
      </div>
    );
  }

  if (tieneGrupos === null) {
    return <div className="loader" style={{ marginTop: '5rem' }}></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app)', borderRadius: '24px', border: '1px solid var(--border-color)', height: '70vh', minHeight: '550px', position: 'relative', overflow: 'hidden' }}>
      
      {/* MENÚ LATERAL DE HISTORIAL */}
      {menuHistorialAbierto && (
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '100%', maxWidth: '350px', backgroundColor: 'var(--bg-panel)', zIndex: 10, borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s', boxShadow: '4px 0 15px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, color: 'var(--accent-blue)' }}>Tus Consultas</h4>
            <button onClick={() => setMenuHistorialAbierto(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
          </div>
          <div style={{ padding: '1rem' }}>
            <button onClick={() => iniciarNuevaConversacion()} className="pill-btn" style={{ width: '100%', background: 'var(--accent-purple)', color: 'white', fontWeight: 'bold' }}>+ Nueva Conversación</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {historial.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2rem' }}>No hay chats recientes.</p>
            ) : (
              historial.map(chat => (
                <div 
                  key={chat.id} 
                  onClick={() => cargarConversacionPrevia(chat)}
                  style={{ padding: '0.8rem 1rem', backgroundColor: chatActivoId === chat.id ? 'rgba(28, 81, 255, 0.1)' : 'var(--bg-input)', borderRadius: '12px', cursor: 'pointer', border: `1px solid ${chatActivoId === chat.id ? 'var(--accent-blue)' : 'var(--border-color)'}`, transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}
                >
                  <p style={{ margin: 0, fontSize: '0.85rem', color: chatActivoId === chat.id ? 'var(--accent-blue)' : 'var(--text-main)', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                    💬 {chat.titulo}
                  </p>
                  <button 
                    onClick={(e) => eliminarChat(chat.id, e)} 
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: '1.1rem', padding: '0.2rem', opacity: 0.7 }}
                    title="Eliminar Chat"
                    onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                  >
                    🗑
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* CABECERA CON BOTONES Y BADGE DE CONTEXTO */}
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-panel)', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => setMenuHistorialAbierto(true)} className="pill-btn" style={{ padding: '0.5rem 1rem', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
            ☰ Historial
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🎓</span>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Asistente Aula+</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: contextoDUA?.entorno ? 'var(--accent-purple)' : 'var(--text-muted)', backgroundColor: contextoDUA?.entorno ? 'rgba(156, 39, 176, 0.1)' : 'transparent', padding: '0.1rem 0.5rem', borderRadius: '50px', display: 'inline-block', marginTop: '0.2rem' }}>
                {contextoDUA?.entorno ? '✨ IA Contextualizada (DUA Activo)' : '● Modo Genérico'}
              </div>
            </div>
          </div>
        </div>
        
        <TutorialTooltip mensaje="Genera un PDF oficial de esta consulta. Universalmente compatible con Mac y Windows." posicion="left">
          <button onClick={exportarChatPDF} className="pill-btn" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem', background: 'var(--accent-blue)', color: 'white', border: 'none', fontWeight: 'bold' }}>
            📄 Exportar a PDF
          </button>
        </TutorialTooltip>
      </div>

      {/* ÁREA DE MENSAJES */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', backgroundColor: 'var(--bg-app)' }}>
        {mensajes.map((msg, i) => (
          <div key={i} style={{ alignSelf: msg.rol === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', marginLeft: '0.5rem', textAlign: msg.rol === 'user' ? 'right' : 'left', fontWeight: 'bold' }}>
              {msg.rol === 'user' ? 'Tú' : 'Asistente Aula+'}
            </div>
            <div style={{
              backgroundColor: msg.rol === 'user' ? 'var(--accent-purple)' : 'var(--bg-panel)',
              color: msg.rol === 'user' ? 'white' : 'var(--text-main)',
              padding: '1.2rem',
              borderRadius: msg.rol === 'user' ? '18px 18px 0 18px' : '18px 18px 18px 0',
              border: msg.rol === 'ia' ? '1px solid var(--border-color)' : 'none',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6',
              fontSize: '1rem',
              boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
            }}>
              {msg.texto}
            </div>

            {msg.rol === 'ia' && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.5rem', marginLeft: '0.5rem' }}>
                <button onClick={() => copiarPortapapeles(msg.texto)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', padding: 0, fontWeight: 'bold' }} className="hover-opacity">
                  📋 Copiar respuesta
                </button>
              </div>
            )}
          </div>
        ))}
        {escribiendo && (
          <div style={{ alignSelf: 'flex-start', backgroundColor: 'var(--bg-panel)', padding: '1rem 1.5rem', borderRadius: '18px 18px 18px 0', border: '1px solid var(--border-color)', color: 'var(--accent-purple)', fontSize: '0.9rem', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            <span className="pulse-fast">Pensando y contextualizando tu respuesta... 🧠</span>
          </div>
        )}
        <div ref={mensajesEndRef} />
      </div>

      {/* FORMULARIO DE ENVÍO */}
      <form onSubmit={enviarMensaje} style={{ padding: '1rem', backgroundColor: 'var(--bg-panel)', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <input 
          type="text" 
          className="search-input" 
          placeholder="Escribe tu consulta pedagógica o didáctica..." 
          value={objetivo} 
          onChange={e => setObjetivo(e.target.value)} 
          disabled={escribiendo}
          style={{ flex: 1, margin: 0, border: '2px solid var(--accent-purple)', padding: '1rem', fontSize: '1rem', borderRadius: '12px' }}
        />
        <button type="submit" disabled={escribiendo || !objetivo.trim()} className="pill-btn hover-opacity" style={{ background: 'var(--accent-purple)', color: 'white', padding: '1rem 2rem', height: '100%', whiteSpace: 'nowrap', fontWeight: 'bold', fontSize: '1rem' }}>
          Enviar
        </button>
      </form>
    </div>
  );
}