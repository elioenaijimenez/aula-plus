import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDoc, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import CalificarEvidencia from './CalificarEvidencia';
import TutorialTooltip from './TutorialTooltip';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Evidencia { id: string; titulo: string; descripcion: string; puntajeMinimo: number; puntajeMaximo: number; fechaActividad: string; trimestre: string; numero?: number; createdAt?: any; calificaciones?: Record<string, number>; }
interface Alumno { id: string; fullName: string; studentNumber: number; }

export default function TabEvidencias({ idGrupo }: { idGrupo: string }) {
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [vista, setVista] = useState<'lista' | 'formulario' | 'calificar'>('lista');
  const [evidenciaActiva, setEvidenciaActiva] = useState<Evidencia | null>(null);
  
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [puntajeMin, setPuntajeMin] = useState(5);
  const [puntajeMax, setPuntajeMax] = useState(10);
  const [trimestre, setTrimestre] = useState('1'); 
  
  const [modalWord, setModalWord] = useState(false);
  const [tipoExport, setTipoExport] = useState('todo');
  const [seleccionManual, setSeleccionManual] = useState<string[]>([]);
  
  const [modalListaCotejo, setModalListaCotejo] = useState(false);
  const [excelTrimestre, setExcelTrimestre] = useState('1');
  const [excelActividades, setExcelActividades] = useState<string[]>([]);

  const [modalConcentrado, setModalConcentrado] = useState(false);
  const [trimestreConcentrado, setTrimestreConcentrado] = useState('1');
  const [exportandoConcentrado, setExportandoConcentrado] = useState(false);

  const [datosGrupo, setDatosGrupo] = useState<any>(null);
  
  const obtenerFechaLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().split('T')[0]; };
  const [fechaActividad, setFechaActividad] = useState(obtenerFechaLocal());
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'groups', idGrupo)).then(snap => { if(snap.exists()) setDatosGrupo(snap.data()); });
    
    const fetchAlumnos = async () => {
      const qAlumnos = query(collection(db, `groups/${idGrupo}/students`), orderBy('studentNumber', 'asc'));
      const snapA = await getDocs(qAlumnos);
      const listaA: Alumno[] = [];
      snapA.forEach(d => listaA.push({ id: d.id, ...d.data() } as Alumno));
      setAlumnos(listaA);
    };
    fetchAlumnos();

    const q = query(collection(db, `groups/${idGrupo}/evidences`));
    const desuscribir = onSnapshot(q, (snapshot) => {
      const lista: Evidencia[] = [];
      snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() } as Evidencia));
      
      lista.sort((a, b) => {
        const comp = a.fechaActividad.localeCompare(b.fechaActividad);
        if (comp === 0) {
           const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
           const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
           return timeA - timeB;
        }
        return comp;
      });
      const listaNumerada = lista.map((ev, index) => ({ ...ev, numero: index + 1, trimestre: ev.trimestre || '1' }));
      setEvidencias(listaNumerada);
    });
    return () => desuscribir();
  }, [idGrupo]);

  const abrirFormulario = (ev?: Evidencia) => {
    if (ev) {
      setEditandoId(ev.id); setTitulo(ev.titulo); setDescripcion(ev.descripcion);
      setPuntajeMin(ev.puntajeMinimo || 5); setPuntajeMax(ev.puntajeMaximo || 10);
      setFechaActividad(ev.fechaActividad || obtenerFechaLocal()); setTrimestre(ev.trimestre || '1');
    } else {
      setEditandoId(null); setTitulo(''); setDescripcion(''); setPuntajeMin(5); setPuntajeMax(10);
      setFechaActividad(obtenerFechaLocal()); setTrimestre('1');
    }
    setVista('formulario');
  };

  const guardarEvidencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Math.abs(new Date(fechaActividad).getFullYear() - new Date().getFullYear()) > 1) { alert(`Revisa la fecha.`); return; }
    if (Number(puntajeMin) >= Number(puntajeMax)) { alert("El máximo debe ser mayor al mínimo."); return; }
    setGuardando(true);
    const datosEvidencia = { titulo, descripcion, puntajeMinimo: Number(puntajeMin), puntajeMaximo: Number(puntajeMax), fechaActividad, trimestre };
    
    try {
      if (editandoId) { await updateDoc(doc(db, `groups/${idGrupo}/evidences`, editandoId), datosEvidencia); } 
      else { await addDoc(collection(db, `groups/${idGrupo}/evidences`), { ...datosEvidencia, createdAt: serverTimestamp(), calificaciones: {} }); }
      setVista('lista');
    } catch (error) { alert("Error al guardar."); }
    setGuardando(false);
  };

  const eliminarEvidencia = async (id: string, nombre: string) => {
    if(window.confirm(`⚠️ ¿Eliminar permanentemente "${nombre}"?`)) await deleteDoc(doc(db, `groups/${idGrupo}/evidences`, id));
  };

  const toggleSeleccionWord = (id: string) => {
    if(seleccionManual.includes(id)) setSeleccionManual(seleccionManual.filter(i => i !== id));
    else setSeleccionManual([...seleccionManual, id]);
  };

  const toggleSeleccionListaCotejo = (id: string) => {
    if(excelActividades.includes(id)) setExcelActividades(excelActividades.filter(i => i !== id));
    else setExcelActividades([...excelActividades, id]);
  };

  /* ------------------- EXPORTAR LISTA DE ACTIVIDADES ------------------- */
  const obtenerActividadesAExportar = () => {
    let actExportar = [];
    if (tipoExport === 'todo') actExportar = evidencias;
    else if (['1','2','3'].includes(tipoExport)) actExportar = evidencias.filter(e => e.trimestre === tipoExport);
    else actExportar = evidencias.filter(e => seleccionManual.includes(e.id));
    return actExportar;
  };

  const exportarWord = () => {
    const actExportar = obtenerActividadesAExportar();
    if(actExportar.length === 0) { alert("No hay actividades en esta selección."); return; }

    const sessionLocal = localStorage.getItem('aulaPlusSession');
    const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
    const pLocal = localStorage.getItem('aulaPlusPerfil');
    const perfilData = pLocal ? JSON.parse(pLocal) : null;

    const nombreDocente = sessionData?.user?.nombre || perfilData?.nombre || 'Docente';
    const escuela = perfilData?.escuela || 'Escuela no registrada';
    const ubicacion = perfilData?.ubicacion || 'Ubicación no registrada';
    const enfasisTxt = datosGrupo?.emphasis ? `<br/><b>Énfasis:</b> ${datosGrupo.emphasis}` : '';

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Actividades</title>
        <style>@page { margin: 1.5cm 1.5cm 1.5cm 1.5cm; }</style>
      </head>
      <body style="font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.3; color: #000;">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 16pt; font-weight: bold; color: #1C51FF;">${escuela}</div>
          <div style="font-size: 12pt; font-weight: bold; margin-top: 5px;">Profesor(a): ${nombreDocente}</div>
          <div style="font-size: 10pt; color: #555; margin-top: 3px;">${ubicacion}</div>
          <hr style="border: 1px solid #ccc; margin-top: 10px;" />
        </div>
        <div style="margin-bottom: 15px;">
          <div style="margin-bottom: 4px;"><b>Ciclo Escolar:</b> ${datosGrupo?.schoolYear || '2026-2027'}</div>
          <div style="margin-bottom: 4px;"><b>Grado y Grupo:</b> ${datosGrupo?.name} &nbsp;&nbsp;&nbsp; <b>Disciplina:</b> ${datosGrupo?.subject} ${enfasisTxt}</div>
        </div>
        <table border="1" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 10pt;">
          <tr style="background-color: #e2e8f0;">
            <th style="padding: 6px; text-align: center; width: 5%;">No.</th>
            <th style="padding: 6px; width: 25%;">Título de Actividad</th>
            <th style="padding: 6px; width: 45%;">Descripción</th>
            <th style="padding: 6px; text-align: center; width: 10%;">Trim.</th>
            <th style="padding: 6px; text-align: center; width: 15%;">Fecha de Aplicación</th>
          </tr>
          ${actExportar.map(a => `
            <tr>
              <td style="padding: 6px; text-align: center;">${a.numero}</td>
              <td style="padding: 6px;"><b>${a.titulo}</b></td>
              <td style="padding: 6px;">${a.descripcion}</td>
              <td style="padding: 6px; text-align: center;">${a.trimestre}</td>
              <td style="padding: 6px; text-align: center;">${a.fechaActividad}</td>
            </tr>
          `).join('')}
        </table>
      </body></html>
    `;

    const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/msword;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Actividades_${datosGrupo?.name}.doc`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setModalWord(false); setSeleccionManual([]);
  };

  const exportarPDF = () => {
    const actExportar = obtenerActividadesAExportar();
    if(actExportar.length === 0) { alert("No hay actividades en esta selección."); return; }

    const sessionLocal = localStorage.getItem('aulaPlusSession');
    const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
    const pLocal = localStorage.getItem('aulaPlusPerfil');
    const perfilData = pLocal ? JSON.parse(pLocal) : null;

    const nombreDocente = sessionData?.user?.nombre || perfilData?.nombre || 'Docente';
    const escuela = perfilData?.escuela || 'Escuela no registrada';
    const ubicacion = perfilData?.ubicacion || 'Ubicación no registrada';
    const enfasisTxt = datosGrupo?.emphasis ? ` - Énfasis: ${datosGrupo.emphasis}` : '';

    const docRef = new jsPDF();
    let posY = 15;

    // Membrete
    docRef.setFontSize(16);
    docRef.setTextColor(28, 81, 255);
    docRef.text(escuela, 105, posY, { align: 'center' });
    posY += 6;
    docRef.setFontSize(12);
    docRef.setTextColor(50, 50, 50);
    docRef.text(`Profesor(a): ${nombreDocente}`, 105, posY, { align: 'center' });
    posY += 5;
    docRef.setFontSize(10);
    docRef.text(ubicacion, 105, posY, { align: 'center' });
    posY += 5;
    docRef.setDrawColor(200, 200, 200);
    docRef.line(14, posY, 196, posY);
    posY += 8;

    // Datos del Grupo
    docRef.setFontSize(11);
    docRef.setTextColor(0, 0, 0);
    docRef.text(`Ciclo Escolar: ${datosGrupo?.schoolYear || '2026-2027'}`, 14, posY);
    posY += 6;
    docRef.text(`Grado y Grupo: ${datosGrupo?.name}   |   Disciplina: ${datosGrupo?.subject}${enfasisTxt}`, 14, posY);
    posY += 8;

    // Tabla de Actividades
    const bodyData = actExportar.map(a => [
      a.numero, a.titulo, a.descripcion, a.trimestre, a.fechaActividad
    ]);

    autoTable(docRef, {
      startY: posY,
      head: [['No.', 'Título de Actividad', 'Descripción', 'Trim.', 'Fecha']],
      body: bodyData,
      theme: 'grid',
      headStyles: { fillColor: [226, 232, 240], textColor: [51, 51, 51] },
      columnStyles: { 
        0: { halign: 'center', cellWidth: 10 }, 
        1: { cellWidth: 40 },
        3: { halign: 'center', cellWidth: 15 }, 
        4: { halign: 'center', cellWidth: 25 } 
      }
    });

    docRef.save(`Actividades_${datosGrupo?.name}.pdf`);
    setModalWord(false); setSeleccionManual([]);
  };

  /* ------------------- EXPORTAR LISTA DE COTEJO ------------------- */
  const exportarListaCotejo = () => {
    if(excelActividades.length === 0) { alert("Selecciona al menos una actividad para evaluar."); return; }

    const sessionLocal = localStorage.getItem('aulaPlusSession');
    const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
    const pLocal = localStorage.getItem('aulaPlusPerfil');
    const perfilData = pLocal ? JSON.parse(pLocal) : null;

    const nombreDocente = sessionData?.user?.nombre || perfilData?.nombre || 'Docente';
    const escuela = perfilData?.escuela || 'Escuela no registrada';
    const enfasisTxt = datosGrupo?.emphasis ? `&nbsp;&nbsp;|&nbsp;&nbsp; <b>Énfasis:</b> ${datosGrupo.emphasis}` : '';

    const actividadesSeleccionadas = evidencias.filter(e => excelActividades.includes(e.id));
    const columnasActividades = actividadesSeleccionadas.map(a => `<th style="padding: 6px; text-align: center; border: 1px solid black; background-color: #e2e8f0; width: 90px; font-size: 8pt;">A${a.numero}<br/>${a.titulo}</th>`).join('');

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Lista de Cotejo</title>
        <style>
          @page WordSection1 { size: 27.94cm 21.59cm; margin: 1.5cm; mso-page-orientation: landscape; }
          div.WordSection1 { page: WordSection1; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid black; padding: 6px; }
        </style>
      </head>
      <body style="font-family: Arial, sans-serif; font-size: 10pt; color: #000;">
        <div class="WordSection1">
          <div style="text-align: center; margin-bottom: 10px;">
            <div style="font-size: 14pt; font-weight: bold; color: #1C51FF;">${escuela}</div>
            <div style="font-size: 12pt; font-weight: bold; margin-top: 5px;">Lista de Cotejo - Trimestre ${excelTrimestre}</div>
          </div>
          
          <div style="margin-bottom: 15px; font-size: 10pt;">
            <b>Docente:</b> ${nombreDocente} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Grupo:</b> ${datosGrupo?.name} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Disciplina:</b> ${datosGrupo?.subject} ${enfasisTxt}
          </div>
          
          <table>
            <tr style="background-color: #e2e8f0;">
              <th style="width: 30px; text-align: center;">No.</th>
              <th style="width: 250px;">Nombre del Estudiante</th>
              ${columnasActividades}
              <th style="width: 60px; text-align: center; background-color: #e2e8f0;">Total</th>
            </tr>
            ${alumnos.map(al => `
              <tr>
                <td style="text-align: center;">${al.studentNumber}</td>
                <td>${al.fullName}</td>
                ${actividadesSeleccionadas.map(() => `<td></td>`).join('')}
                <td></td>
              </tr>
            `).join('')}
          </table>
        </div>
      </body></html>
    `;

    const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/msword;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `ListaCotejo_${datosGrupo?.name}_T${excelTrimestre}.doc`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setModalListaCotejo(false); setExcelActividades([]);
  };

  const exportarListaCotejoPDF = () => {
    if(excelActividades.length === 0) { alert("Selecciona al menos una actividad para evaluar."); return; }

    const sessionLocal = localStorage.getItem('aulaPlusSession');
    const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
    const pLocal = localStorage.getItem('aulaPlusPerfil');
    const perfilData = pLocal ? JSON.parse(pLocal) : null;

    const nombreDocente = sessionData?.user?.nombre || perfilData?.nombre || 'Docente';
    const escuela = perfilData?.escuela || 'Escuela no registrada';
    const enfasisTxt = datosGrupo?.emphasis ? ` - Énfasis: ${datosGrupo.emphasis}` : '';

    // Documento en formato Horizontal (Landscape)
    const docRef = new jsPDF('l', 'mm', 'a4'); 
    let posY = 15;

    docRef.setFontSize(14);
    docRef.setTextColor(28, 81, 255);
    docRef.text(escuela, 148.5, posY, { align: 'center' }); // 148.5 es el centro en A4 Landscape
    posY += 6;
    docRef.setFontSize(12);
    docRef.setTextColor(0, 0, 0);
    docRef.text(`Lista de Cotejo - Trimestre ${excelTrimestre}`, 148.5, posY, { align: 'center' });
    posY += 10;
    
    docRef.setFontSize(10);
    docRef.text(`Docente: ${nombreDocente}   |   Grupo: ${datosGrupo?.name}   |   Disciplina: ${datosGrupo?.subject}${enfasisTxt}`, 14, posY);
    posY += 8;

    const actividadesSeleccionadas = evidencias.filter(e => excelActividades.includes(e.id));
    const headRows = ['No.', 'Nombre del Estudiante', ...actividadesSeleccionadas.map(a => `A${a.numero}\n${a.titulo.substring(0,10)}...`), 'Total'];
    
    const bodyData = alumnos.map(al => [
      al.studentNumber,
      al.fullName,
      ...actividadesSeleccionadas.map(() => ''),
      ''
    ]);

    autoTable(docRef, {
      startY: posY,
      head: [headRows],
      body: bodyData,
      theme: 'grid',
      headStyles: { fillColor: [226, 232, 240], textColor: [51, 51, 51], halign: 'center', fontSize: 8 },
      styles: { fontSize: 8 },
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 1: { cellWidth: 60 } }
    });

    docRef.save(`ListaCotejo_${datosGrupo?.name}_T${excelTrimestre}.pdf`);
    setModalListaCotejo(false); setExcelActividades([]);
  };

  /* ------------------- EXPORTAR CONCENTRADO EXCEL ------------------- */
  const exportarConcentradoExcel = () => {
    setExportandoConcentrado(true);
    try {
      const sessionLocal = localStorage.getItem('aulaPlusSession');
      const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
      const pLocal = localStorage.getItem('aulaPlusPerfil');
      const perfilData = pLocal ? JSON.parse(pLocal) : null;

      const nombreDocente = sessionData?.user?.nombre || perfilData?.nombre || 'Docente';
      const escuela = perfilData?.escuela || 'Escuela no registrada';

      const evsTrimestre = evidencias.filter(e => e.trimestre === trimestreConcentrado);

      if (evsTrimestre.length === 0) {
        alert("No hay actividades registradas en este trimestre.");
        setExportandoConcentrado(false);
        return;
      }

      const headers = ['No.', 'Nombre Completo'];
      evsTrimestre.forEach(ev => headers.push(`${ev.titulo} (${ev.puntajeMaximo}pts)`));
      headers.push('Promedio (Base 10)');

      const rows = alumnos.map(al => {
        const rowData: any[] = [al.studentNumber, al.fullName];
        let sumaPromedios = 0;
        let actividadesEvaluadas = 0;

        evsTrimestre.forEach(ev => {
          const calsObj = ev.calificaciones || {};
          const calEstudiante = calsObj[al.id] !== undefined ? calsObj[al.id] : ev.puntajeMinimo;
          
          rowData.push(calEstudiante);
          sumaPromedios += (calEstudiante / ev.puntajeMaximo) * 10;
          actividadesEvaluadas++;
        });

        const promedioFinal = actividadesEvaluadas > 0 ? (sumaPromedios / actividadesEvaluadas).toFixed(1) : '0.0';
        rowData.push(Number(promedioFinal));

        return rowData;
      });

      const worksheetData = [[escuela], [`Docente: ${nombreDocente}`, `Grupo: ${datosGrupo?.name}`, `Disciplina: ${datosGrupo?.subject}`, `Trimestre: ${trimestreConcentrado}`], [], headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
      worksheet['!cols'] = [{ wch: 5 }, { wch: 38 }, ...evsTrimestre.map(() => ({ wch: 22 })), { wch: 18 }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Trimestre ${trimestreConcentrado}`);
      XLSX.writeFile(workbook, `Concentrado_T${trimestreConcentrado}_${datosGrupo?.name}.xlsx`);
      setModalConcentrado(false);
    } catch (error) {
      alert("Hubo un error al generar el archivo Excel.");
    }
    setExportandoConcentrado(false);
  };

  if (vista === 'calificar' && evidenciaActiva) return <CalificarEvidencia idGrupo={idGrupo} evidencia={evidenciaActiva} onVolver={() => setVista('lista')} />;
  
  if (vista === 'formulario') {
    return (
      <div style={{ animation: 'fadeIn 0.3s' }}>
        <button onClick={() => setVista('lista')} className="pill-btn" style={{ marginBottom: '1rem', background: 'transparent', color: 'var(--text-muted)' }}>← Volver</button>
        <form onSubmit={guardarEvidencia} style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3>{editandoId ? 'Editar Actividad' : 'Nueva Actividad'}</h3>
          <div><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Título</label><input type="text" className="search-input" required value={titulo} onChange={e => setTitulo(e.target.value)} /></div>
          <div><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Descripción</label><input type="text" className="search-input" value={descripcion} onChange={e => setDescripcion(e.target.value)} /></div>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Fecha</label><input type="date" className="search-input" required value={fechaActividad} onChange={e => setFechaActividad(e.target.value)} /></div>
            <div style={{ flex: 1, minWidth: '150px' }}><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Trimestre</label><select className="search-input" value={trimestre} onChange={e => setTrimestre(e.target.value)}><option value="1">Trimestre 1</option><option value="2">Trimestre 2</option><option value="3">Trimestre 3</option></select></div>
          </div>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Cal. Mínima</label><input type="number" className="search-input" required value={puntajeMin} onChange={e => setPuntajeMin(Number(e.target.value))} min="0" style={{ width: '120px' }} /></div>
            <div><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Cal. Máxima</label><input type="number" className="search-input" required value={puntajeMax} onChange={e => setPuntajeMax(Number(e.target.value))} min="1" style={{ width: '120px', borderColor: 'var(--accent-yellow)' }} /></div>
          </div>
          <button type="submit" disabled={guardando} className="pill-btn" style={{ background: 'var(--accent-blue)', color: 'white', alignSelf: 'flex-start', marginTop: '1rem' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        </form>
      </div>
    );
  }

  const trimestres = ['1', '2', '3'];
  const evidenciasParaExcel = evidencias.filter(e => e.trimestre === excelTrimestre);

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h4 style={{ margin: 0 }}>Registro de Actividades</h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total del ciclo: {evidencias.length}</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          
          <TutorialTooltip mensaje="Genera un archivo Excel real (.xlsx) con los promedios calculados base 10.">
            <button onClick={() => setModalConcentrado(true)} className="pill-btn" style={{ background: 'var(--accent-yellow)', color: '#000', border: '1px solid var(--border-color)' }}>📊 Concentrado Excel</button>
          </TutorialTooltip>

          <TutorialTooltip mensaje="Exporta una tabla para imprimir y calificar a mano en clase.">
            <button onClick={() => setModalListaCotejo(true)} className="pill-btn" style={{ background: 'var(--accent-green)', color: '#000', border: '1px solid var(--border-color)' }}>📋 Imprimir Lista de Cotejo</button>
          </TutorialTooltip>

          <TutorialTooltip mensaje="Obtén el registro oficial en Word de todas las actividades.">
            <button onClick={() => setModalWord(true)} className="pill-btn" style={{ background: 'var(--bg-input)', color: 'white', border: '1px solid var(--border-color)' }}>📄 Exportar Actividades</button>
          </TutorialTooltip>

          <TutorialTooltip mensaje="Añade un nuevo criterio de evaluación o tarea para tu grupo.">
            <button onClick={() => abrirFormulario()} className="pill-btn" style={{ background: 'var(--accent-blue)', color: 'white' }}>+ Nueva Evidencia</button>
          </TutorialTooltip>

        </div>
      </div>

      {evidencias.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '24px' }}>No tienes evidencias registradas.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {trimestres.map(t => {
            const evsTrimestre = evidencias.filter(e => e.trimestre === t);
            if (evsTrimestre.length === 0) return null; 
            return (
              <details key={t} className="vark-accordion" open>
                <summary style={{ borderLeft: `4px solid ${t === '1' ? 'var(--accent-green)' : t === '2' ? 'var(--accent-blue)' : 'var(--accent-darkred)'}`, fontSize: '1.1rem' }}>
                  <span>Trimestre {t}</span><span style={{fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'normal'}}>{evsTrimestre.length} act.</span>
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem 1rem' }}>
                  {evsTrimestre.map(ev => (
                    <div key={ev.id} className="activity-card" style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: 'var(--bg-input)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1, minWidth: '250px' }}>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'var(--text-main)', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>#{ev.numero}</div>
                        <div>
                          <h4 style={{ margin: '0 0 0.3rem 0', color: 'var(--accent-blue)' }}>{ev.titulo}</h4>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>{ev.descripcion}</p>
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', backgroundColor: 'var(--bg-panel)', padding: '0.2rem 0.5rem', borderRadius: '5px', border: '1px solid var(--border-color)' }}>📅 {ev.fechaActividad}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--accent-yellow)', backgroundColor: 'rgba(223, 255, 0, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '5px' }}>Rango: {ev.puntajeMinimo} a {ev.puntajeMaximo}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginTop: '1rem' }}>
                        <button onClick={() => { setEvidenciaActiva(ev); setVista('calificar'); }} className="pill-btn" style={{ background: 'var(--accent-blue)', color: 'white' }}>Calificar 📝</button>
                        <button onClick={() => abrirFormulario(ev)} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>✏️</button>
                        <button onClick={() => eliminarEvidencia(ev.id, ev.titulo)} style={{ background: 'rgba(255, 77, 79, 0.1)', border: '1px solid rgba(255, 77, 79, 0.3)', color: 'var(--accent-red)' }}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}

      {/* MODALES EXPORTACIÓN */}
      {modalWord && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.4rem' }}>Exportar Actividades</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Selecciona qué actividades quieres incluir en el documento oficial.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', margin: '1.5rem 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}><input type="radio" name="exp" checked={tipoExport==='todo'} onChange={()=>setTipoExport('todo')} /> Todo el ciclo escolar</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}><input type="radio" name="exp" checked={tipoExport==='1'} onChange={()=>setTipoExport('1')} /> Solo Trimestre 1</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}><input type="radio" name="exp" checked={tipoExport==='2'} onChange={()=>setTipoExport('2')} /> Solo Trimestre 2</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}><input type="radio" name="exp" checked={tipoExport==='3'} onChange={()=>setTipoExport('3')} /> Solo Trimestre 3</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}><input type="radio" name="exp" checked={tipoExport==='manual'} onChange={()=>setTipoExport('manual')} /> Seleccionar manualmente</label>
            </div>
            
            {tipoExport === 'manual' && (
              <div style={{ backgroundColor: 'var(--bg-input)', padding: '1rem', borderRadius: '12px', maxHeight: '150px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                {evidencias.map(e => (
                  <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={seleccionManual.includes(e.id)} onChange={() => toggleSeleccionWord(e.id)} /> #{e.numero} {e.titulo}
                  </label>
                ))}
              </div>
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Descargar:</span>
              <button onClick={exportarWord} className="pill-btn" style={{ flex: 1, backgroundColor: '#185ABD', color: 'white', padding: '0.6rem' }} title="Descargar en Word">📄 .doc</button>
              <button onClick={exportarPDF} className="pill-btn" style={{ flex: 1, backgroundColor: '#E53935', color: 'white', padding: '0.6rem' }} title="Descargar en PDF">📕 .pdf</button>
              <button onClick={() => {setModalWord(false); setSeleccionManual([]);}} className="pill-btn" style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '0.6rem' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {modalListaCotejo && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.4rem', color: 'var(--accent-green)' }}>📋 Generar Lista de Cotejo</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Crea un documento (Horizontal) con los alumnos y las actividades seleccionadas para evaluar en clase.</p>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>1. Selecciona el Trimestre</label>
              <select className="search-input" value={excelTrimestre} onChange={e => { setExcelTrimestre(e.target.value); setExcelActividades([]); }} style={{ cursor: 'pointer' }}>
                <option value="1">Trimestre 1</option>
                <option value="2">Trimestre 2</option>
                <option value="3">Trimestre 3</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>2. Selecciona las Actividades a Evaluar</label>
              {evidenciasParaExcel.length === 0 ? (
                <p style={{ color: 'var(--accent-red)', fontSize: '0.85rem' }}>No hay actividades registradas en este trimestre.</p>
              ) : (
                <div style={{ backgroundColor: 'var(--bg-input)', padding: '1rem', borderRadius: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                  {evidenciasParaExcel.map(e => (
                    <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.8rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={excelActividades.includes(e.id)} onChange={() => toggleSeleccionListaCotejo(e.id)} /> 
                      <span style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>#{e.numero}</span> {e.titulo}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Descargar:</span>
              <button onClick={exportarListaCotejo} disabled={excelActividades.length === 0} className="pill-btn" style={{ flex: 1, backgroundColor: '#185ABD', color: 'white', padding: '0.6rem' }} title="Descargar en Word">📄 .doc</button>
              <button onClick={exportarListaCotejoPDF} disabled={excelActividades.length === 0} className="pill-btn" style={{ flex: 1, backgroundColor: '#E53935', color: 'white', padding: '0.6rem' }} title="Descargar en PDF">📕 .pdf</button>
              <button onClick={() => {setModalListaCotejo(false); setExcelActividades([]);}} className="pill-btn" style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '0.6rem' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {modalConcentrado && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.4rem', color: 'var(--accent-yellow)' }}>📊 Concentrado Excel Trimestral</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Exporta todas las calificaciones del trimestre en un archivo .xlsx nativo, incluyendo el promedio final en base 10.</p>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Selecciona el Trimestre a Exportar</label>
              <select className="search-input" value={trimestreConcentrado} onChange={e => setTrimestreConcentrado(e.target.value)} style={{ cursor: 'pointer' }}>
                <option value="1">Trimestre 1</option>
                <option value="2">Trimestre 2</option>
                <option value="3">Trimestre 3</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={exportarConcentradoExcel} disabled={exportandoConcentrado} className="pill-btn" style={{ flex: 1, backgroundColor: 'var(--accent-yellow)', color: '#000' }}>
                {exportandoConcentrado ? 'Generando...' : 'Descargar Excel'}
              </button>
              <button onClick={() => setModalConcentrado(false)} className="pill-btn" style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}