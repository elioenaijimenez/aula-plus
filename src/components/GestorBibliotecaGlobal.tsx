import { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';

interface Libro { id: string; titulo: string; descripcion: string; categoria: string; cover: string; url: string; fecha?: string; }

export default function GestorBibliotecaGlobal() {
  const [libros, setLibros] = useState<Libro[]>([]);
  const [cargandoLibros, setCargandoLibros] = useState(true);
  const [libroEditando, setLibroEditando] = useState<Libro | null>(null);

  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState('Normativo');
  const [nuevaDesc, setNuevaDesc] = useState('');
  const [nuevoCover, setNuevoCover] = useState('');
  const [nuevaUrl, setNuevaUrl] = useState('');
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const fetchLibros = async () => {
      setCargandoLibros(true);
      const q = query(collection(db, 'global_library'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const lista: Libro[] = [];
      snap.forEach(d => lista.push({ id: d.id, ...d.data() } as Libro));
      setLibros(lista);
      setCargandoLibros(false);
    };
    fetchLibros();
  }, []);

  const abrirFormularioNuevo = () => {
    setNuevoTitulo(''); setNuevaDesc(''); setNuevaUrl(''); setNuevoCover(''); setNuevaCategoria('Normativo');
    setCreandoNuevo(true);
  };

  const subirNuevoRecurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaUrl) { alert('El enlace del documento es obligatorio.'); return; }
    
    setGuardando(true);
    try {
      const coverFinal = nuevoCover || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=400';

      const docRef = await addDoc(collection(db, 'global_library'), {
        titulo: nuevoTitulo, descripcion: nuevaDesc, categoria: nuevaCategoria,
        cover: coverFinal, url: nuevaUrl, createdAt: serverTimestamp()
      });
      
      const nuevo = { id: docRef.id, titulo: nuevoTitulo, descripcion: nuevaDesc, categoria: nuevaCategoria, cover: coverFinal, url: nuevaUrl };
      setLibros([nuevo, ...libros]);
      setCreandoNuevo(false);
    } catch (error) { 
      console.error(error);
      alert("Error al guardar el recurso. Verifica tu conexión."); 
    }
    setGuardando(false);
  };

  const guardarEdicionLibro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!libroEditando) return;
    setGuardando(true);
    try {
      const ref = doc(db, 'global_library', libroEditando.id);
      await updateDoc(ref, { titulo: libroEditando.titulo, descripcion: libroEditando.descripcion, categoria: libroEditando.categoria, cover: libroEditando.cover, url: libroEditando.url });
      setLibros(libros.map(l => l.id === libroEditando.id ? libroEditando : l));
      setLibroEditando(null);
    } catch (error) { alert("Error al actualizar."); }
    setGuardando(false);
  };

  const eliminarLibro = async (id: string) => {
    if (window.confirm("¿Eliminar este recurso permanentemente?")) {
      await deleteDoc(doc(db, 'global_library', id));
      setLibros(libros.filter(l => l.id !== id));
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
      
      <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', height: 'fit-content' }}>
        <h3 style={{ margin: '0 0 1.5rem 0' }}>{libroEditando ? 'Editar Recurso' : 'Vincular Nuevo Recurso'}</h3>
        
        {libroEditando ? (
           <form onSubmit={guardarEdicionLibro} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="text" required placeholder="Título" className="search-input" value={libroEditando.titulo} onChange={e => setLibroEditando({...libroEditando, titulo: e.target.value})} />
            <select className="search-input" value={libroEditando.categoria} onChange={e => setLibroEditando({...libroEditando, categoria: e.target.value})}>
              <option value="Normativo">Normativo Oficial</option>
              <option value="Rincon">Rincón de Lectura</option>
            </select>
            <input type="url" required placeholder="Enlace del documento (Drive, OneDrive...)" className="search-input" style={{ borderLeft: '4px solid var(--accent-blue)' }} value={libroEditando.url} onChange={e => setLibroEditando({...libroEditando, url: e.target.value})} />
            <textarea placeholder="Descripción..." className="search-input" style={{ resize: 'vertical' }} value={libroEditando.descripcion} onChange={e => setLibroEditando({...libroEditando, descripcion: e.target.value})}></textarea>
            <input type="url" placeholder="Carátula (URL opcional)" className="search-input" value={libroEditando.cover} onChange={e => setLibroEditando({...libroEditando, cover: e.target.value})} />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" disabled={guardando} className="pill-btn" style={{ flex: 1, background: 'var(--accent-purple)', color: 'white' }}>Guardar</button>
              <button type="button" onClick={() => setLibroEditando(null)} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Cancelar</button>
            </div>
          </form>
        ) : creandoNuevo ? (
          <form onSubmit={subirNuevoRecurso} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="text" required placeholder="Título público del documento" className="search-input" value={nuevoTitulo} onChange={e => setNuevoTitulo(e.target.value)} />
            <select className="search-input" value={nuevaCategoria} onChange={e => setNuevaCategoria(e.target.value)}>
              <option value="Normativo">Normativo Oficial</option>
              <option value="Rincon">Rincón de Lectura</option>
            </select>
            <input type="url" required placeholder="Enlace público del archivo (Google Drive, etc.)" className="search-input" style={{ borderLeft: '4px solid var(--accent-blue)' }} value={nuevaUrl} onChange={e => setNuevaUrl(e.target.value)} />
            <textarea placeholder="Breve descripción..." className="search-input" style={{ resize: 'vertical' }} value={nuevaDesc} onChange={e => setNuevaDesc(e.target.value)}></textarea>
            <input type="url" placeholder="URL de imagen para portada (Opcional)" className="search-input" value={nuevoCover} onChange={e => setNuevoCover(e.target.value)} />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" disabled={guardando} className="pill-btn" style={{ flex: 1, background: 'var(--accent-purple)', color: 'white' }}>
                {guardando ? 'Guardando...' : 'Publicar Recurso'}
              </button>
              <button type="button" onClick={() => setCreandoNuevo(false)} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Cancelar</button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', padding: '2rem 1rem', border: '2px dashed var(--border-color)', borderRadius: '12px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', margin: 0 }}>Vincula un documento desde la nube para compartirlo con los docentes.</p>
            <button onClick={abrirFormularioNuevo} className="pill-btn" style={{ backgroundColor: 'var(--accent-blue)', color: 'white' }}>➕ Vincular Nuevo Enlace</button>
          </div>
        )}
      </div>

      <div>
        <h3 style={{ margin: '0 0 1.5rem 0' }}>Catálogo Global</h3>
        {cargandoLibros ? <div className="loader"></div> : (
          <div className="book-grid">
            {libros.map(b => (
              <div key={b.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', marginBottom: '1rem' }}>
                <div className="book-card" onClick={() => window.open(b.url, '_blank')} style={{ flex: 1 }}>
                  <img src={b.cover} alt="Cover" className="book-cover" />
                  <h4 className="book-title" style={{ marginTop: '0.5rem' }}>{b.titulo}</h4>
                  <p className="book-author" style={{ fontSize: '0.75rem' }}>{b.categoria}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button onClick={() => { setLibroEditando(b); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="pill-btn" style={{ flex: 1, padding: '0.3rem', background: 'var(--bg-input)', fontSize: '0.75rem', color: 'var(--text-main)' }}>Editar</button>
                  <button onClick={() => eliminarLibro(b.id)} className="pill-btn" style={{ flex: 1, padding: '0.3rem', background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', fontSize: '0.75rem' }}>Borrar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}