import { useState, useEffect } from 'react';
import { collection, query, getDocs, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

interface Recurso { 
  id: string; 
  titulo: string; 
  descripcion: string; 
  url: string; 
  imagenUrl?: string; // NUEVO: Soporte para portadas
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
    case 'LTG': return { icon: '📚', color: '#4CAF50', bg: '#E8F5E9' }; 
    case 'Curricular': return { icon: '📖', color: '#9C27B0', bg: '#F3E5F5' }; 
    case 'Rincón de Lectura': return { icon: '☕', color: '#FF9800', bg: '#FFF3E0' }; 
    case 'Formatos para ti': return { icon: '📝', color: '#E91E63', bg: '#FCE4EC' }; 
    case 'Normativo Nacional': return { icon: '⚖️', color: '#1C51FF', bg: '#E8EDFF' }; 
    case 'Normativo Estatal': return { icon: '📍', color: '#00BFA5', bg: '#E0F2F1' }; 
    case 'Mi Drive (Privado)': return { icon: '📂', color: '#185ABD', bg: '#E6F0FF' }; 
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

const BotonEstrella = ({ esFavorito, onToggle }: { esFavorito: boolean, onToggle: (e: React.MouseEvent) => void }) => {
  return (
    <button 
      onClick={onToggle}
      className="btn-favorito"
      style={{ 
        position: 'absolute', top: '10px', right: '10px', 
        background: esFavorito ? '#fff' : 'rgba(255,255,255,0.7)', 
        border: 'none', borderRadius: '50%', width: '36px', height: '36px',
        cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'all 0.2s ease'
      }}
      title={esFavorito ? "Quitar de favoritos" : "Añadir a favoritos"}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill={esFavorito ? "#FFC107" : "none"} stroke={esFavorito ? "#FFC107" : "#666"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  const [nuevaImagenUrl, setNuevaImagenUrl] = useState('');

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
    setNuevoTitulo(''); setNuevaDescripcion(''); setNuevaUrl(''); setNuevaImagenUrl('');
    setCreandoNuevo(true);
    setFiltroCat('Mi Drive (Privado)'); 
  };

  const guardarNuevoRecurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaUrl || (!nuevaUrl.startsWith('http://') && !nuevaUrl.startsWith('https://'))) { 
      alert('Por favor ingresa un enlace válido del documento (http:// o https://)'); return; 
    }
    
    setGuardando(true);
    try {
      const nuevoDoc: any = {
        titulo: nuevoTitulo,
        descripcion: nuevaDescripcion,
        url: nuevaUrl,
        docenteEmail: userEmail,
        categoria: 'Mi Drive (Privado)',
        createdAt: serverTimestamp()
      };
      if (nuevaImagenUrl.trim() !== '') nuevoDoc.imagenUrl = nuevaImagenUrl;

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
      const actualizacion: any = {
        titulo: recursoEditando.titulo,
        descripcion: recursoEditando.descripcion,
        url: recursoEditando.url,
      };
      if (recursoEditando.imagenUrl !== undefined) actualizacion.imagenUrl = recursoEditando.imagenUrl;

      await updateDoc(doc(db, 'teacher_drive', recursoEditando.id), actualizacion);
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
        .btn-favorito:hover {
          transform: scale(1.1);
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginBottom: '1rem', padding: '0.3rem 0.8rem' }}>
            ← Volver al Dashboard
          </button>
          <h3 style={{ margin: 0, fontWeight: 800, fontSize: '2rem', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>📚 Biblioteca Central</h3>
          <p style={{ color: 'var(--text-muted)', margin: '0.4rem 0 0 0', fontSize: '1.05rem' }}>Explora el acervo global o guarda tus enlaces privados en Mi Drive.</p>
        </div>

        <TutorialTooltip mensaje="Mi Drive es tu espacio privado. Guarda aquí tus PDF o presentaciones para encontrarlos rápido." posicion="left">
          <button onClick={abrirFormularioNuevo} className="pill-btn" style={{ backgroundColor: '#185ABD', color: 'white', fontWeight: 'bold', fontSize: '1.1rem', padding: '0.8rem 1.5rem', boxShadow: '0 4px 15px rgba(24, 90, 189, 0.3)' }}>
            ➕ Añadir a Mi Drive
          </button>
        </TutorialTooltip>
      </div>

      {/* FORMULARIO MEJORADO CON EXPLICACIÓN DE "MI DRIVE" */}
      {(creandoNuevo || recursoEditando) && (
        <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '3rem', animation: 'fadeIn 0.2s', display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
          
          <div style={{ flex: 1, minWidth: '280px', backgroundColor: 'rgba(24, 90, 189, 0.05)', padding: '1.5rem', borderRadius: '16px', border: '1px dashed #185ABD' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#185ABD', fontSize: '1.2rem' }}>🤔 ¿Qué es Mi Drive?</h4>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
              Es tu <b>bóveda personal</b>. El sistema no guarda archivos pesados, sino que guarda tus <b>enlaces</b>.
            </p>
            <ol style={{ fontSize: '0.9rem', color: 'var(--text-muted)', paddingLeft: '1.2rem', lineHeight: '1.6' }}>
              <li>Sube tu PDF, Word o presentación a tu Google Drive, OneDrive o Dropbox personal.</li>
              <li>Obtén el enlace de compartir (Asegúrate de que esté configurado como "Cualquier usuario con el enlace").</li>
              <li>Pega ese enlace aquí. Puedes agregarle una portada copiando la ruta de una imagen de Google.</li>
            </ol>
            <p style={{ margin: '1rem 0 0 0', fontSize: '0.85rem', color: '#b20000', fontWeight: 'bold' }}>Nadie más en Aula+ puede ver los recursos que guardas aquí.</p>
          </div>

          <div style={{ flex: 1.5, minWidth: '300px' }}>
            {recursoEditando ? (
              <form onSubmit={guardarEdicion} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-blue)' }}>✏️ Editar Recurso Privado</h3>
                <input type="text" required value={recursoEditando.titulo} onChange={e => setRecursoEditando({...recursoEditando, titulo: e.target.value})} className="search-input" placeholder="Nombre del documento..." />
                <input type="url" required value={recursoEditando.url} onChange={e => setRecursoEditando({...recursoEditando, url: e.target.value})} className="search-input" style={{ borderLeft: '4px solid var(--accent-blue)' }} placeholder="Enlace del archivo (http://...)" />
                <input type="url" value={recursoEditando.imagenUrl || ''} onChange={e => setRecursoEditando({...recursoEditando, imagenUrl: e.target.value})} className="search-input" placeholder="Enlace de la imagen de portada (Opcional)" />
                <textarea value={recursoEditando.descripcion} onChange={e => setRecursoEditando({...recursoEditando, descripcion: e.target.value})} className="search-input" style={{ resize: 'vertical' }} placeholder="Descripción opcional..."></textarea>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" disabled={guardando} className="pill-btn" style={{ flex: 1, background: 'var(--accent-blue)', color: 'white' }}>{guardando ? 'Guardando...' : 'Guardar Cambios'}</button>
                  <button type="button" onClick={() => setRecursoEditando(null)} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Cancelar</button>
                </div>
              </form>
            ) : (
              <form onSubmit={guardarNuevoRecurso} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#185ABD' }}>📂 Guardar Nuevo Enlace</h3>
                <input type="text" required value={nuevoTitulo} onChange={e => setNuevoTitulo(e.target.value)} className="search-input" placeholder="Ej. Examen de Diagnóstico Formulario..." />
                <input type="url" required value={nuevaUrl} onChange={e => setNuevaUrl(e.target.value)} className="search-input" style={{ borderLeft: '4px solid #185ABD' }} placeholder="Enlace público del documento (http://...)" />
                <input type="url" value={nuevaImagenUrl} onChange={e => setNuevaImagenUrl(e.target.value)} className="search-input" placeholder="Enlace de una imagen de portada (Opcional)" />
                <textarea value={nuevaDescripcion} onChange={e => setNuevaDescripcion(e.target.value)} className="search-input" style={{ resize: 'vertical' }} placeholder="Notas opcionales para recordar qué es..."></textarea>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" disabled={guardando} className="pill-btn" style={{ flex: 1, background: '#185ABD', color: 'white', fontWeight: 'bold' }}>{guardando ? 'Guardando...' : 'Guardar en Mi Bóveda'}</button>
                  <button type="button" onClick={() => setCreandoNuevo(false)} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Cancelar</button>
                </div>
              </form>
            )}
          </div>

        </div>
      )}

      {/* FILTROS MEJORADOS UX */}
      <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
        
        <input 
          type="text" 
          placeholder="🔍 Buscar recursos, libros, formatos..." 
          className="search-input" 
          style={{ width: '100%', fontSize: '1.1rem', margin: 0, border: '2px solid transparent', backgroundColor: 'var(--bg-app)' }} 
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
                className="pill-btn"
                style={{ 
                  flexShrink: 0, 
                  backgroundColor: isSelected ? catColor : 'transparent', 
                  color: isSelected ? (cat === '⭐ Favoritos' ? '#000' : '#fff') : catColor, 
                  border: `1px solid ${isSelected ? 'transparent' : catColor}`,
                  fontWeight: isSelected ? 'bold' : 'normal',
                  padding: '0.5rem 1.2rem',
                  transition: 'all 0.2s ease'
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {filtroCat === 'LTG' && (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', animation: 'fadeIn 0.3s' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <select className="search-input" value={filtroGrado} onChange={e => setFiltroGrado(e.target.value)} style={{ margin: 0 }}>
                <option value="Todos">Todos los Grados</option>
                {GRADOS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <select className="search-input" value={filtroCampo} onChange={e => setFiltroCampo(e.target.value)} style={{ margin: 0 }}>
                <option value="Todos">Todos los Campos Formativos</option>
                {CAMPOS_FORMATIVOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* GRID ESTILO DRIBBBLE */}
      {cargando ? <div className="loader" style={{ marginTop: '4rem' }}></div> : (
        <div className="lib-grid">
          
          {recursosFiltrados.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem 1rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-panel)', borderRadius: '24px', border: '2px dashed var(--border-color)' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🧐</span>
              <p style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: 'bold' }}>No se encontraron recursos.</p>
              {filtroCat !== 'Todas' && (
                <button onClick={() => setFiltroCat('Todas')} className="pill-btn" style={{ backgroundColor: 'var(--accent-blue)', color: 'white' }}>
                  Mostrar Todo el Catálogo
                </button>
              )}
            </div>
          ) : (
            recursosFiltrados.map(r => {
              const estilo = obtenerEstiloCategoria(r.categoria);
              const esFavorito = favoritosIds.includes(r.id);
              
              return (
                <div key={r.id} className="lib-card" onClick={() => abrirDocumentoExterno(r.url)}>
                  
                  {/* PORTADA VISUAL */}
                  {r.imagenUrl ? (
                    <div className="lib-cover" style={{ backgroundImage: `url(${r.imagenUrl})` }}>
                      <BotonEstrella esFavorito={esFavorito} onToggle={(e) => toggleFavorito(r.id, e)} />
                    </div>
                  ) : (
                    <div className="lib-cover-fallback" style={{ backgroundColor: estilo.bg, color: estilo.color }}>
                      {estilo.icon}
                      <BotonEstrella esFavorito={esFavorito} onToggle={(e) => toggleFavorito(r.id, e)} />
                    </div>
                  )}

                  {/* CUERPO DEL LIBRO */}
                  <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: estilo.color, textTransform: 'uppercase', letterSpacing: '0.5px', backgroundColor: estilo.bg, padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                        {r.categoria}
                      </span>
                      {r.categoria === 'Mi Drive (Privado)' && <span title="Solo tú puedes verlo" style={{ fontSize: '0.9rem' }}>🔒</span>}
                    </div>
                    
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.15rem', lineHeight: '1.3' }}>
                      {r.titulo}
                    </h4>
                    
                    {r.categoria === 'LTG' && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                        {r.grado} • {r.campoFormativo}
                      </div>
                    )}

                    <div style={{ flex: 1 }}>
                      <TextoExpandible texto={r.descripcion || 'Sin descripción adicional.'} />
                    </div>
                    
                    {/* BOTONES DE EDICIÓN PARA MI DRIVE */}
                    {!r.isGlobal && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setRecursoEditando(r); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                          className="pill-btn" 
                          title="Editar información"
                          style={{ padding: '0.5rem 1rem', background: 'var(--bg-input)', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 'bold' }}
                        >
                          ✏️ Editar
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); eliminarRecursoPropio(r.id); }} 
                          className="pill-btn" 
                          title="Borrar recurso"
                          style={{ padding: '0.5rem 1rem', background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', fontSize: '0.9rem', border: 'none', fontWeight: 'bold' }}
                        >
                          🗑
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
}