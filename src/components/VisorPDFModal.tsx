import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configuración del motor PDF inyectada a nivel global para que funcione en cualquier módulo
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function VisorPDFModal({ url, titulo, onClose }: { url: string, titulo: string, onClose: () => void }) {
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
          {url ? (
            <Document file={url} onLoadSuccess={onDocumentLoadSuccess} loading={<div className="loader"></div>} error={<div style={{color: 'var(--accent-red)', textAlign: 'center', padding: '2rem'}}>Error al cargar el PDF.<br/>Es posible que el archivo haya sido eliminado o el enlace no sea válido.</div>}>
              <Page pageNumber={pageNumber} renderTextLayer={false} renderAnnotationLayer={false} width={Math.min(window.innerWidth * 0.85, 600)} />
            </Document>
          ) : (
            <div style={{color: 'var(--text-muted)', padding: '2rem'}}>No hay un documento adjunto a este registro.</div>
          )}
        </div>

      </div>
    </div>
  );
}