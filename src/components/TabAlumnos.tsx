import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, query, orderBy, serverTimestamp, writeBatch, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { IconoVisual, IconoAuditivo, IconoLectura, IconoKinestesico } from './IconosVARK';
import TutorialTooltip from './TutorialTooltip';

interface VarkState { v: boolean; a: boolean; r: boolean; k: boolean; }
interface Alumno { id: string; fullName: string; studentNumber: number; vark: VarkState; }

export default function TabAlumnos({ idGrupo, nombreGrupo, onVarkChange }: { idGrupo: string, nombreGrupo: string, onVarkChange: (data: any) => void }) {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [cicloEscolar, setCicloEscolar] = useState('2026-2027');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [mostrarVark, setMostrarVark] = useState(false);
  const [modalExportar, setModalExportar] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState('');

  useEffect(() => {
    getDoc(doc(db, 'groups', idGrupo)).then(snap => { if(snap.exists()) setCicloEscolar(snap.data().schoolYear); });
    const q = query(collection(db, `groups/${idGrupo}/students`), orderBy('studentNumber', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const lista: Alumno[] = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        lista.push({ id: doc.id, fullName: d.fullName, studentNumber: d.studentNumber, vark: d.vark ?? { v: false, a: false, r: false, k: false } });
      });
      setAlumnos(lista);
    });
  }, [idGrupo]);

  useEffect(() => {
    let v = 0, a = 0, r = 0, k = 0;
    alumnos.forEach(al => { if (al.vark.v) v++; if (al.vark.a) a++; if (al.vark.r) r++; if (al.vark.k) k++; });
    onVarkChange({ visible: mostrarVark, v, a, r, k });
  }, [alumnos, mostrarVark]);

  const reordenarYRenumerar = async (listaCompleta: Alumno[]) => {
    const batch = writeBatch(db);
    listaCompleta.sort((a, b) => a.fullName.localeCompare(b.fullName));
    listaCompleta.forEach((alumno, index) => {
      const numeroLista = index + 1;
      const ref = doc(db, `groups/${idGrupo}/students`, alumno.id);
      if (alumno.studentNumber !== numeroLista) batch.update(ref, { studentNumber: numeroLista });
    });
    await batch.commit();
  };

  const procesarLista = async (nombresNuevos: string[]) => {
    setProcesando(true);
    try {
      const batch = writeBatch(db);
      const actuales = alumnos.map(a => a.fullName);
      const unicos = Array.from(new Set(nombresNuevos.map(n => n.trim().toUpperCase())));
      const filtrados = unicos.filter(n => n !== '' && n !== 'NOMBRE').filter(n => !actuales.includes(n)); 
      if (filtrados.length === 0) { alert("Sin nombres válidos nuevos."); setProcesando(false); return; }

      const listaCombinada = [...alumnos, ...filtrados.map(n => ({ id: '', fullName: n, studentNumber: 0, vark: {v:false, a:false, r:false, k:false} }))];
      listaCombinada.sort((a, b) => a.fullName.localeCompare(b.fullName));

      listaCombinada.forEach((alumno, index) => {
        const numero = index + 1;
        if (alumno.id) {
          if (alumno.studentNumber !== numero) batch.update(doc(db, `groups/${idGrupo}/students`, alumno.id), { studentNumber: numero });
        } else {
          const nuevaRef = doc(collection(db, `groups/${idGrupo}/students`));
          batch.set(nuevaRef, { fullName: alumno.fullName, studentNumber: numero, vark: { v: false, a: false, r: false, k: false }, active: true, createdAt: serverTimestamp() });
        }
      });
      await batch.commit();
      setNuevoNombre('');
    } catch (e) { alert("Error al guardar."); }
    setProcesando(false);
  };

  const agregarManual = (e: React.FormEvent) => { e.preventDefault(); procesarLista([nuevoNombre]); };
  
  const importarCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = text.split(/\r?\n/);
      const nombresCsv = rows.map(r => { const c = r.split(','); return c.length > 1 ? c[1] : c[0]; });
      procesarLista(nombresCsv);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const guardarEdicion = async (id: string) => {
    if(!nombreEditado.trim()) return;
    setProcesando(true);
    await writeBatch(db).update(doc(db, `groups/${idGrupo}/students`, id), { fullName: nombreEditado.toUpperCase() }).commit();
    const act = alumnos.map(a => a.id === id ? { ...a, fullName: nombreEditado.toUpperCase() } : a);
    await reordenarYRenumerar(act);
    setEditandoId(null); setProcesando(false);
  };

  const eliminarAlumno = async (id: string, nombre: string) => {
    if(!window.confirm(`¿Eliminar a ${nombre}?`)) return;
    setProcesando(true);
    await deleteDoc(doc(db, `groups/${idGrupo}/students`, id));
    await reordenarYRenumerar(alumnos.filter(a => a.id !== id));
    setProcesando(false);
  };

  const eliminarListaCompleta = async () => {
    if(!window.confirm(`⚠️ ELIMINAR TODOS. ¿Seguro?`)) return;
    setProcesando(true);
    const batch = writeBatch(db);
    alumnos.forEach(a => batch.delete(doc(db, `groups/${idGrupo}/students`, a.id)));
    await batch.commit(); setProcesando(false);
  };

  const toggleVark = async (id: string, actualVark: VarkState, tipo: keyof VarkState) => {
    await updateDoc(doc(db, `groups/${idGrupo}/students`, id), { [`vark.${tipo}`]: !actualVark[tipo] });
  };

  // EXPORTACIÓN OFICIAL MEMBRETADA
  const descargarCSV = (tipo: 'sencilla' | 'vark') => {
    const perfilStr = localStorage.getItem('aulaPlusPerfil');
    const p = perfilStr ? JSON.parse(perfilStr) : { nombre: 'Docente', escuela: 'Escuela Secundaria Técnica' };
    
    let csvContent = `\uFEFF`;
    csvContent += `SISTEMA EDUCATIVO NACIONAL\n`;
    csvContent += `INSTITUTO DE LA EDUCACIÓN BÁSICA DEL ESTADO DE MORELOS (IEBEM)\n`;
    csvContent += `DIRECCIÓN DE EDUCACIÓN SECUNDARIA\n\n`;
    csvContent += `Escuela:,${p.escuela}\n`;
    csvContent += `Profesor:,${p.nombre}\n`;
    csvContent += `Grupo:,${nombreGrupo}\n`;
    csvContent += `Ciclo Escolar:,${cicloEscolar}\n\n`;
    
    if(tipo === 'vark') {
      csvContent += "No. Lista,Nombre Completo,Visual,Auditivo,Lectoescritura,Kinestesico\n";
      alumnos.forEach(a => { csvContent += `${a.studentNumber},${a.fullName},${a.vark.v ? 'X' : ''},${a.vark.a ? 'X' : ''},${a.vark.r ? 'X' : ''},${a.vark.k ? 'X' : ''}\n`; });
    } else {
      csvContent += "No. Lista,Nombre Completo\n";
      alumnos.forEach(a => { csvContent += `${a.studentNumber},${a.fullName}\n`; });
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Lista_Oficial_${nombreGrupo.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setModalExportar(false);
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>{alumnos.length} Alumnos inscritos oficiales</p>
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
          
          {/* BOTONES BLANQUECINOS MEJORADOS UX */}
          <TutorialTooltip mensaje="Evalúa a tus alumnos y genera una gráfica general para tu plan de atención.">
            <button 
              onClick={() => setMostrarVark(!mostrarVark)} 
              className="pill-btn" 
              style={{ backgroundColor: mostrarVark ? 'var(--accent-blue)' : '#f4f7f6', color: mostrarVark ? 'white' : '#333', border: `1px solid ${mostrarVark ? 'var(--accent-blue)' : '#d1d5db'}`, fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
            >
              🧠 Estilos VARK
            </button>
          </TutorialTooltip>

          <TutorialTooltip mensaje="Descarga la lista oficial en formato Excel (.csv) para imprimirla o compartirla.">
            <button 
              onClick={() => setModalExportar(true)} 
              className="pill-btn" 
              style={{ backgroundColor: '#f4f7f6', color: '#333', border: '1px solid #d1d5db', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', opacity: alumnos.length === 0 ? 0.5 : 1 }} 
              disabled={alumnos.length === 0}
            >
              ⬇️ Exportar Lista
            </button>
          </TutorialTooltip>

          <TutorialTooltip mensaje="Carga todos tus alumnos desde un archivo Excel (CSV) para evitar copiarlos a mano.">
            <div className="file-upload-wrapper">
              <button className="pill-btn" style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', fontWeight: 'bold' }}>
                {procesando ? 'Cargando...' : '📥 Subir CSV'}
              </button>
              <input type="file" accept=".csv" onChange={importarCSV} disabled={procesando} />
            </div>
          </TutorialTooltip>

        </div>
      </div>

      <form onSubmit={agregarManual} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <input type="text" className="search-input" placeholder="Escribe el nombre y presiona Enter..." value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} style={{ flex: 1 }} />
        <TutorialTooltip mensaje="Añade estudiantes individuales. Se ordenarán y renumerarán automáticamente.">
          <button type="submit" disabled={procesando || !nuevoNombre.trim()} className="pill-btn" style={{ backgroundColor: 'var(--accent-blue)', color: 'white' }}>Agregar</button>
        </TutorialTooltip>
      </form>

      <div style={{ backgroundColor: 'var(--bg-panel)', borderRadius: '24px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ margin: 0, color: 'var(--text-muted)' }}>Lista de Alumnos Oficial</h4>
          {alumnos.length > 0 && <button onClick={eliminarListaCompleta} className="pill-btn" style={{ backgroundColor: 'transparent', color: 'var(--accent-red)' }}>⚠️ Vaciar</button>}
        </div>
        
        {alumnos.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Sube tu archivo o ingresa el primer nombre.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {alumnos.map((a) => (
              <div key={a.id} className="student-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600, width: '30px' }}>{a.studentNumber.toString().padStart(2, '0')}</span>
                  {editandoId === a.id ? (
                    <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                      <input type="text" className="search-input" value={nombreEditado} onChange={e => setNombreEditado(e.target.value)} autoFocus/>
                      <button onClick={() => guardarEdicion(a.id)} className="pill-btn" style={{ background: 'var(--accent-green)', color: '#000' }}>OK</button>
                      <button onClick={() => setEditandoId(null)} className="pill-btn" style={{ background: 'var(--bg-input)', color: 'white' }}>X</button>
                    </div>
                  ) : (<span style={{ fontWeight: 500 }}>{a.fullName}</span>)}
                </div>

                <div className="student-actions" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                  {mostrarVark && (
                    <div style={{ display: 'flex', gap: '0.8rem', backgroundColor: 'var(--bg-app)', padding: '0.3rem 0.8rem', borderRadius: '50px' }}>
                      <IconoVisual active={a.vark.v} onClick={() => toggleVark(a.id, a.vark, 'v')} />
                      <IconoAuditivo active={a.vark.a} onClick={() => toggleVark(a.id, a.vark, 'a')} />
                      <IconoLectura active={a.vark.r} onClick={() => toggleVark(a.id, a.vark, 'r')} />
                      <IconoKinestesico active={a.vark.k} onClick={() => toggleVark(a.id, a.vark, 'k')} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.8rem' }}>
                    <button onClick={() => { setEditandoId(a.id); setNombreEditado(a.fullName); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✏️</button>
                    <button onClick={() => eliminarAlumno(a.id, a.fullName)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalExportar && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginTop: 0, fontSize: '1.4rem' }}>Exportar Lista (Formato SEP/IEBEM)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={() => descargarCSV('sencilla')} className="pill-btn" style={{ backgroundColor: 'var(--bg-input)', color: 'white', padding: '1rem' }}>📄 Descargar Solo Nombres</button>
              <button onClick={() => descargarCSV('vark')} className="pill-btn" style={{ backgroundColor: 'var(--accent-blue)', color: 'white', padding: '1rem' }}>🧠 Descargar con Diagnóstico VARK</button>
              <button onClick={() => setModalExportar(false)} className="pill-btn" style={{ backgroundColor: 'transparent', color: 'var(--text-muted)' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}