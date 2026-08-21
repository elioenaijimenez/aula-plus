import { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';
import * as XLSX from 'xlsx';

interface Llave { 
  id: string; 
  codigo: string; 
  duracion: string; 
  estado: 'disponible' | 'en uso' | 'caducada'; 
  usuario: string; 
  correo?: string;
  telefono?: string;
  fechaActivacion?: string;
  fechaCaducidad?: string;
  fechaRevocacion?: string; // Nuevo campo para el rastro de auditoría
  createdAt?: any; 
}

export default function GestorLlaves() {
  const [llaves, setLlaves] = useState<Llave[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  
  const [nuevaDuracion, setNuevaDuracion] = useState('7 Días');
  const [busqueda, setBusqueda] = useState('');
  const [mostrarBoveda, setMostrarBoveda] = useState(false);

  useEffect(() => {
    const fetchLlaves = async () => {
      setCargando(true);
      try {
        const q = query(collection(db, 'keys'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const lista: Llave[] = [];
        snap.forEach(d => lista.push({ id: d.id, ...d.data() } as Llave));
        setLlaves(lista);
      } catch (error) {
        console.error("Error cargando llaves:", error);
      }
      setCargando(false);
    };
    fetchLlaves();
  }, []);

  const generarLlave = async () => {
    setGuardando(true);
    try {
      const code = `AP-${nuevaDuracion.charAt(0).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const nuevaLlave: Omit<Llave, 'id'> = {
        codigo: code,
        duracion: nuevaDuracion,
        estado: 'disponible',
        usuario: '-',
        correo: '-',
        telefono: '-',
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'keys'), nuevaLlave);
      setLlaves([{ id: docRef.id, ...nuevaLlave } as Llave, ...llaves]);
    } catch (error) { alert("Error al generar la llave."); }
    setGuardando(false);
  };

  const revocarLlave = async (id: string) => {
    if (window.confirm("¿Mandar esta llave a la Bóveda de Caducadas?")) {
      try {
        const hoy = new Date();
        const fechaLocal = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        
        await updateDoc(doc(db, 'keys', id), { 
          estado: 'caducada', 
          fechaRevocacion: fechaLocal // Estampamos la fecha de la revocación
        });
        
        setLlaves(llaves.map(l => l.id === id ? { ...l, estado: 'caducada', fechaRevocacion: fechaLocal } : l));
      } catch (error) { alert("Error al revocar la llave."); }
    }
  };

  const calcularDiasRestantes = (caducidad?: string) => {
    if (!caducidad) return null;
    const hoy = new Date();
    const limite = new Date(caducidad);
    const diffTime = limite.getTime() - hoy.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const llavesFiltradas = llaves.filter(l => 
    l.codigo.toLowerCase().includes(busqueda.toLowerCase()) || 
    (l.usuario && l.usuario.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const activas = llavesFiltradas.filter(l => l.estado !== 'caducada');
  const caducadas = llavesFiltradas.filter(l => l.estado === 'caducada');

  const exportarExcel = () => {
    if (llaves.length === 0) return alert("No hay datos para exportar.");
    const data = llaves.map(l => ({
      Código: l.codigo,
      Duración: l.duracion,
      Estado: l.estado.toUpperCase(),
      Usuario: l.usuario,
      Correo: l.correo || '-',
      Teléfono: l.telefono || '-',
      Activación: l.fechaActivacion || '-',
      Caducidad: l.fechaCaducidad || '-',
      Revocación: l.fechaRevocacion || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Llaves_AulaPlus");
    XLSX.writeFile(workbook, "Reporte_Llaves_AulaPlus.xlsx");
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      
      {/* PANEL SUPERIOR: GENERADOR Y EXPORTACIÓN */}
      <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)', display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <TutorialTooltip mensaje="Selecciona la duración de la licencia y genera un nuevo código único (KeyPlus) para dárselo a un docente." esBloque={true} posicion="bottom">
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold' }}>Generar Nueva KeyPlus</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <select className="search-input" value={nuevaDuracion} onChange={e => setNuevaDuracion(e.target.value)} style={{ flex: 1 }}>
                  <option value="7 Días">Prueba (7 Días)</option>
                  <option value="1 Mes">1 Mes</option>
                  <option value="1 Año">1 Año</option>
                </select>
                <button disabled={guardando} onClick={generarLlave} className="pill-btn" style={{ background: 'var(--accent-blue)', color: 'white', flex: 1 }}>
                  {guardando ? 'Creando...' : '➕ Generar'}
                </button>
              </div>
            </div>
          </TutorialTooltip>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <TutorialTooltip mensaje="Descarga el reporte completo de todas las llaves, su estado y los docentes que las usan." posicion="left">
            <button onClick={exportarExcel} className="pill-btn" style={{ background: 'var(--accent-green)', color: '#000', border: '1px solid var(--border-color)' }}>📊 Exportar Excel</button>
          </TutorialTooltip>
        </div>
      </div>

      {/* BUSCADOR */}
      <div style={{ marginBottom: '1.5rem' }}>
        <TutorialTooltip mensaje="Busca rápidamente por el código de la llave o el nombre del maestro." esBloque={true} posicion="top">
          <input 
            type="text" 
            placeholder="🔍 Buscar por código de llave o nombre de usuario..." 
            className="search-input" 
            value={busqueda} 
            onChange={e => setBusqueda(e.target.value)} 
            style={{ border: '1px solid var(--accent-blue)', fontSize: '1.1rem', width: '100%' }}
          />
        </TutorialTooltip>
      </div>

      {cargando ? <div className="loader"></div> : (
        <>
          {/* TABLA DE LLAVES ACTIVAS */}
          <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent-green)' }}>Llaves Activas y Disponibles ({activas.length})</h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '0.8rem 0.5rem', color: 'var(--text-muted)' }}>Código</th>
                    <th style={{ padding: '0.8rem 0.5rem', color: 'var(--text-muted)' }}>Estado / Duración</th>
                    <th style={{ padding: '0.8rem 0.5rem', color: 'var(--text-muted)' }}>Usuario (Contacto)</th>
                    <th style={{ padding: '0.8rem 0.5rem', color: 'var(--text-muted)' }}>Fechas y Alertas</th>
                    <th style={{ padding: '0.8rem 0.5rem', color: 'var(--text-muted)' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {activas.map(llave => {
                    const diasRestantes = calcularDiasRestantes(llave.fechaCaducidad);
                    const requiereAlerta = llave.estado === 'en uso' && diasRestantes !== null && diasRestantes <= 3;

                    return (
                      <tr key={llave.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: requiereAlerta ? 'rgba(255, 77, 79, 0.05)' : 'transparent' }}>
                        <td style={{ padding: '0.8rem 0.5rem', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.1rem', color: requiereAlerta ? 'var(--accent-red)' : 'var(--text-main)' }}>{llave.codigo}</td>
                        <td style={{ padding: '0.8rem 0.5rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '5px', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: llave.estado === 'disponible' ? 'rgba(46, 229, 92, 0.1)' : 'rgba(28, 81, 255, 0.1)', color: llave.estado === 'disponible' ? 'var(--accent-green)' : 'var(--accent-blue)' }}>
                            {llave.estado.toUpperCase()}
                          </span>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{llave.duracion}</div>
                        </td>
                        <td style={{ padding: '0.8rem 0.5rem' }}>
                          <strong style={{ display: 'block', color: 'var(--text-main)' }}>{llave.usuario}</strong>
                          {llave.telefono && llave.telefono !== '-' && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📱 {llave.telefono}</span>}
                        </td>
                        <td style={{ padding: '0.8rem 0.5rem', fontSize: '0.85rem' }}>
                          {llave.estado === 'en uso' ? (
                            <>
                              <div style={{ color: 'var(--text-muted)' }}>Alta: {llave.fechaActivacion}</div>
                              <div style={{ color: requiereAlerta ? 'var(--accent-red)' : 'var(--text-main)', fontWeight: requiereAlerta ? 'bold' : 'normal' }}>Expira: {llave.fechaCaducidad}</div>
                              {requiereAlerta && <div style={{ color: 'var(--accent-red)', fontWeight: 'bold', marginTop: '0.2rem' }}>⚠️ Faltan {diasRestantes} días</div>}
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Sin activar</span>
                          )}
                        </td>
                        <td style={{ padding: '0.8rem 0.5rem' }}>
                          <TutorialTooltip mensaje="Inhabilita inmediatamente el acceso del docente y mueve la llave a la bóveda de caducadas." posicion="left">
                            <button onClick={() => revocarLlave(llave.id)} className="pill-btn" style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--accent-red)', color: 'var(--accent-red)' }}>Revocar</button>
                          </TutorialTooltip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {activas.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron llaves activas.</div>}
          </div>

          {/* ACORDEÓN: BÓVEDA DE LLAVES CADUCADAS */}
          <div style={{ backgroundColor: 'var(--bg-app)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <button 
              onClick={() => setMostrarBoveda(!mostrarBoveda)} 
              style={{ width: '100%', padding: '1.2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}
            >
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--accent-red)' }}>🗄️ Bóveda de Llaves Caducadas / Revocadas ({caducadas.length})</h3>
              <span style={{ fontSize: '1.2rem' }}>{mostrarBoveda ? '▲' : '▼'}</span>
            </button>
            
            {mostrarBoveda && (
              <div style={{ padding: '1.5rem', overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '800px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '0.8rem 0.5rem', color: 'var(--text-muted)' }}>Código y Duración</th>
                      <th style={{ padding: '0.8rem 0.5rem', color: 'var(--text-muted)' }}>Usuario (Contacto)</th>
                      <th style={{ padding: '0.8rem 0.5rem', color: 'var(--text-muted)' }}>Línea de Tiempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caducadas.map(llave => (
                      <tr key={llave.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: 0.8 }}>
                        <td style={{ padding: '0.8rem 0.5rem' }}>
                          <del style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.1rem' }}>{llave.codigo}</del>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{llave.duracion}</div>
                        </td>
                        <td style={{ padding: '0.8rem 0.5rem' }}>
                          <strong style={{ display: 'block' }}>{llave.usuario}</strong>
                          {llave.correo && llave.correo !== '-' && <span style={{ fontSize: '0.8rem' }}>✉️ {llave.correo}</span>}
                        </td>
                        <td style={{ padding: '0.8rem 0.5rem', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                          <div>Activada: <b>{llave.fechaActivacion || '-'}</b></div>
                          <div style={{ color: 'var(--text-muted)' }}>Fin original: {llave.fechaCaducidad || '-'}</div>
                          {llave.fechaRevocacion && (
                            <div style={{ color: 'var(--accent-red)', fontWeight: 'bold', marginTop: '0.2rem' }}>
                              🛑 Revocada el: {llave.fechaRevocacion}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {caducadas.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay llaves en la bóveda.</div>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}