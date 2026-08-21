import { useState, useEffect } from 'react';
import { collection, query, getDocs, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';

interface Recurso { id: string; titulo: string; descripcion: string; tipo: 'PDF' | 'IMG'; url: string; categoria?: string; cover?: string; docenteEmail?: string; }

const TextoExpandible = ({ texto }: { texto: string }) => {
  const [expandido, setExpandido] = useState(false);
  if (!texto) return null;
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '0.5rem', cursor: 'default' }}>
      <p style={{ display: '-webkit-box', WebkitLineClamp: expandido ? 'unset' : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
        {texto}
      </p>
      {texto.length > 80 && (
        <button onClick={(e) => { e.stopPropagation(); setExpandido(!expandido); }} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '0.8rem', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}>
          {expandido ? 'Leer menos' : 'Leer más...'}
        </button>
      )}
    </div>
  );
};

export default function Biblioteca({ onVolver }: { onVolver: () => void }) {
  const [tabActiva, setTabActiva] = useState<'normativos' | 'mis-recursos' | 'rincon'>('normativos');
  
  const [normativos, setNormativos] = useState<Recurso[]>([]);
  const [rinconLectura, setRinconLectura] = useState<Recurso[]>([]);
  const [cargandoGlobal, setCargandoGlobal] = useState(true);

  // Espacio Personal (Mi Drive)
  const [misRecursos, setMisRecursos] = useState<Recurso[]>([]);
  const [cargandoDrive, setCargandoDrive] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevaDescripcion, setNuevaDescripcion] = useState('');
  const [nuevaUrl, setNuevaUrl] = useState('');
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  
  const [recursoEditando, setRecursoEditando] = useState<Recurso | null>(null);

  // Obtener correo del usuario
  useEffect(() => {
    const sessionLocal = localStorage.getItem('aulaPlusSession');
    const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
    setUserEmail(sessionData?.user?.email || sessionData?.email || '');
  }, []);

  // Cargar Catálogo Global
  useEffect(() => {
    const fetchCatalogoGlobal = async () => {
      setCargandoGlobal(true);
      const q = query(collection(db, 'global_library'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const listaNorm: Recurso[] = [];
      const listaRincon: Recurso[] = [];
      
      snap.forEach(d => {
        const data = d.data();
        const recurso: Recurso = { id: d.id, titulo: data.titulo, descripcion: data.descripcion, tipo: 'PDF', url: data.url, cover: data.cover, categoria: data.categoria };
        if (data.categoria === 'Normativo') listaNorm.push(recurso);
        if (data.categoria === 'Rincon') listaRincon.push(recurso);
      });
      
      setNormativos(listaNorm);
      setRinconLectura(listaRincon);
      setCargandoGlobal(false);
    };
    fetchCatalogoGlobal();
  }, []);

  // Cargar Catálogo Personal (Mi Drive)
  useEffect(() => {
    if (!userEmail || tabActiva !== 'mis-recursos') return;
    
    const fetchMiDrive = async () => {
      setCargandoDrive(true);
      try {
        const q = query(collection(db, 'teacher_drive'), where('docenteEmail', '==', userEmail));
        const snap = await getDocs(q);
        const listaPersonales: Recurso[] = [];
        
        snap.forEach(d => {
          listaPersonales.push({ id: d.id, ...d.data() } as Recurso);
        });
        
        // Ordenamiento local
        listaPersonales.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setMisRecursos(listaPersonales);
      } catch(error) {
        console.error("Error al cargar Mi Drive", error);
      }
      setCargandoDrive(false);
    };
    fetchMiDrive();
  }, [userEmail, tabActiva]);

  const abrirFormularioNuevo = () => {
    setNuevoTitulo(''); setNuevaDescripcion(''); setNuevaUrl('');
    setCreandoNuevo(true);
  };

  const guardarNuevoRecurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaUrl || !userEmail) return;
    
    setGuardando(true);
    try {
      const nuevoDoc = {
        titulo: nuevoTitulo,
        descripcion: nuevaDescripcion,
        tipo: 'PDF',
        url: nuevaUrl,
        docenteEmail: userEmail,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'teacher_drive'), nuevoDoc);
      setMisRecursos([{ id: docRef.id, ...nuevoDoc } as Recurso, ...misRecursos]);
      
      setCreandoNuevo(false);
    } catch (error) {
      alert("Hubo un error al guardar tu enlace.");
    }
    setGuardando(false);
  };

  const guardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recursoEditando) return;
    setGuardando(true);
    try {
      await updateDoc(doc(db, 'teacher_drive', recursoEditando.id), {
        titulo: recursoEditando.titulo,
        descripcion: recursoEditando.descripcion,
        url: recursoEditando.url
      });
      setMisRecursos(misRecursos.map(r => r.id === recursoEditando.id ? recursoEditando : r));
      setRecursoEditando(null);
    } catch (error) {
      alert("Error al editar el recurso.");
    }
    setGuardando(false);
  };

  const eliminarRecursoPropio = async (id: string) => {
    if (window.confirm("¿Eliminar permanentemente este recurso de tu Drive?")) {
      try {
        await deleteDoc(doc(db, 'teacher_drive', id));
        setMisRecursos(misRecursos.filter(r => r.id !== id));
      } catch (error) {
        alert("No se pudo eliminar el recurso.");
      }
    }
  };

  const abrirDocumentoExterno = (url: string) => {
    if (url) {
      // Intenta abrir el enlace en una nueva pestaña. Funciona excelente en móviles.
      window.open(url, '_blank');
    } else {
      alert('Este recurso no tiene un enlace válido.');
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginBottom: '1.5rem', padding: '0.3rem 0.8rem' }}>
        ← Volver al Inicio
      </button>
      
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ margin: 0, fontWeight: 600, fontSize: '1.8rem', color: 'var(--accent-purple)' }}>📚 Biblioteca Docente</h3>
        <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0' }}>Catálogo de recursos oficiales e inspiración educativa.</p>
      </div>

      <div className="tabs-nav" style={{ marginBottom: '1.5rem' }}>
        <span className={`tab ${tabActiva === 'normativos' ? 'active' : ''}`} onClick={() => { setTabActiva('normativos'); setRecursoEditando(null); setCreandoNuevo(false); }}>📜 Normativos</span>
        <span className={`tab ${tabActiva === 'rincon' ? 'active' : ''}`} onClick={() => { setTabActiva('rincon'); setRecursoEditando(null); setCreandoNuevo(false); }}>☕ Rincón de Lectura</span>
        <span className={`tab ${tabActiva === 'mis-recursos' ? 'active' : ''}`} onClick={() => setTabActiva('mis-recursos')}>📂 Mi Drive (Privado)</span>
      </div>

      <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
        
        {cargandoGlobal && tabActiva !== 'mis-recursos' ? <div className="loader"></div> : (
          <>
            {tabActiva === 'normativos' && (
              <div className="book-grid">
                {normativos.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No hay normativos publicados.</p> : normativos.map(libro => (
                  <div key={libro.id} className="book-card" onClick={() => abrirDocumentoExterno(libro.url)}>
                    <img src={libro.cover} alt="Cover" className="book-cover" />
                    <h4 className="book-title" style={{ marginTop: '0.5rem' }}>{libro.titulo}</h4>
                    <TextoExpandible texto={libro.descripcion} />
                    {libro.url && (
                      <button onClick={(e) => { e.stopPropagation(); abrirDocumentoExterno(libro.url); }} className="pill-btn" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', marginTop: 'auto', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>↗️ Abrir Recurso</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tabActiva === 'rincon' && (
              <div className="book-grid">
                {rinconLectura.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No hay libros sugeridos publicados.</p> : rinconLectura.map(libro => (
                  <div key={libro.id} className="book-card" onClick={() => abrirDocumentoExterno(libro.url)}>
                    <img src={libro.cover} alt="Cover" className="book-cover" />
                    <h4 className="book-title" style={{ marginTop: '0.5rem' }}>{libro.titulo}</h4>
                    <TextoExpandible texto={libro.descripcion} />
                    {libro.url && (
                      <button onClick={(e) => { e.stopPropagation(); abrirDocumentoExterno(libro.url); }} className="pill-btn" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', marginTop: 'auto', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>↗️ Abrir Recurso</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tabActiva === 'mis-recursos' && (
          <div>
            {recursoEditando ? (
              <form onSubmit={guardarEdicion} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '500px', margin: '0 auto', backgroundColor: 'var(--bg-input)', padding: '2rem', borderRadius: '16px' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent-purple)' }}>Editar Documento</h3>
                <input type="text" required value={recursoEditando.titulo} onChange={e => setRecursoEditando({...recursoEditando, titulo: e.target.value})} className="search-input" placeholder="Nombre del documento" />
                <input type="url" required value={recursoEditando.url} onChange={e => setRecursoEditando({...recursoEditando, url: e.target.value})} className="search-input" style={{ borderLeft: '4px solid var(--accent-purple)' }} placeholder="Enlace del archivo" />
                <textarea value={recursoEditando.descripcion} onChange={e => setRecursoEditando({...recursoEditando, descripcion: e.target.value})} className="search-input" style={{ resize: 'vertical' }} placeholder="Descripción opcional"></textarea>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" disabled={guardando} className="pill-btn" style={{ flex: 1, background: 'var(--accent-purple)', color: 'white' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
                  <button type="button" onClick={() => setRecursoEditando(null)} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Cancelar</button>
                </div>
              </form>
            ) : creandoNuevo ? (
              <form onSubmit={guardarNuevoRecurso} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '500px', margin: '0 auto', backgroundColor: 'var(--bg-input)', padding: '2rem', borderRadius: '16px' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent-blue)' }}>Vincular Documento</h3>
                <input type="text" required value={nuevoTitulo} onChange={e => setNuevoTitulo(e.target.value)} className="search-input" placeholder="Nombra tu documento (Ej. Planeación Noviembre)" />
                <input type="url" required value={nuevaUrl} onChange={e => setNuevaUrl(e.target.value)} className="search-input" style={{ borderLeft: '4px solid var(--accent-blue)' }} placeholder="Pega aquí el enlace de Google Drive, OneDrive..." />
                <textarea value={nuevaDescripcion} onChange={e => setNuevaDescripcion(e.target.value)} className="search-input" style={{ resize: 'vertical' }} placeholder="Descripción opcional..."></textarea>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" disabled={guardando} className="pill-btn" style={{ flex: 1, background: 'var(--accent-blue)', color: 'white' }}>{guardando ? 'Guardando...' : 'Guardar Recurso'}</button>
                  <button type="button" onClick={() => setCreandoNuevo(false)} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Cancelar</button>
                </div>
              </form>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>Espacio personal y privado. Guarda enlaces a tus documentos importantes.</p>
                  <button onClick={abrirFormularioNuevo} className="pill-btn" style={{ backgroundColor: 'var(--accent-blue)', color: 'white' }}>➕ Vincular Documento</button>
                </div>

                {cargandoDrive ? <div className="loader"></div> : misRecursos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)' }}>Tu Drive está vacío. Vincula tu primer documento.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {misRecursos.map(doc => (
                      <div key={doc.id} className="activity-card" style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-input)' }}>
                        <div onClick={() => abrirDocumentoExterno(doc.url)} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1, cursor: 'pointer' }}>
                          <div style={{ backgroundColor: '#1C51FF', color: 'white', width: '45px', height: '50px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', flexShrink: 0 }}>
                            DOC
                          </div>
                          <div>
                            <h4 style={{ margin: '0 0 0.3rem 0', color: 'var(--text-main)' }}>{doc.titulo}</h4>
                            <TextoExpandible texto={doc.descripcion} />
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                          <button onClick={(e) => { e.stopPropagation(); abrirDocumentoExterno(doc.url); }} className="pill-btn" style={{ flex: 1, background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: '0.8rem', textAlign: 'center' }}>↗️ Abrir</button>
                          <button onClick={() => setRecursoEditando(doc)} className="pill-btn" style={{ flex: 1, padding: '0.3rem', background: 'var(--bg-panel)', fontSize: '0.8rem', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>✏️ Editar</button>
                          <button onClick={() => eliminarRecursoPropio(doc.id)} className="pill-btn" style={{ flex: 1, padding: '0.3rem', background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', fontSize: '0.8rem', border: 'none' }}>🗑 Borrar</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}