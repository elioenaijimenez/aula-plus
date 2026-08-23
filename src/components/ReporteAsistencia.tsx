import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, doc, updateDoc, getDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Alumno { 
  id: string; 
  fullName: string; 
  studentNumber: number; 
  lastCitationDate?: string;
  lastCitationFaults?: number;
  lastCitationRetardos?: number;
}
interface DiaAsistencia { fecha: string; records: Record<string, 'P'|'R'|'F'|'J'>; }
interface RegistroDiario { fecha: string; estado: string; tipo: 'P'|'R'|'F'|'J'; }
interface StatsAlumno { 
  id: string; 
  fullName: string; 
  p: number; r: number; f: number; j: number; 
  total: number; 
  porcentaje: number; 
  registroCompleto: RegistroDiario[]; 
  lastCitationDate?: string;
  lastCitationFaults?: number;
  lastCitationRetardos?: number;
}

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function ReporteAsistencia({ idGrupo, grupo, onVolver }: { idGrupo: string, grupo: any, onVolver: () => void }) {

  const [alumnosBase, setAlumnosBase] = useState<Alumno[]>([]);
  const [diasRegistrados, setDiasRegistrados] = useState<DiaAsistencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modo, setModo] = useState<'grupo' | 'alumno'>('grupo');
  const [busquedaAlumno, setBusquedaAlumno] = useState('');
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<StatsAlumno | null>(null);
  const [statsGenerales, setStatsGenerales] = useState<StatsAlumno[]>([]);
  const [userEmail, setUserEmail] = useState('');
  
  const [filtroActivo, setFiltroActivo] = useState<'TODOS'|'P'|'R'|'F'|'J'>('TODOS');
  const [modalExportar, setModalExportar] = useState(false);
  const [tipoExportacion, setTipoExportacion] = useState<'historial'|'citatorio'>('historial');
  const [mesesSeleccionados, setMesesSeleccionados] = useState<string[]>([]);
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Estados para el mini calendario y gestión de días
  const [mesCalGlobal, setMesCalGlobal] = useState(new Date());
  const [modalDiaActivo, setModalDiaActivo] = useState<string | null>(null);
  const [editandoAsistencia, setEditandoAsistencia] = useState(false);
  const [asistenciaTemporal, setAsistenciaTemporal] = useState<Record<string, 'P'|'R'|'F'|'J'>>({});
  const [procesandoDia, setProcesandoDia] = useState(false);

  const obtenerFechaLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };

  const formatearFecha = (fechaISO: string) => {
    if (!fechaISO) return '';
    const partes = fechaISO.split('-');
    if(partes.length !== 3) return fechaISO;
    const [yyyy, mm, dd] = partes;
    return `${dd}-${MESES[parseInt(mm, 10) - 1].substring(0,3).toLowerCase()}-${yyyy}`;
  };

  const obtenerMesAnio = (fechaISO: string) => {
    const partes = fechaISO.split('-');
    if(partes.length !== 3) return 'Desconocido';
    return `${MESES[parseInt(partes[1], 10) - 1]} ${partes[0]}`;
  };

  useEffect(() => {
    const sessionLocal = localStorage.getItem('aulaPlusSession');
    if (sessionLocal) {
      const sessionData = JSON.parse(sessionLocal);
      setUserEmail(sessionData?.user?.email || sessionData?.email || '');
    }

    const fetchData = async () => {
      setCargando(true);
      const qAlumnos = query(collection(db, `groups/${idGrupo}/students`), orderBy('studentNumber', 'asc'));
      const snapA = await getDocs(qAlumnos);
      const listaA: Alumno[] = [];
      snapA.forEach(d => listaA.push({ id: d.id, ...d.data() } as Alumno));
      setAlumnosBase(listaA);

      const snapDias = await getDocs(collection(db, `groups/${idGrupo}/attendance`));
      const listaDias: DiaAsistencia[] = [];
      snapDias.forEach(d => listaDias.push({ fecha: d.id, records: d.data().records }));
      listaDias.sort((a, b) => a.fecha.localeCompare(b.fecha));
      setDiasRegistrados(listaDias);
      
      const stats = listaA.map(al => {
        let p = 0, r = 0, f = 0, j = 0;
        let registroCompleto: RegistroDiario[] = [];
        
        listaDias.forEach(dia => {
          const estado = dia.records[al.id] || 'F'; 
          let estadoTexto = '';
          if (estado === 'P') { p++; estadoTexto = 'Presente'; }
          if (estado === 'R') { r++; estadoTexto = 'Retardo'; }
          if (estado === 'F') { f++; estadoTexto = 'Falta'; }
          if (estado === 'J') { j++; estadoTexto = 'Justificado'; }
          
          registroCompleto.push({ fecha: dia.fecha, estado: estadoTexto, tipo: estado as 'P'|'R'|'F'|'J' });
        });

        registroCompleto.sort((a,b) => b.fecha.localeCompare(a.fecha));
        const totalClases = listaDias.length;
        const asistenciasReales = totalClases - f; 
        const porcentaje = totalClases > 0 ? (asistenciasReales / totalClases) * 100 : 100;

        return { 
          id: al.id, fullName: al.fullName, p, r, f, j, total: totalClases, porcentaje, registroCompleto,
          lastCitationDate: al.lastCitationDate, lastCitationFaults: al.lastCitationFaults, lastCitationRetardos: al.lastCitationRetardos
        };
      });

      setStatsGenerales(stats);
      setCargando(false);
    };
    fetchData();
  }, [idGrupo, refreshTrigger]);

  const manejarBusqueda = (val: string) => {
    setBusquedaAlumno(val);
    const encontrado = statsGenerales.find(a => a.fullName.toLowerCase() === val.toLowerCase());
    setAlumnoSeleccionado(encontrado || null);
    setFiltroActivo('TODOS');
  };

  const alternarFiltro = (tipo: 'P'|'R'|'F'|'J') => setFiltroActivo(prev => prev === tipo ? 'TODOS' : tipo);

  const abrirModalExportar = (alumno: StatsAlumno) => {
    const mesesUnicos = Array.from(new Set(alumno.registroCompleto.map(r => obtenerMesAnio(r.fecha))));
    setMesesSeleccionados(mesesUnicos);
    setTipoExportacion(alumno.f >= 3 ? 'citatorio' : 'historial');
    setModalExportar(true);
  };

  const toggleMes = (mes: string) => setMesesSeleccionados(prev => prev.includes(mes) ? prev.filter(m => m !== mes) : [...prev, mes]);

  const obtenerPerfilNube = async () => {
    if (!userEmail) return { nombre: 'Docente', escuela: 'Escuela no registrada', ubicacion: 'Ubicación no registrada' };
    try {
      const docRef = doc(db, 'teacher_settings', userEmail);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().memoriaEscolar) {
        return docSnap.data().memoriaEscolar;
      }
    } catch (error) { console.error("Error al obtener perfil", error); }
    return { nombre: 'Docente', escuela: 'Escuela no registrada', ubicacion: 'Ubicación no registrada' };
  };

  const generarDocumentoWord = async () => {
    if (!alumnoSeleccionado) return;
    if (mesesSeleccionados.length === 0) { alert("Selecciona al menos un mes para exportar."); return; }

    const perfilNube = await obtenerPerfilNube();
    const nombreDocente = perfilNube.nombre || 'Docente';
    const escuela = perfilNube.escuela || 'Escuela no registrada';
    const ubicacion = perfilNube.ubicacion || 'Ubicación no registrada';
    const enfasisTxt = grupo.emphasis ? `<br/><b>Énfasis:</b> ${grupo.emphasis}` : '';

    let registrosAExportar = alumnoSeleccionado.registroCompleto.filter(r => mesesSeleccionados.includes(obtenerMesAnio(r.fecha)));
    if (tipoExportacion === 'citatorio') registrosAExportar = registrosAExportar.filter(r => r.tipo === 'F' || r.tipo === 'R');

    const filasFechasHTML = registrosAExportar.length > 0 
      ? registrosAExportar.map(dia => {
          let color = '#333';
          if(dia.tipo==='F') color = '#b20000';
          if(dia.tipo==='R') color = '#b28000';
          if(dia.tipo==='P') color = '#1e7b34';
          if(dia.tipo==='J') color = '#1C51FF';
          return `<tr><td style="padding: 8px; border: 1px solid #ccc;">${formatearFecha(dia.fecha)}</td><td style="padding: 8px; border: 1px solid #ccc; color: ${color}"><b>${dia.estado}</b></td></tr>`
        }).join('')
      : `<tr><td colspan="2" style="padding: 8px; text-align: center; border: 1px solid #ccc;">No hay registros.</td></tr>`;

    let contenidoEspecifico = tipoExportacion === 'citatorio' 
      ? `<h3 style="color: #b20000;">Citatorio por Inasistencias y Retardos</h3><p style="text-align: justify; font-size: 14px;">Estimado Padre de Familia... la asistencia regular a clases es determinante para el éxito académico.</p><div style="background-color: #e6f0ff; padding: 15px; border-left: 5px solid #1C51FF;"><b>CARTA DE COMPROMISO:</b><br>Al firmar este documento, estoy enterado...</div>`
      : `<h3 style="color: #1C51FF;">Historial General de Asistencia</h3><p style="text-align: justify; font-size: 14px;">Se expide el presente documento para informar sobre el registro detallado de asistencia...</p>`;

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Reporte de Asistencia</title></head>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px;"><h2 style="color: #1C51FF;">${escuela}</h2><h3>Profesor(a): ${nombreDocente}</h3><p style="color: #555;">${ubicacion}</p><hr/></div>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;"><p><b>Alumno(a):</b> ${alumnoSeleccionado.fullName}</p><p><b>Grupo:</b> ${grupo.name} <b>Disciplina:</b> ${grupo.subject} ${enfasisTxt}</p><p><b>Porcentaje:</b> ${alumnoSeleccionado.porcentaje.toFixed(1)}%</p></div>
        <table style="width: 100%; text-align: center; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="border: 1px solid #ccc; background-color: #e6ffe6;"><b>Presente</b><br><span style="color: #1e7b34; font-size: 18px;">${alumnoSeleccionado.p}</span></td><td style="border: 1px solid #ccc; background-color: #ffffe6;"><b>Retardos</b><br><span style="color: #b28000; font-size: 18px;">${alumnoSeleccionado.r}</span></td><td style="border: 1px solid #ccc; background-color: #ffe6e6;"><b>Faltas</b><br><span style="color: #b20000; font-size: 18px;">${alumnoSeleccionado.f}</span></td><td style="border: 1px solid #ccc; background-color: #e6f0ff;"><b>Justif.</b><br><span style="color: #1C51FF; font-size: 18px;">${alumnoSeleccionado.j}</span></td></tr>
        </table>
        ${contenidoEspecifico}
        <h4>Desglose de Días (Meses: ${mesesSeleccionados.join(', ')})</h4>
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
          <tr style="background-color: #e2e8f0;"><th>Fecha</th><th>Estatus</th></tr>${filasFechasHTML}
        </table>
        <div style="margin-top: 50px; text-align: center;"><p>_____________________________________</p><p>Nombre y Firma de Enterado</p></div>
      </body></html>
    `;

    const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/msword;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.setAttribute('download', `ReporteAsistencia_${alumnoSeleccionado.fullName}.doc`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);

    if (tipoExportacion === 'citatorio') {
      const fechaHoy = obtenerFechaLocal();
      await updateDoc(doc(db, `groups/${idGrupo}/students`, alumnoSeleccionado.id), { lastCitationDate: fechaHoy, lastCitationFaults: alumnoSeleccionado.f, lastCitationRetardos: alumnoSeleccionado.r });
      setRefreshTrigger(prev => prev + 1);
    }
    setModalExportar(false);
  };

  const generarDocumentoPDF = async () => {
    if (!alumnoSeleccionado) return;
    if (mesesSeleccionados.length === 0) { alert("Selecciona al menos un mes para exportar."); return; }

    const perfilNube = await obtenerPerfilNube();
    const nombreDocente = perfilNube.nombre || 'Docente';
    const escuela = perfilNube.escuela || 'Escuela no registrada';
    const ubicacion = perfilNube.ubicacion || 'Ubicación no registrada';
    const enfasisTxt = grupo.emphasis ? ` - Énfasis: ${grupo.emphasis}` : '';

    let registrosAExportar = alumnoSeleccionado.registroCompleto.filter(r => mesesSeleccionados.includes(obtenerMesAnio(r.fecha)));
    if (tipoExportacion === 'citatorio') registrosAExportar = registrosAExportar.filter(r => r.tipo === 'F' || r.tipo === 'R');

    const docRef = new jsPDF();
    let posY = 15;

    docRef.setFontSize(16); docRef.setTextColor(28, 81, 255); docRef.text(escuela, 105, posY, { align: 'center' }); posY += 7;
    docRef.setFontSize(11); docRef.setTextColor(50, 50, 50); docRef.text(`Profesor(a): ${nombreDocente}`, 105, posY, { align: 'center' }); posY += 5;
    docRef.setFontSize(9); docRef.text(ubicacion, 105, posY, { align: 'center' }); posY += 4;
    docRef.setDrawColor(200, 200, 200); docRef.line(14, posY, 196, posY); posY += 8;

    docRef.setFontSize(12); docRef.setTextColor(0, 0, 0); docRef.text(`Alumno(a): ${alumnoSeleccionado.fullName}`, 14, posY); posY += 6;
    docRef.setFontSize(10); docRef.text(`Grupo: ${grupo.name}   |   Disciplina: ${grupo.subject}${enfasisTxt}`, 14, posY); posY += 6;
    docRef.text(`Porcentaje Global de Asistencia: ${alumnoSeleccionado.porcentaje.toFixed(1)}%`, 14, posY); posY += 10;

    docRef.setFontSize(14);
    if (tipoExportacion === 'citatorio') {
      docRef.setTextColor(178, 0, 0); docRef.text("Citatorio por Inasistencias y Retardos", 14, posY); posY += 8;
      docRef.setFontSize(10); docRef.setTextColor(50, 50, 50);
      docRef.text("Por medio de la presente, se hace de su conocimiento el historial de inasistencias del alumno(a).", 14, posY); posY += 5;
      docRef.text("Es indispensable comprender que la asistencia regular a clases es determinante para el éxito académico.", 14, posY);
    } else {
      docRef.setTextColor(28, 81, 255); docRef.text("Historial General de Asistencia", 14, posY); posY += 8;
      docRef.setFontSize(10); docRef.setTextColor(50, 50, 50);
      docRef.text("Se expide el presente documento para informar sobre el registro detallado de asistencia", 14, posY); posY += 5;
      docRef.text("del alumno(a) durante los meses seleccionados, reflejando su compromiso y constancia.", 14, posY);
    }
    posY += 10;

    const bodyData = registrosAExportar.map(dia => [formatearFecha(dia.fecha), dia.estado]);
    
    autoTable(docRef, {
      startY: posY, head: [['Fecha', 'Estatus']], body: bodyData, theme: 'grid',
      headStyles: { fillColor: [226, 232, 240], textColor: [51, 51, 51] },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 1) {
          if (data.cell.raw === 'Falta') data.cell.styles.textColor = [178, 0, 0];
          else if (data.cell.raw === 'Retardo') data.cell.styles.textColor = [178, 128, 0];
          else if (data.cell.raw === 'Presente') data.cell.styles.textColor = [30, 123, 52];
          else if (data.cell.raw === 'Justificado') data.cell.styles.textColor = [28, 81, 255];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    let finalY = (docRef as any).lastAutoTable.finalY + 15;
    const pageHeight = docRef.internal.pageSize.height;

    if (tipoExportacion === 'citatorio') {
      if (finalY > pageHeight - 50) { docRef.addPage(); finalY = 20; }
      docRef.setFillColor(230, 240, 255); docRef.rect(14, finalY, 182, 20, 'F');
      docRef.setDrawColor(28, 81, 255); docRef.setLineWidth(1); docRef.line(14, finalY, 14, finalY + 20);
      docRef.setFontSize(10); docRef.setTextColor(0, 0, 0); docRef.setFont("helvetica", "bold");
      docRef.text("CARTA DE COMPROMISO:", 18, finalY + 6);
      docRef.setFont("helvetica", "normal");
      docRef.text("Al firmar este documento, estoy enterado(a) de la situación actual de mi hijo(a) y me comprometo a apoyarlo(a) asegurando su asistencia puntual y regular.", 18, finalY + 12, { maxWidth: 170 });
      finalY += 30;
    }

    if (finalY > pageHeight - 40) { docRef.addPage(); finalY = 20; }
    finalY += 20; docRef.setTextColor(0, 0, 0); docRef.text("_____________________________________", 105, finalY, { align: 'center' });
    docRef.text("Nombre y Firma de Enterado (Padre / Tutor)", 105, finalY + 6, { align: 'center' });
    docRef.setFontSize(9); docRef.setTextColor(100, 100, 100); docRef.text("Fecha de firma: ____ / ____________ / ______", 105, finalY + 12, { align: 'center' });

    docRef.save(`ReporteAsistencia_${alumnoSeleccionado.fullName}.pdf`);

    if (tipoExportacion === 'citatorio') {
      const fechaHoy = obtenerFechaLocal();
      await updateDoc(doc(db, `groups/${idGrupo}/students`, alumnoSeleccionado.id), { lastCitationDate: fechaHoy, lastCitationFaults: alumnoSeleccionado.f, lastCitationRetardos: alumnoSeleccionado.r });
      setRefreshTrigger(prev => prev + 1);
    }
    setModalExportar(false);
  };

  // Lógica del mini calendario y edición
  const diasRegistradosSet = new Set(diasRegistrados.map(d => d.fecha));
  
  const abrirDiaRegistrado = (fechaStr: string) => {
    const diaData = diasRegistrados.find(d => d.fecha === fechaStr);
    if (diaData) {
      setAsistenciaTemporal(diaData.records);
      setModalDiaActivo(fechaStr);
      setEditandoAsistencia(false);
    }
  };

  const borrarAsistenciaDia = async () => {
    if (!modalDiaActivo) return;
    if (window.confirm(`¿Seguro que deseas BORRAR todo el registro de asistencia del día ${formatearFecha(modalDiaActivo)}? Esta acción no se puede deshacer.`)) {
      setProcesandoDia(true);
      try {
        await deleteDoc(doc(db, `groups/${idGrupo}/attendance`, modalDiaActivo));
        setModalDiaActivo(null);
        setRefreshTrigger(prev => prev + 1);
      } catch (error) { alert("Error al borrar el registro."); }
      setProcesandoDia(false);
    }
  };

  const guardarEdicionDia = async () => {
    if (!modalDiaActivo) return;
    setProcesandoDia(true);
    try {
      await setDoc(doc(db, `groups/${idGrupo}/attendance`, modalDiaActivo), {
        records: asistenciaTemporal,
        updatedAt: serverTimestamp()
      });
      setEditandoAsistencia(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) { alert("Error al actualizar la asistencia."); }
    setProcesandoDia(false);
  };

  const exportarPDFDia = async () => {
    if (!modalDiaActivo) return;
    const perfilNube = await obtenerPerfilNube();
    const docRef = new jsPDF();
    let posY = 15;

    docRef.setFontSize(16); docRef.setTextColor(28, 81, 255); docRef.text(perfilNube.escuela || '', 105, posY, { align: 'center' }); posY += 6;
    docRef.setFontSize(11); docRef.setTextColor(50, 50, 50); docRef.text(`Profesor(a): ${perfilNube.nombre || ''}`, 105, posY, { align: 'center' }); posY += 5;
    docRef.setDrawColor(200, 200, 200); docRef.line(14, posY, 196, posY); posY += 8;

    docRef.setFontSize(14); docRef.setTextColor(0, 0, 0); docRef.text(`Asistencia del ${formatearFecha(modalDiaActivo)}`, 14, posY); posY += 6;
    docRef.setFontSize(10); docRef.text(`Grupo: ${grupo.name}   |   Disciplina: ${grupo.subject}`, 14, posY); posY += 8;

    const bodyData = alumnosBase.map(al => {
       const est = asistenciaTemporal[al.id] || 'F';
       let str = 'Falta';
       if(est==='P') str = 'Presente'; else if(est==='R') str = 'Retardo'; else if(est==='J') str = 'Justificado';
       return [al.studentNumber, al.fullName, str];
    });

    autoTable(docRef, {
      startY: posY, head: [['No.', 'Estudiante', 'Estatus']], body: bodyData, theme: 'grid',
      headStyles: { fillColor: [226, 232, 240], textColor: [51, 51, 51] },
      columnStyles: { 0: { halign: 'center', cellWidth: 15 }, 2: { halign: 'center', cellWidth: 30 } },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 2) {
          if (data.cell.raw === 'Falta') data.cell.styles.textColor = [178, 0, 0];
          else if (data.cell.raw === 'Retardo') data.cell.styles.textColor = [178, 128, 0];
          else if (data.cell.raw === 'Presente') data.cell.styles.textColor = [30, 123, 52];
          else if (data.cell.raw === 'Justificado') data.cell.styles.textColor = [28, 81, 255];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    docRef.save(`Asistencia_${grupo.name}_${modalDiaActivo}.pdf`);
  };

  const renderMiniCalendario = () => {
    const añoCal = mesCalGlobal.getFullYear();
    const mesCal = mesCalGlobal.getMonth();
    const diasEnMes = new Date(añoCal, mesCal + 1, 0).getDate();
    const primerDia = new Date(añoCal, mesCal, 1).getDay();
    
    const celdas = [];
    for (let i = 0; i < primerDia; i++) celdas.push(<div key={`empty-${i}`} style={{ padding: '0.5rem' }}></div>);

    for (let d = 1; d <= diasEnMes; d++) {
      const diaStr = `${añoCal}-${(mesCal + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      const tieneRegistro = diasRegistradosSet.has(diaStr);
      
      celdas.push(
        <div key={d} onClick={() => tieneRegistro ? abrirDiaRegistrado(diaStr) : null} 
          style={{ 
            padding: '0.6rem 0', textAlign: 'center', borderRadius: '8px',
            backgroundColor: tieneRegistro ? 'rgba(46, 229, 92, 0.15)' : 'transparent',
            border: tieneRegistro ? '1px solid var(--accent-green)' : '1px solid transparent',
            color: tieneRegistro ? 'var(--accent-green)' : 'var(--text-muted)',
            fontWeight: tieneRegistro ? 'bold' : 'normal',
            cursor: tieneRegistro ? 'pointer' : 'default',
            transition: 'all 0.2s'
          }}
          className={tieneRegistro ? 'hover-scale' : ''}
          title={tieneRegistro ? 'Ver/Editar Asistencia' : 'Sin registro'}
        >
          {d}
        </div>
      );
    }

    return (
      <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', flex: 1, minWidth: '300px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ margin: 0, color: 'var(--text-main)' }}>Historial por Día</h4>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setMesCalGlobal(new Date(añoCal, mesCal - 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>◀</button>
            <span style={{ fontWeight: 'bold' }}>{MESES[mesCal]} {añoCal}</span>
            <button onClick={() => setMesCalGlobal(new Date(añoCal, mesCal + 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>▶</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', fontSize: '0.85rem' }}>
          {DIAS_SEMANA.map(dia => <div key={dia} style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{dia}</div>)}
          {celdas}
        </div>
        <p style={{ margin: '1rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>👆 Clic en un día marcado (verde) para gestionar.</p>
        <style>{`.hover-scale:hover { transform: scale(1.1); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }`}</style>
      </div>
    );
  };

  const promedioAsistenciaGrupal = statsGenerales.length > 0 ? statsGenerales.reduce((acc, st) => acc + st.porcentaje, 0) / statsGenerales.length : 0;
  const focosRojos = statsGenerales.filter(st => st.f >= 3).sort((a,b) => b.f - a.f);

  if (cargando) return <div className="loader" style={{ marginTop: '4rem' }}></div>;

  return (
    <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)', animation: 'fadeIn 0.3s' }}>
      
      {/* MODAL GLOBAL: GESTIÓN DE DÍA ESPECÍFICO */}
      {modalDiaActivo && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--accent-green)' }}>📅 Gestión del {formatearFecha(modalDiaActivo)}</h3>
              <button onClick={() => setModalDiaActivo(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
               <button onClick={exportarPDFDia} className="pill-btn" style={{ flex: 1, backgroundColor: 'var(--accent-blue)', color: 'white' }}>📄 Descargar Lista (PDF)</button>
               <button onClick={() => setEditandoAsistencia(!editandoAsistencia)} className="pill-btn" style={{ flex: 1, backgroundColor: editandoAsistencia ? 'var(--bg-input)' : 'var(--accent-yellow)', color: '#000', border: '1px solid var(--border-color)' }}>
                 {editandoAsistencia ? 'Cancelar Edición' : '✏️ Editar Lista'}
               </button>
               <button onClick={borrarAsistenciaDia} disabled={procesandoDia} className="pill-btn" style={{ flex: 1, backgroundColor: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)' }}>🗑 Borrar Día</button>
            </div>

            {/* Lista de Alumnos para ver/editar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {alumnosBase.map(alumno => (
                <div key={alumno.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem', backgroundColor: 'var(--bg-input)', borderRadius: '8px', borderLeft: `4px solid ${asistenciaTemporal[alumno.id] === 'P' ? 'var(--accent-green)' : asistenciaTemporal[alumno.id] === 'R' ? 'var(--accent-yellow)' : asistenciaTemporal[alumno.id] === 'J' ? 'var(--accent-blue)' : 'var(--accent-red)'}` }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{alumno.studentNumber}. {alumno.fullName}</span>
                  
                  {editandoAsistencia ? (
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button onClick={() => setAsistenciaTemporal(p => ({...p, [alumno.id]: 'P'}))} style={{ padding: '0.3rem 0.6rem', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: asistenciaTemporal[alumno.id] === 'P' ? 'var(--accent-green)' : 'transparent', color: asistenciaTemporal[alumno.id] === 'P' ? 'white' : 'var(--text-muted)' }}>P</button>
                      <button onClick={() => setAsistenciaTemporal(p => ({...p, [alumno.id]: 'R'}))} style={{ padding: '0.3rem 0.6rem', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: asistenciaTemporal[alumno.id] === 'R' ? 'var(--accent-yellow)' : 'transparent', color: asistenciaTemporal[alumno.id] === 'R' ? '#000' : 'var(--text-muted)' }}>R</button>
                      <button onClick={() => setAsistenciaTemporal(p => ({...p, [alumno.id]: 'J'}))} style={{ padding: '0.3rem 0.6rem', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: asistenciaTemporal[alumno.id] === 'J' ? 'var(--accent-blue)' : 'transparent', color: asistenciaTemporal[alumno.id] === 'J' ? 'white' : 'var(--text-muted)' }}>J</button>
                      <button onClick={() => setAsistenciaTemporal(p => ({...p, [alumno.id]: 'F'}))} style={{ padding: '0.3rem 0.6rem', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: asistenciaTemporal[alumno.id] === 'F' ? 'var(--accent-red)' : 'transparent', color: asistenciaTemporal[alumno.id] === 'F' ? 'white' : 'var(--text-muted)' }}>F</button>
                    </div>
                  ) : (
                    <span style={{ fontWeight: 'bold', color: asistenciaTemporal[alumno.id] === 'P' ? 'var(--accent-green)' : asistenciaTemporal[alumno.id] === 'R' ? 'var(--accent-yellow)' : asistenciaTemporal[alumno.id] === 'J' ? 'var(--accent-blue)' : 'var(--accent-red)' }}>
                      {asistenciaTemporal[alumno.id] === 'P' ? 'Presente' : asistenciaTemporal[alumno.id] === 'R' ? 'Retardo' : asistenciaTemporal[alumno.id] === 'J' ? 'Justificado' : 'Falta'}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {editandoAsistencia && (
              <button onClick={guardarEdicionDia} disabled={procesandoDia} className="pill-btn" style={{ width: '100%', marginTop: '1.5rem', backgroundColor: 'var(--accent-green)', color: '#000', padding: '1rem' }}>
                {procesandoDia ? 'Actualizando...' : '💾 Guardar Cambios en Nube'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODAL CITATORIO/HISTORIAL */}
      {modalExportar && alumnoSeleccionado && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.4rem' }}>Imprimir Reporte</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Personaliza la información que mostrarás a los padres.</p>
            
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Tipo de Documento:</label>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <label style={{ flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '1rem', border: `2px solid ${tipoExportacion === 'historial' ? 'var(--accent-blue)' : 'var(--border-color)'}`, borderRadius: '12px', cursor: 'pointer', backgroundColor: tipoExportacion === 'historial' ? 'rgba(28, 81, 255, 0.1)' : 'transparent' }}>
                <input type="radio" checked={tipoExportacion === 'historial'} onChange={() => setTipoExportacion('historial')} />
                <div><b>Historial Completo</b><br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Muestra todos los estatus</span></div>
              </label>
              <label style={{ flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '1rem', border: `2px solid ${tipoExportacion === 'citatorio' ? 'var(--accent-red)' : 'var(--border-color)'}`, borderRadius: '12px', cursor: 'pointer', backgroundColor: tipoExportacion === 'citatorio' ? 'rgba(255, 77, 79, 0.1)' : 'transparent' }}>
                <input type="radio" checked={tipoExportacion === 'citatorio'} onChange={() => setTipoExportacion('citatorio')} />
                <div><b>Citatorio Oficial</b><br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Filtra faltas y retardos</span></div>
              </label>
            </div>

            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Meses a incluir:</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
              {Array.from(new Set(alumnoSeleccionado.registroCompleto.map(r => obtenerMesAnio(r.fecha)))).map(mes => (
                <label key={mes} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0.5rem', backgroundColor: 'var(--bg-input)', borderRadius: '8px', cursor: 'pointer', border: `1px solid ${mesesSeleccionados.includes(mes) ? 'var(--accent-blue)' : 'transparent'}` }}>
                  <input type="checkbox" checked={mesesSeleccionados.includes(mes)} onChange={() => toggleMes(mes)} /> {mes}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Descargar:</span>
              <button onClick={generarDocumentoWord} className="pill-btn" style={{ flex: 1, backgroundColor: '#185ABD', color: 'white', padding: '0.6rem' }} title="Descargar en Word">📄 .doc</button>
              <button onClick={generarDocumentoPDF} className="pill-btn" style={{ flex: 1, backgroundColor: '#E53935', color: 'white', padding: '0.6rem' }} title="Descargar en PDF">📕 .pdf</button>
              <button onClick={() => setModalExportar(false)} className="pill-btn" style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '0.6rem' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={onVolver} className="pill-btn" style={{ marginBottom: '1rem', background: 'var(--bg-input)', color: 'var(--text-muted)' }}>← Cambiar de Reporte</button>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--accent-green)', fontSize: '1.6rem' }}>📅 Estadísticas de Asistencia</h3>
          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)' }}>Grupo {grupo.name} | Clases evaluadas: {diasRegistrados.length}</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <TutorialTooltip mensaje="Navega entre la información de todos tus alumnos y los reportes individuales.">
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-input)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <button onClick={() => setModo('grupo')} style={{ padding: '0.6rem 1.2rem', border: 'none', background: modo === 'grupo' ? 'var(--accent-green)' : 'transparent', color: modo === 'grupo' ? '#000' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}>Vista Grupal</button>
              <button onClick={() => setModo('alumno')} style={{ padding: '0.6rem 1.2rem', border: 'none', background: modo === 'alumno' ? 'var(--accent-green)' : 'transparent', color: modo === 'alumno' ? '#000' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}>Vista por Alumno</button>
            </div>
          </TutorialTooltip>
        </div>
      </div>

      {diasRegistrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No has pasado lista en este grupo.</div>
      ) : (
        <>
          {modo === 'grupo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
                <div style={{ flex: 1, minWidth: '200px', backgroundColor: 'var(--bg-input)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)' }}>Asistencia Promedio Grupal</h4>
                  <span style={{ fontSize: '3rem', fontWeight: 'bold', color: promedioAsistenciaGrupal >= 85 ? 'var(--accent-green)' : promedioAsistenciaGrupal >= 70 ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
                    {promedioAsistenciaGrupal.toFixed(1)}%
                  </span>
                </div>
                
                <TutorialTooltip mensaje="Observa los días que pasaste lista. Da clic en uno verde para descargar, editar o borrar esa asistencia específica." posicion="top">
                  {renderMiniCalendario()}
                </TutorialTooltip>
              </div>

              <TutorialTooltip mensaje="Aula+ detecta automáticamente a los alumnos que acumulan 3 o más faltas.">
                <div style={{ backgroundColor: 'rgba(255, 77, 79, 0.05)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255, 77, 79, 0.2)' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent-red)' }}>🚨 Historial Focos Rojos (Alumnos con 3 o más faltas)</h4>
                  {focosRojos.length === 0 ? (
                    <p style={{ color: 'var(--accent-green)', margin: 0 }}>¡Excelente! Ningún alumno acumula 3 faltas.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      {focosRojos.map(al => (
                        <div key={al.id} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: 'var(--bg-panel)', padding: '0.8rem', borderRadius: '8px' }}>
                          <span><strong>{al.fullName}</strong></span>
                          <span style={{ color: 'var(--accent-red)', fontWeight: 'bold' }}>{al.f} Faltas acumuladas</span>
                        </div>
                      ))}
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}><em>Acción recomendada: Revisa la "Vista por Alumno" para ver el reporte mensual.</em></p>
                    </div>
                  )}
                </div>
              </TutorialTooltip>
            </div>
          )}

          {modo === 'alumno' && (
            <div>
              <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Buscar historial de un estudiante específico:</label>
                <input 
                  type="text" list="lista-alumnos-asist" className="search-input" placeholder="Escribe el apellido o nombre..." 
                  value={busquedaAlumno} onChange={e => manejarBusqueda(e.target.value)}
                  style={{ border: '1px solid var(--accent-green)', fontSize: '1.1rem' }}
                />
                <datalist id="lista-alumnos-asist">
                  {statsGenerales.map(a => <option key={a.id} value={a.fullName} />)}
                </datalist>
              </div>

              {alumnoSeleccionado && (
                <div style={{ animation: 'fadeIn 0.3s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', backgroundColor: 'var(--bg-input)', padding: '1.5rem', borderRadius: '16px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-main)' }}>{alumnoSeleccionado.fullName}</h4>
                      <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)' }}>Asistencia Real: <strong style={{ color: alumnoSeleccionado.porcentaje >= 85 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{alumnoSeleccionado.porcentaje.toFixed(1)}%</strong></p>
                      {alumnoSeleccionado.lastCitationDate && (
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--accent-green)' }}>✅ Último reporte generado el: {formatearFecha(alumnoSeleccionado.lastCitationDate)}</p>
                      )}
                    </div>
                    
                    <TutorialTooltip mensaje="Genera un Citatorio Oficial o un Historial de Asistencia para entregar a Trabajo Social o tutores.">
                      <button onClick={() => abrirModalExportar(alumnoSeleccionado)} className="pill-btn" style={{ backgroundColor: 'var(--accent-green)', color: '#000' }}>📄 Imprimir Reporte</button>
                    </TutorialTooltip>
                  </div>

                  <TutorialTooltip mensaje="Haz clic en cualquier tarjeta para filtrar y ver las fechas exactas de ese estatus.">
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                      <div onClick={() => alternarFiltro('P')} style={{ flex: 1, minWidth: '100px', textAlign: 'center', backgroundColor: 'rgba(46, 229, 92, 0.1)', padding: '1rem', borderRadius: '12px', border: `2px solid ${filtroActivo === 'P' ? 'var(--accent-green)' : 'transparent'}`, cursor: 'pointer', opacity: filtroActivo === 'TODOS' || filtroActivo === 'P' ? 1 : 0.5, transition: 'all 0.2s' }}>
                        <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-green)' }}>{alumnoSeleccionado.p}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Presentes</span>
                      </div>
                      <div onClick={() => alternarFiltro('R')} style={{ flex: 1, minWidth: '100px', textAlign: 'center', backgroundColor: 'rgba(223, 255, 0, 0.1)', padding: '1rem', borderRadius: '12px', border: `2px solid ${filtroActivo === 'R' ? 'var(--accent-yellow)' : 'transparent'}`, cursor: 'pointer', opacity: filtroActivo === 'TODOS' || filtroActivo === 'R' ? 1 : 0.5, transition: 'all 0.2s' }}>
                        <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-yellow)' }}>{alumnoSeleccionado.r}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Retardos</span>
                      </div>
                      <div onClick={() => alternarFiltro('F')} style={{ flex: 1, minWidth: '100px', textAlign: 'center', backgroundColor: 'rgba(255, 77, 79, 0.1)', padding: '1rem', borderRadius: '12px', border: `2px solid ${filtroActivo === 'F' ? 'var(--accent-red)' : 'transparent'}`, cursor: 'pointer', opacity: filtroActivo === 'TODOS' || filtroActivo === 'F' ? 1 : 0.5, transition: 'all 0.2s' }}>
                        <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-red)' }}>{alumnoSeleccionado.f}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Faltas</span>
                      </div>
                      <div onClick={() => alternarFiltro('J')} style={{ flex: 1, minWidth: '100px', textAlign: 'center', backgroundColor: 'rgba(28, 81, 255, 0.1)', padding: '1rem', borderRadius: '12px', border: `2px solid ${filtroActivo === 'J' ? 'var(--accent-blue)' : 'transparent'}`, cursor: 'pointer', opacity: filtroActivo === 'TODOS' || filtroActivo === 'J' ? 1 : 0.5, transition: 'all 0.2s' }}>
                        <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-blue)' }}>{alumnoSeleccionado.j}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Justificados</span>
                      </div>
                    </div>
                  </TutorialTooltip>

                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)' }}>Registro Detallado (Agrupado por Mes)</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(() => {
                      const registrosFiltrados = filtroActivo === 'TODOS' 
                        ? alumnoSeleccionado.registroCompleto 
                        : alumnoSeleccionado.registroCompleto.filter(r => r.tipo === filtroActivo);

                      if (registrosFiltrados.length === 0) {
                        return <p style={{ color: 'var(--text-muted)' }}>No hay registros para este estatus.</p>;
                      }

                      const gruposMeses: Record<string, RegistroDiario[]> = {};
                      registrosFiltrados.forEach(reg => {
                        const mesAnio = obtenerMesAnio(reg.fecha);
                        if (!gruposMeses[mesAnio]) gruposMeses[mesAnio] = [];
                        gruposMeses[mesAnio].push(reg);
                      });

                      return Object.entries(gruposMeses).map(([mesAnio, registros]) => (
                        <details key={mesAnio} className="vark-accordion" open>
                          <summary style={{ borderLeft: '4px solid var(--accent-green)', fontSize: '1.1rem' }}>
                            <span>{mesAnio}</span>
                            <span style={{fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'normal'}}>{registros.length} registros</span>
                          </summary>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1rem' }}>
                            {registros.map((dia, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '12px', borderLeft: `4px solid ${dia.tipo === 'F' ? 'var(--accent-red)' : dia.tipo === 'R' ? 'var(--accent-yellow)' : dia.tipo === 'P' ? 'var(--accent-green)' : 'var(--accent-blue)'}` }}>
                                <span style={{ color: 'var(--text-main)' }}>📅 {formatearFecha(dia.fecha)}</span>
                                <span style={{ fontWeight: 'bold', color: dia.tipo === 'F' ? 'var(--accent-red)' : dia.tipo === 'R' ? 'var(--accent-yellow)' : dia.tipo === 'P' ? 'var(--accent-green)' : 'var(--accent-blue)' }}>{dia.estado}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      ));
                    })()}
                  </div>

                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}