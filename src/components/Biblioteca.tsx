import { useState, useEffect } from 'react';
import { collection, query, getDocs, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

interface Recurso { 
  id: string; 
  titulo: string; 
  descripcion: string; 
  url: string; 
  categoria: string; 
  grado?: string;
  campoFormativo?: string;
  docenteEmail?: string; 
  isGlobal?: boolean;
}

const CATEGORIAS_GLOBALES = [
  'LTG',
  'Curricular', 
  'Rincón de Lectura', 
  'Formatos para ti',
  'Normativo Nacional', 
  'Normativo Estatal'
];

const CATEGORIAS_FILTRO = ['Todas', '⭐ Favoritos', 'Mi Drive (Privado)', ...CATEGORIAS_GLOBALES];

const GRADOS = ['1° Secundaria', '2° Secundaria', '3° Secundaria'];
const CAMPOS_FORMATIVOS = [
  'Lenguajes', 
  'Saberes y Pensamiento Científico', 
  'Ética, Naturaleza y Sociedades', 
  'De lo Humano y lo Comunitario'
];

// Generador de estilos visuales según la categoría
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

// Generador de color dinámico para los grados de LTG
const obtenerColorGrado = (grado?: string) => {
  if (grado === '1° Secundaria') return '#4CAF50'; // Verde
  if (grado === '2° Secundaria') return '#1C51FF'; // Azul
  if (grado === '3° Secundaria') return '#FF4D4F'; // Rojo
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
    <button 
      onClick={onToggle}
      style={{ 
        position: 'absolute', 
        top: '10px', 
        right: '10px', 
        background: 'none', 
        border: 'none', 
        cursor: 'pointer', 
        zIndex: 10, 
        padding: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease'
      }}
      title={esFavorito ? "Quitar de favoritos" : "Añadir a favoritos"}
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        width="22" 
        height="22"
        fill={esFavorito ? "#FFC107" : "none"} 
        stroke="#FFC107" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
};

export default function Biblioteca({ onVolver }: { onVolver: () => void }) {
  const [recursosGlobales, setRecursosGlobales] = useState<Recurso[]>([]);
  const [misRecursos, setMisRecursos] = useState<Recurso[]>([]);
  const [cargando, setCargando] = useState(true);
  
  const [favoritosIds, setFavoritosIds] = useState<string[]>([]);
  
  const [filtroCat, setFiltroCat] = useState('Todas');
  const [busqueda, setBusqueda] = useState('');
  
  const [filtroGrado, setFiltroGrado] = useState('Todos');
  const [filtroCampo, setFiltroCampo] = useState('Todos');
  
  const [userEmail, setUserEmail] = useState('');
  const [recursoEditando, setRecursoEditando] = useState<Recurso | null>(null);
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevaDescripcion, setNuevaDescripcion] = useState('');
  const [nuevaUrl, setNuevaUrl] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setCargando(true);
      try {
        const sessionLocal = localStorage.getItem('aulaPlusSession');
        const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
        const email = sessionData?.user?.email || sessionData?.email || '';
        setUserEmail(email);

        if (email) {
          try {
            const favDoc = await getDoc(doc(db, 'teacher_favorites', email));
            if (favDoc.exists()) {
              setFavoritosIds(favDoc.data().ids || []);
            }
          } catch (e) { console.error("Error al cargar favoritos de la nube", e); }
        }

        const qGlobal = query(collection(db, 'global_library'), orderBy('createdAt', 'desc'));
        const snapGlobal = await getDocs(qGlobal);
        const listaGlobal: Recurso[] = [];
        snapGlobal.forEach(d => {
          listaGlobal.push({ id: d.id, ...d.data(), isGlobal: true } as Recurso);
        });
        setRecursosGlobales(listaGlobal);

        if (email) {
          const qDrive = query(collection(db, 'teacher_drive'), where('docenteEmail', '==', email));
          const snapDrive = await getDocs(qDrive);
          const listaDrive: Recurso[] = [];
          snapDrive.forEach(d => {
            listaDrive.push({ id: d.id, ...d.data(), categoria: 'Mi Drive (Privado)', isGlobal: false } as Recurso);
          });
          listaDrive.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setMisRecursos(listaDrive);
        }
      } catch (error) {
        console.error("Error al cargar la biblioteca:", error);
      }
      setCargando(false);
    };
    fetchData();
  }, []);

  const toggleFavorito = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    let nuevosFavs;
    if (favoritosIds.includes(id)) {
      nuevosFavs = favoritosIds.filter(favId => favId !== id);
    } else {
      nuevosFavs = [...favoritosIds, id];
    }
    setFavoritosIds(nuevosFavs);
    
    if (userEmail) {
      try {
        await setDoc(doc(db, 'teacher_favorites', userEmail), { ids: nuevosFavs }, { merge: true });
      } catch (error) {
        console.error("Error al guardar favoritos en la nube", error);
      }
    }
  };

  const todosLosRecursos = [...recursosGlobales, ...misRecursos];

  const recursosFiltrados = todosLosRecursos.filter(r => {
    const termino = busqueda.toLowerCase();
    
    const coincideTitulo = r.titulo ? r.titulo.toLowerCase().includes(termino) : false;
    const coincideDesc = r.descripcion ? r.descripcion.toLowerCase().includes(termino) : false;
    const coincideBusqueda = coincideTitulo || coincideDesc;
    
    let coincideCategoria = false;
    if (filtroCat === 'Todas') {
      coincideCategoria = true;
    } else if (filtroCat === '⭐ Favoritos') {
      coincideCategoria = favoritosIds.includes(r.id);
    } else {
      coincideCategoria = r.categoria === filtroCat;
    }

    let coincideGrado = true;
    let coincideCampo = true;
    if (filtroCat === 'LTG' && r.categoria === 'LTG') {
      if (filtroGrado !== 'Todos') coincideGrado = r.grado === filtroGrado;
      if (filtroCampo !== 'Todos') coincideCampo = r.campoFormativo === filtroCampo;
    }
    
    return coincideBusqueda && coincideCategoria && coincideGrado && coincideCampo;
  });

  const abrirFormularioNuevo = () => {
    setNuevoTitulo(''); setNuevaDescripcion(''); setNuevaUrl('');
    setCreandoNuevo(true);
    setFiltroCat('Mi Drive (Privado)'); 
  };

  const guardarNuevoRecurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaUrl || (!nuevaUrl.startsWith('http://') && !nuevaUrl.startsWith('https://'))) { 
      alert('Por favor ingresa un enlace válido que comience con http:// o https://'); return; 
    }
    
    setGuardando(true);
    try {
      const nuevoDoc = {
        titulo: nuevoTitulo,
        descripcion: nuevaDescripcion,
        url: nuevaUrl,
        docenteEmail: userEmail,
        categoria: 'Mi Drive (Privado)',
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'teacher_drive'), nuevoDoc);
      setMisRecursos([{ id: docRef.id, ...nuevoDoc, isGlobal: false } as Recurso, ...misRecursos]);
      setCreandoNuevo(false);
    } catch (error) {
      alert("Hubo un error al guardar tu enlace.");
    }
    setGuardando(false);
  };

  const guardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recursoEditando) return;
    if (!recursoEditando.url.startsWith('http://') && !recursoEditando.url.startsWith('https://')) { 
      alert('Por favor ingresa un enlace válido.'); return; 
    }

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
    if (window.confirm("¿Eliminar permanentemente este recurso de tu Drive privado?")) {
      try {
        await deleteDoc(doc(db, 'teacher_drive', id));
        setMisRecursos(misRecursos.filter(r => r.id !== id));
      } catch (error) {
        alert("No se pudo eliminar el recurso.");
      }
    }
  };

  const abrirDocumentoExterno = (url: string) => {
    if (url) { window.open(url, '_blank'); } 
    else { alert('Este recurso no tiene un enlace válido.'); }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      
      {/* MAGIA CSS: Inyectamos estilos para el hover glow dinámico */}
      <style>{`
        .biblioteca-card {
          transition: all 0.3s ease;
          border: 1px solid var(--border-color);
        }
        .biblioteca-card:hover {
          box-shadow: 0 4px 20px var(--glow-color-shadow);
          border-color: var(--glow-color-border);
          transform: translateY(-3px);
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginBottom: '1rem', padding: '0.3rem 0.8rem' }}>
            ← Volver al Inicio
          </button>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: '1.8rem', color: 'var(--accent-purple)' }}>📚 Biblioteca Docente</h3>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0' }}>Encuentra leyes, formatos, lecturas y guarda tus enlaces privados.</p>
        </div>

        <TutorialTooltip mensaje="Añade un enlace rápido a tu propia carpeta de Google Drive o un PDF que necesites tener a la mano." posicion="left">
          <button onClick={abrirFormularioNuevo} className="pill-btn" style={{ backgroundColor: '#185ABD', color: 'white' }}>
            ➕ Añadir a Mi Drive
          </button>
        </TutorialTooltip>
      </div>

      {(creandoNuevo || recursoEditando) && (
        <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '2rem', animation: 'fadeIn 0.2s' }}>
          
          {recursoEditando ? (
            <form onSubmit={guardarEdicion} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px', margin: '0 auto' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent-blue)', textAlign: 'center' }}>✏️ Editar Recurso Privado</h3>
              <input type="text" required value={recursoEditando.titulo} onChange={e => setRecursoEditando({...recursoEditando, titulo: e.target.value})} className="search-input" placeholder="Nombre del documento" />
              <input type="url" required value={recursoEditando.url} onChange={e => setRecursoEditando({...recursoEditando, url: e.target.value})} className="search-input" style={{ borderLeft: '4px solid var(--accent-blue)' }} placeholder="Enlace del archivo" />
              <textarea value={recursoEditando.descripcion} onChange={e => setRecursoEditando({...recursoEditando, descripcion: e.target.value})} className="search-input" style={{ resize: 'vertical' }} placeholder="Descripción opcional"></textarea>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" disabled={guardando} className="pill-btn" style={{ flex: 1, background: 'var(--accent-blue)', color: 'white' }}>{guardando ? 'Guardando...' : 'Guardar Cambios'}</button>
                <button type="button" onClick={() => setRecursoEditando(null)} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Cancelar</button>
              </div>
            </form>
          ) : (
            <form onSubmit={guardarNuevoRecurso} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px', margin: '0 auto' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#185ABD', textAlign: 'center' }}>📂 Guardar Enlace en Mi Drive</h3>
              <input type="text" required value={nuevoTitulo} onChange={e => setNuevoTitulo(e.target.value)} className="search-input" placeholder="Ej. Examen Diagnóstico (Google Forms)" />
              <input type="url" required value={nuevaUrl} onChange={e => setNuevaUrl(e.target.value)} className="search-input" style={{ borderLeft: '4px solid #185ABD' }} placeholder="Pega aquí tu enlace (Drive, OneDrive, Forms...)" />
              <textarea value={nuevaDescripcion} onChange={e => setNuevaDescripcion(e.target.value)} className="search-input" style={{ resize: 'vertical' }} placeholder="Notas opcionales para recordar qué es..."></textarea>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" disabled={guardando} className="pill-btn" style={{ flex: 1, background: '#185ABD', color: 'white' }}>{guardando ? 'Guardando...' : 'Guardar en Mi Bóveda'}</button>
                <button type="button" onClick={() => setCreandoNuevo(false)} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Cancelar</button>
              </div>
            </form>
          )}

        </div>
      )}

      <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        
        <input 
          type="text" 
          placeholder="🔍 Buscar por título o descripción del documento..." 
          className="search-input" 
          style={{ width: '100%', fontSize: '1.1rem', border: '1px solid var(--accent-purple)' }} 
          value={busqueda} 
          onChange={e => {
            setBusqueda(e.target.value);
            if (e.target.value.length > 0 && filtroCat !== 'Todas' && filtroCat !== '⭐ Favoritos') {
              setFiltroCat('Todas');
            }
          }} 
        />

        <div style={{ display: 'flex', gap: '0.8rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
          {CATEGORIAS_FILTRO.map(cat => {
            // Asignación de colores dinámicos a los botones
            let catColor = 'var(--text-muted)';
            if (cat === 'Todas') catColor = '#888';
            else if (cat === '⭐ Favoritos') catColor = '#FFC107';
            else if (cat === 'Mi Drive (Privado)') catColor = '#185ABD';
            else catColor = obtenerEstiloCategoria(cat).color;

            const isSelected = filtroCat === cat;

            return (
              <button 
                key={cat}
                onClick={() => { setFiltroCat(cat); setFiltroGrado('Todos'); setFiltroCampo('Todos'); }}
                className="pill-btn hover-opacity"
                style={{ 
                  flexShrink: 0, 
                  backgroundColor: isSelected ? catColor : 'transparent', 
                  color: isSelected ? (cat === '⭐ Favoritos' ? '#000' : '#fff') : catColor, 
                  border: `1px solid ${isSelected ? 'transparent' : catColor}`,
                  fontWeight: isSelected ? 'bold' : '600'
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {filtroCat === 'LTG' && (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem', backgroundColor: 'rgba(76, 175, 80, 0.05)', borderRadius: '12px', border: '1px solid rgba(76, 175, 80, 0.2)', animation: 'fadeIn 0.3s' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Filtrar por Grado</label>
              <select className="search-input" value={filtroGrado} onChange={e => setFiltroGrado(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="Todos">Todos los Grados</option>
                {GRADOS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Filtrar por Campo Formativo</label>
              <select className="search-input" value={filtroCampo} onChange={e => setFiltroCampo(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="Todos">Todos los Campos</option>
                {CAMPOS_FORMATIVOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {cargando ? <div className="loader"></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          
          {recursosFiltrados.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-panel)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
              <p style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>No se encontraron recursos que coincidan.</p>
              {filtroCat !== 'Todas' && (
                <button onClick={() => setFiltroCat('Todas')} className="pill-btn" style={{ backgroundColor: 'var(--accent-blue)', color: 'white' }}>
                  Buscar en Todas las Categorías
                </button>
              )}
            </div>
          ) : (
            recursosFiltrados.map(r => {
              const estilo = obtenerEstiloCategoria(r.categoria);
              const esFavorito = favoritosIds.includes(r.id);
              
              // Determinar el color del glow
              const glowHex = r.categoria === 'LTG' ? obtenerColorGrado(r.grado) : estilo.color;

              return (
                <div 
                  key={r.id} 
                  className="activity-card biblioteca-card" 
                  onClick={() => abrirDocumentoExterno(r.url)}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    backgroundColor: 'var(--bg-input)', 
                    margin: 0, 
                    cursor: 'pointer', 
                    position: 'relative',
                    // Variables inyectadas para el CSS hover mágico
                    '--glow-color-shadow': `${glowHex}66`, // 40% de opacidad
                    '--glow-color-border': glowHex
                  } as React.CSSProperties}
                >
                  <BotonEstrella esFavorito={esFavorito} onToggle={(e) => toggleFavorito(r.id, e)} />

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1, paddingRight: '25px' }}>
                    <div style={{ backgroundColor: estilo.bg, color: estilo.color, minWidth: '48px', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                      {estilo.icon}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: estilo.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {r.categoria}
                      </span>
                      <h4 style={{ margin: '0.2rem 0 0.4rem 0', color: 'var(--text-main)', fontSize: '1.1rem', lineHeight: '1.3' }}>{r.titulo}</h4>
                      
                      {r.categoria === 'LTG' && (
                        <div style={{ fontSize: '0.8rem', color: glowHex, marginBottom: '0.4rem', fontWeight: '600' }}>
                          {r.grado} • {r.campoFormativo}
                        </div>
                      )}

                      <TextoExpandible texto={r.descripcion} />
                    </div>
                  </div>
                  
                  {!r.isGlobal && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setRecursoEditando(r); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                        className="pill-btn" 
                        title="Editar"
                        style={{ padding: '0.5rem 1rem', background: 'var(--bg-panel)', fontSize: '1.1rem', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); eliminarRecursoPropio(r.id); }} 
                        className="pill-btn" 
                        title="Borrar"
                        style={{ padding: '0.5rem 1rem', background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', fontSize: '1.1rem', border: 'none' }}
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
}