import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface Recurso { 
  id: string; titulo: string; descripcion: string; url: string; 
  imagenUrl?: string; // NUEVO: Soporte para portadas
  categoria: string; grado?: string; campoFormativo?: string; docenteEmail?: string; isGlobal?: boolean;
}

// Colores actualizados a la nueva paleta premium
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

export default function TabBibliotecaNube({ userEmail, tabActiva }: { userEmail: string, tabActiva: 'biblioteca' | 'drive' }) {
  const [recursosGlobales, setRecursosGlobales] = useState<Recurso[]>([]);
  const [misRecursos, setMisRecursos] = useState<Recurso[]>([]);
  const [favoritosIds, setFavoritosIds] = useState<string[]>([]);
  const [cargandoRecursos, setCargandoRecursos] = useState(false);
  
  const [creandoDrive, setCreandoDrive] = useState(false);
  const [recursoEditando, setRecursoEditando] = useState<Recurso | null>(null);
  const [nuevoTituloDrive, setNuevoTituloDrive] = useState('');
  const [nuevaUrlDrive, setNuevaUrlDrive] = useState('');
  const [nuevaDescDrive, setNuevaDescDrive] = useState('');
  const [nuevaImagenUrlDrive, setNuevaImagenUrlDrive] = useState(''); // Nuevo
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
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
      const nuevoDoc: any = { 
        titulo: nuevoTituloDrive, 
        descripcion: nuevaDescDrive, 
        url: nuevaUrlDrive, 
        docenteEmail: userEmail, 
        categoria: 'Mi Drive (Privado)', 
        createdAt: serverTimestamp() 
      };
      if (nuevaImagenUrlDrive.trim() !== '') nuevoDoc.imagenUrl = nuevaImagenUrlDrive;

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
      const actualizacion: any = { 
        titulo: recursoEditando.titulo, 
        descripcion: recursoEditando.descripcion, 
        url: recursoEditando.url 
      };
      if (recursoEditando.imagenUrl !== undefined) actualizacion.imagenUrl = recursoEditando.imagenUrl;

      await updateDoc(doc(db, 'teacher_drive', recursoEditando.id), actualizacion);
      setMisRecursos(misRecursos.map(r => r.id === recursoEditando.id ? { ...recursoEditando, ...actualizacion } : r));
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

  const librosFavoritos = recursosGlobales.filter(r => favoritosIds.includes(r.id));

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      
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

      {tabActiva === 'biblioteca' && (
        <div>
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
            <div className="lib-grid">
              {librosFavoritos.map(b => {
                const estilo = obtenerEstiloCategoria(b.categoria);
                const glowHex = b.categoria === 'LTG' ? obtenerColorGrado(b.grado) : estilo.color;
                
                return (
                  <div key={b.id} className="lib-card" onClick={() => abrirRecurso(b.url)}>
                    {b.imagenUrl ? (
                      <div className="lib-cover" style={{ backgroundImage: `url(${b.imagenUrl})` }}>
                        <BotonEstrella esFavorito={true} onToggle={(e) => toggleFavorito(b.id, e)} />
                      </div>
                    ) : (
                      <div className="lib-cover-fallback" style={{ backgroundColor: estilo.bg, color: estilo.color }}>
                        {estilo.icon}
                        <BotonEstrella esFavorito={true} onToggle={(e) => toggleFavorito(b.id, e)} />
                      </div>
                    )}
                    
                    <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: estilo.color, textTransform: 'uppercase', letterSpacing: '0.5px', backgroundColor: estilo.bg, padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                          {b.categoria}
                        </span>
                      </div>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.15rem', lineHeight: '1.3' }}>{b.titulo}</h4>
                      {b.categoria === 'LTG' && <div style={{ fontSize: '0.8rem', color: glowHex, marginBottom: '0.4rem', fontWeight: '600' }}>{b.grado} • {b.campoFormativo}</div>}
                      <div style={{ flex: 1 }}>
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

      {tabActiva === 'drive' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0 }}>Archivos Personales de Drive ({misRecursos.length})</h3>
            <button onClick={() => { setCreandoDrive(true); setRecursoEditando(null); setNuevoTituloDrive(''); setNuevaDescDrive(''); setNuevaUrlDrive(''); setNuevaImagenUrlDrive(''); }} className="pill-btn" style={{ backgroundColor: '#185ABD', color: 'white', fontWeight: 'bold' }}>➕ Añadir Enlace</button>
          </div>

          {(creandoDrive || recursoEditando) && (
            <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '2rem', animation: 'fadeIn 0.2s', display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
              
              {/* ONBOARDING UX: EXPLICACIÓN DE MI DRIVE */}
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
                <form onSubmit={recursoEditando ? guardarEdicionDrive : guardarNuevoDrive} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#185ABD' }}>{recursoEditando ? '✏️ Editar Recurso Privado' : '📂 Guardar Enlace en Mi Drive'}</h3>
                  <input type="text" required value={recursoEditando ? recursoEditando.titulo : nuevoTituloDrive} onChange={e => recursoEditando ? setRecursoEditando({...recursoEditando, titulo: e.target.value}) : setNuevoTituloDrive(e.target.value)} className="search-input" placeholder="Nombre del documento" />
                  <input type="url" required value={recursoEditando ? recursoEditando.url : nuevaUrlDrive} onChange={e => recursoEditando ? setRecursoEditando({...recursoEditando, url: e.target.value}) : setNuevaUrlDrive(e.target.value)} className="search-input" style={{ borderLeft: '4px solid #185ABD' }} placeholder="Enlace del archivo (Drive, OneDrive...)" />
                  <input type="url" value={recursoEditando ? (recursoEditando.imagenUrl || '') : nuevaImagenUrlDrive} onChange={e => recursoEditando ? setRecursoEditando({...recursoEditando, imagenUrl: e.target.value}) : setNuevaImagenUrlDrive(e.target.value)} className="search-input" placeholder="Enlace de la imagen de portada (Opcional)" />
                  <textarea value={recursoEditando ? recursoEditando.descripcion : nuevaDescDrive} onChange={e => recursoEditando ? setRecursoEditando({...recursoEditando, descripcion: e.target.value}) : setNuevaDescDrive(e.target.value)} className="search-input" style={{ resize: 'vertical' }} placeholder="Descripción opcional"></textarea>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button type="submit" disabled={guardando} className="pill-btn" style={{ flex: 1, background: '#185ABD', color: 'white', fontWeight: 'bold' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
                    <button type="button" onClick={() => { setCreandoDrive(false); setRecursoEditando(null); }} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Cancelar</button>
                  </div>
                </form>
              </div>

            </div>
          )}

          {cargandoRecursos ? <div className="loader"></div> : misRecursos.length === 0 && !creandoDrive ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', border: '2px dashed var(--border-color)', borderRadius: '24px' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>☁️</span>
              <h3>No tienes archivos en tu Nube</h3>
              <p>Vincula tus carpetas o PDFs de Google Drive para tenerlos a la mano durante tus clases.</p>
            </div>
          ) : (
            <div className="lib-grid">
              {misRecursos.map(r => {
                const estilo = obtenerEstiloCategoria(r.categoria);
                return (
                  <div key={r.id} className="lib-card" onClick={() => abrirRecurso(r.url)}>
                    
                    {r.imagenUrl ? (
                      <div className="lib-cover" style={{ backgroundImage: `url(${r.imagenUrl})` }}></div>
                    ) : (
                      <div className="lib-cover-fallback" style={{ backgroundColor: estilo.bg, color: estilo.color }}>
                        {estilo.icon}
                      </div>
                    )}

                    <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: estilo.color, textTransform: 'uppercase', letterSpacing: '0.5px', backgroundColor: estilo.bg, padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                          {r.categoria}
                        </span>
                        <span title="Solo tú puedes verlo" style={{ fontSize: '0.9rem' }}>🔒</span>
                      </div>
                      
                      <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.15rem', lineHeight: '1.3' }}>{r.titulo}</h4>
                      
                      <div style={{ flex: 1 }}>
                        <TextoExpandible texto={r.descripcion || 'Sin descripción adicional.'} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                        <button onClick={(e) => { e.stopPropagation(); setRecursoEditando(r); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="pill-btn" title="Editar" style={{ padding: '0.5rem 1rem', background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: 'bold' }}>✏️ Editar</button>
                        <button onClick={(e) => { e.stopPropagation(); eliminarDrive(r.id); }} className="pill-btn" title="Borrar" style={{ padding: '0.5rem 1rem', background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', border: 'none', fontWeight: 'bold' }}>🗑 Borrar</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}