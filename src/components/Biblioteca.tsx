import { useState, useEffect } from 'react';
import { collection, query, getDocs, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

interface Recurso { 
  id: string; 
  titulo: string; 
  descripcion: string; 
  url: string; 
  categoria: string; 
  docenteEmail?: string; 
  isGlobal?: boolean;
}

const CATEGORIAS_GLOBALES = [
  'Normativo Nacional', 
  'Normativo Estatal', 
  'Curricular', 
  'Rincón de Lectura', 
  'Formatos para ti'
];

const CATEGORIAS_FILTRO = ['Todas', ...CATEGORIAS_GLOBALES, 'Mi Drive (Privado)'];

// Generador de estilos visuales según la categoría
const obtenerEstiloCategoria = (categoria: string) => {
  switch (categoria) {
    case 'Normativo Nacional': return { icon: '🇲🇽', color: '#1C51FF', bg: 'rgba(28, 81, 255, 0.1)' }; // Azul
    case 'Normativo Estatal': return { icon: '📍', color: '#00BFA5', bg: 'rgba(0, 191, 165, 0.1)' }; // Verde
    case 'Curricular': return { icon: '📖', color: '#9C27B0', bg: 'rgba(156, 39, 176, 0.1)' }; // Morado
    case 'Rincón de Lectura': return { icon: '☕', color: '#FF9800', bg: 'rgba(255, 152, 0, 0.1)' }; // Naranja
    case 'Formatos para ti': return { icon: '📝', color: '#E91E63', bg: 'rgba(233, 30, 99, 0.1)' }; // Rosa
    case 'Mi Drive (Privado)': return { icon: '📂', color: '#185ABD', bg: 'rgba(24, 90, 189, 0.1)' }; // Azul Oscuro
    default: return { icon: '📄', color: '#757575', bg: 'rgba(117, 117, 117, 0.1)' }; // Gris
  }
};

const TextoExpandible = ({ texto }: { texto: string }) => {
  const [expandido, setExpandido] = useState(false);
  if (!texto) return null;
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '0.5rem', cursor: 'default' }}>
      <p style={{ display: '-webkit-box', WebkitLineClamp: expandido ? 'unset' : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
        {texto}
      </p>
      {texto.length > 100 && (
        <button onClick={(e) => { e.stopPropagation(); setExpandido(!expandido); }} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '0.85rem', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}>
          {expandido ? 'Leer menos' : 'Leer más...'}
        </button>
      )}
    </div>
  );
};

export default function Biblioteca({ onVolver }: { onVolver: () => void }) {
  const [recursosGlobales, setRecursosGlobales] = useState<Recurso[]>([]);
  const [misRecursos, setMisRecursos] = useState<Recurso[]>([]);
  const [cargando, setCargando] = useState(true);
  
  // Filtros y Búsqueda estilo App
  const [filtroCat, setFiltroCat] = useState('Todas');
  const [busqueda, setBusqueda] = useState('');
  
  // Estados para Mi Drive
  const [userEmail, setUserEmail] = useState('');
  const [recursoEditando, setRecursoEditando] = useState<Recurso | null>(null);
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevaDescripcion, setNuevaDescripcion] = useState('');
  const [nuevaUrl, setNuevaUrl] = useState('');

  // Carga inicial unificada
  useEffect(() => {
    const fetchData = async () => {
      setCargando(true);
      try {
        const sessionLocal = localStorage.getItem('aulaPlusSession');
        const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
        const email = sessionData?.user?.email || sessionData?.email || '';
        setUserEmail(email);

        // 1. Cargar Catálogo Global (del SuperAdmin)
        const qGlobal = query(collection(db, 'global_library'), orderBy('createdAt', 'desc'));
        const snapGlobal = await getDocs(qGlobal);
        const listaGlobal: Recurso[] = [];
        snapGlobal.forEach(d => {
          listaGlobal.push({ id: d.id, ...d.data(), isGlobal: true } as Recurso);
        });
        setRecursosGlobales(listaGlobal);

        // 2. Cargar Mi Drive (del Docente)
        if (email) {
          const qDrive = query(collection(db, 'teacher_drive'), where('docenteEmail', '==', email));
          const snapDrive = await getDocs(qDrive);
          const listaDrive: Recurso[] = [];
          snapDrive.forEach(d => {
            listaDrive.push({ id: d.id, ...d.data(), categoria: 'Mi Drive (Privado)', isGlobal: false } as Recurso);
          });
          // Ordenamos localmente por si createdAt viene nulo al instante de crear
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

  // Consolidar todos los recursos para el buscador global
  const todosLosRecursos = [...recursosGlobales, ...misRecursos];

  // Aplicar filtros: Título + Descripción
  const recursosFiltrados = todosLosRecursos.filter(r => {
    const termino = busqueda.toLowerCase();
    
    // Búsqueda robusta en título y descripción
    const coincideTitulo = r.titulo ? r.titulo.toLowerCase().includes(termino) : false;
    const coincideDesc = r.descripcion ? r.descripcion.toLowerCase().includes(termino) : false;
    const coincideBusqueda = coincideTitulo || coincideDesc;
    
    const coincideCategoria = filtroCat === 'Todas' || r.categoria === filtroCat;
    
    return coincideBusqueda && coincideCategoria;
  });

  // Acciones de Mi Drive
  const abrirFormularioNuevo = () => {
    setNuevoTitulo(''); setNuevaDescripcion(''); setNuevaUrl('');
    setCreandoNuevo(true);
    setFiltroCat('Mi Drive (Privado)'); // Forzamos a ver la sección privada para no confundirse
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
      
      {/* CABECERA */}
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

      {/* FORMULARIOS DE MI DRIVE (Solo visibles si se activan) */}
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

      {/* BUSCADOR Y FILTROS ESTILO APP */}
      <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* Buscador de texto con Lógica UX Inteligente */}
        <input 
          type="text" 
          placeholder="🔍 Buscar por título o descripción del documento..." 
          className="search-input" 
          style={{ width: '100%', fontSize: '1.1rem', border: '1px solid var(--accent-purple)' }} 
          value={busqueda} 
          onChange={e => {
            setBusqueda(e.target.value);
            // Magia UX: Si el usuario escribe algo, quitamos el filtro de categoría para asegurar que encuentre el archivo en toda la biblioteca
            if (e.target.value.length > 0 && filtroCat !== 'Todas') {
              setFiltroCat('Todas');
            }
          }} 
        />

        {/* Botones de Categorías desplazables (Scroll horizontal suave en móviles) */}
        <div style={{ display: 'flex', gap: '0.8rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
          {CATEGORIAS_FILTRO.map(cat => (
            <button 
              key={cat}
              onClick={() => setFiltroCat(cat)}
              className="pill-btn"
              style={{ 
                flexShrink: 0, 
                backgroundColor: filtroCat === cat ? (cat === 'Mi Drive (Privado)' ? '#185ABD' : 'var(--text-main)') : 'transparent', 
                color: filtroCat === cat ? 'var(--bg-app)' : 'var(--text-muted)', 
                border: `1px solid ${filtroCat === cat ? 'transparent' : 'var(--border-color)'}`,
                fontWeight: filtroCat === cat ? 'bold' : 'normal'
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* REJILLA DE RECURSOS */}
      {cargando ? <div className="loader"></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          
          {recursosFiltrados.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-panel)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
              <p style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>No se encontraron recursos que coincidan con tu búsqueda.</p>
              {filtroCat !== 'Todas' && (
                <button onClick={() => setFiltroCat('Todas')} className="pill-btn" style={{ backgroundColor: 'var(--accent-blue)', color: 'white' }}>
                  Buscar en Todas las Categorías
                </button>
              )}
            </div>
          ) : (
            recursosFiltrados.map(r => {
              const estilo = obtenerEstiloCategoria(r.categoria);
              return (
                <div 
                  key={r.id} 
                  className="activity-card hover-opacity" 
                  onClick={() => abrirDocumentoExterno(r.url)}
                  style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-input)', margin: 0, cursor: 'pointer', position: 'relative' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1 }}>
                    <div style={{ backgroundColor: estilo.bg, color: estilo.color, width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                      {estilo.icon}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: estilo.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {r.categoria}
                      </span>
                      <h4 style={{ margin: '0.2rem 0 0.4rem 0', color: 'var(--text-main)', fontSize: '1.1rem', lineHeight: '1.3' }}>{r.titulo}</h4>
                      <TextoExpandible texto={r.descripcion} />
                    </div>
                  </div>
                  
                  {/* SI ES UN RECURSO PRIVADO, MOSTRAMOS LOS BOTONES DE EDICIÓN */}
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