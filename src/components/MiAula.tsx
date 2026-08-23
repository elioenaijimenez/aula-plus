import { useState, useEffect } from 'react';
// CORRECCIÓN: Agregamos setDoc a la importación
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDoc, getDocs, where, orderBy, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import CalificarEvidencia from './CalificarEvidencia';
import TutorialTooltip from './TutorialTooltip';

// --- INTERFACES ---
interface Evidencia { 
  id: string; titulo: string; descripcion: string; tipo: string;
  enlaceDrive: string; publicada: boolean; vistas: number; likes: number;
  puntajeMinimo: number; puntajeMaximo: number; fechaActividad: string; 
  trimestre: string; numero?: number; createdAt?: any; calificaciones?: Record<string, number>; 
}

interface Recurso { 
  id: string; titulo: string; descripcion: string; url: string; 
  categoria: string; grado?: string; campoFormativo?: string; docenteEmail?: string; isGlobal?: boolean;
}

// --- HELPERS DE DISEÑO PARA BIBLIOTECA Y DRIVE ---
const obtenerEstiloCategoria = (categoria: string) => {
  switch (categoria) {
    case 'LTG': return { icon: '📚', color: '#4CAF50', bg: 'rgba(76, 175, 80, 0.1)' }; 
    case 'Curricular': return { icon: '📖', color: '#9C27B0', bg: 'rgba(156, 39, 176, 0.1)' }; 
    case 'Rincón de Lectura': return { icon: '☕', color: '#FF9800', bg: 'rgba(255, 152, 0, 0.1)' }; 
    case 'Formatos para ti': return { icon: '📝', color: '#E91E63', bg: 'rgba(233, 30, 99, 0.1)' }; 
    case 'Normativo Nacional': return { icon: '⚖️', color: '#1C51FF', bg: 'rgba(28, 81, 255, 0.1)' }; 
    case 'Normativo Estatal': return { icon: '📍', color: '#00BFA5', bg: 'rgba(0, 191, 165, 0.1)' }; 
    case 'Mi Drive (Privado)': return { icon: '📂', color: '#185ABD', bg: 'rgba(24, 90, 189, 0.1)' }; 
    default: return { icon: '📄', color: '#757575', bg: 'rgba(117, 117, 117, 0.1)' }; 
  }
};

const obtenerColorGrado = (grado?: string) => {
  if (grado === '1° Secundaria') return '#4CAF50';
  if (grado === '2° Secundaria') return '#1C51FF';
  if (grado === '3° Secundaria') return '#FF4D4F';
  return '#757575';
};

const TextoExpandible = ({ texto }: { texto: string }) => {
  const [expandido, setExpandido] = useState(false);
  if (!texto) return null;
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '0.5rem', cursor: 'default' }}>
      <p style={{ display: '-webkit-box', WebkitLineClamp: expandido ? 'unset' : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
        {texto}
      </p>
      {texto.length > 60 && (
        <button onClick={(e) => { e.stopPropagation(); setExpandido(!expandido); }} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '0.85rem', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}>
          {expandido ? 'Leer menos' : 'Leer más...'}
        </button>
      )}
    </div>
  );
};

const BotonEstrella = ({ esFavorito, onToggle }: { esFavorito: boolean, onToggle: (e: React.MouseEvent) => void }) => {
  return (
    <button onClick={onToggle} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', zIndex: 10, padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }} title={esFavorito ? "Quitar de favoritos" : "Añadir a favoritos"}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill={esFavorito ? "#FFC107" : "none"} stroke="#FFC107" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
};

export default function MiAula({ idGrupo, nombreGrupo, onVolver }: { idGrupo: string, nombreGrupo: string, onVolver: () => void }) {
  // Estados Generales
  const [vista, setVista] = useState<'panel' | 'formulario' | 'calificar'>('panel');
  const [tab, setTab] = useState<'actividades' | 'biblioteca' | 'drive'>('actividades');
  
  // CORRECCIÓN: Quitamos setUserEmail porque no se usa para modificar el estado, solo lo leemos.
  const [userEmail] = useState(() => {
    const sessionLocal = localStorage.getItem('aulaPlusSession');
    return sessionLocal ? (JSON.parse(sessionLocal)?.user?.email || JSON.parse(sessionLocal)?.email || '') : '';
  });
  
  // Estados Actividades
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [evidenciaActiva, setEvidenciaActiva] = useState<Evidencia | null>(null);
  const [pizarraCode, setPizarraCode] = useState<string>('Generando...');
  const [filtroTrimestre, setFiltroTrimestre] = useState<'Todos' | '1' | '2' | '3'>('Todos');
  
  // Estados Formulario Actividades
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState('Tarea');
  const [tipoOtro, setTipoOtro] = useState('');
  const [enlaceDrive, setEnlaceDrive] = useState('');
  const [puntajeMin, setPuntajeMin] = useState(5);
  const [puntajeMax, setPuntajeMax] = useState(10);
  const [trimestre, setTrimestre] = useState('1'); 
  const [publicada, setPublicada] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [fechaActividad, setFechaActividad] = useState(() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().split('T')[0]; });

  // Estados Biblioteca y Drive
  const [recursosGlobales, setRecursosGlobales] = useState<Recurso[]>([]);
  const [misRecursos, setMisRecursos] = useState<Recurso[]>([]);
  const [favoritosIds, setFavoritosIds] = useState<string[]>([]);
  const [cargandoRecursos, setCargandoRecursos] = useState(false);
  
  // Formulario Drive
  const [creandoDrive, setCreandoDrive] = useState(false);
  const [recursoEditando, setRecursoEditando] = useState<Recurso | null>(null);
  const [nuevoTituloDrive, setNuevoTituloDrive] = useState('');
  const [nuevaUrlDrive, setNuevaUrlDrive] = useState('');
  const [nuevaDescDrive, setNuevaDescDrive] = useState('');

  useEffect(() => {
    // 1. Inicializar Pizarra Code
    const inicializarPizarra = async () => {
      const refGrupo = doc(db, 'groups', idGrupo);
      const docSnap = await getDoc(refGrupo);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.pizarraCode) {
          setPizarraCode(data.pizarraCode);
        } else {
          // Genera una clave aleatoria corta (ej. AULA-Y6T9)
          const newCode = 'AULA-' + Math.random().toString(36).substring(2, 6).toUpperCase();
          await updateDoc(refGrupo, { pizarraCode: newCode });
          setPizarraCode(newCode);
        }
      }
    };
    inicializarPizarra();

    // 2. Cargar Actividades
    const qActs = query(collection(db, `groups/${idGrupo}/evidences`));
    const desuscribirActs = onSnapshot(qActs, (snapshot) => {
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
    return () => desuscribirActs();
  }, [idGrupo]);

  useEffect(() => {
    // 3. Cargar Biblioteca Favoritos y Drive Personal
    const fetchRecursos = async () => {
      setCargandoRecursos(true);
      if (userEmail) {
        try {
          const favDoc = await getDoc(doc(db, 'teacher_favorites', userEmail));
          if (favDoc.exists()) setFavoritosIds(favDoc.data().ids || []);
          
          const qDrive = query(collection(db, 'teacher_drive'), where('docenteEmail', '==', userEmail));
          const snapDrive = await getDocs(qDrive);
          const listaDrive: Recurso[] = [];
          snapDrive.forEach(d => listaDrive.push({ id: d.id, ...d.data(), categoria: 'Mi Drive (Privado)', isGlobal: false } as Recurso));
          listaDrive.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setMisRecursos(listaDrive);
        } catch (e) { console.error("Error cargando Drive/Favs", e); }
      }
      try {
        const qGlobal = query(collection(db, 'global_library'), orderBy('createdAt', 'desc'));
        const snapGlobal = await getDocs(qGlobal);
        const listaGlobal: Recurso[] = [];
        snapGlobal.forEach(d => listaGlobal.push({ id: d.id, ...d.data(), isGlobal: true } as Recurso));
        setRecursosGlobales(listaGlobal);
      } catch (e) { console.error("Error cargando Biblioteca Global", e); }
      setCargandoRecursos(false);
    };
    fetchRecursos();
  }, [userEmail]);

  // --- LÓGICA ACTIVIDADES ---
  const abrirFormulario = (ev?: Evidencia) => {
    if (ev) {
      setEditandoId(ev.id); setTitulo(ev.titulo); setDescripcion(ev.descripcion);
      setEnlaceDrive(ev.enlaceDrive || ''); setPublicada(ev.publicada ?? true);
      setPuntajeMin(ev.puntajeMinimo || 5); setPuntajeMax(ev.puntajeMaximo || 10);
      setFechaActividad(ev.fechaActividad); setTrimestre(ev.trimestre);
      if (['Tarea', 'Trabajo en clase', 'Anotación', 'Proyecto'].includes(ev.tipo)) { setTipo(ev.tipo); setTipoOtro(''); } 
      else { setTipo('Otro'); setTipoOtro(ev.tipo); }
    } else {
      setEditandoId(null); setTitulo(''); setDescripcion(''); setEnlaceDrive(''); setPublicada(true);
      setTipo('Tarea'); setTipoOtro(''); setPuntajeMin(5); setPuntajeMax(10);
      setFechaActividad(() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().split('T')[0]; });
      setTrimestre('1');
    }
    setVista('formulario');
  };

  const guardarEvidencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(puntajeMin) >= Number(puntajeMax)) { alert("El máximo debe ser mayor al mínimo."); return; }
    const tipoFinal = tipo === 'Otro' ? tipoOtro : tipo;
    if (!tipoFinal.trim()) { alert("Especifica el tipo de actividad."); return; }

    setGuardando(true);
    const datosEvidencia = { 
      titulo, descripcion, tipo: tipoFinal, enlaceDrive, publicada,
      puntajeMinimo: Number(puntajeMin), puntajeMaximo: Number(puntajeMax), fechaActividad, trimestre 
    };
    
    try {
      if (editandoId) await updateDoc(doc(db, `groups/${idGrupo}/evidences`, editandoId), datosEvidencia); 
      else await addDoc(collection(db, `groups/${idGrupo}/evidences`), { ...datosEvidencia, createdAt: serverTimestamp(), calificaciones: {}, vistas: 0, likes: 0 }); 
      setVista('panel');
    } catch (error) { alert("Error al guardar."); }
    setGuardando(false);
  };

  const eliminarEvidencia = async (id: string, nombre: string) => {
    if(window.confirm(`⚠️ ¿Eliminar permanentemente "${nombre}"? Los alumnos ya no podrán verla.`)) await deleteDoc(doc(db, `groups/${idGrupo}/evidences`, id));
  };

  const togglePublicacion = async (id: string, estadoActual: boolean) => {
    await updateDoc(doc(db, `groups/${idGrupo}/evidences`, id), { publicada: !estadoActual });
  };

  // --- LÓGICA DRIVE Y FAVORITOS ---
  const toggleFavorito = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    const nuevosFavs = favoritosIds.includes(id) ? favoritosIds.filter(favId => favId !== id) : [...favoritosIds, id];
    setFavoritosIds(nuevosFavs);
    if (userEmail) {
      try { await setDoc(doc(db, 'teacher_favorites', userEmail), { ids: nuevosFavs }, { merge: true }); } 
      catch (error) { console.error("Error al guardar favoritos", error); }
    }
  };

  const guardarNuevoDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaUrlDrive || (!nuevaUrlDrive.startsWith('http://') && !nuevaUrlDrive.startsWith('https://'))) { alert('Enlace inválido.'); return; }
    setGuardando(true);
    try {
      const nuevoDoc = { titulo: nuevoTituloDrive, descripcion: nuevaDescDrive, url: nuevaUrlDrive, docenteEmail: userEmail, categoria: 'Mi Drive (Privado)', createdAt: serverTimestamp() };
      const docRef = await addDoc(collection(db, 'teacher_drive'), nuevoDoc);
      setMisRecursos([{ id: docRef.id, ...nuevoDoc, isGlobal: false } as Recurso, ...misRecursos]);
      setCreandoDrive(false);
    } catch (error) { alert("Error al guardar en Drive."); }
    setGuardando(false);
  };

  const guardarEdicionDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recursoEditando) return;
    if (!recursoEditando.url.startsWith('http://') && !recursoEditando.url.startsWith('https://')) { alert('Enlace inválido.'); return; }
    setGuardando(true);
    try {
      await updateDoc(doc(db, 'teacher_drive', recursoEditando.id), { titulo: recursoEditando.titulo, descripcion: recursoEditando.descripcion, url: recursoEditando.url });
      setMisRecursos(misRecursos.map(r => r.id === recursoEditando.id ? recursoEditando : r));
      setRecursoEditando(null);
    } catch (error) { alert("Error al editar."); }
    setGuardando(false);
  };

  const eliminarDrive = async (id: string) => {
    if (window.confirm("¿Eliminar permanentemente de tu Drive privado?")) {
      try { await deleteDoc(doc(db, 'teacher_drive', id)); setMisRecursos(misRecursos.filter(r => r.id !== id)); } 
      catch (error) { alert("No se pudo eliminar."); }
    }
  };

  const abrirRecurso = (url: string) => { if (url) window.open(url, '_blank'); else alert('Enlace inválido.'); };

  // --- RENDERIZADO PRINCIPAL ---
  if (vista === 'calificar' && evidenciaActiva) return <CalificarEvidencia idGrupo={idGrupo} evidencia={evidenciaActiva as any} onVolver={() => setVista('panel')} />;
  
  if (vista === 'formulario') {
    return (
      <div style={{ animation: 'fadeIn 0.3s' }}>
        <button onClick={() => setVista('panel')} className="pill-btn" style={{ marginBottom: '1rem', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>← Volver al Aula</button>
        <form onSubmit={guardarEvidencia} style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent-purple)' }}>{editandoId ? '✏️ Editar Actividad' : '✨ Crear Nueva Actividad'}</h3>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '250px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Título de la Actividad</label>
              <input type="text" className="search-input" required value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej. Resumen de la Revolución..." style={{ borderLeft: '4px solid var(--accent-purple)' }}/>
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Fecha de Aplicación</label>
              <input type="date" className="search-input" required value={fechaActividad} onChange={e => setFechaActividad(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Tipo de Actividad</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: tipo === 'Otro' ? '0.8rem' : '0' }}>
              {['Tarea', 'Trabajo en clase', 'Anotación', 'Proyecto', 'Otro'].map(t => (
                <div key={t} onClick={() => setTipo(t)} style={{ padding: '0.5rem 1rem', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.2s', border: tipo === t ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)', backgroundColor: tipo === t ? 'rgba(28, 81, 255, 0.1)' : 'transparent', color: tipo === t ? 'var(--accent-blue)' : 'var(--text-muted)' }}>{t}</div>
              ))}
            </div>
            {tipo === 'Otro' && <input type="text" className="search-input" required placeholder="Especificar..." value={tipoOtro} onChange={e => setTipoOtro(e.target.value)} style={{ animation: 'fadeIn 0.2s' }} />}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Instrucciones para el Alumno</label>
            <textarea className="search-input" required value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Escribe aquí las instrucciones detalladas que verá el alumno..." style={{ minHeight: '80px', resize: 'vertical' }} />
          </div>

          <div style={{ backgroundColor: 'rgba(28, 81, 255, 0.05)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(28, 81, 255, 0.2)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--accent-blue)', fontWeight: 'bold' }}><span>🔗 Documento PDF de Apoyo (Drive) - Opcional</span></label>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>💡 <b>Ayuda rápida:</b> Sube tu archivo a Google Drive, compártelo como <b>"Cualquier usuario con el enlace"</b> y pégalo aquí abajo.</p>
            <input type="url" className="search-input" value={enlaceDrive} onChange={e => setEnlaceDrive(e.target.value)} placeholder="https://drive.google.com/file/d/..." />
          </div>

          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', backgroundColor: 'var(--bg-app)', padding: '1.5rem', borderRadius: '16px' }}>
            <div style={{ flex: 1, minWidth: '150px' }}><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Trimestre</label><select className="search-input" value={trimestre} onChange={e => setTrimestre(e.target.value)}><option value="1">Trimestre 1</option><option value="2">Trimestre 2</option><option value="3">Trimestre 3</option></select></div>
            <div style={{ flex: 1, minWidth: '100px' }}><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Cal. Mínima</label><input type="number" className="search-input" required value={puntajeMin} onChange={e => setPuntajeMin(Number(e.target.value))} min="0" /></div>
            <div style={{ flex: 1, minWidth: '100px' }}><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Cal. Máxima</label><input type="number" className="search-input" required value={puntajeMax} onChange={e => setPuntajeMax(Number(e.target.value))} min="1" style={{ borderColor: 'var(--accent-yellow)' }} /></div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={publicada} onChange={e => setPublicada(e.target.checked)} style={{ transform: 'scale(1.5)' }} />
              <span style={{ fontWeight: 'bold', color: publicada ? 'var(--accent-green)' : 'var(--text-muted)' }}>{publicada ? '📢 Visible en la Pizarra Alumno' : '🙈 Oculto (Borrador)'}</span>
            </label>
            <button type="submit" disabled={guardando} className="pill-btn" style={{ background: 'var(--accent-purple)', color: 'white', padding: '1rem 3rem', fontSize: '1.1rem' }}>{guardando ? 'Guardando...' : '💾 Guardar Actividad'}</button>
          </div>
        </form>
      </div>
    );
  }

  const evidenciasFiltradas = filtroTrimestre === 'Todos' ? evidencias : evidencias.filter(e => e.trimestre === filtroTrimestre);
  const librosFavoritos = recursosGlobales.filter(r => favoritosIds.includes(r.id));

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      <style>{`
        .switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0;}
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .3s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--accent-green); }
        input:checked + .slider:before { transform: translateX(18px); }
        .biblioteca-card { transition: all 0.3s ease; border: 1px solid var(--border-color); }
        .biblioteca-card:hover { box-shadow: 0 4px 20px var(--glow-color-shadow); border-color: var(--glow-color-border); transform: translateY(-3px); }
      `}</style>

      {/* HEADER MI AULA */}
      <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button onClick={onVolver} className="pill-btn" style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginBottom: '1rem', padding: '0.3rem 0.8rem' }}>← Salir del Aula</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '2.5rem' }}>🎓</span>
            <div><h2 style={{ margin: 0, color: 'var(--accent-purple)', fontSize: '2rem' }}>Mi Aula Virtual</h2><p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '1rem' }}>Grupo {nombreGrupo}</p></div>
          </div>
        </div>
        <div style={{ textAlign: 'right', backgroundColor: 'rgba(28, 81, 255, 0.05)', padding: '1rem', borderRadius: '16px', border: '1px dashed var(--accent-blue)' }}>
          <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Clave de Acceso Alumnos:</span>
          <strong style={{ fontSize: '1.5rem', color: 'var(--accent-blue)', letterSpacing: '2px' }}>{pizarraCode}</strong>
        </div>
      </div>

      {/* TABS DE NAVEGACIÓN */}
      <div className="tabs-nav" style={{ marginBottom: '2rem' }}>
        <span className={`tab ${tab === 'actividades' ? 'active' : ''}`} onClick={() => setTab('actividades')} style={{ borderBottomColor: tab === 'actividades' ? 'var(--accent-purple)' : '' }}>📋 Gestor de Actividades</span>
        <span className={`tab ${tab === 'biblioteca' ? 'active' : ''}`} onClick={() => setTab('biblioteca')} style={{ borderBottomColor: tab === 'biblioteca' ? 'var(--accent-purple)' : '' }}>⭐ Biblioteca Favoritos</span>
        <span className={`tab ${tab === 'drive' ? 'active' : ''}`} onClick={() => setTab('drive')} style={{ borderBottomColor: tab === 'drive' ? 'var(--accent-purple)' : '' }}>📁 Mi Nube Drive</span>
      </div>

      {/* TAB: BIBLIOTECA FAVORITOS */}
      {tab === 'biblioteca' && (
        <div style={{ animation: 'fadeIn 0.2s' }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Mis Recursos Favoritos ({librosFavoritos.length})</h3>
          </div>
          {cargandoRecursos ? <div className="loader"></div> : librosFavoritos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', border: '2px dashed var(--border-color)', borderRadius: '24px' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>⭐</span>
              <h3>Aún no tienes favoritos</h3>
              <p>Ve a la Biblioteca Global y marca con una estrella los libros que quieras tener a la mano aquí.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {librosFavoritos.map(b => {
                const estilo = obtenerEstiloCategoria(b.categoria);
                const glowHex = b.categoria === 'LTG' ? obtenerColorGrado(b.grado) : estilo.color;
                return (
                  <div key={b.id} className="activity-card biblioteca-card" onClick={() => abrirRecurso(b.url)} style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-input)', margin: 0, cursor: 'pointer', position: 'relative', '--glow-color-shadow': `${glowHex}66`, '--glow-color-border': glowHex } as React.CSSProperties}>
                    <BotonEstrella esFavorito={true} onToggle={(e) => toggleFavorito(b.id, e)} />
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1, paddingRight: '25px' }}>
                      <div style={{ backgroundColor: estilo.bg, color: estilo.color, minWidth: '48px', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>{estilo.icon}</div>
                      <div style={{ overflow: 'hidden' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: estilo.color, textTransform: 'uppercase' }}>{b.categoria}</span>
                        <h4 style={{ margin: '0.2rem 0 0.4rem 0', color: 'var(--text-main)', fontSize: '1.1rem', lineHeight: '1.3' }}>{b.titulo}</h4>
                        {b.categoria === 'LTG' && <div style={{ fontSize: '0.8rem', color: glowHex, marginBottom: '0.4rem', fontWeight: '600' }}>{b.grado} • {b.campoFormativo}</div>}
                        <TextoExpandible texto={b.descripcion} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: MI DRIVE */}
      {tab === 'drive' && (
        <div style={{ animation: 'fadeIn 0.2s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Archivos Personales de Drive ({misRecursos.length})</h3>
            <button onClick={() => { setCreandoDrive(true); setRecursoEditando(null); setNuevoTituloDrive(''); setNuevaDescDrive(''); setNuevaUrlDrive(''); }} className="pill-btn" style={{ backgroundColor: '#185ABD', color: 'white' }}>➕ Añadir Enlace</button>
          </div>

          {(creandoDrive || recursoEditando) && (
            <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '2rem', animation: 'fadeIn 0.2s' }}>
              <form onSubmit={recursoEditando ? guardarEdicionDrive : guardarNuevoDrive} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px', margin: '0 auto' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#185ABD', textAlign: 'center' }}>{recursoEditando ? '✏️ Editar Recurso Privado' : '📂 Guardar Enlace en Mi Drive'}</h3>
                <input type="text" required value={recursoEditando ? recursoEditando.titulo : nuevoTituloDrive} onChange={e => recursoEditando ? setRecursoEditando({...recursoEditando, titulo: e.target.value}) : setNuevoTituloDrive(e.target.value)} className="search-input" placeholder="Nombre del documento" />
                <input type="url" required value={recursoEditando ? recursoEditando.url : nuevaUrlDrive} onChange={e => recursoEditando ? setRecursoEditando({...recursoEditando, url: e.target.value}) : setNuevaUrlDrive(e.target.value)} className="search-input" style={{ borderLeft: '4px solid #185ABD' }} placeholder="Enlace del archivo (Drive, OneDrive...)" />
                <textarea value={recursoEditando ? recursoEditando.descripcion : nuevaDescDrive} onChange={e => recursoEditando ? setRecursoEditando({...recursoEditando, descripcion: e.target.value}) : setNuevaDescDrive(e.target.value)} className="search-input" style={{ resize: 'vertical' }} placeholder="Descripción opcional"></textarea>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" disabled={guardando} className="pill-btn" style={{ flex: 1, background: '#185ABD', color: 'white' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
                  <button type="button" onClick={() => { setCreandoDrive(false); setRecursoEditando(null); }} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Cancelar</button>
                </div>
              </form>
            </div>
          )}

          {cargandoRecursos ? <div className="loader"></div> : misRecursos.length === 0 && !creandoDrive ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', border: '2px dashed var(--border-color)', borderRadius: '24px' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>☁️</span>
              <h3>No tienes archivos en tu Nube</h3>
              <p>Vincula tus carpetas o PDFs de Google Drive para tenerlos a la mano durante tus clases.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {misRecursos.map(r => {
                const estilo = obtenerEstiloCategoria(r.categoria);
                return (
                  <div key={r.id} className="activity-card biblioteca-card" onClick={() => abrirRecurso(r.url)} style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-input)', margin: 0, cursor: 'pointer', '--glow-color-shadow': `${estilo.color}66`, '--glow-color-border': estilo.color } as React.CSSProperties}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1 }}>
                      <div style={{ backgroundColor: estilo.bg, color: estilo.color, minWidth: '48px', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>{estilo.icon}</div>
                      <div style={{ overflow: 'hidden' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: estilo.color, textTransform: 'uppercase' }}>{r.categoria}</span>
                        <h4 style={{ margin: '0.2rem 0 0.4rem 0', color: 'var(--text-main)', fontSize: '1.1rem', lineHeight: '1.3' }}>{r.titulo}</h4>
                        <TextoExpandible texto={r.descripcion} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                      <button onClick={(e) => { e.stopPropagation(); setRecursoEditando(r); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="pill-btn" style={{ padding: '0.5rem 1rem', background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>✏️</button>
                      <button onClick={(e) => { e.stopPropagation(); eliminarDrive(r.id); }} className="pill-btn" style={{ padding: '0.5rem 1rem', background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', border: 'none' }}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: ACTIVIDADES */}
      {tab === 'actividades' && (
        <div style={{ animation: 'fadeIn 0.2s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', backgroundColor: 'var(--bg-panel)', padding: '0.4rem', borderRadius: '50px', border: '1px solid var(--border-color)' }}>
              {['Todos', '1', '2', '3'].map(t => (
                <button key={t} onClick={() => setFiltroTrimestre(t as any)} style={{ padding: '0.4rem 1.2rem', borderRadius: '50px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', backgroundColor: filtroTrimestre === t ? 'var(--accent-purple)' : 'transparent', color: filtroTrimestre === t ? 'white' : 'var(--text-muted)' }}>
                  {t === 'Todos' ? 'Todos' : `Trim. ${t}`}
                </button>
              ))}
            </div>
            <TutorialTooltip mensaje="¡Ojo! Las actividades que crees aquí pueden enviarse a la pizarra de los alumnos para que las vean.">
              <button onClick={() => abrirFormulario()} className="pill-btn" style={{ background: 'var(--accent-purple)', color: 'white', padding: '0.8rem 1.5rem' }}>✨ Crear Actividad</button>
            </TutorialTooltip>
          </div>

          {evidenciasFiltradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '24px' }}>No tienes actividades en este trimestre.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {evidenciasFiltradas.map(ev => (
                <div key={ev.id} className="activity-card" style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-panel)', margin: 0, borderTop: `4px solid var(--accent-purple)` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-main)', backgroundColor: 'var(--bg-input)', padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>{ev.tipo}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>T-{ev.trimestre}</span>
                  </div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.2rem' }}><span style={{ color: 'var(--accent-purple)', marginRight: '0.3rem' }}>#{ev.numero}</span>{ev.titulo}</h4>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ev.descripcion}</p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', backgroundColor: 'var(--bg-input)', padding: '0.8rem', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label className="switch"><input type="checkbox" checked={ev.publicada} onChange={() => togglePublicacion(ev.id, ev.publicada)} /><span className="slider"></span></label>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: ev.publicada ? 'var(--accent-green)' : 'var(--text-muted)' }}>Pizarra</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                      <span title="Vistas en Pizarra">👁️ {ev.vistas || 0}</span>
                      <span title="Likes de Alumnos">❤️ {ev.likes || 0}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                    <button onClick={() => { setEvidenciaActiva(ev); setVista('calificar'); }} className="pill-btn" style={{ flex: 1, background: 'var(--accent-blue)', color: 'white', padding: '0.6rem' }}>📝 Calificar</button>
                    <button onClick={() => abrirFormulario(ev)} className="pill-btn" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.6rem' }} title="Editar">✏️</button>
                    <button onClick={() => eliminarEvidencia(ev.id, ev.titulo)} className="pill-btn" style={{ background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', border: 'none', padding: '0.6rem' }} title="Eliminar">🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}