import { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
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

  useEffect(() => {
    const fetchGrupos = async () => {
      const q = query(collection(db, 'groups'));
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

  const exportarPDF = () => {
    if (!nombreActividad) { alert("Ponle un nombre a la actividad primero."); return; }
    
    let htmlEquipos = equipos.map((eq, i) => `
      <div style="margin-bottom: 20px;">
        <h3 style="background-color: #1C51FF; color: white; padding: 5px;">Equipo ${i + 1}</h3>
        <ul>${eq.map(a => `<li>${a.studentNumber}. ${a.fullName}</li>`).join('')}</ul>
      </div>
    `).join('');

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
      <head><meta charset='utf-8'><title>Equipos</title></head>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="text-align: center;">Listas de Equipos para: ${nombreActividad}</h2>
        <hr/>
        ${htmlEquipos}
      </body></html>
    `;
    const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/msword;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Equipos_${nombreActividad}.doc`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-app)', padding: '1rem', borderRadius: '24px', animation: 'fadeIn 0.3s' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button onClick={onVolver} className="pill-btn" style={{ marginBottom: '0.5rem', background: 'var(--bg-input)', color: 'var(--text-muted)' }}>← Salir de Utilidades</button>
          <h3 style={{ margin: 0, color: 'var(--accent-blue)', fontSize: '1.8rem' }}>🧩 Creador de Equipos</h3>
        </div>
        
        <TutorialTooltip mensaje="Genera un documento oficial con la alineación de todos los equipos para imprimir.">
          <button onClick={exportarPDF} className="pill-btn" style={{ background: 'var(--accent-green)', color: '#000', fontSize: '1rem', padding: '0.8rem 1.5rem' }}>📄 Exportar Documento</button>
        </TutorialTooltip>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem', backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
        <div>
          <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold' }}>1. Selecciona Grupo</label>
          <select className="search-input" value={grupoSeleccionado} onChange={e => setGrupoSeleccionado(e.target.value)}>
            <option value="">-- Elige un grupo --</option>
            {grupos.map(g => <option key={g.id} value={g.id}>{g.name} - {g.subject}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold' }}>2. Nombre de la Actividad</label>
          <input type="text" className="search-input" placeholder="Ej. Proyecto Final" value={nombreActividad} onChange={e => setNombreActividad(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold' }}>3. Cantidad (Máx 20)</label>
          <input type="number" className="search-input" min="2" max="20" value={numEquipos} onChange={e => setNumEquipos(Math.min(20, Math.max(2, Number(e.target.value))))} style={{ maxWidth: '120px' }} />
        </div>
      </div>

      {grupoSeleccionado && (
        <>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <TutorialTooltip mensaje="Crea los equipos aleatoriamente mezclando a todos los alumnos disponibles." posicion="top">
              <button onClick={armarAutomatico} className="pill-btn" style={{ background: 'var(--accent-blue)', color: 'white', padding: '0.8rem 1.5rem' }}>🎲 Armar Aleatorio</button>
            </TutorialTooltip>
            
            <button onClick={limpiarEquipos} className="pill-btn" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>Limpiar Todo</button>
          </div>

          <div className="equipos-layout">
            
            <div className="pool-alumnos">
              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-yellow)', display: 'flex', justifyContent: 'space-between' }}>
                Modo Inteligente 
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{alumnosDisponibles.length} listos</span>
              </h4>
              <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4' }}>
                Toca un alumno y luego toca una caja para asignarlo.
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
                        border: `1px solid ${alumnoParaAsignar?.id === a.id ? 'var(--accent-yellow)' : 'var(--border-color)'}`, 
                        cursor: 'pointer', 
                        fontSize: '0.85rem',
                        userSelect: 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      {a.fullName.split(' ')[0]} {a.fullName.split(' ')[1] || ''}
                    </div>
                  </TutorialTooltip>
                ))}
                {alumnosDisponibles.length === 0 && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', width: '100%', textAlign: 'center', marginTop: '1rem' }}>Todos asignados ✅</span>}
              </div>
            </div>

            <div className="equipos-grid">
              {equipos.map((equipo, index) => (
                <div 
                  key={index} 
                  className={`equipo-card ${alumnoParaAsignar ? 'selectable' : ''}`}
                  onClick={() => asignarAEquipo(index)}
                >
                  <h4 style={{ margin: '0 0 1rem 0', color: 'white', backgroundColor: 'var(--bg-panel)', borderBottom: '2px solid var(--accent-blue)', padding: '0.8rem', borderRadius: '8px', textAlign: 'center', fontSize: '1.1rem' }}>
                    Equipo {index + 1} <span style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', fontWeight: 'normal'}}>{equipo.length} miembros</span>
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {equipo.map(a => (
                      <div 
                        key={a.id} 
                        onClick={(e) => { e.stopPropagation(); removerDeEquipo(index, a.id); }}
                        style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '0.6rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        title="Clic para remover"
                      >
                        <span style={{color: 'var(--text-main)'}}>{a.studentNumber}. {a.fullName.split(' ')[0]} {a.fullName.split(' ')[1] || ''}</span>
                        <span style={{color: 'var(--accent-red)', opacity: 0.6}}>✖</span>
                      </div>
                    ))}
                    {equipo.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem', margin: '1rem 0', fontStyle: 'italic' }}>{alumnoParaAsignar ? '👇 Toca para soltar aquí' : 'Caja vacía'}</p>}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </>
      )}
    </div>
  );
}