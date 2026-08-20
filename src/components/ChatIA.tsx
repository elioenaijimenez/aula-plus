import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

interface Mensaje { rol: 'user' | 'ia'; texto: string; }
interface GrupoInfo { name: string; grade: string; subject: string; emphasis?: string; }
interface MemoriaEscolar { escuela: string; ubicacion: string; docente: string; revisor: string; }

export default function ChatIA() {
  const [docenteNombre, setDocenteNombre] = useState('Colega Docente');
  const [contextoDocente, setContextoDocente] = useState('');
  const [memoria, setMemoria] = useState<MemoriaEscolar>({ escuela: 'Escuela Secundaria', ubicacion: 'México', docente: 'Docente', revisor: 'Dirección' });
  
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [objetivo, setObjetivo] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);

  useEffect(() => {
    const cargarContextoDocente = async () => {
      const sessionLocal = localStorage.getItem('aulaPlusSession');
      const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
      const userEmail = sessionData?.user?.email || 'docente_default';
      let nombre = sessionData?.user?.nombre || '';

      let datosMemoria: MemoriaEscolar = { escuela: 'Escuela Secundaria', ubicacion: 'México', docente: nombre || 'Docente', revisor: 'Dirección' };
      try {
        const docMemoria = await getDoc(doc(db, 'teacher_settings', userEmail));
        if (docMemoria.exists() && docMemoria.data().memoriaEscolar) {
          const m = docMemoria.data().memoriaEscolar;
          datosMemoria = {
            escuela: m.escuela || 'Escuela Secundaria',
            ubicacion: m.ubicacion || 'México',
            docente: m.docente || nombre || 'Docente',
            revisor: m.revisor || 'Dirección'
          };
          if (m.docente) nombre = m.docente;
        }
      } catch (e) {
        console.error("Error al leer memoria escolar:", e);
      }
      setMemoria(datosMemoria);

      const primerNombre = nombre ? nombre.split(' ')[0] : 'Docente';
      setDocenteNombre(nombre || 'Docente');

      let resumenGrupos = '';
      try {
        const qGrupos = query(collection(db, 'groups'));
        const snap = await getDocs(qGrupos);
        const lista: GrupoInfo[] = [];
        snap.forEach(d => {
          const data = d.data();
          lista.push({ name: data.name, grade: data.grade, subject: data.subject, emphasis: data.emphasis });
        });
        
        if (lista.length > 0) {
          resumenGrupos = lista.map(g => 
            `${g.name} en ${g.subject}${g.emphasis ? ` (Énfasis: ${g.emphasis})` : ''}`
          ).join(', ');
        }
      } catch (e) {
        console.error("Error al leer grupos:", e);
      }

      const directiva = `
[CONTEXTO DEL USUARIO]:
- Nombre del Docente: ${nombre || 'Profesor/a'}
- Nivel Educativo: Educación Secundaria (Bajo el marco de la Nueva Escuela Mexicana)
- Escuela: ${datosMemoria.escuela} (${datosMemoria.ubicacion})
- Grupos y Asignaturas a su cargo: ${resumenGrupos || 'Asignaturas de Secundaria'}

[INSTRUCCIONES DE TONO Y RESPUESTA]:
1. Dirígete al docente de manera respetuosa y cercana llamándolo por su nombre (${nombre ? `Prof. ${primerNombre}` : 'Profesor'}).
2. Tus respuestas deben ser técnicamente precisas, con fundamento pedagógico y formalidad, pero redactadas con calidez humana, empatía y sentido práctico del aula.
3. Al final de tu explicación o respuesta, incluye SIEMPRE una breve sección titulada "💡 Consejo de aplicación en clase", ofreciendo una recomendación didáctica aterrizada que se vincule o adapte a sus asignaturas o grados registrados.
      `.trim();

      setContextoDocente(directiva);

      setMensajes([
        { 
          rol: 'ia', 
          texto: `¡Hola, ${nombre ? `Prof. ${nombre}` : 'Colega'}! 🧠\n\nSoy tu asistente pedagógico Aula+. ¿Qué tema, duda curricular, estrategia o situación con tus grupos te gustaría consultar hoy?` 
        }
      ]);
    };

    cargarContextoDocente();
  }, []);

  const enviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objetivo.trim()) return;

    const textoUsuario = objetivo;
    setMensajes(prev => [...prev, { rol: 'user', texto: textoUsuario }]);
    setObjetivo('');
    setEscribiendo(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const promptCompleto = mensajes.length <= 1 
        ? `${contextoDocente}\n\n[CONSULTA DEL DOCENTE]:\n${textoUsuario}`
        : textoUsuario;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptCompleto }] }] })
      });

      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        setMensajes(prev => [...prev, { rol: 'ia', texto: data.candidates[0].content.parts[0].text }]);
      } else {
        setMensajes(prev => [...prev, { rol: 'ia', texto: '⚠️ Hubo un detalle al procesar la respuesta. Por favor intenta de nuevo.' }]);
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

  const exportarChatWord = () => {
    if (mensajes.length <= 1) return alert("No hay suficientes mensajes en el chat para exportar.");

    const historialHtml = mensajes.map(m => {
      const remitente = m.rol === 'user' ? `<b>${memoria.docente} (Docente):</b>` : `<b>Asistente Pedagógico Aula+:</b>`;
      const contenidoFormateado = m.texto.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>').replace(/\n/g, '<br/>');
      const estiloCaja = m.rol === 'user' ? 'background-color: #f0f4ff; border-left: 4px solid #1c51ff;' : 'background-color: #f9fafb; border-left: 4px solid #8b5cf6;';
      
      return `
        <div style="margin-bottom: 20px; padding: 12px; ${estiloCaja} font-size: 11pt; line-height: 1.5;">
          <div style="margin-bottom: 6px; color: #333;">${remitente}</div>
          <div>${contenidoFormateado}</div>
        </div>
      `;
    }).join('');

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'><title>Consulta Pedagógica IA</title>
        <style>
          @page { margin: 2cm; size: 21.59cm 27.94cm; }
          body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10pt; }
          td { border: 1px solid #000; padding: 6px; }
          .title { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 15px; color: #1c51ff; }
          .signatures td { border: none; text-align: center; padding-top: 50px; width: 50%; }
        </style>
      </head>
      <body>
        <div class="title">REPORTE DE CONSULTA PEDAGÓGICA (IA)</div>
        <table>
          <tr><td><b>Escuela:</b> ${memoria.escuela}</td><td><b>Ubicación:</b> ${memoria.ubicacion}</td></tr>
          <tr><td><b>Docente Consultor:</b> ${memoria.docente}</td><td><b>Fecha:</b> ${new Date().toLocaleDateString()}</td></tr>
        </table>
        
        <div style="margin-top: 20px;">${historialHtml}</div>

        <table class="signatures">
          <tr>
            <td>___________________________<br/><b>Docente</b><br/>${memoria.docente}</td>
            <td>___________________________<br/><b>Revisa</b><br/>${memoria.revisor}</td>
          </tr>
        </table>
      </body></html>
    `;

    const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/msword;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Consulta_Pedagogica_${new Date().toISOString().split('T')[0]}.doc`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app)', borderRadius: '24px', border: '1px solid var(--border-color)', height: '65vh', minHeight: '520px' }}>
      
      {/* CABECERA CON BOTÓN DE EXPORTAR */}
      <div style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-panel)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.2rem' }}>🎓</span>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Asistente Aula+</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-green)' }}>● Contextualizado para {docenteNombre}</div>
          </div>
        </div>
        
        <TutorialTooltip mensaje="Descarga la conversación completa en un documento oficial con membrete para evidenciar tus consultas y estrategias." posicion="left">
          <button onClick={exportarChatWord} className="pill-btn" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', background: 'var(--accent-blue)', color: 'white', border: 'none' }}>
            📄 Exportar Chat a Word
          </button>
        </TutorialTooltip>
      </div>

      {/* ÁREA DE MENSAJES */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        {mensajes.map((msg, i) => (
          <div key={i} style={{ alignSelf: msg.rol === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', marginLeft: '0.5rem', textAlign: msg.rol === 'user' ? 'right' : 'left' }}>
              {msg.rol === 'user' ? 'Tú' : 'Asistente Aula+'}
            </div>
            <div style={{
              backgroundColor: msg.rol === 'user' ? 'var(--accent-purple)' : 'var(--bg-panel)',
              color: msg.rol === 'user' ? 'white' : 'var(--text-main)',
              padding: '1.2rem',
              borderRadius: '18px',
              border: msg.rol === 'ia' ? '1px solid var(--border-color)' : 'none',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6',
              fontSize: '0.95rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              {msg.texto}
            </div>

            {/* BOTÓN COPIAR */}
            {msg.rol === 'ia' && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.3rem', marginLeft: '0.5rem' }}>
                <button onClick={() => copiarPortapapeles(msg.texto)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}>
                  📋 Copiar respuesta
                </button>
              </div>
            )}
          </div>
        ))}
        {escribiendo && (
          <div style={{ alignSelf: 'flex-start', backgroundColor: 'var(--bg-panel)', padding: '0.8rem 1.2rem', borderRadius: '16px', border: '1px solid var(--border-color)', color: 'var(--accent-purple)', fontSize: '0.85rem' }}>
            Pensando y contextualizando tu respuesta... 🧠
          </div>
        )}
      </div>

      {/* FORMULARIO DE ENVÍO CORREGIDO */}
      <form onSubmit={enviarMensaje} style={{ padding: '1rem', backgroundColor: 'var(--bg-panel)', borderTop: '1px solid var(--border-color)', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <input 
          type="text" 
          className="search-input" 
          placeholder="Escribe tu consulta pedagógica o didáctica..." 
          value={objetivo} 
          onChange={e => setObjetivo(e.target.value)} 
          disabled={escribiendo}
          style={{ flex: 1, marginBottom: 0, border: '1px solid var(--accent-purple)' }}
        />
        <TutorialTooltip mensaje="Hazle preguntas a la IA. Está programada para responderte como un asesor pedagógico experto de la Nueva Escuela Mexicana." posicion="top">
          <button type="submit" disabled={escribiendo || !objetivo.trim()} className="pill-btn" style={{ background: 'var(--accent-purple)', color: 'white', padding: '0.8rem 1.5rem', height: '100%', whiteSpace: 'nowrap' }}>
            Enviar
          </button>
        </TutorialTooltip>
      </form>
    </div>
  );
}