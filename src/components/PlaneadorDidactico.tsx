import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

interface Grupo { id: string; name: string; grade: string; subject: string; emphasis: string; }
interface MemoriaEscolar { escuela: string; ubicacion: string; docente: string; revisor: string; }

export default function PlaneadorDidactico() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<string>('');
  const [userId, setUserId] = useState<string>('');

  // 1. Estados de Memoria Escolar
  const [memoria, setMemoria] = useState<MemoriaEscolar>({ escuela: '', ubicacion: '', docente: '', revisor: '' });
  const [modoEdicionMemoria, setModoEdicionMemoria] = useState(true);
  const [guardandoMemoria, setGuardandoMemoria] = useState(false);

  // 2. Estados de Configuración (Fechas y Días)
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [diasClase, setDiasClase] = useState<string[]>([]);
  const [duracion, setDuracion] = useState('50');
  
  // 3. Estados Pedagógicos
  const [instrucciones, setInstrucciones] = useState('');
  const [contenido, setContenido] = useState('');
  const [pda, setPda] = useState('');
  const [ejes, setEjes] = useState('');

  // 4. Estados de Generación
  const [generando, setGenerando] = useState(false);
  const [resultadoIA, setResultadoIA] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const sessionLocal = localStorage.getItem('aulaPlusSession');
      const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
      
      const userEmail = sessionData?.user?.email || 'docente_default';
      setUserId(userEmail);

      const qGrupos = query(collection(db, 'groups'));
      const snapGrupos = await getDocs(qGrupos);
      const listaGrupos: Grupo[] = [];
      snapGrupos.forEach(d => {
        listaGrupos.push({ id: d.id, ...d.data() } as Grupo);
      });
      setGrupos(listaGrupos);

      const docMemoria = await getDoc(doc(db, 'teacher_settings', userEmail));
      if (docMemoria.exists() && docMemoria.data().memoriaEscolar) {
        setMemoria(docMemoria.data().memoriaEscolar);
        setModoEdicionMemoria(false);
      } else if (sessionData?.user?.nombre) {
        setMemoria(prev => ({ ...prev, docente: sessionData.user.nombre }));
      }
    };
    fetchData();
  }, []);

  const handleMemoriaChange = (campo: keyof MemoriaEscolar, valor: string) => {
    if (campo === 'docente' || campo === 'revisor') {
      if (/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]*$/.test(valor)) setMemoria(prev => ({ ...prev, [campo]: valor }));
    } else {
      if (/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.,#-]*$/.test(valor)) setMemoria(prev => ({ ...prev, [campo]: valor }));
    }
  };

  const alternarMemoriaEscolar = async () => {
    if (modoEdicionMemoria) {
      if (!memoria.escuela || !memoria.docente) return alert("Escuela y Docente son obligatorios.");
      setGuardandoMemoria(true);
      try {
        await setDoc(doc(db, 'teacher_settings', userId), { memoriaEscolar: memoria }, { merge: true });
        setModoEdicionMemoria(false);
      } catch (error) { alert("Error al guardar la configuración."); }
      setGuardandoMemoria(false);
    } else {
      setModoEdicionMemoria(true);
    }
  };

  const toggleDia = (dia: string) => {
    setDiasClase(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]);
  };

  const generarPlaneacion = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!instrucciones) return alert("Debes escribir las instrucciones o el tema de tu planeación.");
    if (!fechaInicio || !fechaFin || !fechaEntrega) return alert("Establece las fechas de entrega y periodo lectivo.");
    if (diasClase.length === 0) return alert("Debes seleccionar al menos un día de clase en la semana.");
    if (!duracion || Number(duracion) <= 0) return alert("La duración de la sesión debe ser mayor a 0 minutos.");

    const diffDays = Math.ceil((new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return alert("La fecha de fin no puede ser anterior a la de inicio.");
    if (diffDays > 31) return alert("No planear para más de un mes (máximo 31 días) por variabilidad del contexto.");

    setGenerando(true);
    const grupo = grupos.find(g => g.id === grupoSeleccionado);
    
    const prompt = `
      Actúa como experto en pedagogía bajo la Nueva Escuela Mexicana.
      Genera el desarrollo detallado de una planeación didáctica.
      
      INSTRUCCIONES PRINCIPALES DEL DOCENTE:
      "${instrucciones}"
      
      DATOS DEL CONTEXTO:
      - Grado y Grupo: ${grupo?.name}
      - Disciplina: ${grupo?.subject} ${grupo?.subject === 'Tecnología' && grupo?.emphasis ? `(Énfasis: ${grupo?.emphasis})` : ''}
      - Periodo: Del ${fechaInicio} al ${fechaFin}
      - Días de clase a la semana: ${diasClase.join(', ')}
      - Duración por sesión (Periodo lectivo): ${duracion} minutos
      - Contenido Sintético: ${contenido || 'Adecuado a la disciplina y tema'}
      - PDA: ${pda || 'Adecuado al contenido'}
      - Ejes Articuladores: ${ejes || 'Pertinentes al tema'}

      ESTRUCTURA OBLIGATORIA A DEVOLVER (Usa formato claro, viñetas y negritas):
      1. Metodología
      2. Actividades Propuestas: Desglosado POR SESIÓN. Para CADA sesión debes especificar explícitamente:
         - El Número de Sesión.
         - El Día de la semana (basado estrictamente en los días de clase: ${diasClase.join(', ')}).
         - La Duración de ${duracion} minutos.
         - Detallar Inicio, Desarrollo y Cierre (indicando acciones del alumno y docente).
      3. Medios y Recursos a utilizar.
      4. Estrategias didácticas empleadas.
      5. Actividades para entregar e instrumentos de evaluación.
      6. Plan de atención (alumnos con rezago).
      7. Orientaciones didácticas.
      
      NO incluyas introducciones, saludos ni conclusiones tuyas. Solo el documento formal.
    `;

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY; 
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        setResultadoIA(data.candidates[0].content.parts[0].text);
      } else { alert('Error en la respuesta de la IA. Verifica tu API Key.'); }
    } catch (error) { alert('Error de conexión con la IA.'); }
    setGenerando(false);
  };

  const exportarWord = () => {
    if (!resultadoIA) return;
    const grupo = grupos.find(g => g.id === grupoSeleccionado);
    
    const htmlResultado = resultadoIA
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') 
      .replace(/^\*\s(.*)/gm, '&bull; $1')    
      .replace(/\*(.*?)\*/g, '<i>$1</i>')     
      .replace(/\n/g, '<br/>');               

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'><title>Planeación Didáctica</title>
        <style>
          @page { margin: 2cm; size: 21.59cm 27.94cm; }
          body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10pt; }
          td { border: 1px solid #000; padding: 5px; }
          .title { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 15px; }
          .section-content { text-align: left; line-height: 1.5; } 
          .signatures td { border: none; text-align: center; padding-top: 50px; width: 50%; }
        </style>
      </head>
      <body>
        <div class="title">PLANEACIÓN DIDÁCTICA</div>
        <table>
          <tr><td><b>Escuela:</b> ${memoria.escuela}</td><td><b>Ubicación:</b> ${memoria.ubicacion}</td></tr>
          <tr><td><b>Disciplina:</b> ${grupo?.subject}</td><td><b>Énfasis:</b> ${grupo?.subject === 'Tecnología' && grupo?.emphasis ? grupo.emphasis : 'N/A'}</td></tr>
          <tr><td><b>Grado y Grupo:</b> ${grupo?.name}</td><td><b>Fecha de Entrega:</b> ${fechaEntrega}</td></tr>
          <tr><td colspan="2"><b>Contenido:</b> ${contenido || 'Ver desarrollo'}</td></tr>
          <tr><td colspan="2"><b>PDA:</b> ${pda || 'Ver desarrollo'}</td></tr>
          <tr><td colspan="2"><b>Ejes Articuladores:</b> ${ejes || 'Ver desarrollo'}</td></tr>
        </table>
        
        <div class="section-content">${htmlResultado}</div>
        
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
    link.setAttribute('download', `Planeacion_${grupo?.name}_${fechaInicio}.doc`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const paso2Habilitado = grupoSeleccionado !== '';
  const paso3Habilitado = paso2Habilitado && fechaInicio !== '' && fechaFin !== '' && fechaEntrega !== '' && diasClase.length > 0 && duracion !== '';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', animation: 'fadeIn 0.3s' }}>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* MEMORIA ESCOLAR */}
        <TutorialTooltip mensaje="PASO 0: Completa tu Memoria Escolar. Estos datos formarán el membrete de tu documento oficial en Word. Se guardan en la nube para que no tengas que escribirlos cada vez." esBloque={true} posicion="top">
          <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '24px', border: `1px solid ${modoEdicionMemoria ? 'var(--accent-yellow)' : 'var(--border-color)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>🧠 Memoria Escolar</h3>
              <button onClick={alternarMemoriaEscolar} disabled={guardandoMemoria} className="pill-btn" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', background: modoEdicionMemoria ? 'var(--accent-blue)' : 'var(--bg-input)', color: modoEdicionMemoria ? 'white' : 'var(--text-main)' }}>
                {guardandoMemoria ? '⏳' : modoEdicionMemoria ? '💾 Guardar' : '✏️ Editar'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', opacity: modoEdicionMemoria ? 1 : 0.6, pointerEvents: modoEdicionMemoria ? 'auto' : 'none' }}>
              <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Escuela</label><input type="text" className="search-input" value={memoria.escuela} onChange={e => handleMemoriaChange('escuela', e.target.value)} /></div>
              <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ubicación</label><input type="text" className="search-input" value={memoria.ubicacion} onChange={e => handleMemoriaChange('ubicacion', e.target.value)} /></div>
              <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Docente</label><input type="text" className="search-input" value={memoria.docente} onChange={e => handleMemoriaChange('docente', e.target.value)} /></div>
              <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quien Revisa</label><input type="text" className="search-input" value={memoria.revisor} onChange={e => handleMemoriaChange('revisor', e.target.value)} /></div>
            </div>
          </div>
        </TutorialTooltip>

        {/* CASCADA DE CONFIGURACIÓN */}
        <form onSubmit={generarPlaneacion} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* PASO 1 */}
          <TutorialTooltip mensaje="PASO 1: Elige tu grupo. La Inteligencia Artificial analizará automáticamente qué grado es y la disciplina (ej. Artes o Tecnología) para adaptar el contenido." esBloque={true} posicion="right">
            <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', borderLeft: '4px solid var(--accent-blue)' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>1. Grupo a Planear</label>
              <select className="search-input" value={grupoSeleccionado} onChange={e => setGrupoSeleccionado(e.target.value)} style={{ margin: 0, cursor: 'pointer' }}>
                <option value="">-- Selecciona un grupo --</option>
                {grupos.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} - {g.subject}{g.subject === 'Tecnología' && g.emphasis ? ` - ${g.emphasis}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </TutorialTooltip>

          {/* PASO 2 */}
          <TutorialTooltip mensaje="PASO 2: Define tu calendario. Selecciona los días exactos que ves a este grupo y la duración del periodo lectivo. La IA dividirá las actividades para que encajen perfecto en estas sesiones." esBloque={true} posicion="right">
            <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', borderLeft: paso2Habilitado ? '4px solid var(--accent-blue)' : '4px solid var(--border-color)', opacity: paso2Habilitado ? 1 : 0.4, pointerEvents: paso2Habilitado ? 'auto' : 'none', transition: 'all 0.3s' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '1rem' }}>2. Calendario y Fechas</label>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Inicio (Periodo Lectivo)</label><input type="date" className="search-input" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} /></div>
                <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fin (Periodo Lectivo)</label><input type="date" className="search-input" value={fechaFin} onChange={e => setFechaFin(e.target.value)} /></div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Días de clase en la semana</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map(d => (
                    <button key={d} type="button" onClick={() => toggleDia(d)} className="pill-btn" style={{ padding: '0.3rem 0.8rem', border: '1px solid var(--border-color)', background: diasClase.includes(d) ? 'var(--accent-blue)' : 'var(--bg-input)', color: diasClase.includes(d) ? 'white' : 'var(--text-muted)' }}>{d.substring(0,3)}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Duración sesión (min)</label>
                  <input type="number" className="search-input" value={duracion} onChange={e => setDuracion(e.target.value)} style={{ margin: 0 }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fecha Oficial Entrega</label>
                  <input type="date" className="search-input" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} style={{ margin: 0 }} />
                </div>
              </div>

            </div>
          </TutorialTooltip>

          {/* PASO 3 */}
          <TutorialTooltip mensaje="PASO 3: Instrucción principal. Sé específico y directo (Ej: 'Crea un proyecto sobre reciclaje basado en trabajo colaborativo'). Puedes añadir los elementos sintéticos de tu programa si los tienes a la mano." esBloque={true} posicion="right">
            <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', borderLeft: paso3Habilitado ? '4px solid var(--accent-purple)' : '4px solid var(--border-color)', opacity: paso3Habilitado ? 1 : 0.4, pointerEvents: paso3Habilitado ? 'auto' : 'none', transition: 'all 0.3s' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--accent-purple)' }}>3. Instrucciones y Pedagogía</label>
              
              <label style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 'bold' }}>Instrucción Principal (Obligatorio)</label>
              <textarea className="search-input" placeholder="Ej. Genera una planeación sobre las Leyes de Newton enfocada en experimentos prácticos..." value={instrucciones} onChange={e => setInstrucciones(e.target.value)} style={{ resize: 'vertical', minHeight: '80px', border: '1px solid var(--accent-purple)' }} />

              <details style={{ marginTop: '1rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Elementos Sintéticos (Opcionales ▼)</summary>
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <input type="text" className="search-input" placeholder="Contenido..." value={contenido} onChange={e => setContenido(e.target.value)} style={{ margin: 0 }} />
                  <input type="text" className="search-input" placeholder="PDA (Proceso de Desarrollo)..." value={pda} onChange={e => setPda(e.target.value)} style={{ margin: 0 }} />
                  <input type="text" className="search-input" placeholder="Ejes Articuladores..." value={ejes} onChange={e => setEjes(e.target.value)} style={{ margin: 0 }} />
                </div>
              </details>
            </div>
          </TutorialTooltip>

          <TutorialTooltip mensaje="PASO FINAL: Da clic aquí para enviar todo el contexto a la IA y generar tu plano didáctico." esBloque={true} posicion="top">
            <button type="submit" disabled={generando || !paso3Habilitado} className="pill-btn" style={{ width: '100%', background: 'var(--accent-purple)', color: 'white', padding: '1rem', fontSize: '1.1rem', opacity: paso3Habilitado ? 1 : 0.5 }}>
              {generando ? 'Generando Planeación...' : '✨ Generar con Inteligencia Artificial'}
            </button>
          </TutorialTooltip>
        </form>
      </div>

      {/* PANEL DERECHO: VISOR Y CARGA */}
      <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app)', borderRadius: '24px', border: '1px solid var(--border-color)', minHeight: '600px' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>Vista Previa del Documento</span>
          <TutorialTooltip mensaje="Descarga el documento completamente formateado, membretado y listo para imprimirse o firmarse." posicion="left">
            <button onClick={exportarWord} disabled={!resultadoIA} className="pill-btn" style={{ background: resultadoIA ? 'var(--accent-blue)' : 'var(--bg-input)', color: resultadoIA ? 'white' : 'var(--text-muted)', border: 'none' }}>📄 Descargar Word</button>
          </TutorialTooltip>
        </div>
        
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', backgroundColor: '#e2e8f0', display: 'flex', justifyContent: 'center' }}>
          {generando ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
              <div className="loader" style={{ width: '50px', height: '50px', borderTopColor: 'var(--accent-purple)' }}></div>
              <p style={{ color: 'var(--accent-purple)', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>Estructurando plano didáctico...</p>
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', padding: '3rem', width: '100%', maxWidth: '800px', minHeight: '100%', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', color: '#000', fontSize: '10pt', lineHeight: '1.5', fontFamily: 'Arial', textAlign: 'left' }}>
              {resultadoIA ? (
                <div dangerouslySetInnerHTML={{ __html: resultadoIA.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/^\*\s(.*)/gm, '&bull; $1').replace(/\*(.*?)\*/g, '<i>$1</i>').replace(/\n/g, '<br/>') }} />
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '30%' }}>
                  Sigue los pasos a la izquierda para configurar tu grupo, fechas y pedagogía.<br/><br/>Aquí se construirá tu documento oficial.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}