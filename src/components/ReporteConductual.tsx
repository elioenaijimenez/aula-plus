import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, addDoc, serverTimestamp, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';
import jsPDF from 'jspdf';

interface Alumno { id: string; fullName: string; studentNumber: number; }
interface Incidencia {
  id: string; folio: string; idAlumno: string; nombreAlumno: string; fecha: string; tipo: string; descripcion: string; medidas: string; compromisos: string; createdAt?: any;
}

export default function ReporteConductual({ idGrupo, grupo, onVolver, setGuiaConductual }: { idGrupo: string, grupo: any, onVolver: () => void, setGuiaConductual: (v: boolean) => void }) {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  const [vista, setVista] = useState<'panel' | 'formulario'>('panel');
  
  const [idAlumnoSelec, setIdAlumnoSelec] = useState('');
  const [tipoIncidencia, setTipoIncidencia] = useState('Indisciplina o Falta a Acuerdos');
  const [descripcion, setDescripcion] = useState('');
  const [medidas, setMedidas] = useState('');
  const [compromisos, setCompromisos] = useState('');
  
  const obtenerFechaLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().split('T')[0]; };
  const [fecha, setFecha] = useState(obtenerFechaLocal());
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const sessionLocal = localStorage.getItem('aulaPlusSession');
    if (sessionLocal) {
      const sessionData = JSON.parse(sessionLocal);
      setUserEmail(sessionData?.user?.email || sessionData?.email || '');
    }

    setGuiaConductual(vista === 'formulario');
    return () => setGuiaConductual(false);
  }, [vista, setGuiaConductual]);

  useEffect(() => {
    const fetchData = async () => {
      setCargando(true);
      const qAlumnos = query(collection(db, `groups/${idGrupo}/students`), orderBy('studentNumber', 'asc'));
      const snapA = await getDocs(qAlumnos);
      const listaA: Alumno[] = [];
      snapA.forEach(d => listaA.push({ id: d.id, ...d.data() } as Alumno));
      setAlumnos(listaA);

      const qIncidencias = query(collection(db, `groups/${idGrupo}/incidences`), orderBy('createdAt', 'desc'));
      const desuscribir = onSnapshot(qIncidencias, (snap) => {
        const listaI: Incidencia[] = [];
        snap.forEach(doc => listaI.push({ id: doc.id, ...doc.data() } as Incidencia));
        setIncidencias(listaI);
        setCargando(false);
      });
      return () => desuscribir();
    };
    fetchData();
  }, [idGrupo]);

  const abrirFormulario = (idAl: string = '') => {
    setIdAlumnoSelec(idAl); setDescripcion(''); setMedidas(''); setCompromisos(''); setFecha(obtenerFechaLocal());
    setVista('formulario');
  };

  const guardarIncidencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idAlumnoSelec) { alert("Selecciona un alumno."); return; }
    
    setGuardando(true);
    const alumnoObj = alumnos.find(a => a.id === idAlumnoSelec);
    const timestampFolio = Math.floor(Date.now() / 1000).toString();
    const folioUnico = `BIT-${timestampFolio}-${alumnoObj?.fullName.charAt(0)}`;

    try {
      await addDoc(collection(db, `groups/${idGrupo}/incidences`), {
        folio: folioUnico, idAlumno: idAlumnoSelec, nombreAlumno: alumnoObj?.fullName,
        fecha, tipo: tipoIncidencia, descripcion, medidas, compromisos, createdAt: serverTimestamp()
      });
      alert('✅ Bitácora registrada con éxito y valor legal.');
      setVista('panel');
    } catch (error) { alert("Error al guardar la incidencia."); }
    setGuardando(false);
  };

  const formatearFecha = (fechaISO: string) => {
    if (!fechaISO) return '';
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const partes = fechaISO.split('-');
    if(partes.length !== 3) return fechaISO;
    return `${partes[2]}-${meses[parseInt(partes[1], 10) - 1]}-${partes[0]}`;
  };

  // Función genérica para obtener el perfil desde la nube
  const obtenerPerfilNube = async () => {
    if (!userEmail) return { nombre: 'Docente', escuela: 'Escuela no registrada', ubicacion: 'Ubicación no registrada' };
    try {
      const docRef = doc(db, 'teacher_settings', userEmail);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().memoriaEscolar) {
        return docSnap.data().memoriaEscolar;
      }
    } catch (error) {
      console.error("Error al obtener perfil de la nube", error);
    }
    return { nombre: 'Docente', escuela: 'Escuela no registrada', ubicacion: 'Ubicación no registrada' };
  };

  const exportarBitacoraWord = async (inc: Incidencia) => {
    // EXTRACCIÓN DE LA NUBE
    const perfilNube = await obtenerPerfilNube();
    const nombreDocente = perfilNube.nombre || 'Docente';
    const escuela = perfilNube.escuela || 'Escuela no registrada';
    const ubicacion = perfilNube.ubicacion || 'Ubicación no registrada';
    const ubicacionStr = ubicacion.includes('Morelos') ? ubicacion : `${ubicacion}, Morelos`;

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Bitácora Oficial</title>
        <style>
          @page { margin: 1.5cm 1.5cm 1.5cm 1.5cm; }
        </style>
      </head>
      <body style="font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.15; color: #000;">
        <div style="text-align: right; font-size: 9pt; color: #555; margin-bottom: 10px;"><b>FOLIO INTERNO:</b> ${inc.folio}</div>
        <div style="text-align: center; margin-bottom: 15px;">
          <div style="font-size: 16pt; font-weight: bold; color: #1C51FF;">BITÁCORA DOCENTE</div>
          <div style="font-size: 11pt; color: #333;">(Registro de incidencias, eventualidades y seguimiento)</div>
        </div>
        
        <div style="background-color: #e2e8f0; padding: 4px; font-weight: bold; margin-top: 10px; margin-bottom: 5px;">1. DATOS GENERALES</div>
        <table style="width: 100%; font-size: 11pt; line-height: 1.3; margin-bottom: 10px;">
          <tr><td style="padding: 2px 0;"><b>Lugar y fecha:</b> ${ubicacionStr}, a ${formatearFecha(inc.fecha)}</td></tr>
          <tr><td style="padding: 2px 0;"><b>Nombre de la escuela:</b> ${escuela}</td></tr>
          <tr><td style="padding: 2px 0;"><b>Nombre del Docente:</b> ${nombreDocente}</td></tr>
          <tr><td style="padding: 2px 0;"><b>Nombre de la alumna o alumno:</b> ${inc.nombreAlumno}</td></tr>
          <tr><td style="padding: 2px 0;"><b>Grado y grupo:</b> ${grupo.name}</td></tr>
          <tr><td style="padding: 2px 0;"><b>Tipo de Eventualidad:</b> ${inc.tipo}</td></tr>
        </table>

        <div style="background-color: #e2e8f0; padding: 4px; font-weight: bold; margin-top: 10px; margin-bottom: 5px;">2. DESCRIPCIÓN DE HECHOS</div>
        <div style="text-align: justify; margin-bottom: 10px;">${inc.descripcion}</div>

        <div style="background-color: #e2e8f0; padding: 4px; font-weight: bold; margin-top: 10px; margin-bottom: 5px;">3. MEDIDAS DE PREVENCIÓN APLICADAS</div>
        <div style="text-align: justify; margin-bottom: 10px;">${inc.medidas}</div>

        <div style="background-color: #e2e8f0; padding: 4px; font-weight: bold; margin-top: 10px; margin-bottom: 5px;">4. COMPROMISOS DE LOS TUTORES (Acuerdos)</div>
        <div style="text-align: justify; margin-bottom: 20px;">${inc.compromisos}</div>

        <div style="background-color: #e2e8f0; padding: 4px; font-weight: bold; margin-top: 10px; margin-bottom: 25px;">5. FIRMAS DE VALIDACIÓN</div>
        <table style="width: 100%; text-align: center; font-size: 10pt; margin-top: 30px;">
          <tr>
            <td style="width: 33%;">___________________________<br><br>${nombreDocente}<br>Docente</td>
            <td style="width: 33%;">___________________________<br><br>Firma de Madre, Padre o Tutor</td>
            <td style="width: 33%;">___________________________<br><br>Directivo o Autoridad Escolar</td>
          </tr>
        </table>

        <div style="margin-top: 30px; font-size: 8pt; color: #777; text-align: justify; border-top: 1px solid #ccc; padding-top: 5px; line-height: 1.1;">
          <b>AVISO DE PRIVACIDAD Y PROTECCIÓN DE DATOS:</b> Los datos personales proporcionados serán protegidos en términos de la Ley de Protección de Datos Personales en Posesión de Sujetos Obligados para el Estado de Morelos, y serán utilizados exclusivamente para fines estadísticos, de prevención, seguimiento pedagógico y protección del interés superior de la niñez. Se han omitido los apellidos de terceros involucrados para salvaguardar su derecho constitucional a la privacidad e intimidad.
        </div>
      </body></html>
    `;

    const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/msword;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Bitacora_${inc.nombreAlumno}_${inc.fecha}.doc`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const exportarBitacoraPDF = async (inc: Incidencia) => {
    // EXTRACCIÓN DE LA NUBE
    const perfilNube = await obtenerPerfilNube();
    const nombreDocente = perfilNube.nombre || 'Docente';
    const escuela = perfilNube.escuela || 'Escuela no registrada';
    const ubicacion = perfilNube.ubicacion || 'Ubicación no registrada';
    const ubicacionStr = ubicacion.includes('Morelos') ? ubicacion : `${ubicacion}, Morelos`;

    const docRef = new jsPDF();
    let posY = 20;

    // Folio
    docRef.setFontSize(9);
    docRef.setTextColor(85, 85, 85);
    docRef.text(`FOLIO INTERNO: ${inc.folio}`, 196, posY, { align: 'right' });
    posY += 10;

    // Encabezado
    docRef.setFontSize(16);
    docRef.setFont("helvetica", "bold");
    docRef.setTextColor(28, 81, 255);
    docRef.text("BITÁCORA DOCENTE", 105, posY, { align: 'center' });
    posY += 6;
    docRef.setFontSize(11);
    docRef.setFont("helvetica", "normal");
    docRef.setTextColor(51, 51, 51);
    docRef.text("(Registro de incidencias, eventualidades y seguimiento)", 105, posY, { align: 'center' });
    posY += 15;

    const printSection = (title: string, content: string | string[], isTable: boolean = false) => {
      docRef.setFillColor(226, 232, 240);
      docRef.rect(14, posY - 4, 182, 7, 'F');
      docRef.setFontSize(10);
      docRef.setFont("helvetica", "bold");
      docRef.setTextColor(0, 0, 0);
      docRef.text(title, 16, posY + 1);
      posY += 8;

      docRef.setFont("helvetica", "normal");
      if (isTable && Array.isArray(content)) {
        content.forEach(line => {
          docRef.text(line, 14, posY);
          posY += 6;
        });
      } else if (typeof content === 'string') {
        const splitText = docRef.splitTextToSize(content, 182);
        splitText.forEach((line: string) => {
          if (posY > 270) { docRef.addPage(); posY = 20; }
          docRef.text(line, 14, posY);
          posY += 6;
        });
      }
      posY += 4;
    };

    printSection("1. DATOS GENERALES", [
      `Lugar y fecha: ${ubicacionStr}, a ${formatearFecha(inc.fecha)}`,
      `Nombre de la escuela: ${escuela}`,
      `Nombre del Docente: ${nombreDocente}`,
      `Nombre de la alumna o alumno: ${inc.nombreAlumno}`,
      `Grado y grupo: ${grupo.name}`,
      `Tipo de Eventualidad: ${inc.tipo}`
    ], true);

    printSection("2. DESCRIPCIÓN DE HECHOS", inc.descripcion);
    printSection("3. MEDIDAS DE PREVENCIÓN APLICADAS", inc.medidas);
    printSection("4. COMPROMISOS DE LOS TUTORES (Acuerdos)", inc.compromisos);

    if (posY > 230) { docRef.addPage(); posY = 20; }

    docRef.setFillColor(226, 232, 240);
    docRef.rect(14, posY - 4, 182, 7, 'F');
    docRef.setFontSize(10);
    docRef.setFont("helvetica", "bold");
    docRef.text("5. FIRMAS DE VALIDACIÓN", 16, posY + 1);
    posY += 25;

    docRef.setFont("helvetica", "normal");
    docRef.text("_________________________", 40, posY, { align: 'center' });
    docRef.text("_________________________", 105, posY, { align: 'center' });
    docRef.text("_________________________", 170, posY, { align: 'center' });
    posY += 5;
    docRef.setFontSize(9);
    docRef.text(`${nombreDocente}`, 40, posY, { align: 'center' });
    docRef.text("Firma de Madre, Padre o Tutor", 105, posY, { align: 'center' });
    docRef.text("Directivo o Autoridad Escolar", 170, posY, { align: 'center' });
    posY += 5;
    docRef.text("Docente", 40, posY, { align: 'center' });

    posY += 20;
    docRef.setDrawColor(200, 200, 200);
    docRef.line(14, posY, 196, posY);
    posY += 5;
    docRef.setFontSize(7);
    docRef.setTextColor(119, 119, 119);
    const privacyText = "AVISO DE PRIVACIDAD Y PROTECCIÓN DE DATOS: Los datos personales proporcionados serán protegidos en términos de la Ley de Protección de Datos Personales en Posesión de Sujetos Obligados para el Estado de Morelos, y serán utilizados exclusivamente para fines estadísticos, de prevención, seguimiento pedagógico y protección del interés superior de la niñez. Se han omitido los apellidos de terceros involucrados para salvaguardar su derecho constitucional a la privacidad e intimidad.";
    const splitPrivacy = docRef.splitTextToSize(privacyText, 182);
    splitPrivacy.forEach((line: string) => {
       docRef.text(line, 14, posY);
       posY += 4;
    });

    docRef.save(`Bitacora_${inc.nombreAlumno}_${inc.fecha}.pdf`);
  };

  const conteoPorAlumno: Record<string, { nombre: string, total: number }> = {};
  incidencias.forEach(inc => {
    if(!conteoPorAlumno[inc.idAlumno]) conteoPorAlumno[inc.idAlumno] = { nombre: inc.nombreAlumno, total: 0 };
    conteoPorAlumno[inc.idAlumno].total += 1;
  });
  const focosRojos = Object.entries(conteoPorAlumno).filter(([_, data]) => data.total > 1).sort((a,b) => b[1].total - a[1].total);

  if (cargando) return <div className="loader" style={{ marginTop: '4rem' }}></div>;

  if (vista === 'formulario') {
    return (
      <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', animation: 'fadeIn 0.3s' }}>
        <button onClick={() => setVista('panel')} className="pill-btn" style={{ marginBottom: '1.5rem', background: 'var(--bg-input)', color: 'var(--text-muted)' }}>← Cancelar y Volver</button>
        <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-yellow)', fontSize: '1.6rem' }}>⚠️ Registrar Nueva Incidencia</h3>
        <p style={{ margin: '0 0 2rem 0', color: 'var(--text-muted)' }}>La información capturada tiene valor documental y legal (Anexos IEBEM).</p>

        <form onSubmit={guardarIncidencia} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>1. Alumno Principal Involucrado</label>
              <select className="search-input" required value={idAlumnoSelec} onChange={e => setIdAlumnoSelec(e.target.value)} style={{ cursor: 'pointer' }}>
                <option value="">-- Selecciona un alumno --</option>
                {alumnos.map(a => <option key={a.id} value={a.id}>{a.fullName}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Fecha del Hecho</label>
              <input type="date" className="search-input" required value={fecha} onChange={e => setFecha(e.target.value)} style={{ cursor: 'pointer' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Tipo de Eventualidad</label>
            <select className="search-input" value={tipoIncidencia} onChange={e => setTipoIncidencia(e.target.value)} style={{ cursor: 'pointer', borderLeft: '4px solid var(--accent-yellow)' }}>
              <option value="Indisciplina o Falta a Acuerdos">Falta a Acuerdos de Convivencia</option>
              <option value="Cambio de Conducta Notorio">Cambio de Conducta Notorio / Apatía</option>
              <option value="Conflicto entre pares (Mediable)">Conflicto menor entre pares</option>
              <option value="Presunto Acoso Escolar (Bullying)">Presunto Acoso Escolar (Bullying)</option>
              <option value="Presunto Abuso o Maltrato">Presunto Abuso o Maltrato Externo</option>
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '0.5rem' }}>
              <label style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>2. Descripción Objetiva de los Hechos</label>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-red)', marginTop: '0.2rem' }}>🚨 <b>Importante para Privacidad:</b> Si mencionas a terceros involucrados, usa SOLO su primer nombre o iniciales, NUNCA apellidos completos.</span>
            </div>
            <textarea 
              className="search-input" 
              required 
              value={descripcion} 
              onChange={e => setDescripcion(e.target.value)} 
              placeholder='Ej. El alumno refiere textualmente: "Pedro M. me escondió la libreta". Se observó el cuaderno dañado...'
              style={{ minHeight: '120px', resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>3. Medidas de Prevención o Contención Aplicadas</label>
            <textarea className="search-input" required value={medidas} onChange={e => setMedidas(e.target.value)} placeholder="Ej. Diálogo conciliatorio, se solicitó reponer el daño..." style={{ minHeight: '80px', resize: 'vertical' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>4. Compromisos de los Tutores (Acuerdos)</label>
            <textarea className="search-input" required value={compromisos} onChange={e => setCompromisos(e.target.value)} placeholder="Ej. El tutor se compromete a dialogar diariamente..." style={{ minHeight: '80px', resize: 'vertical' }} />
          </div>

          <button type="submit" disabled={guardando} className="pill-btn" style={{ background: 'var(--accent-yellow)', color: '#000', alignSelf: 'flex-start', padding: '1rem 3rem', fontSize: '1rem' }}>
            {guardando ? 'Firmando y Guardando...' : '💾 Guardar Bitácora'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)', animation: 'fadeIn 0.3s' }}>
      <button onClick={onVolver} className="pill-btn" style={{ marginBottom: '1rem', background: 'var(--bg-input)', color: 'var(--text-muted)' }}>← Cambiar de Reporte</button>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--accent-yellow)', fontSize: '1.6rem' }}>⚠️ Bitácora Conductual e Incidencias</h3>
          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)' }}>Grupo {grupo.name} | Total de Registros: {incidencias.length}</p>
        </div>
        
        <TutorialTooltip mensaje="Crea un nuevo documento oficial para respaldar acuerdos con alumnos o tutores.">
          <button onClick={() => abrirFormulario()} className="pill-btn" style={{ backgroundColor: 'var(--accent-yellow)', color: '#000' }}>➕ Registrar Incidencia</button>
        </TutorialTooltip>
      </div>

      {focosRojos.length > 0 && (
        <div style={{ backgroundColor: 'rgba(255, 77, 79, 0.05)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255, 77, 79, 0.2)', marginBottom: '2rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent-red)' }}>🚨 Alumnos Reincidentes (Múltiples Reportes)</h4>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {focosRojos.map(([id, data]) => (
              <div key={id} style={{ backgroundColor: 'var(--bg-app)', padding: '0.8rem 1.2rem', borderRadius: '8px', borderLeft: '4px solid var(--accent-red)' }}>
                <span style={{ fontWeight: 'bold', display: 'block' }}>{data.nombre}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{data.total} incidencias documentadas</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {incidencias.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>El grupo mantiene un comportamiento ejemplar. No hay incidencias.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {incidencias.map(inc => (
            <div key={inc.id} className="activity-card" style={{ flexDirection: 'column', alignItems: 'flex-start', backgroundColor: 'var(--bg-input)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '5px', fontSize: '0.75rem', fontFamily: 'monospace' }}>Folio: {inc.folio}</span>
                    <span style={{ color: 'var(--accent-yellow)', fontSize: '0.85rem', fontWeight: 'bold' }}>{formatearFecha(inc.fecha)}</span>
                  </div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>{inc.nombreAlumno}</h4>
                  <span style={{ color: 'var(--text-main)', fontSize: '0.85rem', backgroundColor: 'var(--bg-panel)', padding: '0.3rem 0.8rem', borderRadius: '50px', border: '1px solid var(--border-color)' }}>{inc.tipo}</span>
                </div>
                
                <TutorialTooltip mensaje="Descarga el acta lista para imprimir y solicitar la firma de Trabajo Social o Padres de familia." posicion="left">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Descargar:</span>
                    <button onClick={() => exportarBitacoraWord(inc)} className="pill-btn" style={{ backgroundColor: '#185ABD', color: 'white', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '8px' }} title="Descargar en Word">📄 .doc</button>
                    <button onClick={() => exportarBitacoraPDF(inc)} className="pill-btn" style={{ backgroundColor: '#E53935', color: 'white', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '8px' }} title="Descargar en PDF">📕 .pdf</button>
                  </div>
                </TutorialTooltip>
              </div>

              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', width: '100%' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>"{inc.descripcion}"</p>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}