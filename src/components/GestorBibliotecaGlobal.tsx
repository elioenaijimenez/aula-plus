import { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';

interface Libro { 
  id: string; 
  titulo: string; 
  descripcion: string; 
  categoria: string; 
  url: string; 
  grado?: string;
  campoFormativo?: string;
  createdAt?: any; 
}

const CATEGORIAS = [
  'LTG',
  'Curricular', 
  'Rincón de Lectura', 
  'Formatos para ti',
  'Normativo Nacional', 
  'Normativo Estatal'
];

const GRADOS = ['1° Secundaria', '2° Secundaria', '3° Secundaria'];
const CAMPOS_FORMATIVOS = ['Lenguajes', 'Saberes y Pensamiento Científico', 'Ética, Naturaleza y Sociedades', 'De lo Humano y lo Comunitario', 'Múltiples Lenguajes'];

const obtenerEstiloCategoria = (categoria: string) => {
  switch (categoria) {
    case 'LTG': return { icon: '📚', color: '#4CAF50', bg: 'rgba(76, 175, 80, 0.1)' }; // Verde Claro
    case 'Curricular': return { icon: '📖', color: '#9C27B0', bg: 'rgba(156, 39, 176, 0.1)' }; // Morado
    case 'Rincón de Lectura': return { icon: '☕', color: '#FF9800', bg: 'rgba(255, 152, 0, 0.1)' }; // Naranja
    case 'Formatos para ti': return { icon: '📝', color: '#E91E63', bg: 'rgba(233, 30, 99, 0.1)' }; // Rosa
    case 'Normativo Nacional': return { icon: '🇲🇽', color: '#1C51FF', bg: 'rgba(28, 81, 255, 0.1)' }; // Azul
    case 'Normativo Estatal': return { icon: '📍', color: '#00BFA5', bg: 'rgba(0, 191, 165, 0.1)' }; // Verde
    default: return { icon: '📄', color: '#757575', bg: 'rgba(117, 117, 117, 0.1)' }; // Gris
  }
};

export default function GestorBibliotecaGlobal() {
  const [libros, setLibros] = useState<Libro[]>([]);
  const [cargandoLibros, setCargandoLibros] = useState(true);
  const [libroEditando, setLibroEditando] = useState<Libro | null>(null);

  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState('LTG');
  const [nuevoGrado, setNuevoGrado] = useState(GRADOS[0]);
  const [nuevoCampo, setNuevoCampo] = useState(CAMPOS_FORMATIVOS[0]);
  const [nuevaDesc, setNuevaDesc] = useState('');
  const [nuevaUrl, setNuevaUrl] = useState('');
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  
  const [busqueda, setBusqueda] = useState('');
  const [filtroCat, setFiltroCat] = useState('Todas');

  useEffect(() => {
    const fetchLibros = async () => {
      setCargandoLibros(true);
      try {
        const q = query(collection(db, 'global_library'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const lista: Libro[] = [];
        snap.forEach(d => lista.push({ id: d.id, ...d.data() } as Libro));
        setLibros(lista);
      } catch (error) {
        console.error("Error al cargar biblioteca:", error);
      }
      setCargandoLibros(false);
    };
    fetchLibros();
  }, []);

  const abrirFormularioNuevo = () => {
    setNuevoTitulo(''); setNuevaDesc(''); setNuevaUrl(''); setNuevaCategoria('LTG');
    setNuevoGrado(GRADOS[0]); setNuevoCampo(CAMPOS_FORMATIVOS[0]);
    setCreandoNuevo(true);
  };

  const subirNuevoRecurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaUrl || (!nuevaUrl.startsWith('http://') && !nuevaUrl.startsWith('https://'))) { 
      alert('Por favor ingresa un enlace válido que comience con http:// o https://'); 
      return; 
    }
    
    setGuardando(true);
    try {
      const nuevoDoc: any = {
        titulo: nuevoTitulo, 
        descripcion: nuevaDesc, 
        categoria: nuevaCategoria,
        url: nuevaUrl, 
        createdAt: serverTimestamp()
      };
      
      if (nuevaCategoria === 'LTG') {
        nuevoDoc.grado = nuevoGrado;
        nuevoDoc.campoFormativo = nuevoCampo;
      }

      const docRef = await addDoc(collection(db, 'global_library'), nuevoDoc);
      
      const nuevo = { id: docRef.id, ...nuevoDoc };
      setLibros([nuevo, ...libros]);
      setCreandoNuevo(false);
    } catch (error) { 
      console.error(error);
      alert("Error al publicar el recurso. Verifica tu conexión."); 
    }
    setGuardando(false);
  };

  const guardarEdicionLibro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!libroEditando) return;
    if (!libroEditando.url.startsWith('http://') && !libroEditando.url.startsWith('https://')) { 
      alert('Por favor ingresa un enlace válido.'); return; 
    }

    setGuardando(true);
    try {
      const ref = doc(db, 'global_library', libroEditando.id);
      const dataUpdate: any = { 
        titulo: libroEditando.titulo, 
        descripcion: libroEditando.descripcion, 
        categoria: libroEditando.categoria, 
        url: libroEditando.url 
      };

      if (libroEditando.categoria === 'LTG') {
        dataUpdate.grado = libroEditando.grado || GRADOS[0];
        dataUpdate.campoFormativo = libroEditando.campoFormativo || CAMPOS_FORMATIVOS[0];
      }

      await updateDoc(ref, dataUpdate);
      setLibros(libros.map(l => l.id === libroEditando.id ? { ...libroEditando, ...dataUpdate } : l));
      setLibroEditando(null);
    } catch (error) { alert("Error al actualizar."); }
    setGuardando(false);
  };

  const eliminarLibro = async (id: string) => {
    if (window.confirm("¿Estás seguro de eliminar este recurso permanentemente de la biblioteca global?")) {
      try {
        await deleteDoc(doc(db, 'global_library', id));
        setLibros(libros.filter(l => l.id !== id));
      } catch (error) {
        alert("No se pudo eliminar el recurso.");
      }
    }
  };

  const librosFiltrados = libros.filter(l => {
    const termino = busqueda.toLowerCase();
    const coincideTitulo = l.titulo ? l.titulo.toLowerCase().includes(termino) : false;
    const coincideDesc = l.descripcion ? l.descripcion.toLowerCase().includes(termino) : false;
    const coincideBusqueda = coincideTitulo || coincideDesc;
    const coincideCategoria = filtroCat === 'Todas' || l.categoria === filtroCat;
    return coincideBusqueda && coincideCategoria;
  });

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--accent-blue)' }}>
          {libroEditando ? '✏️ Editar Recurso Existente' : creandoNuevo ? '➕ Publicar Nuevo Recurso' : '📚 Gestión de Catálogo Global'}
        </h3>
        
        {libroEditando ? (
           <form onSubmit={guardarEdicionLibro} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="text" required placeholder="Título público del documento" className="search-input" value={libroEditando.titulo} onChange={e => setLibroEditando({...libroEditando, titulo: e.target.value})} />
            
            <select className="search-input" value={libroEditando.categoria} onChange={e => setLibroEditando({...libroEditando, categoria: e.target.value})}>
              {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              {!CATEGORIAS.includes(libroEditando.categoria) && <option value={libroEditando.categoria}>{libroEditando.categoria} (Antigua)</option>}
            </select>

            {libroEditando.categoria === 'LTG' && (
              <div style={{ display: 'flex', gap: '1rem' }}>
                <select className="search-input" value={libroEditando.grado || GRADOS[0]} onChange={e => setLibroEditando({...libroEditando, grado: e.target.value})} style={{ flex: 1 }}>
                  {GRADOS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <select className="search-input" value={libroEditando.campoFormativo || CAMPOS_FORMATIVOS[0]} onChange={e => setLibroEditando({...libroEditando, campoFormativo: e.target.value})} style={{ flex: 1 }}>
                  {CAMPOS_FORMATIVOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            
            <input type="url" required placeholder="Enlace del documento (Drive, OneDrive...)" className="search-input" style={{ borderLeft: `4px solid ${obtenerEstiloCategoria(libroEditando.categoria).color}` }} value={libroEditando.url} onChange={e => setLibroEditando({...libroEditando, url: e.target.value})} />
            <textarea placeholder="Descripción pedagógica, vigencia o notas de uso..." className="search-input" style={{ resize: 'vertical', minHeight: '80px' }} value={libroEditando.descripcion} onChange={e => setLibroEditando({...libroEditando, descripcion: e.target.value})}></textarea>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" disabled={guardando} className="pill-btn" style={{ flex: 1, background: 'var(--accent-blue)', color: 'white' }}>{guardando ? 'Guardando...' : 'Guardar Cambios'}</button>
              <button type="button" onClick={() => setLibroEditando(null)} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Cancelar</button>
            </div>
          </form>
        ) : creandoNuevo ? (
          <form onSubmit={subirNuevoRecurso} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="text" required placeholder="Ej. Plan de Estudio 2022" className="search-input" value={nuevoTitulo} onChange={e => setNuevoTitulo(e.target.value)} />
            
            <select className="search-input" value={nuevaCategoria} onChange={e => setNuevaCategoria(e.target.value)}>
              {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>

            {nuevaCategoria === 'LTG' && (
              <div style={{ display: 'flex', gap: '1rem' }}>
                <select className="search-input" value={nuevoGrado} onChange={e => setNuevoGrado(e.target.value)} style={{ flex: 1 }}>
                  {GRADOS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <select className="search-input" value={nuevoCampo} onChange={e => setNuevoCampo(e.target.value)} style={{ flex: 1 }}>
                  {CAMPOS_FORMATIVOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            
            <input type="url" required placeholder="Pega el enlace público del archivo (Google Drive, etc.)" className="search-input" style={{ borderLeft: `4px solid ${obtenerEstiloCategoria(nuevaCategoria).color}` }} value={nuevaUrl} onChange={e => setNuevaUrl(e.target.value)} />
            <textarea placeholder="Describe el propósito del documento, sugerencias de uso o su vigencia..." className="search-input" style={{ resize: 'vertical', minHeight: '80px' }} value={nuevaDesc} onChange={e => setNuevaDesc(e.target.value)}></textarea>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" disabled={guardando} className="pill-btn" style={{ flex: 1, background: 'var(--accent-blue)', color: 'white' }}>
                {guardando ? 'Publicando...' : 'Publicar Recurso Oficial'}
              </button>
              <button type="button" onClick={() => setCreandoNuevo(false)} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Cancelar</button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', padding: '1rem', border: '2px dashed var(--border-color)', borderRadius: '16px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', textAlign: 'center', margin: 0 }}>Publica leyes, acuerdos, formatos o libros vinculando su enlace de Google Drive.</p>
            <button onClick={abrirFormularioNuevo} className="pill-btn" style={{ backgroundColor: 'var(--accent-blue)', color: 'white', padding: '0.8rem 2rem' }}>➕ Vincular Nuevo Documento</button>
          </div>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>Catálogo Publicado ({librosFiltrados.length})</h3>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            <select className="search-input" style={{ width: 'auto', padding: '0.5rem', borderRadius: '12px' }} value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
              <option value="Todas">Todas las Categorías</option>
              {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            
            <input 
              type="text" 
              placeholder="🔍 Buscar título o descripción..." 
              className="search-input" 
              style={{ width: '100%', maxWidth: '300px', padding: '0.5rem', borderRadius: '12px' }} 
              value={busqueda} 
              onChange={e => {
                setBusqueda(e.target.value);
                if (e.target.value.length > 0 && filtroCat !== 'Todas') setFiltroCat('Todas');
              }} 
            />
          </div>
        </div>

        {cargandoLibros ? <div className="loader"></div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {librosFiltrados.length === 0 ? (
               <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No se encontraron documentos.</div>
            ) : (
              librosFiltrados.map(b => {
                const estilo = obtenerEstiloCategoria(b.categoria);
                return (
                  <div 
                    key={b.id} 
                    className="activity-card hover-opacity" 
                    onClick={() => window.open(b.url, '_blank')}
                    style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-input)', margin: 0, cursor: 'pointer', position: 'relative' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1 }}>
                      <div style={{ backgroundColor: estilo.bg, color: estilo.color, width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                        {estilo.icon}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: estilo.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{b.categoria}</span>
                        <h4 style={{ margin: '0.2rem 0 0.4rem 0', color: 'var(--text-main)', fontSize: '1.1rem', lineHeight: '1.3' }}>{b.titulo}</h4>
                        {b.categoria === 'LTG' && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                            <b>{b.grado}</b> • {b.campoFormativo}
                          </div>
                        )}
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {b.descripcion || 'Sin descripción adicional.'}
                        </p>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setLibroEditando(b); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                        className="pill-btn" 
                        title="Editar"
                        style={{ padding: '0.5rem 1rem', background: 'var(--bg-panel)', fontSize: '1.1rem', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); eliminarLibro(b.id); }} 
                        className="pill-btn" 
                        title="Borrar"
                        style={{ padding: '0.5rem 1rem', background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', fontSize: '1.1rem', border: 'none' }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}