import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function FormularioGrupo({ onVolver, grupoAEditar }: { onVolver: () => void, grupoAEditar?: any }) {
  const grados = ['1', '2', '3'];
  const grupos = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
  
  const materiasBase = ['Español', 'Inglés', 'Artes', 'Matemáticas', 'Historia', 'Formación Cívica y Ética', 'Tecnología', 'Educación Física', 'Tutoría / Educación Socioemocional'];
  
  const obtenerMateriasPorGrado = (g: string) => {
    if (g === '1') return [...materiasBase, 'Biología', 'Geografía'].sort();
    if (g === '2') return [...materiasBase, 'Física'].sort();
    return [...materiasBase, 'Química'].sort();
  };

  // Catálogo Oficial Completo de Énfasis
  const enfasisMorelos = {
    "Agropecuarias y pesqueras": [
      "Agricultura", "Apicultura", "Pecuaria", "Acuicultura", 
      "Silvicultura", "Ganadería", "Pesca"
    ],
    "Tecnologías de alimentos": [
      "Preparación, conservación e industrialización de alimentos agrícolas",
      "Preparación, conservación e industrialización de alimentos pecuarios cárnicos",
      "Preparación, conservación e industrialización de alimentos pecuarios lácteos",
      "Preparación, conservación e industrialización de alimentos agrícolas, cárnicos y lácteos",
      "Procesamiento de productos pesqueros",
      "Conservación y procesamiento de productos agrícolas",
      "Conservación y procesamiento de productos cárnicos",
      "Conservación y procesamiento de productos lácteos"
    ],
    "Tecnologías de producción": [
      "Diseño industrial", "Máquinas-herramienta y sistemas de control", 
      "Diseño de estructuras metálicas", "Diseño y mecánica automotriz", 
      "Electrónica, comunicación y sistemas de control", 
      "Confección del vestido e industria textil", "Carpintería e industria de la madera", 
      "Creación artesanal", "Diseño y creación plástica", "Diseño y transporte marítimo", 
      "Climatización y refrigeración", "Programación y control de sistemas"
    ],
    "Construcción e información": [
      "Diseño arquitectónico", "Diseño de circuitos eléctricos", 
      "Diseño de interiores", "Ductos y controles", "Diseño gráfico", "Informática"
    ],
    "Salud, servicios y recreación": [
      "Administración contable", "Ofimática", "Estética y salud corporal", "Turismo"
    ]
  };

  // Si nos mandan un grupo a editar, inicializamos los estados con esa información
  const [grado, setGrado] = useState(grupoAEditar ? grupoAEditar.grade : '1');
  const [grupo, setGrupo] = useState(grupoAEditar ? grupoAEditar.section : 'A');
  const [materiasDisponibles, setMateriasDisponibles] = useState(obtenerMateriasPorGrado(grupoAEditar ? grupoAEditar.grade : '1'));
  const [disciplina, setDisciplina] = useState(grupoAEditar ? grupoAEditar.subject : 'Tecnología');
  const [enfasis, setEnfasis] = useState(grupoAEditar?.emphasis ? grupoAEditar.emphasis : 'Ofimática');
  const [ciclo, setCiclo] = useState(grupoAEditar ? grupoAEditar.schoolYear : '2026-2027');
  
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const nuevasMaterias = obtenerMateriasPorGrado(grado);
    setMateriasDisponibles(nuevasMaterias);
    // Solo cambiar la disciplina si la actual no está disponible en el nuevo grado
    if (!nuevasMaterias.includes(disciplina)) {
      setDisciplina(nuevasMaterias[0]);
    }
  }, [grado]);

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const regexCiclo = /^\d{4}-\d{4}$/;
    if (!regexCiclo.test(ciclo)) {
      setErrorMsg('El ciclo escolar debe tener el formato AAAA-AAAA (Ej. 2026-2027).');
      return;
    }
    
    const sessionLocal = localStorage.getItem('aulaPlusSession');
    const sessionData = sessionLocal ? JSON.parse(sessionLocal) : null;
    const userEmail = sessionData?.user?.email || sessionData?.email || '';

    setGuardando(true);
    try {
      // Buscar colisiones
      const q = query(
        collection(db, 'groups'), 
        where('docenteEmail', '==', userEmail),
        where('grade', '==', grado), 
        where('section', '==', grupo),
        where('subject', '==', disciplina),
        where('schoolYear', '==', ciclo)
      );
      const snapshot = await getDocs(q);
      
      // Si estamos editando, ignoramos la colisión si se trata del MISMO documento
      const colision = snapshot.docs.find(d => d.id !== (grupoAEditar?.id || ''));
      
      if (colision) {
        setErrorMsg(`El grupo ${grado}° ${grupo} de ${disciplina} ya está registrado en el ciclo ${ciclo}.`);
        setGuardando(false);
        return;
      }
      
      const datosGuardar = {
        name: `${grado}° ${grupo}`,
        grade: grado,
        section: grupo,
        subject: disciplina,
        emphasis: disciplina === 'Tecnología' ? enfasis : '',
        schoolYear: ciclo,
        docenteEmail: userEmail,
        active: true,
      };

      if (grupoAEditar) {
        // Lógica de Edición
        await updateDoc(doc(db, 'groups', grupoAEditar.id), datosGuardar);
      } else {
        // Lógica de Creación
        await addDoc(collection(db, 'groups'), {
          ...datosGuardar,
          createdAt: serverTimestamp()
        });
      }
      onVolver();
    } catch (error) {
      console.error("Error al guardar:", error);
      setErrorMsg("Ocurrió un error de conexión al intentar guardar.");
      setGuardando(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: '1.5rem' }}>{grupoAEditar ? '✏️ Editar Grupo' : '✨ Crear Nuevo Grupo'}</h3>
          <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0 0', fontSize: '0.9rem' }}>Configuración Fase 6 (Catálogo Técnico Completo)</p>
        </div>
        <button onClick={onVolver} className="pill-btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer' }}>
          ✕ Cancelar
        </button>
      </div>
      <form style={{ backgroundColor: 'var(--bg-panel)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }} onSubmit={manejarEnvio}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.8rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Selecciona el Grado</label>
          <div className="chip-container">
            {grados.map(g => (
              <div key={g} className={`chip ${grado === g ? 'active' : ''}`} onClick={() => setGrado(g)}>{g}° Grado</div>
            ))}
          </div>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.8rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Selecciona el Grupo</label>
          <div className="chip-scroll">
            {grupos.map(g => (
              <div key={g} className={`chip ${grupo === g ? 'active' : ''}`} onClick={() => setGrupo(g)} style={{ minWidth: '45px', textAlign: 'center' }}>{g}</div>
            ))}
          </div>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Disciplina (Ajustada al {grado}° Grado)</label>
          <select className="search-input" value={disciplina} onChange={(e) => setDisciplina(e.target.value)} style={{ cursor: 'pointer' }}>
            {materiasDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {disciplina === 'Tecnología' && (
          <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Énfasis Técnico (Catálogo IEBEM Morelos)</label>
            <select className="search-input" value={enfasis} onChange={(e) => setEnfasis(e.target.value)} style={{ cursor: 'pointer', borderLeft: '4px solid var(--accent-blue)' }}>
              {Object.entries(enfasisMorelos).map(([categoria, opciones]) => (
                <optgroup label={`📂 ${categoria}`} key={categoria}>
                  {opciones.map(opc => <option key={opc} value={opc}>{opc}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        )}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Ciclo Escolar</label>
          <input type="text" className="search-input" placeholder="AAAA-AAAA" required value={ciclo} onChange={(e) => { setCiclo(e.target.value); setErrorMsg(''); }} />
        </div>
        {errorMsg && <div className="error-msg"><span>⚠️</span> {errorMsg}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <button type="submit" disabled={guardando} className="pill-btn" style={{ backgroundColor: guardando ? 'var(--text-muted)' : 'var(--accent-blue)', color: 'white', border: 'none', padding: '0.8rem 2.5rem', fontSize: '1rem', cursor: guardando ? 'not-allowed' : 'pointer' }}>
            {guardando ? 'Validando y Guardando...' : (grupoAEditar ? '💾 Actualizar Grupo' : 'Guardar Grupo')}
          </button>
        </div>
      </form>
    </div>
  )
}