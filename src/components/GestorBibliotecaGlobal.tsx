import { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';

interface Libro { 
  id: string; 
  titulo: string; 
  descripcion: string; 
  categoria: string; 
  url: string; 
  imagenUrl?: string; // NUEVO: Soporte para portadas
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
const CAMPOS_FORMATIVOS = [
  'Lenguajes', 
  'Saberes y Pensamiento Científico', 
  'Ética, Naturaleza y Sociedades', 
  'De lo Humano y lo Comunitario'
];

// Colores actualizados para coincidir con la nueva UI premium
const obtenerEstiloCategoria = (categoria: string) => {
  switch (categoria) {
    case 'LTG': return { icon: '📚', color: '#4CAF50', bg: '#E8F5E9' }; 
    case 'Curricular': return { icon: '📖', color: '#9C27B0', bg: '#F3E5F5' }; 
    case 'Rincón de Lectura': return { icon: '☕', color: '#FF9800', bg: '#FFF3E0' }; 
    case 'Formatos para ti': return { icon: '📝', color: '#E91E63', bg: '#FCE4EC' }; 
    case 'Normativo Nacional': return { icon: '⚖️', color: '#1C51FF', bg: '#E8EDFF' }; 
    case 'Normativo Estatal': return { icon: '📍', color: '#00BFA5', bg: '#E0F2F1' }; 
    default: return { icon: '📄', color: '#757575', bg: '#F5F5F5' }; 
  }
};

const TextoExpandible = ({ texto }: { texto: string }) => {
  const [expandido, setExpandido] = useState(false);
  if (!texto) return null;
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '0.5rem', cursor: 'default' }}>
      <p style={{ display: '-webkit-box', WebkitLineClamp: expandido ? 'unset' : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
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
  const [nuevaImagenUrl, setNuevaImagenUrl] = useState(''); // Estado para portada
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
    setNuevoTitulo(''); setNuevaDesc(''); setNuevaUrl(''); setNuevaImagenUrl(''); setNuevaCategoria('LTG');
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
      
      if (nuevaImagenUrl.trim() !== '') {
        nuevoDoc.imagenUrl = nuevaImagenUrl;
      }
      
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

      if (libroEditando.imagenUrl !== undefined) {
        dataUpdate.imagenUrl = libroEditando.imagenUrl;
      }

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
      
      <style>{`
        .lib-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 2rem;
        }
        .lib-card {
          background: var(--bg-panel);
          border-radius: 16px;
          border: 1px solid var(--border-color);
          overflow: hidden;
          transition: all 0.3s ease;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .lib-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 15px 30px rgba(0,0,0,0.1);
          border-color: var(--accent-blue);
        }
        .lib-cover {
          height: 160px;
          width: 100%;
          position: relative;
          background-size: cover;
          background-position: center;
          border-bottom: 1px solid var(--border-color);
        }
        .lib-cover-fallback {
          height: 160px;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 4rem;
          position: relative;
        }
      `}</style>

      <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--accent-blue)', fontSize: '1.8rem' }}>
          {libroEditando ? '✏️ Editar Recurso Existente' : creandoNuevo ? '➕ Publicar Nuevo Recurso' : '📚 Gestión de Catálogo Global'}
        </h3>
        
        {libroEditando ? (
           <form onSubmit={guardarEdicionLibro} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '800px' }}>
            <input type="text" required placeholder="Título público del documento" className="search-input" value={libroEditando.titulo} onChange={e => setLibroEditando({...libroEditando, titulo: e.target.value})} />
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <select className="search-input" value={libroEditando.categoria} onChange={e => setLibroEditando({...libroEditando, categoria: e.target.value})} style={{ flex: 1, minWidth: '200px' }}>
                {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                {!CATEGORIAS.includes(libroEditando.categoria) && <option value={libroEditando.categoria}>{libroEditando.categoria} (Antigua)</option>}
              </select>

              {libroEditando.categoria === 'LTG' && (
                <>
                  <select className="search-input" value={libroEditando.grado || GRADOS[0]} onChange={e => setLibroEditando({...libroEditando, grado: e.target.value})} style={{ flex: 1, minWidth: '150px' }}>
                    {GRADOS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select className="search-input" value={libroEditando.campoFormativo || CAMPOS_FORMATIVOS[0]} onChange={e => setLibroEditando({...libroEditando, campoFormativo: e.target.value})} style={{ flex: 1, minWidth: '200px' }}>
                    {CAMPOS_FORMATIVOS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input type="url" required placeholder="Enlace del documento (Drive, OneDrive...)" className="search-input" style={{ flex: 1, minWidth: '250px', borderLeft: `4px solid ${obtenerEstiloCategoria(libroEditando.categoria).color}` }} value={libroEditando.url} onChange={e => setLibroEditando({...libroEditando, url: e.target.value})} />
              <input type="url" placeholder="Enlace de la portada (Opcional)" className="search-input" style={{ flex: 1, minWidth: '250px' }} value={libroEditando.imagenUrl || ''} onChange={e => setLibroEditando({...libroEditando, imagenUrl: e.target.value})} />
            </div>

            <textarea placeholder="Descripción pedagógica, vigencia o notas de uso..." className="search-input" style={{ resize: 'vertical', minHeight: '80px' }} value={libroEditando.descripcion} onChange={e => setLibroEditando({...libroEditando, descripcion: e.target.value})}></textarea>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" disabled={guardando} className="pill-btn" style={{ flex: 1, background: 'var(--accent-blue)', color: 'white', padding: '1rem', fontWeight: 'bold' }}>{guardando ? 'Guardando...' : '💾 Guardar Cambios'}</button>
              <button type="button" onClick={() => setLibroEditando(null)} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Cancelar</button>
            </div>
          </form>
        ) : creandoNuevo ? (
          <form onSubmit={subirNuevoRecurso} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '800px' }}>
            <input type="text" required placeholder="Ej. Plan de Estudio 2022" className="search-input" value={nuevoTitulo} onChange={e => setNuevoTitulo(e.target.value)} />
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <select className="search-input" value={nuevaCategoria} onChange={e => setNuevaCategoria(e.target.value)} style={{ flex: 1, minWidth: '200px' }}>
                {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>

              {nuevaCategoria === 'LTG' && (
                <>
                  <select className="search-input" value={nuevoGrado} onChange={e => setNuevoGrado(e.target.value)} style={{ flex: 1, minWidth: '150px' }}>
                    {GRADOS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select className="search-input" value={nuevoCampo} onChange={e => setNuevoCampo(e.target.value)} style={{ flex: 1, minWidth: '200px' }}>
                    {CAMPOS_FORMATIVOS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input type="url" required placeholder="Pega el enlace público del archivo (Google Drive, etc.)" className="search-input" style={{ flex: 1, minWidth: '250px', borderLeft: `4px solid ${obtenerEstiloCategoria(nuevaCategoria).color}` }} value={nuevaUrl} onChange={e => setNuevaUrl(e.target.value)} />
              <input type="url" placeholder="Enlace de una imagen de portada (Opcional)" className="search-input" style={{ flex: 1, minWidth: '250px' }} value={nuevaImagenUrl} onChange={e => setNuevaImagenUrl(e.target.value)} />
            </div>

            <textarea placeholder="Describe el propósito del documento, sugerencias de uso o su vigencia..." className="search-input" style={{ resize: 'vertical', minHeight: '80px' }} value={nuevaDesc} onChange={e => setNuevaDesc(e.target.value)}></textarea>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" disabled={guardando} className="pill-btn" style={{ flex: 1, background: 'var(--accent-blue)', color: 'white', padding: '1rem', fontWeight: 'bold' }}>
                {guardando ? 'Publicando...' : '📢 Publicar Recurso Oficial'}
              </button>
              <button type="button" onClick={() => setCreandoNuevo(false)} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Cancelar</button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', padding: '2rem', border: '2px dashed var(--border-color)', borderRadius: '16px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', textAlign: 'center', margin: 0 }}>Sube libros de texto, formatos IEBEM o normativa oficial para todos los docentes.</p>
            <button onClick={abrirFormularioNuevo} className="pill-btn" style={{ backgroundColor: 'var(--accent-blue)', color: 'white', padding: '1rem 2.5rem', fontSize: '1.1rem', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(28, 81, 255, 0.3)' }}>
              ➕ Publicar Nuevo Documento
            </button>
          </div>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: 0, fontSize: '1.5rem' }}>Catálogo Activo ({librosFiltrados.length})</h3>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            <select className="search-input" style={{ width: 'auto', padding: '0.6rem 1rem', borderRadius: '12px', margin: 0 }} value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
              <option value="Todas">Todas las Categorías</option>
              {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            
            <input 
              type="text" 
              placeholder="🔍 Buscar título o descripción..." 
              className="search-input" 
              style={{ width: '100%', maxWidth: '350px', padding: '0.6rem 1rem', borderRadius: '12px', margin: 0 }} 
              value={busqueda} 
              onChange={e => {
                setBusqueda(e.target.value);
                if (e.target.value.length > 0 && filtroCat !== 'Todas') setFiltroCat('Todas');
              }} 
            />
          </div>
        </div>

        {cargandoLibros ? <div className="loader"></div> : (
          <div className="lib-grid">
            {librosFiltrados.length === 0 ? (
               <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem 1rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-panel)', borderRadius: '24px', border: '2px dashed var(--border-color)' }}>
                 <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🧐</span>
                 <p style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: 'bold' }}>No se encontraron documentos.</p>
               </div>
            ) : (
              librosFiltrados.map(b => {
                const estilo = obtenerEstiloCategoria(b.categoria);
                return (
                  <div 
                    key={b.id} 
                    className="lib-card" 
                    onClick={() => window.open(b.url, '_blank')}
                  >
                    {/* PORTADA VISUAL */}
                    {b.imagenUrl ? (
                      <div className="lib-cover" style={{ backgroundImage: `url(${b.imagenUrl})` }}></div>
                    ) : (
                      <div className="lib-cover-fallback" style={{ backgroundColor: estilo.bg, color: estilo.color }}>
                        {estilo.icon}
                      </div>
                    )}

                    {/* CUERPO DE LA TARJETA */}
                    <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: estilo.color, textTransform: 'uppercase', letterSpacing: '0.5px', backgroundColor: estilo.bg, padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                          {b.categoria}
                        </span>
                      </div>
                      
                      <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.15rem', lineHeight: '1.3' }}>
                        {b.titulo}
                      </h4>
                      
                      {b.categoria === 'LTG' && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                          {b.grado} • {b.campoFormativo}
                        </div>
                      )}

                      <div style={{ flex: 1 }}>
                        <TextoExpandible texto={b.descripcion || 'Sin descripción adicional.'} />
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setLibroEditando(b); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                          className="pill-btn" 
                          title="Editar"
                          style={{ padding: '0.5rem 1rem', background: 'var(--bg-input)', fontSize: '0.9rem', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold' }}
                        >
                          ✏️ Editar
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); eliminarLibro(b.id); }} 
                          className="pill-btn" 
                          title="Borrar"
                          style={{ padding: '0.5rem 1rem', background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', fontSize: '0.9rem', border: 'none', fontWeight: 'bold' }}
                        >
                          🗑 Borrar
                        </button>
                      </div>
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