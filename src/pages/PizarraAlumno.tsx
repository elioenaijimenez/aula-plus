import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, increment } from 'firebase/firestore';
import { db } from '../services/firebase';

interface EvidenciaPublica { 
  id: string; titulo: string; descripcion: string; tipo: string; 
  enlaceDrive: string; vistas: number; likes: number; 
  fechaActividad: string; fechaFinAviso?: string; trimestre: string; 
}

export default function PizarraAlumno({ onVolver }: { onVolver: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  
  const [grupoData, setGrupoData] = useState<any>(null);
  const [actividades, setActividades] = useState<EvidenciaPublica[]>([]);
  const [trimestreActivo, setTrimestreActivo] = useState('1');
  const [ahora, setAhora] = useState(new Date());

  const [likesLocales, setLikesLocales] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem('aulaPlus_likes') || '[]');
  });

  useEffect(() => {
    const int = setInterval(() => setAhora(new Date()), 60000);
    return () => clearInterval(int);
  }, []);

  const buscarPizarra = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Limpieza profunda de espacios y autocompletado erróneo
    let cleanCode = codigo.replace(/\s+/g, '').toUpperCase();
    if (!cleanCode) return;
    
    if (!cleanCode.startsWith('AULA-')) {
      cleanCode = 'AULA-' + cleanCode;
    }

    setCargando(true);
    setError('');

    try {
      const qGrupo = query(collection(db, 'groups'), where('pizarraCode', '==', cleanCode));
      const snapGrupo = await getDocs(qGrupo);

      if (snapGrupo.empty) {
        setError('Código no encontrado. Revisa que lo hayas escrito bien.');
        setCargando(false);
        return;
      }

      const docGrupo = snapGrupo.docs[0];
      const gData = docGrupo.data();
      setGrupoData({ id: docGrupo.id, ...gData });

      const qActs = query(collection(db, `groups/${docGrupo.id}/evidences`), where('publicada', '==', true));
      const snapActs = await getDocs(qActs);
      const listaActs: EvidenciaPublica[] = [];
      
      snapActs.forEach(d => listaActs.push({ id: d.id, ...d.data() } as EvidenciaPublica));
      listaActs.sort((a, b) => b.fechaActividad.localeCompare(a.fechaActividad));
      
      setActividades(listaActs);
    } catch (err) {
      setError('Error al conectar con la pizarra.');
    }
    setCargando(false);
  };

  const registrarVista = async (act: EvidenciaPublica) => {
    if (act.enlaceDrive) {
      window.open(act.enlaceDrive, '_blank');
      const refAct = doc(db, `groups/${grupoData.id}/evidences`, act.id);
      await updateDoc(refAct, { vistas: increment(1) });
      setActividades(prev => prev.map(a => a.id === act.id ? { ...a, vistas: a.vistas + 1 } : a));
    }
  };

  const darLike = async (idActividad: string) => {
    if (likesLocales.includes(idActividad)) return; 
    const nuevosLikes = [...likesLocales, idActividad];
    setLikesLocales(nuevosLikes);
    localStorage.setItem('aulaPlus_likes', JSON.stringify(nuevosLikes));

    const refAct = doc(db, `groups/${grupoData.id}/evidences`, idActividad);
    await updateDoc(refAct, { likes: increment(1) });
    setActividades(prev => prev.map(a => a.id === idActividad ? { ...a, likes: a.likes + 1 } : a));
  };

  const calcularTiempoRestante = (fechaFin: string) => {
    if (!fechaFin) return null;
    const target = new Date(fechaFin);
    const diff = target.getTime() - ahora.getTime();
    
    if (diff <= 0) return 'Expirado';
    
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / 1000 / 60) % 60);
    
    if (d > 0) return `Termina en ${d} d y ${h} hrs`;
    return `Termina en ${h} hrs y ${m} min`;
  };

  if (!grupoData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f7f6', padding: '1rem', animation: 'fadeIn 0.5s' }}>
        <button onClick={onVolver} style={{ position: 'absolute', top: '20px', left: '20px', background: 'white', border: '1px solid #ccc', padding: '10px 15px', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold' }}>← Volver</button>
        
        <div style={{ background: 'white', padding: '2.5rem', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎓</div>
          <h1 style={{ margin: '0 0 0.5rem 0', color: '#1C51FF' }}>Pizarra Alumno</h1>
          <p style={{ color: '#666', marginBottom: '2rem' }}>Ingresa el código de 4 dígitos que te dio el profesor.</p>

          <form onSubmit={buscarPizarra} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '15px', color: '#1C51FF', fontWeight: 'bold', fontSize: '1.2rem' }}>AULA-</span>
              <input 
                type="text" 
                placeholder="XYZW" 
                value={codigo.replace(/^AULA-/i, '').replace(/\s+/g, '')} 
                onChange={e => setCodigo(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                style={{ width: '100%', padding: '1rem 1rem 1rem 5.5rem', fontSize: '1.2rem', textAlign: 'left', borderRadius: '12px', border: '2px solid #ccc', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold' }}
                required 
                maxLength={10}
              />
            </div>
            {error && <span style={{ color: 'red', fontSize: '0.9rem', fontWeight: 'bold' }}>{error}</span>}
            <button type="submit" disabled={cargando} style={{ padding: '1rem', borderRadius: '12px', border: 'none', backgroundColor: '#1C51FF', color: 'white', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>
              {cargando ? 'Buscando...' : 'Entrar a mi Pizarra'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Filtramos los avisos para NO mostrar los expirados
  const avisosGenerales = actividades.filter(a => {
    if (a.tipo !== 'Aviso') return false;
    if (a.fechaFinAviso) {
       const target = new Date(a.fechaFinAviso).getTime();
       if (target <= ahora.getTime()) return false; 
    }
    return true;
  });

  const actividadesTrimestre = actividades.filter(a => a.trimestre === trimestreActivo && a.tipo !== 'Aviso');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f8', paddingBottom: '3rem', animation: 'fadeIn 0.4s' }}>
      <style>{`
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(255, 193, 7, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0); }
        }
      `}</style>

      <header style={{ backgroundColor: '#1C51FF', color: 'white', padding: '2rem 1rem', textAlign: 'center', borderBottomLeftRadius: '30px', borderBottomRightRadius: '30px', boxShadow: '0 4px 20px rgba(28, 81, 255, 0.3)', position: 'relative' }}>
        <button onClick={() => setGrupoData(null)} style={{ position: 'absolute', top: '20px', left: '20px', background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>← Salir</button>
        
        {avisosGenerales.length > 0 && (
          <div style={{ position: 'absolute', top: '20px', right: '20px', fontSize: '1.5rem', animation: 'pulseGlow 2s infinite', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🔔
            <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#FFC107', color: '#000', fontSize: '0.7rem', fontWeight: 'bold', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {avisosGenerales.length}
            </span>
          </div>
        )}

        <span style={{ fontSize: '3rem', display: 'block', margin: '1rem 0' }}>📌</span>
        <h1 style={{ margin: 0, fontSize: '1.8rem', lineHeight: '1.2' }}>Pizarra de {grupoData.subject}</h1>
        <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '1.1rem' }}>Grupo: <b>{grupoData.name}</b> {grupoData.emphasis && `• ${grupoData.emphasis}`}</p>
      </header>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1rem' }}>
        
        {avisosGenerales.length > 0 && (
          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {avisosGenerales.map(aviso => {
              const tiempoRestante = calcularTiempoRestante(aviso.fechaFinAviso || '');

              return (
                <div key={aviso.id} style={{ backgroundColor: '#fffdf5', borderRadius: '20px', padding: '1.5rem', border: '2px solid #FFC107', boxShadow: '0 8px 25px rgba(255, 193, 7, 0.2)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.8rem' }}>
                    <span style={{ backgroundColor: '#FFC107', color: '#000', padding: '4px 12px', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      🔔 AVISO IMPORTANTE
                    </span>
                    {aviso.fechaFinAviso && (
                      <span style={{ fontSize: '0.9rem', color: '#b28000', fontWeight: 'bold', backgroundColor: 'rgba(255, 193, 7, 0.2)', padding: '4px 10px', borderRadius: '8px' }}>
                        ⏳ {tiempoRestante}
                      </span>
                    )}
                  </div>

                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', color: '#b28000' }}>{aviso.titulo}</h3>
                  <p style={{ margin: '0 0 1.5rem 0', color: '#555', lineHeight: '1.5', fontSize: '1rem', whiteSpace: 'pre-wrap' }}>{aviso.descripcion}</p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,193,7,0.3)', paddingTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', color: '#888', fontWeight: 'bold' }}>Emitido: {aviso.fechaActividad}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem', marginBottom: '2rem' }}>
          {['1', '2', '3'].map(t => (
            <button 
              key={t} onClick={() => setTrimestreActivo(t)}
              style={{ padding: '0.6rem 1.5rem', borderRadius: '50px', border: 'none', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: trimestreActivo === t ? '#1C51FF' : 'white', color: trimestreActivo === t ? 'white' : '#666', boxShadow: trimestreActivo === t ? '0 4px 10px rgba(28, 81, 255, 0.3)' : '0 2px 5px rgba(0,0,0,0.05)' }}
            >
              Trimestre {t}
            </button>
          ))}
        </div>

        {actividadesTrimestre.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888', background: 'white', borderRadius: '20px', border: '2px dashed #ccc' }}>
            <span style={{ fontSize: '3rem' }}>📭</span>
            <h2>Nada por aquí aún</h2>
            <p>El maestro no ha publicado actividades para este trimestre.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {actividadesTrimestre.map(act => {
              const leDioLike = likesLocales.includes(act.id);
              return (
                <div key={act.id} style={{ backgroundColor: 'white', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
                  
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '6px', height: '100%', backgroundColor: '#1C51FF' }}></div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                    <span style={{ backgroundColor: 'rgba(28, 81, 255, 0.1)', color: '#1C51FF', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {act.tipo}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#888', fontWeight: 'bold' }}>📅 {act.fechaActividad}</span>
                  </div>

                  <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '1.4rem', color: '#333' }}>{act.titulo}</h3>
                  <p style={{ margin: '0 0 1.5rem 0', color: '#555', lineHeight: '1.5', fontSize: '1rem', whiteSpace: 'pre-wrap' }}>
                    {act.descripcion}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eee', paddingTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button 
                        onClick={() => darLike(act.id)} 
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', fontSize: '1rem', color: leDioLike ? '#E91E63' : '#888', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', transform: leDioLike ? 'scale(1.1)' : 'scale(1)' }}
                      >
                        {leDioLike ? '❤️' : '🤍'} {act.likes}
                      </button>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '1rem', color: '#888', fontWeight: 'bold' }}>
                        👁️ {act.vistas}
                      </span>
                    </div>

                    {act.enlaceDrive && (
                      <button onClick={() => registrarVista(act)} style={{ padding: '0.8rem 1.5rem', borderRadius: '12px', border: 'none', backgroundColor: '#e6f0ff', color: '#1C51FF', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s' }}>
                        📄 Ver Material
                      </button>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}