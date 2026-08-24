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
  
  // NUEVO: Estado para guardar los nombres personalizados de los equipos
  const [nombresEquipos, setNombresEquipos] = useState<string[]>([]);
  
  const [alumnoParaAsignar, setAlumnoParaAsignar] = useState<Alumno | null>(null);

  useEffect(() => {
    const fetchGrupos = async () => {
      const sessionLocal = localStorage.getItem('aulaPlusSession');
      const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
      const email = sessionData?.user?.email || sessionData?.email || '';

      if (!email) return;

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
      
      // MAGIA UX: Mantiene los nombres editados si solo cambias la cantidad de equipos
      setNombresEquipos(prev => {
        const newNames = Array.from({ length: numEquipos }, (_, i) => `Equipo ${i + 1}`);
        for(let i = 0; i < Math.min(prev.length, numEquipos); i++) {
          newNames[i] = prev[i];
        }
        return newNames;
      });
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
    // Nota: A propósito NO limpiamos los nombres editados para no hacer trabajar doble al maestro
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

  const handleNombreEquipoChange = (index: number, nuevoNombre: string) => {
    const nuevosNombres = [...nombresEquipos];
    nuevosNombres[index] = nuevoNombre;
    setNombresEquipos(nuevosNombres);
  };

  const exportarDocumentoWord = () => {
    if (!nombreActividad) { alert("Ponle un nombre a la actividad primero."); return; }
    
    // Usamos los nombres personalizados o caemos en el default seguro
    let htmlEquipos = equipos.map((eq, i) => `
      <div style="margin-bottom: 20px; page-break-inside: avoid;">
        <h3 style="background-color: #1C51FF; color: white; padding: 8px; border-radius: 4px; margin-bottom: 5px;">${nombresEquipos[i] || `Equipo ${i + 1}`}</h3>
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
      
      {/* Estilos dinámicos para Desktop vs Móvil */}
      <style>{`
        .responsive-grid {
          display: grid;
          grid-template-columns: 1fr; /* Móvil por defecto */
          gap: 2rem;
          align-items: start;
        }
        .alumnos-panel {
          background-color: var(--bg-panel);
          padding: 1.5rem;
          border-radius: 24px;
          border: 1px solid var(--border-color);
          max-height: 250px; /* En móvil, que no sature la pantalla */
          overflow-y: auto;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }
        .input-equipo {
          background: transparent;
          border: none;
          color: white;
          font-size: 1.1rem;
          font-weight: bold;
          outline: none;
          border-bottom: 1px dashed rgba(255,255,255,0.4);
          width: 100%;
          max-width: 160px;
          transition: border-color 0.2s;
        }
        .input-equipo:focus {
          border-bottom: 1px solid white;
        }
        .input-equipo::placeholder {
          color: rgba(255,255,255,0.7);
        }
        @media (min-width: 900px) {
          .responsive-grid {
            grid-template-columns: 320px 1fr; /* Desktop: Alumnos a la izquierda, equipos derecha */
          }
          .alumnos-panel {
            position: sticky;
            top: 20px;
            max-height: calc(100vh - 150px); /* En escritorio ocupa más alto fijo */
          }
        }
      `}</style>

      {/* HEADER */}
      <div style={{ flexShrink: 0, display: 'flex', gap: '1rem', padding: '1rem 1.5rem', width: '100%', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', zIndex: 100, borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '0.4rem 1rem' }}>← Salir</button>
          <h3 style={{ margin: 0, color: 'var(--accent-blue)', fontSize: '1.4rem' }}>🧩 Equipos</h3>
        </div>
        
        <TutorialTooltip mensaje="Genera un documento oficial con la alineación de todos los equipos para imprimir.">
          <button onClick={exportarDocumentoWord} className="pill-btn" style={{ background: '#185ABD', color: 'white', fontSize: '0.95rem', padding: '0.5rem 1rem', fontWeight: 'bold' }}>📄 Exportar a Word</button>
        </TutorialTooltip>
      </div>

      <div style={{ padding: '0 1rem' }}>
        {/* CONFIGURACIÓN */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>1. Selecciona Grupo</label>
            <select className="search-input" value={grupoSeleccionado} onChange={e => setGrupoSeleccionado(e.target.value)} style={{ borderLeft: '4px solid var(--accent-blue)', fontWeight: 'bold', margin: 0 }}>
              <option value="">-- Elige un grupo --</option>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.name} - {g.subject}</option>)}
            </select>
          </div>
          <div style={{ flex: 2, minWidth: '200px' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>2. Actividad</label>
            <input type="text" className="search-input" placeholder="Ej. Proyecto Final..." value={nombreActividad} onChange={e => setNombreActividad(e.target.value)} style={{ margin: 0 }} />
          </div>
          <div style={{ width: '100px' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>3. Equipos</label>
            <input type="number" className="search-input" min="2" max="20" value={numEquipos} onChange={e => setNumEquipos(Math.min(20, Math.max(2, Number(e.target.value))))} style={{ margin: 0 }} />
          </div>
        </div>

        {grupoSeleccionado && (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <TutorialTooltip mensaje="Crea los equipos aleatoriamente mezclando a todos los alumnos disponibles." posicion="top">
                <button onClick={armarAutomatico} className="pill-btn" style={{ background: 'var(--accent-blue)', color: 'white', padding: '0.6rem 1rem', fontSize: '1rem', fontWeight: 'bold' }}>🎲 Armar al Azar</button>
              </TutorialTooltip>
              
              <button onClick={limpiarEquipos} className="pill-btn" style={{ background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', padding: '0.6rem 1rem' }}>🗑 Limpiar</button>
            </div>

            <div className="responsive-grid">
              
              {/* COLUMNA IZQUIERDA (O ARRIBA EN MÓVIL): ALUMNOS DISPONIBLES */}
              <div className="alumnos-panel custom-scrollbar">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0, color: 'var(--accent-yellow)', fontSize: '1.1rem' }}>Alumnos Disponibles</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', backgroundColor: 'var(--bg-input)', padding: '0.2rem 0.6rem', borderRadius: '50px', fontWeight: 'bold' }}>
                    {alumnosDisponibles.length} por asignar
                  </span>
                </div>
                <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.3' }}>
                  👆 Toca un alumno, luego toca el equipo destino.
                </p>
                
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {alumnosDisponibles.map(a => (
                    <TutorialTooltip key={a.id} mensaje={`Selecciona a ${a.fullName.split(' ')[0]} y luego toca un equipo.`}>
                      <div 
                        onClick={() => setAlumnoParaAsignar(alumnoParaAsignar?.id === a.id ? null : a)}
                        style={{ 
                          padding: '0.4rem 0.8rem', 
                          backgroundColor: alumnoParaAsignar?.id === a.id ? 'var(--accent-yellow)' : 'var(--bg-input)', 
                          color: alumnoParaAsignar?.id === a.id ? '#000' : 'var(--text-main)', 
                          borderRadius: '8px', 
                          border: `2px solid ${alumnoParaAsignar?.id === a.id ? 'var(--accent-yellow)' : 'transparent'}`, 
                          cursor: 'pointer', 
                          fontSize: '0.85rem',
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
                  {alumnosDisponibles.length === 0 && <div style={{ width: '100%', textAlign: 'center', padding: '1rem', backgroundColor: 'rgba(46, 229, 92, 0.1)', color: 'var(--accent-green)', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem' }}>✅ Todos asignados</div>}
                </div>
              </div>

              {/* COLUMNA DERECHA (O ABAJO EN MÓVIL): CAJAS DE EQUIPOS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
                {equipos.map((equipo, index) => (
                  <div 
                    key={index} 
                    className={alumnoParaAsignar ? 'selectable' : ''}
                    onClick={() => asignarAEquipo(index)}
                    style={{ 
                      backgroundColor: 'var(--bg-panel)', 
                      borderRadius: '16px', 
                      overflow: 'hidden', 
                      border: alumnoParaAsignar ? '2px dashed var(--accent-blue)' : '1px solid var(--border-color)',
                      transition: 'all 0.2s',
                      cursor: alumnoParaAsignar ? 'pointer' : 'default',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ backgroundColor: 'var(--accent-blue)', color: 'white', padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <TutorialTooltip mensaje="Toca aquí para personalizar el nombre del equipo (Ej. Los Halcones).">
                        <input 
                          type="text" 
                          className="input-equipo"
                          value={nombresEquipos[index] || ''} 
                          onChange={e => handleNombreEquipoChange(index, e.target.value)}
                          placeholder={`Equipo ${index + 1}`}
                          title="Toca para editar nombre"
                        />
                      </TutorialTooltip>
                      <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.3rem 0.6rem', borderRadius: '50px', fontWeight: 'bold' }}>{equipo.length}</span>
                    </div>
                    
                    <div style={{ padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', minHeight: '80px' }}>
                      {equipo.map(a => (
                        <div 
                          key={a.id} 
                          onClick={(e) => { e.stopPropagation(); removerDeEquipo(index, a.id); }}
                          style={{ backgroundColor: 'var(--bg-input)', padding: '0.5rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s' }}
                          title="Clic para remover"
                          onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--accent-red)')}
                          onMouseOut={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                        >
                          <span style={{color: 'var(--text-main)', fontWeight: '500'}}>{a.studentNumber}. {a.fullName.split(' ')[0]} {a.fullName.split(' ')[1] || ''}</span>
                          <span style={{color: 'var(--accent-red)', fontSize: '1rem', opacity: 0.8}}>✖</span>
                        </div>
                      ))}
                      {equipo.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.8rem', margin: 'auto', fontStyle: 'italic' }}>{alumnoParaAsignar ? '👇 Suelta aquí' : 'Caja vacía'}</p>}
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