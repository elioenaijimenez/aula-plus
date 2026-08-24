import { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

interface Grupo { id: string; name: string; subject: string; }
interface Alumno { id: string; fullName: string; studentNumber: number; }

export default function UtilidadEquipos({ onVolver }: { onVolver: () => void }) {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState('');
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  
  const [nombreActividad, setNombreActividad] = useState('');
  const [numEquipos, setNumEquipos] = useState(4);
  const [equipos, setEquipos] = useState<Alumno[][]>([]);
  
  const [alumnoParaAsignar, setAlumnoParaAsignar] = useState<Alumno | null>(null);

  // MAGIA SEGURIDAD: Obtenemos el email para filtrar
  useEffect(() => {
    const fetchGrupos = async () => {
      const sessionLocal = localStorage.getItem('aulaPlusSession');
      const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
      const email = sessionData?.user?.email || sessionData?.email || '';

      if (!email) return;

      // FILTRO ESTRICTO: Solo grupos del maestro actual
      const q = query(collection(db, 'groups'), where('docenteEmail', '==', email));
      const snap = await getDocs(q);
      const lista: Grupo[] = [];
      snap.forEach(d => lista.push({ id: d.id, name: d.data().name, subject: d.data().subject }));
      setGrupos(lista);
    };
    fetchGrupos();
  }, []);

  useEffect(() => {
    if (!grupoSeleccionado) return;
    const fetchAlumnos = async () => {
      const snap = await getDocs(collection(db, `groups/${grupoSeleccionado}/students`));
      const lista: Alumno[] = [];
      snap.forEach(d => lista.push({ id: d.id, fullName: d.data().fullName, studentNumber: d.data().studentNumber }));
      
      lista.sort((a,b) => a.fullName.localeCompare(b.fullName));
      setAlumnos(lista);
      setEquipos(Array.from({ length: numEquipos }, () => []));
    };
    fetchAlumnos();
  }, [grupoSeleccionado, numEquipos]);

  const armarAutomatico = () => {
    if (alumnos.length === 0) return;
    const mezclados = [...alumnos].sort(() => Math.random() - 0.5);
    const nuevasCajas: Alumno[][] = Array.from({ length: numEquipos }, () => []);
    mezclados.forEach((al, index) => {
      nuevasCajas[index % numEquipos].push(al);
    });
    setEquipos(nuevasCajas);
    setAlumnoParaAsignar(null);
  };

  const limpiarEquipos = () => {
    setEquipos(Array.from({ length: numEquipos }, () => []));
    setAlumnoParaAsignar(null);
  };

  const alumnosAsignadosIds = equipos.flat().map(a => a.id);
  const alumnosDisponibles = alumnos.filter(a => !alumnosAsignadosIds.includes(a.id));

  const asignarAEquipo = (indiceEquipo: number) => {
    if (!alumnoParaAsignar) return;
    const nuevosEquipos = [...equipos];
    nuevosEquipos[indiceEquipo].push(alumnoParaAsignar);
    setEquipos(nuevosEquipos);
    setAlumnoParaAsignar(null);
  };

  const removerDeEquipo = (indiceEquipo: number, idAlumno: string) => {
    const nuevosEquipos = [...equipos];
    nuevosEquipos[indiceEquipo] = nuevosEquipos[indiceEquipo].filter(a => a.id !== idAlumno);
    setEquipos(nuevosEquipos);
    setAlumnoParaAsignar(null);
  };

  const exportarDocumentoWord = () => {
    if (!nombreActividad) { alert("Ponle un nombre a la actividad primero."); return; }
    
    let htmlEquipos = equipos.map((eq, i) => `
      <div style="margin-bottom: 20px; page-break-inside: avoid;">
        <h3 style="background-color: #1C51FF; color: white; padding: 8px; border-radius: 4px; margin-bottom: 5px;">Equipo ${i + 1}</h3>
        <ul style="list-style-type: none; padding-left: 10px; margin-top: 5px;">
          ${eq.map(a => `<li style="padding: 4px 0; border-bottom: 1px solid #eee;"><b>${a.studentNumber}.</b> ${a.fullName}</li>`).join('')}
        </ul>
      </div>
    `).join('');

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
      <head><meta charset='utf-8'><title>Equipos de Trabajo</title></head>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="text-align: center; color: #333;">Listas de Equipos para: <span style="color: #1C51FF;">${nombreActividad}</span></h2>
        <hr style="border: 1px solid #ccc; margin-bottom: 20px;" />
        <div style="display: flex; flex-wrap: wrap; gap: 20px;">
          ${htmlEquipos}
        </div>
      </body></html>
    `;
    const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/msword;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Equipos_${nombreActividad.replace(/[^a-zA-Z0-9]/g, '_')}.doc`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="fullscreen-bg" style={{ animation: 'fadeIn 0.3s' }}>
      
      {/* HEADER MEJORADO UX */}
      <div style={{ flexShrink: 0, display: 'flex', gap: '1rem', padding: '1.5rem', width: '100%', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', zIndex: 100, borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>← Salir</button>
          <h3 style={{ margin: 0, color: 'var(--accent-blue)', fontSize: '1.5rem' }}>🧩 Creador de Equipos</h3>
        </div>
        
        <TutorialTooltip mensaje="Genera un documento oficial con la alineación de todos los equipos para imprimir.">
          <button onClick={exportarDocumentoWord} className="pill-btn" style={{ background: '#185ABD', color: 'white', fontSize: '0.95rem', padding: '0.6rem 1.2rem', fontWeight: 'bold' }}>📄 Exportar a Word</button>
        </TutorialTooltip>
      </div>

      <div style={{ padding: '0 1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem', backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold' }}>1. Selecciona Grupo</label>
            <select className="search-input" value={grupoSeleccionado} onChange={e => setGrupoSeleccionado(e.target.value)} style={{ borderLeft: '4px solid var(--accent-blue)', fontWeight: 'bold' }}>
              <option value="">-- Elige un grupo --</option>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.name} - {g.subject}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold' }}>2. Nombre de la Actividad</label>
            <input type="text" className="search-input" placeholder="Ej. Proyecto Final..." value={nombreActividad} onChange={e => setNombreActividad(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold' }}>3. Cantidad de Equipos</label>
            <input type="number" className="search-input" min="2" max="20" value={numEquipos} onChange={e => setNumEquipos(Math.min(20, Math.max(2, Number(e.target.value))))} style={{ maxWidth: '120px' }} />
          </div>
        </div>

        {grupoSeleccionado && (
          <>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <TutorialTooltip mensaje="Crea los equipos aleatoriamente mezclando a todos los alumnos disponibles." posicion="top">
                <button onClick={armarAutomatico} className="pill-btn" style={{ background: 'var(--accent-blue)', color: 'white', padding: '0.8rem 1.5rem', fontSize: '1.1rem', fontWeight: 'bold' }}>🎲 Armar Equipos al Azar</button>
              </TutorialTooltip>
              
              <button onClick={limpiarEquipos} className="pill-btn" style={{ background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)' }}>🗑 Limpiar Todo</button>
            </div>

            <div className="equipos-layout" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
              
              {/* ÁREA DE ALUMNOS DISPONIBLES */}
              <div className="pool-alumnos" style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0, color: 'var(--accent-yellow)', fontSize: '1.2rem' }}>
                    Alumnos Disponibles 
                  </h4>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', backgroundColor: 'var(--bg-input)', padding: '0.3rem 0.8rem', borderRadius: '50px', fontWeight: 'bold' }}>
                    {alumnosDisponibles.length} por asignar
                  </span>
                </div>
                <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  👆 Toca a un alumno para seleccionarlo (se pondrá amarillo) y luego toca la caja del equipo al que lo quieres enviar.
                </p>
                
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  {alumnosDisponibles.map(a => (
                    <TutorialTooltip key={a.id} mensaje={`Selecciona a ${a.fullName.split(' ')[0]} y luego toca un equipo.`}>
                      <div 
                        onClick={() => setAlumnoParaAsignar(alumnoParaAsignar?.id === a.id ? null : a)}
                        style={{ 
                          padding: '0.5rem 1rem', 
                          backgroundColor: alumnoParaAsignar?.id === a.id ? 'var(--accent-yellow)' : 'var(--bg-input)', 
                          color: alumnoParaAsignar?.id === a.id ? '#000' : 'var(--text-main)', 
                          borderRadius: '12px', 
                          border: `2px solid ${alumnoParaAsignar?.id === a.id ? 'var(--accent-yellow)' : 'transparent'}`, 
                          cursor: 'pointer', 
                          fontSize: '0.95rem',
                          fontWeight: 'bold',
                          userSelect: 'none',
                          transition: 'all 0.2s',
                          boxShadow: alumnoParaAsignar?.id === a.id ? '0 4px 10px rgba(255, 193, 7, 0.3)' : 'none',
                          transform: alumnoParaAsignar?.id === a.id ? 'scale(1.05)' : 'none'
                        }}
                      >
                        {a.studentNumber}. {a.fullName.split(' ')[0]} {a.fullName.split(' ')[1] || ''}
                      </div>
                    </TutorialTooltip>
                  ))}
                  {alumnosDisponibles.length === 0 && <div style={{ width: '100%', textAlign: 'center', padding: '2rem', backgroundColor: 'rgba(46, 229, 92, 0.1)', color: 'var(--accent-green)', borderRadius: '12px', fontWeight: 'bold' }}>✅ Todos los alumnos han sido asignados</div>}
                </div>
              </div>

              {/* CAJAS DE EQUIPOS */}
              <div className="equipos-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
                {equipos.map((equipo, index) => (
                  <div 
                    key={index} 
                    className={`equipo-card ${alumnoParaAsignar ? 'selectable' : ''}`}
                    onClick={() => asignarAEquipo(index)}
                    style={{ 
                      backgroundColor: 'var(--bg-panel)', 
                      borderRadius: '16px', 
                      overflow: 'hidden', 
                      border: alumnoParaAsignar ? '2px dashed var(--accent-blue)' : '1px solid var(--border-color)',
                      transition: 'all 0.2s',
                      cursor: alumnoParaAsignar ? 'pointer' : 'default',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div style={{ backgroundColor: 'var(--accent-blue)', color: 'white', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '1.2rem' }}>Equipo {index + 1}</h4>
                      <span style={{ fontSize: '0.8rem', backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.6rem', borderRadius: '50px' }}>{equipo.length} miembros</span>
                    </div>
                    
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '100px' }}>
                      {equipo.map(a => (
                        <div 
                          key={a.id} 
                          onClick={(e) => { e.stopPropagation(); removerDeEquipo(index, a.id); }}
                          style={{ backgroundColor: 'var(--bg-input)', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s' }}
                          title="Clic para remover"
                          onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--accent-red)')}
                          onMouseOut={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                        >
                          <span style={{color: 'var(--text-main)', fontWeight: '500'}}>{a.studentNumber}. {a.fullName.split(' ')[0]} {a.fullName.split(' ')[1] || ''}</span>
                          <span style={{color: 'var(--accent-red)', fontSize: '1.1rem'}}>✖</span>
                        </div>
                      ))}
                      {equipo.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.9rem', margin: 'auto', fontStyle: 'italic' }}>{alumnoParaAsignar ? '👇 Toca para soltar aquí' : 'Caja vacía'}</p>}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}