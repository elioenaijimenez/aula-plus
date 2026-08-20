import { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Recurso { id: string; titulo: string; descripcion: string; tipo: 'PDF' | 'IMG'; url: string; categoria?: string; cover?: string; }

const TextoExpandible = ({ texto }: { texto: string }) => {
  const [expandido, setExpandido] = useState(false);
  if (!texto) return null;
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '0.5rem', cursor: 'default' }}>
      <p style={{ 
        display: '-webkit-box', WebkitLineClamp: expandido ? 'unset' : 3, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4'
      }}>
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

const VisorPDFModal = ({ url, titulo, onClose }: { url: string, titulo: string, onClose: () => void }) => {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
    setPageNumber(1);
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal-content" style={{ maxWidth: '800px', width: '95%', maxHeight: '95vh', display: 'flex', flexDirection: 'column', padding: '1.5rem', backgroundColor: 'var(--bg-app)' }}>
        
        <div style={{ display: 'flex', flexDirection: window.innerWidth < 600 ? 'column-reverse' : 'row', justifyContent: 'space-between', alignItems: window.innerWidth < 600 ? 'flex-end' : 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', gap: '1rem' }}>
          <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: 'clamp(0.9rem, 3vw, 1.2rem)', width: '100%', wordBreak: 'break-all', textAlign: 'left' }}>{titulo}</h3>
          <button onClick={onClose} className="pill-btn" style={{ background: 'var(--accent-red)', color: 'white', flexShrink: 0 }}>Cerrar</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button disabled={pageNumber <= 1} onClick={() => setPageNumber(p => p - 1)} className="pill-btn" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>← Anterior</button>
          <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Página {pageNumber} de {numPages || '--'}</span>
          <button disabled={pageNumber >= (numPages || 1)} onClick={() => setPageNumber(p => p + 1)} className="pill-btn" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>Siguiente →</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', padding: '1rem', border: '1px solid var(--border-color)' }}>
          <Document file={url} onLoadSuccess={onDocumentLoadSuccess} loading={<div className="loader"></div>} error={<div style={{color: 'var(--accent-red)'}}>Error al cargar el PDF. Verifica que el archivo exista.</div>}>
            <Page pageNumber={pageNumber} renderTextLayer={false} renderAnnotationLayer={false} width={Math.min(window.innerWidth * 0.85, 600)} />
          </Document>
        </div>

      </div>
    </div>
  );
};

export default function Biblioteca({ onVolver }: { onVolver: () => void }) {
  const [tabActiva, setTabActiva] = useState<'normativos' | 'mis-recursos' | 'rincon'>('normativos');
  
  const [normativos, setNormativos] = useState<Recurso[]>([]);
  const [rinconLectura, setRinconLectura] = useState<Recurso[]>([]);
  const [cargandoGlobal, setCargandoGlobal] = useState(true);

  const [misRecursos, setMisRecursos] = useState<Recurso[]>([]);
  
  // Nuevos estados para el flujo de subida
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null);
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevaDescripcion, setNuevaDescripcion] = useState('');
  
  const [recursoEditando, setRecursoEditando] = useState<Recurso | null>(null);
  const [recursoViendo, setRecursoViendo] = useState<Recurso | null>(null);

  useEffect(() => {
    const fetchCatalogoGlobal = async () => {
      setCargandoGlobal(true);
      const q = query(collection(db, 'global_library'));
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

  const seleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivoPendiente(file);
    setNuevoTitulo(file.name);
    setNuevaDescripcion('');
  };

  const guardarNuevoRecurso = (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivoPendiente) return;
    
    const nuevoRecurso: Recurso = {
      id: Date.now().toString(),
      titulo: nuevoTitulo,
      descripcion: nuevaDescripcion,
      tipo: archivoPendiente.type === 'application/pdf' ? 'PDF' : 'IMG',
      url: URL.createObjectURL(archivoPendiente),
      cover: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&q=80&w=400'
    };
    
    setMisRecursos([nuevoRecurso, ...misRecursos]);
    setArchivoPendiente(null);
    setNuevoTitulo('');
    setNuevaDescripcion('');
  };

  const guardarEdicion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recursoEditando) return;
    setMisRecursos(misRecursos.map(r => r.id === recursoEditando.id ? recursoEditando : r));
    setRecursoEditando(null);
  };

  const eliminarRecursoPropio = (id: string) => {
    if (window.confirm("¿Eliminar este recurso permanentemente?")) {
      setMisRecursos(misRecursos.filter(r => r.id !== id));
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      {recursoViendo && (
        <VisorPDFModal url={recursoViendo.url} titulo={recursoViendo.titulo} onClose={() => setRecursoViendo(null)} />
      )}

      <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', marginBottom: '1.5rem', padding: '0.3rem 0.8rem' }}>
        ← Volver al Inicio
      </button>
      
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ margin: 0, fontWeight: 600, fontSize: '1.8rem', color: 'var(--accent-purple)' }}>📚 Biblioteca Docente</h3>
        <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0' }}>Catálogo de recursos oficiales e inspiración educativa.</p>
      </div>

      <div className="tabs-nav" style={{ marginBottom: '1.5rem' }}>
        <span className={`tab ${tabActiva === 'normativos' ? 'active' : ''}`} onClick={() => { setTabActiva('normativos'); setRecursoEditando(null); setArchivoPendiente(null); }}>📜 Normativos</span>
        <span className={`tab ${tabActiva === 'rincon' ? 'active' : ''}`} onClick={() => { setTabActiva('rincon'); setRecursoEditando(null); setArchivoPendiente(null); }}>☕ Rincón de Lectura</span>
        <span className={`tab ${tabActiva === 'mis-recursos' ? 'active' : ''}`} onClick={() => setTabActiva('mis-recursos')}>📂 Mi Drive (Mis Recursos)</span>
      </div>

      <div style={{ backgroundColor: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
        
        {cargandoGlobal && tabActiva !== 'mis-recursos' ? <div className="loader"></div> : (
          <>
            {tabActiva === 'normativos' && (
              <div className="book-grid">
                {normativos.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No hay normativos publicados.</p> : normativos.map(libro => (
                  <div key={libro.id} className="book-card" onClick={() => setRecursoViendo(libro)}>
                    <img src={libro.cover} alt="Cover" className="book-cover" />
                    <h4 className="book-title" style={{ marginTop: '0.5rem' }}>{libro.titulo}</h4>
                    <TextoExpandible texto={libro.descripcion} />
                    {libro.url && (
                      <a href={libro.url} download onClick={(e) => e.stopPropagation()} className="pill-btn" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', marginTop: 'auto', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>⬇️ Descargar</a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tabActiva === 'rincon' && (
              <div className="book-grid">
                {rinconLectura.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No hay libros sugeridos publicados.</p> : rinconLectura.map(libro => (
                  <div key={libro.id} className="book-card" onClick={() => setRecursoViendo(libro)}>
                    <img src={libro.cover} alt="Cover" className="book-cover" />
                    <h4 className="book-title" style={{ marginTop: '0.5rem' }}>{libro.titulo}</h4>
                    <TextoExpandible texto={libro.descripcion} />
                    {libro.url && (
                      <a href={libro.url} download onClick={(e) => e.stopPropagation()} className="pill-btn" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', marginTop: 'auto', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>⬇️ Descargar</a>
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
                <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent-purple)' }}>Editar Recurso</h3>
                <input type="text" value={recursoEditando.titulo} onChange={e => setRecursoEditando({...recursoEditando, titulo: e.target.value})} className="search-input" required placeholder="Título" />
                <textarea value={recursoEditando.descripcion} onChange={e => setRecursoEditando({...recursoEditando, descripcion: e.target.value})} className="search-input" style={{ resize: 'vertical' }} placeholder="Descripción"></textarea>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" className="pill-btn" style={{ flex: 1, background: 'var(--accent-purple)', color: 'white' }}>Guardar</button>
                  <button type="button" onClick={() => setRecursoEditando(null)} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Cancelar</button>
                </div>
              </form>
            ) : archivoPendiente ? (
              <form onSubmit={guardarNuevoRecurso} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '500px', margin: '0 auto', backgroundColor: 'var(--bg-input)', padding: '2rem', borderRadius: '16px' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent-blue)' }}>Detalles del Nuevo Recurso</h3>
                <input type="text" value={nuevoTitulo} onChange={e => setNuevoTitulo(e.target.value)} className="search-input" required placeholder="Título del archivo" />
                <textarea value={nuevaDescripcion} onChange={e => setNuevaDescripcion(e.target.value)} className="search-input" style={{ resize: 'vertical' }} placeholder="Escribe una breve descripción..."></textarea>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" className="pill-btn" style={{ flex: 1, background: 'var(--accent-blue)', color: 'white' }}>Guardar Recurso</button>
                  <button type="button" onClick={() => setArchivoPendiente(null)} className="pill-btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Cancelar</button>
                </div>
              </form>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>Espacio personal de almacenamiento. Sube tus PDFs e imágenes.</p>
                  <div className="file-upload-wrapper">
                    <button className="pill-btn" style={{ backgroundColor: 'var(--accent-blue)', color: 'white' }}>➕ Seleccionar Archivo</button>
                    <input type="file" accept="application/pdf, image/*" onChange={seleccionarArchivo} />
                  </div>
                </div>

                {misRecursos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)' }}>No has subido ningún recurso aún.</div>
                ) : (
                  <div className="book-grid">
                    {misRecursos.map(libro => (
                      <div key={libro.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                        <div className="book-card" onClick={() => setRecursoViendo(libro)} style={{ flex: 1 }}>
                          <img src={libro.cover} alt="Cover" className="book-cover" />
                          <h4 className="book-title" style={{ marginTop: '0.5rem' }}>{libro.titulo}</h4>
                          <TextoExpandible texto={libro.descripcion} />
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <a href={libro.url} download onClick={(e) => e.stopPropagation()} className="pill-btn" style={{ background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>⬇️ Descargar</a>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => setRecursoEditando(libro)} className="pill-btn" style={{ flex: 1, padding: '0.3rem', background: 'var(--bg-input)', fontSize: '0.75rem', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>Editar</button>
                            <button onClick={() => eliminarRecursoPropio(libro.id)} className="pill-btn" style={{ flex: 1, padding: '0.3rem', background: 'rgba(255, 77, 79, 0.1)', color: 'var(--accent-red)', fontSize: '0.75rem' }}>Borrar</button>
                          </div>
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