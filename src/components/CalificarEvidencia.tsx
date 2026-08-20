import { useState, useEffect } from 'react';
import { collection, doc, query, orderBy, getDocs, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

interface Alumno { id: string; fullName: string; studentNumber: number; }
interface Evidencia { id: string; titulo: string; descripcion: string; fechaActividad: string; puntajeMinimo: number; puntajeMaximo: number; trimestre: string; numero?: number; calificaciones?: Record<string, number>; }

export default function CalificarEvidencia({ idGrupo, evidencia, onVolver }: { idGrupo: string, evidencia: Evidencia, onVolver: () => void }) {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [calificaciones, setCalificaciones] = useState<Record<string, number | ''>>({});
  const [cargando, setCargando] = useState(true);
  
  const [datosGrupo, setDatosGrupo] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setCargando(true);
      
      const docGrupo = await getDoc(doc(db, 'groups', idGrupo));
      if (docGrupo.exists()) setDatosGrupo(docGrupo.data());

      const q = query(collection(db, `groups/${idGrupo}/students`), orderBy('studentNumber', 'asc'));
      const snapAlumnos = await getDocs(q);
      const lista: Alumno[] = [];
      snapAlumnos.forEach(d => lista.push({ id: d.id, ...d.data() } as Alumno));
      setAlumnos(lista);

      const refEvidencia = doc(db, `groups/${idGrupo}/evidences`, evidencia.id);
      const docEv = await getDoc(refEvidencia);
      
      let datosCargados: Record<string, number> = {};
      if (docEv.exists()) {
        datosCargados = docEv.data().calificaciones || {};
      }

      let huboCambiosNuevos = false;
      const calificacionesIniciales: Record<string, number> = {};

      lista.forEach(alumno => {
        if (datosCargados[alumno.id] === undefined) {
          calificacionesIniciales[alumno.id] = evidencia.puntajeMinimo;
          huboCambiosNuevos = true;
        } else {
          calificacionesIniciales[alumno.id] = datosCargados[alumno.id];
        }
      });

      setCalificaciones(calificacionesIniciales);

      if (huboCambiosNuevos) {
        await updateDoc(refEvidencia, { calificaciones: calificacionesIniciales });
      }

      setCargando(false);
    };
    fetchData();
  }, [idGrupo, evidencia]);

  const guardarCalificacionNube = async (idAlumno: string, puntajeStr: string) => {
    let puntaje = puntajeStr === '' ? evidencia.puntajeMinimo : Number(puntajeStr);
    
    if (puntaje > evidencia.puntajeMaximo) puntaje = evidencia.puntajeMaximo;
    if (puntaje < evidencia.puntajeMinimo) puntaje = evidencia.puntajeMinimo;

    setCalificaciones(prev => ({ ...prev, [idAlumno]: puntaje }));

    const refEvidencia = doc(db, `groups/${idGrupo}/evidences`, evidencia.id);
    await updateDoc(refEvidencia, {
      [`calificaciones.${idAlumno}`]: puntaje
    });
  };

  const exportarActividadWord = () => {
    const sessionLocal = localStorage.getItem('aulaPlusSession');
    const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
    const pLocal = localStorage.getItem('aulaPlusPerfil');
    const perfilData = pLocal ? JSON.parse(pLocal) : null;

    const nombreDocente = sessionData?.user?.nombre || perfilData?.nombre || 'Docente';
    const escuela = perfilData?.escuela || 'Escuela no registrada';
    const enfasisTxt = datosGrupo?.emphasis ? `&nbsp;&nbsp;|&nbsp;&nbsp; <b>Énfasis:</b> ${datosGrupo.emphasis}` : '';

    const filasHTML = alumnos.map(al => {
      const cal = calificaciones[al.id] !== undefined && calificaciones[al.id] !== '' ? calificaciones[al.id] : evidencia.puntajeMinimo;
      const estatus = Number(cal) > evidencia.puntajeMinimo ? 'Entregada / Calificada' : 'Pendiente / Mínimo';
      const color = Number(cal) > evidencia.puntajeMinimo ? '#1e7b34' : '#b20000';
      
      return `
        <tr>
          <td style="padding: 6px; text-align: center; border: 1px solid black;">${al.studentNumber}</td>
          <td style="padding: 6px; border: 1px solid black;">${al.fullName}</td>
          <td style="padding: 6px; text-align: center; border: 1px solid black; font-weight: bold;">${cal} / ${evidencia.puntajeMaximo}</td>
          <td style="padding: 6px; text-align: center; border: 1px solid black; color: ${color}; font-weight: bold;">${estatus}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Calificaciones Actividad</title>
        <style>
          @page WordSection1 { size: 27.94cm 21.59cm; margin: 1.5cm; mso-page-orientation: landscape; }
          div.WordSection1 { page: WordSection1; }
        </style>
      </head>
      <body style="font-family: Arial, sans-serif; font-size: 10pt; color: #000;">
        <div class="WordSection1">
          <div style="text-align: center; margin-bottom: 10px;">
            <div style="font-size: 14pt; font-weight: bold; color: #1C51FF;">${escuela}</div>
            <div style="font-size: 12pt; font-weight: bold; margin-top: 5px;">Reporte de Evaluación - Actividad #${evidencia.numero || '-'}</div>
          </div>
          <div style="margin-bottom: 15px; font-size: 10pt;">
            <b>Docente:</b> ${nombreDocente} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Grupo:</b> ${datosGrupo?.name} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Disciplina:</b> ${datosGrupo?.subject} ${enfasisTxt}<br/>
            <b>Actividad:</b> ${evidencia.titulo} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Fecha:</b> ${evidencia.fechaActividad}
          </div>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 10pt;">
            <tr style="background-color: #e2e8f0;">
              <th style="padding: 6px; text-align: center; border: 1px solid black; width: 8%;">No.</th>
              <th style="padding: 6px; border: 1px solid black; width: 50%;">Nombre del Estudiante</th>
              <th style="padding: 6px; text-align: center; border: 1px solid black; width: 20%;">Calificación Obtenida</th>
              <th style="padding: 6px; text-align: center; border: 1px solid black; width: 22%;">Estatus</th>
            </tr>
            ${filasHTML}
          </table>
        </div>
      </body></html>
    `;

    const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/msword;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Evaluacion_${evidencia.titulo}_${datosGrupo?.name}.doc`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      
      <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <button onClick={onVolver} className="pill-btn" style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>← Volver a Evidencias</button>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <TutorialTooltip mensaje="Descarga la sábana de calificaciones actual de esta actividad.">
              <button onClick={exportarActividadWord} className="pill-btn" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                📄 Exportar Actividad (Word)
              </button>
            </TutorialTooltip>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <span style={{ backgroundColor: 'var(--accent-blue)', color: 'white', padding: '0.3rem 0.8rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.2rem' }}>
            #{evidencia.numero || '-'}
          </span>
          <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.8rem' }}>{evidencia.titulo}</h3>
        </div>
        
        <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)' }}>{evidencia.descripcion}</p>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ backgroundColor: 'var(--bg-input)', padding: '0.4rem 1rem', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-main)' }}>
            📍 Trimestre: <strong style={{ color: 'var(--accent-blue)' }}>{evidencia.trimestre}</strong>
          </span>
          <span style={{ backgroundColor: 'var(--bg-input)', padding: '0.4rem 1rem', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-main)' }}>
            📅 Impartida: <strong style={{ color: 'var(--accent-green)' }}>{evidencia.fechaActividad}</strong>
          </span>
          <span style={{ backgroundColor: 'var(--bg-input)', padding: '0.4rem 1rem', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-main)' }}>
            📊 Rango: <strong style={{ color: 'var(--accent-yellow)' }}>{evidencia.puntajeMinimo} a {evidencia.puntajeMaximo} pts.</strong>
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0, color: 'var(--text-muted)' }}>Lista de Evaluación</h4>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Se guarda automáticamente al presionar Enter o salir de la casilla.</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {cargando ? <div className="loader"></div> : alumnos.map((alumno) => (
          <div key={alumno.id} className="student-item" style={{ borderLeft: `4px solid ${calificaciones[alumno.id] === evidencia.puntajeMaximo ? 'var(--accent-green)' : calificaciones[alumno.id] === evidencia.puntajeMinimo ? 'var(--accent-red)' : 'var(--accent-yellow)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600, width: '25px' }}>{alumno.studentNumber.toString().padStart(2, '0')}</span>
              <span style={{ fontWeight: 500 }}>{alumno.fullName}</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TutorialTooltip mensaje="Ingresa la calificación aquí">
                <input 
                  type="number" 
                  className="score-input"
                  min={evidencia.puntajeMinimo}
                  max={evidencia.puntajeMaximo}
                  value={calificaciones[alumno.id] !== undefined ? calificaciones[alumno.id] : ''}
                  onChange={(e) => setCalificaciones({ ...calificaciones, [alumno.id]: e.target.value === '' ? '' : Number(e.target.value) })}
                  onBlur={(e) => guardarCalificacionNube(alumno.id, e.target.value)}
                />
              </TutorialTooltip>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>/ {evidencia.puntajeMaximo}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}