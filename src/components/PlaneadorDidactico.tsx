import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';
import jsPDF from 'jspdf';

interface Grupo { id: string; name: string; grade: string; subject: string; emphasis: string; docenteEmail?: string; }
interface MemoriaEscolar { escuela: string; ubicacion: string; docente: string; revisor: string; }
interface ContextoAula { entorno: string; grupo: string; reglas: string; }

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
  
  // 3. Estados Pedagógicos (Curriculares)
  const [instrucciones, setInstrucciones] = useState('');
  const [contenido, setContenido] = useState('');
  const [pda, setPda] = useState('');
  const [ejes, setEjes] = useState('');

  // 4. NUEVO: Metodologías a la carta
  const [metodologia, setMetodologia] = useState('Aprendizaje Basado en Proyectos (ABP)');
  const [metodologiaPersonalizada, setMetodologiaPersonalizada] = useState('');

  // 5. NUEVO: Módulo de Contexto Vivo (DUA)
  const [usarContextoBase, setUsarContextoBase] = useState(false);
  const [panelContextoAbierto, setPanelContextoAbierto] = useState(false);
  const [contextoAula, setContextoAula] = useState<ContextoAula>({ entorno: '', grupo: '', reglas: '' });

  // 6. Estados de Generación
  const [generando, setGenerando] = useState(false);
  const [resultadoIA, setResultadoIA] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const sessionLocal = localStorage.getItem('aulaPlusSession');
      const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
      
      const userEmail = sessionData?.user?.email || sessionData?.email || 'docente_default';
      setUserId(userEmail);

      const qGrupos = query(collection(db, 'groups'), where('docenteEmail', '==', userEmail));
      const snapGrupos = await getDocs(qGrupos);
      const listaGrupos: Grupo[] = [];
      snapGrupos.forEach(d => listaGrupos.push({ id: d.id, ...d.data() } as Grupo));
      setGrupos(listaGrupos);

      const docMemoria = await getDoc(doc(db, 'teacher_settings', userEmail));
      if (docMemoria.exists() && docMemoria.data().memoriaEscolar) {
        setMemoria(docMemoria.data().memoriaEscolar);
        setModoEdicionMemoria(false);
      } else if (sessionData?.user?.nombre) {
        setMemoria(prev => ({ ...prev, docente: sessionData.user.nombre }));
      }

      // Cargar contexto guardado previamente si existe
      if (docMemoria.exists() && docMemoria.data().contextoAula) {
        setContextoAula(docMemoria.data().contextoAula);
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

  const guardarContextoVivo = async () => {
    try {
      await setDoc(doc(db, 'teacher_settings', userId), { contextoAula }, { merge: true });
      setPanelContextoAbierto(false);
      alert("Contexto de aula guardado. La IA ahora lo tomará en cuenta.");
    } catch (e) {
      alert("Error al guardar el contexto.");
    }
  };

  const toggleDia = (dia: string) => setDiasClase(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]);

  // Cálculo de Temporalidad
  const diffDays = (fechaInicio && fechaFin) ? Math.ceil((new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const etiquetaTemporal = diffDays > 31 ? '📅 Planeación Trimestral' : diffDays > 0 ? '📅 Planeación Mensual/Quincenal' : '';

  const generarPlaneacion = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!instrucciones) return alert("Debes escribir las instrucciones o el tema de tu planeación.");
    if (!fechaInicio || !fechaFin || !fechaEntrega) return alert("Establece las fechas de entrega y periodo lectivo.");
    if (diasClase.length === 0) return alert("Debes seleccionar al menos un día de clase en la semana.");
    if (!duracion || Number(duracion) <= 0) return alert("La duración de la sesión debe ser mayor a 0 minutos.");
    if (diffDays < 0) return alert("La fecha de fin no puede ser anterior a la de inicio.");
    if (diffDays > 120) return alert("El rango supera un trimestre. Por favor, redúcelo para mantener la precisión de la IA.");

    setGenerando(true);
    const grupo = grupos.find(g => g.id === grupoSeleccionado);
    const metodoElegido = metodologia === 'Personalizada' ? metodologiaPersonalizada : metodologia;
    
    // PROMPT MAESTRO (Investigación NEM)
    const promptMaestro = `
      Actúa como un equipo interdisciplinario integrado por:
      - Especialista en currículo mexicano y Nueva Escuela Mexicana.
      - Docente experimentado de Educación Secundaria.
      - Diseñador instruccional.
      - Especialista en inclusión y Diseño Universal para el Aprendizaje (DUA).
      - Especialista en evaluación formativa.

      Tu tarea es construir una planeación didáctica viable, contextualizada y pedagógicamente coherente.
      IMPORTANTE: No inventes contenidos oficiales ni normativas. Cuando un dato sea indispensable y no esté, indícalo como "DATO PENDIENTE".

      ════════════════════
      1. DATOS INSTITUCIONALES
      ════════════════════
      - Escuela: ${memoria.escuela}
      - Docente: ${memoria.docente}
      - Disciplina: ${grupo?.subject} ${grupo?.subject === 'Tecnología' && grupo?.emphasis ? `(Énfasis: ${grupo?.emphasis})` : ''}
      - Grado y grupo: ${grupo?.name}
      - Periodo de aplicación: Del ${fechaInicio} al ${fechaFin}
      
      ════════════════════
      2. CONTEXTO SOCIOEDUCATIVO (DUA E INCLUSIÓN)
      ════════════════════
      ${usarContextoBase && contextoAula.entorno ? `- Características de la comunidad e infraestructura: ${contextoAula.entorno}` : '- Contexto: Estándar urbano/semiurbano.'}
      ${usarContextoBase && contextoAula.grupo ? `- Ritmos, diversidad y necesidades del grupo: ${contextoAula.grupo}` : '- Necesidades del grupo: Heterogéneas, requiere actividades multimodales.'}
      ${usarContextoBase && contextoAula.reglas ? `- Reglas de formato/IA del docente: ${contextoAula.reglas}` : ''}

      ════════════════════
      3. REFERENTES CURRICULARES
      ════════════════════
      - Contenido: ${contenido || 'Determinar con base en la disciplina'}
      - PDA: ${pda || 'Determinar con base en el contenido'}
      - Ejes articuladores pertinentes: ${ejes || 'Los que apliquen orgánicamente'}

      ════════════════════
      4. INTENCIÓN DIDÁCTICA Y METODOLOGÍA
      ════════════════════
      - Tema/Instrucción principal: "${instrucciones}"
      - Metodología exigida: ${metodoElegido}
      - Días de clase a la semana: ${diasClase.join(', ')}
      - Duración por sesión: ${duracion} minutos

      ════════════════════
      5. DISEÑO DE ACTIVIDADES (ESTRUCTURA DE SALIDA ESPERADA)
      ════════════════════
      Organiza la planeación estructurándola por SESIONES.
      Si el periodo es largo (Trimestral), agrupa las sesiones por SEMANAS.
      
      Para cada sesión especifica:
      - Propósito de la sesión.
      - Inicio (recuperación de saberes).
      - Desarrollo (acciones del docente y alumnos, considerando DUA y el contexto).
      - Cierre (metacognición).
      - Evaluación formativa de esa sesión.
      
      Entrega el documento final usando markdown, viñetas y negritas. 
      Omite introducciones o saludos. Genera directamente el contenido de la planeación.
    `;

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY; 
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptMaestro }] }] })
      });

      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        setResultadoIA(data.candidates[0].content.parts[0].text);
      } else { alert('Error en la respuesta de la IA. Verifica tu conexión.'); }
    } catch (error) { alert('Error de red al conectar con el motor de IA.'); }
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
          .section-content { text-align: justify; line-height: 1.5; } 
          .signatures td { border: none; text-align: center; padding-top: 50px; width: 50%; }
          /* Control de paginación para evitar que rompa títulos en Word */
          h1, h2, h3 { page-break-after: avoid; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        </style>
      </head>
      <body>
        <div class="title">PLANEACIÓN DIDÁCTICA FORMATIVA</div>
        <table>
          <tr><td><b>Escuela:</b> ${memoria.escuela}</td><td><b>Ubicación:</b> ${memoria.ubicacion}</td></tr>
          <tr><td><b>Disciplina:</b> ${grupo?.subject}</td><td><b>Énfasis:</b> ${grupo?.subject === 'Tecnología' && grupo?.emphasis ? grupo.emphasis : 'N/A'}</td></tr>
          <tr><td><b>Grado y Grupo:</b> ${grupo?.name}</td><td><b>Fecha de Entrega:</b> ${fechaEntrega}</td></tr>
          <tr><td colspan="2"><b>Metodología:</b> ${metodologia === 'Personalizada' ? metodologiaPersonalizada : metodologia}</td></tr>
          <tr><td colspan="2"><b>Contenido Sintético:</b> ${contenido || 'Ver desarrollo'}</td></tr>
          <tr><td colspan="2"><b>PDA:</b> ${pda || 'Ver desarrollo'}</td></tr>
          <tr><td colspan="2"><b>Ejes Articuladores:</b> ${ejes || 'Ver desarrollo'}</td></tr>
        </table>
        
        <div class="section-content">${htmlResultado}</div>
        
        <br clear="all" style="page-break-before:always" />
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

  const exportarPDF = () => {
    if (!resultadoIA) return;
    const grupo = grupos.find(g => g.id === grupoSeleccionado);
    const doc = new jsPDF();
    
    const marginX = 14;
    let posY = 20;
    const pageHeight = doc.internal.pageSize.height;

    doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(28, 81, 255);
    doc.text("PLANEACIÓN DIDÁCTICA FORMATIVA", 105, posY, { align: "center" }); posY += 10;

    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);
    doc.text(`Escuela: ${memoria.escuela}`, marginX, posY); doc.text(`Ubicación: ${memoria.ubicacion}`, 105, posY); posY += 6;
    doc.text(`Disciplina: ${grupo?.subject}`, marginX, posY); doc.text(`Grado y Grupo: ${grupo?.name}`, 105, posY); posY += 6;
    doc.text(`Metodología: ${metodologia === 'Personalizada' ? metodologiaPersonalizada : metodologia}`, marginX, posY); posY += 8;

    doc.setDrawColor(200, 200, 200); doc.line(marginX, posY, 196, posY); posY += 8;

    const textoLimpio = resultadoIA.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
    const splitText = doc.splitTextToSize(textoLimpio, 180);
    
    splitText.forEach((line: string) => {
      if (posY > pageHeight - 40) { doc.addPage(); posY = 20; }
      doc.text(line, marginX, posY);
      posY += 6;
    });

    if (posY > pageHeight - 40) { doc.addPage(); posY = 20; }
    posY += 20;
    doc.text("___________________________", 50, posY, { align: "center" }); doc.text("___________________________", 150, posY, { align: "center" }); posY += 5;
    doc.setFont("helvetica", "bold"); doc.text("Docente", 50, posY, { align: "center" }); doc.text("Revisa", 150, posY, { align: "center" }); posY += 5;
    doc.setFont("helvetica", "normal"); doc.text(memoria.docente, 50, posY, { align: "center" }); doc.text(memoria.revisor, 150, posY, { align: "center" });

    doc.save(`Planeacion_${grupo?.name}_${fechaInicio}.pdf`);
  };

  const paso2Habilitado = grupoSeleccionado !== '';
  const paso3Habilitado = paso2Habilitado && fechaInicio !== '' && fechaFin !== '' && fechaEntrega !== '' && diasClase.length > 0 && duracion !== '';

  return (
    <div style={{ position: 'relative', minHeight: '80vh', overflowX: 'hidden' }}>
      
      {/* SWITCH DE CONTEXTO VIVO */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', paddingRight: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: usarContextoBase ? 'rgba(156, 39, 176, 0.1)' : 'var(--bg-panel)', padding: '0.6rem 1.5rem', borderRadius: '50px', border: `1px solid ${usarContextoBase ? 'var(--accent-purple)' : 'var(--border-color)'}`, transition: 'all 0.3s' }}>
          <span style={{ fontWeight: 'bold', color: usarContextoBase ? 'var(--accent-purple)' : 'var(--text-muted)' }}>
            {usarContextoBase ? '✨ Contexto Base Activado (DUA)' : 'Planeación Genérica'}
          </span>
          <label className="switch">
            <input type="checkbox" checked={usarContextoBase} onChange={(e) => { setUsarContextoBase(e.target.checked); if(e.target.checked) setPanelContextoAbierto(true); }} />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', animation: 'fadeIn 0.3s' }}>
        
        {/* COLUMNA IZQUIERDA: CONFIGURACIÓN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <TutorialTooltip mensaje="Completa tu Memoria Escolar. Se guardará en la nube para armar tu membrete oficial automáticamente." posicion="top">
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

          <form onSubmit={generarPlaneacion} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', borderLeft: '4px solid var(--accent-blue)' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>1. Grupo a Planear</label>
              <select className="search-input" value={grupoSeleccionado} onChange={e => setGrupoSeleccionado(e.target.value)} style={{ margin: 0, cursor: 'pointer' }}>
                <option value="">-- Selecciona un grupo --</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.name} - {g.subject}</option>)}
              </select>
            </div>

            <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', borderLeft: paso2Habilitado ? '4px solid var(--accent-blue)' : '4px solid var(--border-color)', opacity: paso2Habilitado ? 1 : 0.4, pointerEvents: paso2Habilitado ? 'auto' : 'none', transition: 'all 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <label style={{ fontWeight: 'bold', margin: 0 }}>2. Calendario y Fechas</label>
                {etiquetaTemporal && <span style={{ fontSize: '0.8rem', backgroundColor: 'rgba(28, 81, 255, 0.1)', color: 'var(--accent-blue)', padding: '0.2rem 0.6rem', borderRadius: '50px', fontWeight: 'bold' }}>{etiquetaTemporal}</span>}
              </div>
              
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
                <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Duración sesión (min)</label><input type="number" className="search-input" value={duracion} onChange={e => setDuracion(e.target.value)} style={{ margin: 0 }} /></div>
                <div><label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fecha Oficial Entrega</label><input type="date" className="search-input" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} style={{ margin: 0 }} /></div>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', borderLeft: paso3Habilitado ? '4px solid var(--accent-purple)' : '4px solid var(--border-color)', opacity: paso3Habilitado ? 1 : 0.4, pointerEvents: paso3Habilitado ? 'auto' : 'none', transition: 'all 0.3s' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--accent-purple)' }}>3. Instrucciones y Pedagogía</label>
              
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>Metodología a usar</label>
              <select className="search-input" value={metodologia} onChange={e => setMetodologia(e.target.value)} style={{ marginBottom: '1rem' }}>
                <option value="Aprendizaje Basado en Proyectos (ABP)">Aprendizaje Basado en Proyectos (ABP)</option>
                <option value="STEAM">STEAM (Ciencia, Tecnología, Ingeniería, Artes y Matemáticas)</option>
                <option value="Aprendizaje Basado en Problemas">Aprendizaje Basado en Problemas (ABp)</option>
                <option value="Aprendizaje en el Servicio">Aprendizaje en el Servicio (AS)</option>
                <option value="Secuencia Didáctica Estándar">Secuencia Didáctica Estándar</option>
                <option value="Personalizada">🌟 Metodología Propia / Personalizada</option>
              </select>

              {metodologia === 'Personalizada' && (
                <input type="text" className="search-input" placeholder="Ej. Aula Invertida (Flipped Classroom)" value={metodologiaPersonalizada} onChange={e => setMetodologiaPersonalizada(e.target.value)} style={{ borderLeft: '4px solid var(--accent-purple)' }} />
              )}

              <label style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 'bold', marginTop: '0.5rem' }}>Instrucción Principal (Obligatorio)</label>
              <textarea className="search-input" placeholder="Ej. Diseña un proyecto para construir un huerto escolar vinculando los estados de la materia..." value={instrucciones} onChange={e => setInstrucciones(e.target.value)} style={{ resize: 'vertical', minHeight: '80px', border: '1px solid var(--accent-purple)' }} />

              <details style={{ marginTop: '1rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Elementos Curriculares (Opcionales ▼)</summary>
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <input type="text" className="search-input" placeholder="Contenido Sintético..." value={contenido} onChange={e => setContenido(e.target.value)} style={{ margin: 0 }} />
                  <input type="text" className="search-input" placeholder="PDA (Proceso de Desarrollo)..." value={pda} onChange={e => setPda(e.target.value)} style={{ margin: 0 }} />
                  <input type="text" className="search-input" placeholder="Ejes Articuladores (Ej. Inclusión, Pensamiento Crítico)..." value={ejes} onChange={e => setEjes(e.target.value)} style={{ margin: 0 }} />
                </div>
              </details>
            </div>

            <button type="submit" disabled={generando || !paso3Habilitado} className="pill-btn hover-opacity" style={{ width: '100%', background: 'var(--accent-purple)', color: 'white', padding: '1.2rem', fontSize: '1.2rem', fontWeight: 'bold', opacity: paso3Habilitado ? 1 : 0.5, boxShadow: '0 8px 20px rgba(156, 39, 176, 0.3)' }}>
              {generando ? '🧠 Analizando y Generando...' : '✨ Construir Plano Didáctico'}
            </button>
          </form>
        </div>

        {/* COLUMNA DERECHA: VISOR */}
        <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app)', borderRadius: '24px', border: '1px solid var(--border-color)', minHeight: '600px', position: 'relative', overflow: 'hidden' }}>
          
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', backgroundColor: 'var(--bg-panel)' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>Vista Previa del Documento</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: resultadoIA ? 1 : 0.4, pointerEvents: resultadoIA ? 'auto' : 'none' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Descargar:</span>
              <button onClick={exportarWord} className="pill-btn" style={{ backgroundColor: '#185ABD', color: 'white', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '8px' }}>📄 .doc</button>
              <button onClick={exportarPDF} className="pill-btn" style={{ backgroundColor: '#E53935', color: 'white', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '8px' }}>📕 .pdf</button>
            </div>
          </div>
          
          <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', backgroundColor: '#e2e8f0', display: 'flex', justifyContent: 'center' }}>
            {generando ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
                <div className="loader" style={{ width: '60px', height: '60px', borderTopColor: 'var(--accent-purple)' }}></div>
                <p style={{ color: 'var(--accent-purple)', fontWeight: 'bold', animation: 'pulse 1.5s infinite', textAlign: 'center' }}>Aplicando DUA y pedagogía...<br/>Construyendo documento oficial.</p>
              </div>
            ) : (
              <div style={{ backgroundColor: 'white', padding: '3rem', width: '100%', maxWidth: '800px', minHeight: '100%', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', color: '#000', fontSize: '11pt', lineHeight: '1.6', fontFamily: 'Arial', textAlign: 'justify' }}>
                {resultadoIA ? (
                  <div dangerouslySetInnerHTML={{ __html: resultadoIA.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/^\*\s(.*)/gm, '&bull; $1').replace(/\*(.*?)\*/g, '<i>$1</i>').replace(/\n/g, '<br/>') }} />
                ) : (
                  <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '30%' }}>
                    <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>📄</span>
                    Sigue los pasos a la izquierda para configurar tu grupo, fechas y metodología.<br/><br/>Aquí se construirá tu documento formal.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DRAWER LATERAL: MÓDULO DE CONTEXTO VIVO */}
          <div style={{ position: 'absolute', top: 0, right: panelContextoAbierto ? 0 : '-100%', width: '100%', maxWidth: '400px', height: '100%', backgroundColor: 'var(--bg-panel)', borderLeft: '1px solid var(--border-color)', boxShadow: '-5px 0 25px rgba(0,0,0,0.1)', transition: 'right 0.3s ease', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(156, 39, 176, 0.1)' }}>
              <h3 style={{ margin: 0, color: 'var(--accent-purple)' }}>✨ Contexto Vivo (DUA)</h3>
              <button onClick={() => setPanelContextoAbierto(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>
            
            <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>Si configuras estos campos, la Inteligencia Artificial los memorizará y adaptará tus planeaciones (Ajustes razonables, materiales y tiempos) a tu realidad.</p>
              
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>🏫 Infraestructura y Entorno</label>
                <textarea className="search-input" value={contextoAula.entorno} onChange={e => setContextoAula({...contextoAula, entorno: e.target.value})} placeholder="Ej. No hay proyector, los alumnos no tienen internet en casa, hay un proyecto comunitario de reciclaje activo..." style={{ minHeight: '100px', resize: 'vertical', borderLeft: '3px solid var(--accent-purple)' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>👥 Barreras y Ritmos del Grupo</label>
                <textarea className="search-input" value={contextoAula.grupo} onChange={e => setContextoAula({...contextoAula, grupo: e.target.value})} placeholder="Ej. Tengo 3 alumnos con TDAH, el grupo es muy kinestésico, se distraen rápido con lecturas largas..." style={{ minHeight: '100px', resize: 'vertical', borderLeft: '3px solid var(--accent-green)' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>⚙️ Reglas Propias para la IA</label>
                <textarea className="search-input" value={contextoAula.reglas} onChange={e => setContextoAula({...contextoAula, reglas: e.target.value})} placeholder="Ej. Siempre usa tablas para la rúbrica final. Háblame de 'Tú'. Usa lenguaje sencillo en las instrucciones..." style={{ minHeight: '80px', resize: 'vertical', borderLeft: '3px solid var(--accent-blue)' }} />
              </div>
            </div>

            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
              <button onClick={guardarContextoVivo} className="pill-btn" style={{ width: '100%', background: 'var(--accent-purple)', color: 'white', padding: '1rem', fontWeight: 'bold' }}>💾 Memorizar Contexto</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}