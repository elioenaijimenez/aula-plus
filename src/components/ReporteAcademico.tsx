import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Alumno { id: string; fullName: string; studentNumber: number; }
// AÑADIDO: Agregamos la propiedad 'tipo' a la interfaz para poder identificar los avisos
interface Evidencia { id: string; titulo: string; descripcion: string; tipo?: string; trimestre: string; fechaActividad: string; puntajeMinimo: number; puntajeMaximo: number; calificaciones: Record<string, number>; numero?: number; createdAt?: any; }

export default function ReporteAcademico({ idGrupo, grupo, onVolver }: { idGrupo: string, grupo: any, onVolver: () => void }) {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modo, setModo] = useState<'grupo' | 'alumno'>('grupo');
  const [trimestreFiltro, setTrimestreFiltro] = useState<'1' | '2' | '3' | 'anual'>('anual');
  const [userEmail, setUserEmail] = useState('');
  
  const [busquedaAlumno, setBusquedaAlumno] = useState('');
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<Alumno | null>(null);

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
      setAlumnos(listaA);

      const snapE = await getDocs(collection(db, `groups/${idGrupo}/evidences`));
      const listaE: Evidencia[] = [];
      
      snapE.forEach(d => {
        const data = d.data();
        // MAGIA: Filtramos estrictamente para que los "Avisos" no entren al Kardex ni afecten promedios
        if (data.tipo !== 'Aviso') {
          listaE.push({ id: d.id, ...data } as Evidencia);
        }
      });
      
      listaE.sort((a, b) => {
        const comp = a.fechaActividad.localeCompare(b.fechaActividad);
        if (comp === 0) {
           const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
           const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
           return timeA - timeB;
        }
        return comp;
      });
      
      // La numeración ahora solo aplicará a actividades reales
      const listaNumerada = listaE.map((ev, index) => ({ ...ev, numero: index + 1, trimestre: ev.trimestre || '1' }));
      setEvidencias(listaNumerada);
      
      setCargando(false);
    };
    fetchData();
  }, [idGrupo]);

  const manejarBusqueda = (val: string) => {
    const cleanVal = val.replace(/[^\w\sñÑáéíóúÁÉÍÓÚ]/gi, '');
    setBusquedaAlumno(cleanVal);
    const encontrado = alumnos.find(a => a.fullName.toLowerCase() === cleanVal.toLowerCase());
    setAlumnoSeleccionado(encontrado || null);
  };

  const limpiarBusqueda = () => {
    setAlumnoSeleccionado(null);
    setBusquedaAlumno('');
  };

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

  const evidenciasFiltradas = trimestreFiltro === 'anual' ? evidencias : evidencias.filter(e => e.trimestre === trimestreFiltro);

  let promedioGrupal = 0;
  let actividadesEnRiesgo: any[] = [];
  
  if (modo === 'grupo' && evidenciasFiltradas.length > 0 && alumnos.length > 0) {
    let sumaTotalGrupo = 0;
    let conteoCalificaciones = 0;
    const statsActividades = evidenciasFiltradas.map(ev => {
      let sumaEv = 0;
      let entregadas = 0;
      alumnos.forEach(al => {
        const cal = ev.calificaciones[al.id];
        const calFinal = cal !== undefined ? cal : ev.puntajeMinimo;
        sumaEv += calFinal;
        if (calFinal > ev.puntajeMinimo) entregadas++;
        sumaTotalGrupo += calFinal;
        conteoCalificaciones++;
      });
      const promEv = sumaEv / alumnos.length;
      return { ...ev, promedio: promEv, entregadas, porcentaje: (entregadas / alumnos.length) * 100 };
    });
    promedioGrupal = conteoCalificaciones > 0 ? (sumaTotalGrupo / conteoCalificaciones) : 0;
    actividadesEnRiesgo = statsActividades.filter(a => a.porcentaje <= 50).sort((a,b) => a.porcentaje - b.porcentaje);
  }

  const exportarKardexWord = async () => {
    if (!alumnoSeleccionado) return;
    
    const perfilNube = await obtenerPerfilNube();
    const nombreDocente = perfilNube.nombre || 'Docente';
    const escuela = perfilNube.escuela || 'Escuela no registrada';
    const ubicacion = perfilNube.ubicacion || 'Ubicación no registrada';
    const enfasisTxt = grupo.emphasis ? `<br/><b>Énfasis:</b> ${grupo.emphasis}` : '';
    
    let pendientes = 0;
    const filasHTML = evidenciasFiltradas.map(ev => {
      const cal = ev.calificaciones[alumnoSeleccionado.id] !== undefined ? ev.calificaciones[alumnoSeleccionado.id] : ev.puntajeMinimo;
      const entregado = cal > ev.puntajeMinimo;
      if (!entregado) pendientes++;
      
      const color = entregado ? '#1e7b34' : '#b20000';
      const estatus = entregado ? 'Entregada' : 'Pendiente';
      
      return `
        <tr>
          <td style="padding: 10px; text-align: center;">${ev.numero}</td>
          <td style="padding: 10px;"><b>${ev.titulo}</b><br/><span style="font-size: 12px; color: #555;">${ev.descripcion}</span></td>
          <td style="padding: 10px; text-align: center;">${ev.fechaActividad}</td>
          <td style="padding: 10px; text-align: center; font-weight: bold;">${cal} / ${ev.puntajeMaximo}</td>
          <td style="padding: 10px; text-align: center; color: ${color}; font-weight: bold;">${estatus}</td>
        </tr>
      `;
    }).join('');

    const mensajePedagogico = pendientes > 0 
      ? `<div style="background-color: #ffe6e6; padding: 15px; border-left: 5px solid #b20000; margin-top: 20px;">
           <h4 style="margin-top: 0; color: #b20000;">¡Aún estás a tiempo!</h4>
           <p style="margin: 0;">Tienes <b>${pendientes} actividades pendientes</b>. Te invito a realizarlas y entregarlas lo más pronto posible para mejorar tu promedio. ¡Tú puedes lograrlo!</p>
         </div>`
      : `<div style="background-color: #e6ffe6; padding: 15px; border-left: 5px solid #1e7b34; margin-top: 20px;">
           <h4 style="margin-top: 0; color: #1e7b34;">¡Excelente trabajo!</h4>
           <p style="margin: 0;">Felicidades por tu dedicación y esfuerzo. Has entregado todas tus actividades en este periodo. Sigue así y alcanzarás todas tus metas.</p>
         </div>`;

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Kardex del Alumno</title></head>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #1C51FF;">${escuela}</h2>
          <h3 style="margin: 5px 0;">Profesor(a): ${nombreDocente}</h3>
          <p style="margin: 5px 0; color: #555;">${ubicacion}</p>
          <hr style="border: 1px solid #ccc;" />
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; color: #333;">Kardex de Avance Académico</h3>
          <p style="margin: 5px 0;"><b>Alumno(a):</b> ${alumnoSeleccionado.fullName}</p>
          <p style="margin: 5px 0;"><b>Ciclo Escolar:</b> ${grupo.schoolYear} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Trimestre Analizado:</b> ${trimestreFiltro === 'anual' ? 'Todos' : trimestreFiltro}</p>
          <p style="margin: 5px 0;"><b>Grado y Grupo:</b> ${grupo.name} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Disciplina:</b> ${grupo.subject} ${enfasisTxt}</p>
        </div>
        <table border="1" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
          <tr style="background-color: #e2e8f0; color: #333;">
            <th style="padding: 10px;">#</th>
            <th style="padding: 10px;">Actividad</th>
            <th style="padding: 10px;">Fecha</th>
            <th style="padding: 10px;">Calificación</th>
            <th style="padding: 10px;">Estatus</th>
          </tr>
          ${filasHTML}
        </table>
        ${mensajePedagogico}
      </body></html>
    `;

    const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/msword;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Kardex_${alumnoSeleccionado.fullName.replace(/[^a-zA-Z0-9]/g, '_')}.doc`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const exportarKardexPDF = async () => {
    if (!alumnoSeleccionado) return;
    
    const perfilNube = await obtenerPerfilNube();
    const nombreDocente = perfilNube.nombre || 'Docente';
    const escuela = perfilNube.escuela || 'Escuela no registrada';
    const ubicacion = perfilNube.ubicacion || 'Ubicación no registrada';
    const enfasisTxt = grupo.emphasis ? ` - Énfasis: ${grupo.emphasis}` : '';

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setTextColor(28, 81, 255);
    doc.text(escuela, 105, 15, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text(`Profesor(a): ${nombreDocente}`, 105, 22, { align: 'center' });
    doc.setFontSize(9);
    doc.text(ubicacion, 105, 27, { align: 'center' });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 30, 196, 30);

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Kardex de Avance Académico", 14, 38);
    
    doc.setFontSize(10);
    doc.text(`Alumno(a): ${alumnoSeleccionado.fullName}`, 14, 45);
    doc.text(`Ciclo Escolar: ${grupo.schoolYear}   |   Trimestre Analizado: ${trimestreFiltro === 'anual' ? 'Todos' : trimestreFiltro}`, 14, 51);
    doc.text(`Grado y Grupo: ${grupo.name}   |   Disciplina: ${grupo.subject}${enfasisTxt}`, 14, 57);

    let pendientes = 0;
    const bodyData = evidenciasFiltradas.map(ev => {
      const cal = ev.calificaciones[alumnoSeleccionado.id] !== undefined ? ev.calificaciones[alumnoSeleccionado.id] : ev.puntajeMinimo;
      const entregado = cal > ev.puntajeMinimo;
      if (!entregado) pendientes++;
      
      return [
        ev.numero || '', 
        ev.titulo || '', 
        ev.fechaActividad || '', 
        `${cal} / ${ev.puntajeMaximo}`, 
        entregado ? 'Entregada' : 'Pendiente'
      ] as (string | number)[];
    });

    autoTable(doc, {
      startY: 65,
      head: [['#', 'Actividad', 'Fecha', 'Calificación', 'Estatus']],
      body: bodyData,
      theme: 'grid',
      headStyles: { fillColor: [226, 232, 240], textColor: [51, 51, 51] },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 4) {
          if (data.cell.raw === 'Entregada') {
            data.cell.styles.textColor = [30, 123, 52]; 
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [178, 0, 0]; 
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(11);
    if (pendientes > 0) {
      doc.setTextColor(178, 0, 0);
      doc.text("¡Aún estás a tiempo!", 14, finalY);
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(10);
      doc.text(`Tienes ${pendientes} actividades pendientes. Te invito a realizarlas y entregarlas lo`, 14, finalY + 6);
      doc.text(`más pronto posible para mejorar tu promedio. ¡Tú puedes lograrlo!`, 14, finalY + 11);
    } else {
      doc.setTextColor(30, 123, 52);
      doc.text("¡Excelente trabajo!", 14, finalY);
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(10);
      doc.text(`Felicidades por tu dedicación y esfuerzo. Has entregado todas tus actividades en`, 14, finalY + 6);
      doc.text(`este periodo. Sigue así y alcanzarás todas tus metas.`, 14, finalY + 11);
    }

    doc.save(`Kardex_${alumnoSeleccionado.fullName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  };

  if (cargando) return <div className="loader" style={{ marginTop: '4rem' }}></div>;

  return (
    <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)', animation: 'fadeIn 0.3s' }}>
      <button onClick={onVolver} className="pill-btn" style={{ marginBottom: '1rem', background: 'var(--bg-input)', color: 'var(--text-muted)' }}>← Cambiar de Reporte</button>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--accent-blue)', fontSize: '1.6rem' }}>📊 Rendimiento Académico</h3>
          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)' }}>Grupo {grupo.name} - {grupo.subject}</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <TutorialTooltip mensaje="Alterna entre las analíticas de toda la clase y el reporte individual." posicion="left">
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-input)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <button onClick={() => setModo('grupo')} style={{ padding: '0.6rem 1.2rem', border: 'none', background: modo === 'grupo' ? 'var(--accent-blue)' : 'transparent', color: modo === 'grupo' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}>Vista Grupal</button>
              <button onClick={() => setModo('alumno')} style={{ padding: '0.6rem 1.2rem', border: 'none', background: modo === 'alumno' ? 'var(--accent-blue)' : 'transparent', color: modo === 'alumno' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}>Vista por Alumno</button>
            </div>
          </TutorialTooltip>

          <TutorialTooltip mensaje="Filtra los datos por periodo de evaluación.">
            <select className="search-input" value={trimestreFiltro} onChange={e => setTrimestreFiltro(e.target.value as any)} style={{ width: 'auto', cursor: 'pointer' }}>
              <option value="anual">Ciclo Completo (Anual)</option>
              <option value="1">Trimestre 1</option>
              <option value="2">Trimestre 2</option>
              <option value="3">Trimestre 3</option>
            </select>
          </TutorialTooltip>
        </div>
      </div>

      {evidenciasFiltradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay actividades registradas en el periodo seleccionado.</div>
      ) : (
        <>
          {/* --- VISTA GRUPAL --- */}
          {modo === 'grupo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px', backgroundColor: 'var(--bg-input)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)' }}>Promedio General del Grupo</h4>
                  <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: promedioGrupal >= 8 ? 'var(--accent-green)' : promedioGrupal >= 6 ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
                    {promedioGrupal.toFixed(1)}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: '200px', backgroundColor: 'var(--bg-input)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)' }}>Actividades Evaluadas</h4>
                  <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-blue)' }}>{evidenciasFiltradas.length}</span>
                </div>
              </div>

              <TutorialTooltip mensaje="Identifica automáticamente las actividades que tus alumnos no entregaron o reprobaron para ajustar tu metodología.">
                <div style={{ backgroundColor: 'rgba(255, 77, 79, 0.05)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255, 77, 79, 0.2)' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent-red)' }}>⚠️ Cuellos de Botella (Mayor índice de no entrega)</h4>
                  {actividadesEnRiesgo.length === 0 ? (
                    <p style={{ color: 'var(--accent-green)', margin: 0 }}>¡Excelente! Ninguna actividad tiene menos del 50% de entrega.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      {actividadesEnRiesgo.map(act => (
                        <div key={act.id} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: 'var(--bg-panel)', padding: '0.8rem', borderRadius: '8px' }}>
                          <span><strong>#{act.numero} {act.titulo}</strong></span>
                          <span style={{ color: 'var(--accent-red)', fontWeight: 'bold' }}>Solo {act.entregadas} de {alumnos.length} entregaron ({act.porcentaje.toFixed(0)}%)</span>
                        </div>
                      ))}
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}><em>Sugerencia Pedagógica: Revisa si las instrucciones de estas actividades fueron claras o si requieren más tiempo de clase.</em></p>
                    </div>
                  )}
                </div>
              </TutorialTooltip>
            </div>
          )}

          {/* --- VISTA POR ALUMNO (KARDEX) --- */}
          {modo === 'alumno' && (
            <div>
              {!alumnoSeleccionado ? (
                <div style={{ marginBottom: '1.5rem', position: 'relative', animation: 'fadeIn 0.3s' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Buscar Estudiante:</label>
                  <input 
                    type="text" 
                    list="lista-alumnos" 
                    className="search-input" 
                    placeholder="Escribe el apellido o nombre..." 
                    value={busquedaAlumno}
                    onChange={e => manejarBusqueda(e.target.value)}
                    style={{ border: '2px solid var(--accent-blue)', fontSize: '1.1rem', padding: '1rem', borderRadius: '12px' }}
                  />
                  <datalist id="lista-alumnos">
                    {alumnos.map(a => <option key={a.id} value={a.fullName} />)}
                  </datalist>
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Selecciona un alumno para generar su Kardex.</div>
                </div>
              ) : (
                <div style={{ animation: 'fadeIn 0.3s' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', backgroundColor: 'var(--bg-input)', padding: '1.5rem', borderRadius: '16px', borderLeft: '4px solid var(--accent-blue)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                        <h4 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)' }}>{alumnoSeleccionado.fullName}</h4>
                        <button onClick={limpiarBusqueda} className="pill-btn" style={{ background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', border: 'none', padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}>
                          ✕ Nueva Búsqueda
                        </button>
                      </div>
                      <p style={{ margin: '0', color: 'var(--text-muted)' }}>No. Lista: {alumnoSeleccionado.studentNumber}</p>
                    </div>
                    
                    <TutorialTooltip mensaje="Genera un reporte motivacional listo para imprimir o enviar a los tutores.">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Descargar Kardex:</span>
                        <button onClick={exportarKardexWord} className="pill-btn" style={{ backgroundColor: '#185ABD', color: 'white', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '8px' }} title="Descargar en Word">📄 .doc</button>
                        <button onClick={exportarKardexPDF} className="pill-btn" style={{ backgroundColor: '#E53935', color: 'white', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '8px' }} title="Descargar en PDF">📕 .pdf</button>
                      </div>
                    </TutorialTooltip>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {evidenciasFiltradas.map(ev => {
                      const cal = ev.calificaciones[alumnoSeleccionado.id] !== undefined ? ev.calificaciones[alumnoSeleccionado.id] : ev.puntajeMinimo;
                      const entregado = cal > ev.puntajeMinimo;
                      
                      return (
                        <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '12px', borderLeft: `4px solid ${entregado ? 'var(--accent-green)' : 'var(--accent-darkred)'}`, flexWrap: 'wrap', gap: '1rem' }}>
                          <div style={{ flex: 1, minWidth: '200px' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Actividad #{ev.numero} | Fecha: {ev.fechaActividad}</div>
                            <strong style={{ fontSize: '1.1rem' }}>{ev.titulo}</strong>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{ev.descripcion}</p>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                            <div style={{ textAlign: 'center' }}>
                              <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: 'bold', color: entregado ? 'var(--text-main)' : 'var(--accent-red)' }}>{cal} <span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>/ {ev.puntajeMaximo}</span></span>
                            </div>
                            <div style={{ padding: '0.4rem 1rem', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 'bold', backgroundColor: entregado ? 'rgba(46, 229, 92, 0.1)' : 'rgba(178, 0, 0, 0.1)', color: entregado ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                              {entregado ? 'Entregada' : 'Pendiente'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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