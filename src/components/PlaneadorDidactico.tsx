import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import type {
  ContenidoCodisenado,
  ContenidoPrograma,
  ContextoEscuela,
  ContextoGrupo,
  PDAPrograma,
  ProgramaAnaliticoGrupo,
} from '../services/planeacionContextService';
import {
  cargarContextoEscuela,
  cargarContextoGrupo,
  cargarProgramaAnalitico,
  obtenerCorreoSesion,
} from '../services/planeacionContextService';
import jsPDF from 'jspdf';

interface Grupo {
  id: string;
  name: string;
  grade: string;
  subject: string;
  emphasis: string;
  docenteEmail?: string;
}

interface MemoriaEscolar {
  escuela: string;
  ubicacion: string;
  docente: string;
  revisor: string;
}

type OrigenCurricular = 'nacional' | 'codiseno';

const DIAS = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
];

const METODOLOGIAS = [
  'Recomendar según el propósito y el contexto',
  'Aprendizaje Basado en Proyectos Comunitarios',
  'Aprendizaje Basado en Problemas',
  'Indagación con enfoque STEAM',
  'Aprendizaje Servicio',
  'Taller',
  'Estudio de caso',
  'Secuencia didáctica',
  'Personalizada',
];

export default function PlaneadorDidactico() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoSeleccionado, setGrupoSeleccionado] =
    useState('');
  const [userEmail, setUserEmail] = useState('');

  const [memoria, setMemoria] =
    useState<MemoriaEscolar>({
      escuela: '',
      ubicacion: '',
      docente: '',
      revisor: '',
    });

  const [contextoEscuela, setContextoEscuela] =
    useState<ContextoEscuela | null>(null);
  const [contextoGrupo, setContextoGrupo] =
    useState<ContextoGrupo | null>(null);
  const [programa, setPrograma] =
    useState<ProgramaAnaliticoGrupo | null>(null);

  const [cargandoBase, setCargandoBase] = useState(true);
  const [cargandoGrupo, setCargandoGrupo] = useState(false);

  const [origenCurricular, setOrigenCurricular] =
    useState<OrigenCurricular>('nacional');
  const [
    contenidoSeleccionadoId,
    setContenidoSeleccionadoId,
  ] = useState('');
  const [pdaSeleccionadosIds, setPdaSeleccionadosIds] =
    useState<string[]>([]);
  const [
    codisenoSeleccionadoId,
    setCodisenoSeleccionadoId,
  ] = useState('');

  const [fechaEntrega, setFechaEntrega] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [diasClase, setDiasClase] = useState<string[]>([]);
  const [duracion, setDuracion] = useState('50');

  const [instrucciones, setInstrucciones] = useState('');
  const [productoEsperado, setProductoEsperado] =
    useState('');
  const [indicacionesExtra, setIndicacionesExtra] =
    useState('');

  const [metodologia, setMetodologia] = useState(
    'Recomendar según el propósito y el contexto'
  );
  const [
    metodologiaPersonalizada,
    setMetodologiaPersonalizada,
  ] = useState('');

  const [generando, setGenerando] = useState(false);
  const [resultadoIA, setResultadoIA] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    const inicializar = async () => {
      const email = obtenerCorreoSesion();
      setUserEmail(email);

      try {
        const [snapGrupos, docMemoria] = await Promise.all([
          getDocs(
            query(
              collection(db, 'groups'),
              where('docenteEmail', '==', email)
            )
          ),
          getDoc(doc(db, 'teacher_settings', email)),
        ]);

        const lista: Grupo[] = [];
        snapGrupos.forEach((d) => {
          lista.push({
            id: d.id,
            ...(d.data() as Omit<Grupo, 'id'>),
          });
        });

        lista.sort((a, b) =>
          `${a.grade}-${a.name}`.localeCompare(
            `${b.grade}-${b.name}`,
            'es'
          )
        );

        setGrupos(lista);

        if (
          docMemoria.exists() &&
          docMemoria.data().memoriaEscolar
        ) {
          setMemoria(
            docMemoria.data()
              .memoriaEscolar as MemoriaEscolar
          );
        } else {
          const sessionLocal =
            localStorage.getItem('aulaPlusSession');
          const sessionData = sessionLocal
            ? JSON.parse(sessionLocal)
            : null;

          setMemoria((prev) => ({
            ...prev,
            docente:
              sessionData?.user?.nombre || 'Docente',
          }));
        }
      } catch (error) {
        console.error(
          'Error al inicializar Planeador:',
          error
        );
        setMensaje(
          'No fue posible cargar toda la información inicial.'
        );
      } finally {
        setCargandoBase(false);
      }
    };

    inicializar();
  }, []);

  useEffect(() => {
    if (!grupoSeleccionado || !userEmail) {
      setContextoEscuela(null);
      setContextoGrupo(null);
      setPrograma(null);
      return;
    }

    const cargarDatosGrupo = async () => {
      setCargandoGrupo(true);
      setMensaje('');
      setResultadoIA('');
      setContenidoSeleccionadoId('');
      setPdaSeleccionadosIds([]);
      setCodisenoSeleccionadoId('');
      setOrigenCurricular('nacional');

      try {
        const [
          escuela,
          grupo,
          programaGuardado,
        ] = await Promise.all([
          cargarContextoEscuela(userEmail),
          cargarContextoGrupo(
            userEmail,
            grupoSeleccionado
          ),
          cargarProgramaAnalitico(
            userEmail,
            grupoSeleccionado
          ),
        ]);

        setContextoEscuela(escuela);
        setContextoGrupo(grupo);
        setPrograma(programaGuardado);
      } catch (error) {
        console.error(
          'Error al cargar contexto curricular:',
          error
        );
        setMensaje(
          'No fue posible cargar el contexto o Programa Analítico del grupo.'
        );
      } finally {
        setCargandoGrupo(false);
      }
    };

    cargarDatosGrupo();
  }, [grupoSeleccionado, userEmail]);

  const grupoActivo = useMemo(
    () =>
      grupos.find(
        (grupo) => grupo.id === grupoSeleccionado
      ) || null,
    [grupos, grupoSeleccionado]
  );

  const contextoEscuelaListo =
    contextoEscuela?.estado === 'listo' ||
    contextoEscuela?.estado === 'optimizado';

  const contextoGrupoListo =
    contextoGrupo?.estado === 'listo' ||
    contextoGrupo?.estado === 'optimizado';

  const programaListo =
    programa?.estado === 'listo' &&
    programa.contenidos.length > 0;

  const baseLista =
    Boolean(grupoSeleccionado) &&
    contextoEscuelaListo &&
    contextoGrupoListo &&
    programaListo;

  const contenidoSeleccionado =
    useMemo<ContenidoPrograma | null>(() => {
      if (!programa || !contenidoSeleccionadoId) {
        return null;
      }

      return (
        programa.contenidos.find(
          (contenido) =>
            contenido.id ===
            contenidoSeleccionadoId
        ) || null
      );
    }, [programa, contenidoSeleccionadoId]);

  const pdaSeleccionados = useMemo<PDAPrograma[]>(
    () => {
      if (!contenidoSeleccionado) return [];

      return contenidoSeleccionado.pda.filter((pda) =>
        pdaSeleccionadosIds.includes(pda.id)
      );
    },
    [contenidoSeleccionado, pdaSeleccionadosIds]
  );

  const codisenoSeleccionado =
    useMemo<ContenidoCodisenado | null>(() => {
      if (!programa || !codisenoSeleccionadoId) {
        return null;
      }

      return (
        programa.contenidosCodisenados.find(
          (item) =>
            item.id === codisenoSeleccionadoId
        ) || null
      );
    }, [programa, codisenoSeleccionadoId]);

  const ejesSeleccionados = useMemo(() => {
    const set = new Set<string>();

    if (origenCurricular === 'nacional') {
      pdaSeleccionados.forEach((pda) =>
        pda.ejesArticuladores.forEach((eje) =>
          set.add(eje)
        )
      );
    } else if (codisenoSeleccionado) {
      codisenoSeleccionado.ejesArticuladores.forEach(
        (eje) => set.add(eje)
      );
    }

    return Array.from(set);
  }, [
    origenCurricular,
    pdaSeleccionados,
    codisenoSeleccionado,
  ]);

  const contextualizaciones = useMemo(() => {
    if (origenCurricular !== 'nacional') return [];

    return pdaSeleccionados
      .map((pda) => pda.contextualizacion.trim())
      .filter(Boolean);
  }, [origenCurricular, pdaSeleccionados]);

  const problematicasRelacionadas = useMemo(() => {
    const set = new Set<string>();

    if (origenCurricular === 'nacional') {
      pdaSeleccionados.forEach((pda) =>
        pda.problematicasRelacionadas.forEach(
          (problema) => set.add(problema)
        )
      );
    } else if (
      codisenoSeleccionado?.problematicaQueLoJustifica
    ) {
      set.add(
        codisenoSeleccionado.problematicaQueLoJustifica
      );
    }

    return Array.from(set);
  }, [
    origenCurricular,
    pdaSeleccionados,
    codisenoSeleccionado,
  ]);

  const referenteCurricularElegido =
    origenCurricular === 'nacional'
      ? Boolean(
          contenidoSeleccionado &&
            pdaSeleccionados.length > 0
        )
      : Boolean(codisenoSeleccionado);

  const diffDays =
    fechaInicio && fechaFin
      ? Math.ceil(
          (new Date(fechaFin).getTime() -
            new Date(fechaInicio).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

  const etiquetaTemporal =
    diffDays > 60
      ? 'Planeación trimestral'
      : diffDays > 31
        ? 'Planeación bimestral / extensa'
        : diffDays > 14
          ? 'Planeación mensual'
          : diffDays > 7
            ? 'Planeación quincenal'
            : diffDays >= 0 &&
                fechaInicio &&
                fechaFin
              ? 'Planeación semanal'
              : '';

  const calendarioListo =
    fechaInicio !== '' &&
    fechaFin !== '' &&
    fechaEntrega !== '' &&
    diasClase.length > 0 &&
    Number(duracion) > 0 &&
    diffDays >= 0 &&
    diffDays <= 120;

  const formularioListo =
    baseLista &&
    referenteCurricularElegido &&
    calendarioListo &&
    instrucciones.trim().length >= 5 &&
    (metodologia !== 'Personalizada' ||
      metodologiaPersonalizada.trim().length >= 3);

  const toggleDia = (dia: string) => {
    setDiasClase((prev) =>
      prev.includes(dia)
        ? prev.filter((item) => item !== dia)
        : [...prev, dia]
    );
  };

  const togglePDA = (pdaId: string) => {
    setPdaSeleccionadosIds((prev) =>
      prev.includes(pdaId)
        ? prev.filter((id) => id !== pdaId)
        : [...prev, pdaId]
    );
  };

  const cambiarContenido = (contenidoId: string) => {
    setContenidoSeleccionadoId(contenidoId);
    setPdaSeleccionadosIds([]);
    setResultadoIA('');
  };

  const construirReferenteParaPrompt = () => {
    if (origenCurricular === 'nacional') {
      return {
        tipo: 'REFERENTE NACIONAL',
        contenido:
          contenidoSeleccionado?.textoOficial || '',
        pda: pdaSeleccionados.map(
          (item) => item.textoOficial
        ),
        contextualizaciones:
          pdaSeleccionados.map((item) => ({
            pda: item.textoOficial,
            contextualizacion:
              item.contextualizacion || '',
            decisionCurricular:
              item.decisionCurricular,
            temporalidad: item.temporalidad || '',
            ejes: item.ejesArticuladores,
            problematicas:
              item.problematicasRelacionadas,
            saberesComunitarios:
              item.saberesComunitariosRelacionados,
          })),
      };
    }

    return {
      tipo: 'CONTENIDO LOCAL CODISEÑADO',
      contenido:
        codisenoSeleccionado?.contenidoLocal || '',
      pda: codisenoSeleccionado?.pdaLocal
        ? [codisenoSeleccionado.pdaLocal]
        : [],
      contextualizaciones: [
        {
          justificacion:
            codisenoSeleccionado?.justificacion || '',
          problematica:
            codisenoSeleccionado
              ?.problematicaQueLoJustifica || '',
          evidencias:
            codisenoSeleccionado?.evidencias || '',
          relacionConContenidosNacionales:
            codisenoSeleccionado
              ?.relacionConContenidosNacionales || '',
          temporalidad:
            codisenoSeleccionado?.temporalidad || '',
          ejes:
            codisenoSeleccionado
              ?.ejesArticuladores || [],
        },
      ],
    };
  };

  const generarPlaneacion = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!grupoActivo) {
      setMensaje(
        'Selecciona primero el grupo para el que vas a planear.'
      );
      return;
    }

    if (!contextoEscuelaListo) {
      setMensaje(
        'Completa primero el contexto de Escuela.'
      );
      return;
    }

    if (!contextoGrupoListo) {
      setMensaje(
        `Completa primero el contexto de ${grupoActivo.name}.`
      );
      return;
    }

    if (!programaListo) {
      setMensaje(
        'Termina y guarda el Programa Analítico de este grupo antes de generar planeaciones.'
      );
      return;
    }

    if (!referenteCurricularElegido) {
      setMensaje(
        'Selecciona un Contenido y al menos un PDA del Programa Analítico.'
      );
      return;
    }

    if (!calendarioListo) {
      setMensaje(
        'Completa correctamente fechas, días de clase y duración.'
      );
      return;
    }

    if (diffDays > 120) {
      setMensaje(
        'El periodo supera 120 días. Divide la planeación para mantener coherencia y precisión.'
      );
      return;
    }

    if (!instrucciones.trim()) {
      setMensaje(
        'Describe qué quieres trabajar o conseguir con el grupo.'
      );
      return;
    }

    setGenerando(true);
    setMensaje('');

    const metodoElegido =
      metodologia === 'Personalizada'
        ? metodologiaPersonalizada
        : metodologia;

    const referente = construirReferenteParaPrompt();

    const promptMaestro = `
ACTÚA COMO:
Un equipo interdisciplinario integrado por:
- especialista en currículo mexicano y Nueva Escuela Mexicana;
- docente experimentado de Educación Secundaria;
- diseñador instruccional;
- especialista en inclusión y Diseño Universal para el Aprendizaje;
- especialista en evaluación formativa.

OBJETIVO:
Construir una planeación didáctica viable, situada, clara y pedagógicamente coherente para ESTE grupo.

REGLAS CRÍTICAS:
1. Usa exclusivamente el Contenido y PDA proporcionados como referentes curriculares.
2. NO inventes, cambies, resumas ni "corrijas" el texto oficial del Contenido o PDA.
3. Si el referente es un contenido local codiseñado, identifícalo expresamente como LOCAL CODISEÑADO, nunca como contenido oficial.
4. El contexto no debe aparecer sólo como decoración: debe influir en ejemplos, tiempos, apoyos, recursos, agrupamientos, productos, evaluación o situaciones de trabajo cuando sea pertinente.
5. No inventes características de estudiantes, familias, escuela o comunidad.
6. No diagnostiques condiciones médicas.
7. Respeta recursos y limitaciones reales.
8. Diseña actividades realizables en el tiempo disponible.
9. Usa evaluación formativa durante el proceso, no sólo al final.
10. Si la metodología elegida es "Recomendar según el propósito y el contexto", selecciona la estrategia más congruente y explica brevemente la elección dentro de la planeación.
11. No fuerces una metodología de proyecto cuando una secuencia, taller, estudio de caso u otra estrategia sea más pertinente.
12. Evita actividades repetitivas y consignas ambiguas.
13. Genera directamente el documento. Sin saludo ni conversación.

════════════════════
1. DATOS INSTITUCIONALES
════════════════════
- Escuela: ${memoria.escuela || 'DATO PENDIENTE'}
- Ubicación: ${memoria.ubicacion || 'DATO PENDIENTE'}
- Docente: ${memoria.docente || 'DATO PENDIENTE'}
- Revisa: ${memoria.revisor || 'DATO PENDIENTE'}
- Grupo: ${grupoActivo.name}
- Grado: ${grupoActivo.grade}
- Disciplina: ${grupoActivo.subject}
- Énfasis: ${grupoActivo.emphasis || 'No aplica'}
- Periodo: ${fechaInicio} a ${fechaFin}
- Días de clase: ${diasClase.join(', ')}
- Duración por sesión: ${duracion} minutos
- Tipo de periodo: ${etiquetaTemporal || 'Periodo definido por fechas'}

════════════════════
2. CONTEXTO DE ESCUELA Y COMUNIDAD
════════════════════
${JSON.stringify(
  {
    escuela:
      contextoEscuela?.campos.descripcionEscuela || '',
    infraestructura:
      contextoEscuela?.campos.infraestructura || '',
    recursos:
      contextoEscuela?.campos.recursosDisponibles || [],
    limitaciones:
      contextoEscuela?.campos.limitaciones || '',
    comunidad:
      contextoEscuela?.campos.descripcionComunidad || '',
    actividadesFamiliaresComunitarias:
      contextoEscuela?.campos
        .actividadesFamiliaresComunitarias || '',
    problematicas:
      contextoEscuela?.campos
        .problematicasComunitarias || '',
    fortalezas:
      contextoEscuela?.campos
        .fortalezasComunitarias || '',
    saberes:
      contextoEscuela?.campos.saberesComunitarios ||
      '',
  },
  null,
  2
)}

════════════════════
3. CONTEXTO ESPECÍFICO DEL GRUPO
════════════════════
${JSON.stringify(
  {
    descripcion:
      contextoGrupo?.campos.descripcionGeneral || '',
    saberesPrevios:
      contextoGrupo?.campos.saberesPrevios || '',
    dificultades:
      contextoGrupo?.campos.dificultades || '',
    fortalezas:
      contextoGrupo?.campos.fortalezas || '',
    intereses:
      contextoGrupo?.campos.intereses || '',
    ritmo:
      contextoGrupo?.campos.ritmoTrabajo || '',
    formaTrabajo:
      contextoGrupo?.campos.formaTrabajo || '',
    diagnostico:
      contextoGrupo?.campos.diagnostico || '',
    apoyos:
      contextoGrupo?.campos.diversidadYApoyos ||
      '',
    participacion:
      contextoGrupo?.campos
        .preferenciasParticipacion || '',
    observaciones:
      contextoGrupo?.campos.observaciones || '',
  },
  null,
  2
)}

════════════════════
4. ACUERDOS DEL PROGRAMA ANALÍTICO
════════════════════
- Problemáticas priorizadas:
${JSON.stringify(
  programa?.problematicasPriorizadas || [],
  null,
  2
)}
- Horizonte formativo:
${programa?.horizonteFormativo || 'No especificado'}
- Orientaciones didácticas generales:
${programa?.orientacionesDidacticasGenerales || 'No especificadas'}
- Orientaciones de evaluación:
${programa?.orientacionesEvaluacion || 'No especificadas'}
- Seguimiento:
${programa?.acuerdosSeguimiento || 'No especificado'}

════════════════════
5. REFERENTE CURRICULAR SELECCIONADO
════════════════════
${JSON.stringify(referente, null, 2)}

Ejes articuladores seleccionados:
${JSON.stringify(ejesSeleccionados, null, 2)}

Problemáticas vinculadas:
${JSON.stringify(problematicasRelacionadas, null, 2)}

════════════════════
6. SOLICITUD DEL DOCENTE
════════════════════
- Intención / tema / reto: ${instrucciones}
- Producto o evidencia esperada: ${
      productoEsperado || 'Determinar según la intención formativa'
    }
- Metodología: ${metodoElegido}
- Indicaciones adicionales: ${
      indicacionesExtra || 'Ninguna'
    }

════════════════════
7. ESTRUCTURA OBLIGATORIA DE SALIDA
════════════════════
Entrega en Markdown claro y profesional, utilizando exactamente estas secciones:

## 1. Intención didáctica
Explica qué se busca lograr con este grupo y por qué tiene sentido.

## 2. Vinculación curricular y contextual
Presenta Contenido, PDA, ejes y contextualización sin alterar los textos curriculares proporcionados.

## 3. Metodología y organización
Indica la metodología o estrategia elegida, agrupamientos y lógica de trabajo.

## 4. Secuencia didáctica
Organiza por SESIONES.
Si el periodo es mayor a dos semanas, organiza primero por SEMANAS y luego por sesiones.

Para CADA sesión incluye:
- Propósito de la sesión
- Inicio
- Desarrollo
- Cierre
- Acciones del docente
- Acciones del alumnado
- Recursos
- Evidencia o producto parcial
- Evaluación formativa
- Apoyos / diversificación pertinentes

## 5. Producto o evidencia final
Describe qué se espera y cómo se relaciona con el PDA.

## 6. Evaluación formativa
Incluye criterios observables, momentos de retroalimentación y un instrumento apropiado.

## 7. Atención a la diversidad y participación
Sólo ajustes sustentados por el contexto del grupo. No inventes diagnósticos.

## 8. Recursos y viabilidad
Verifica que los recursos sean compatibles con lo disponible.

## 9. Cierre y metacognición
Incluye una estrategia breve para recuperar aprendizajes, dificultades y próximos pasos.

IMPORTANTE:
La planeación debe poder ejecutarse de verdad. Prefiere calidad y coherencia sobre cantidad de actividades.
`.trim();

    try {
      const apiKey =
        import.meta.env.VITE_GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error(
          'No existe VITE_GEMINI_API_KEY.'
        );
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: promptMaestro }],
              },
            ],
            generationConfig: {
              temperature: 0.25,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Gemini respondió ${response.status}`
        );
      }

      const data = await response.json();
      const texto =
        data?.candidates?.[0]?.content?.parts?.[0]
          ?.text;

      if (!texto) {
        throw new Error(
          'La IA no devolvió contenido.'
        );
      }

      setResultadoIA(texto);
    } catch (error) {
      console.error(
        'Error al generar planeación:',
        error
      );
      setMensaje(
        'No fue posible generar la planeación. Tu configuración permanece intacta.'
      );
    } finally {
      setGenerando(false);
    }
  };

  const textoContenidoParaDocumento = () => {
    if (origenCurricular === 'nacional') {
      return contenidoSeleccionado?.textoOficial || '';
    }

    return codisenoSeleccionado?.contenidoLocal || '';
  };

  const textoPDAParaDocumento = () => {
    if (origenCurricular === 'nacional') {
      return pdaSeleccionados
        .map((pda) => pda.textoOficial)
        .join(' | ');
    }

    return codisenoSeleccionado?.pdaLocal || '';
  };

  const convertirMarkdownAHtml = (texto: string) =>
    texto
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/^\-\s(.*)/gm, '&bull; $1')
      .replace(/^\*\s(.*)/gm, '&bull; $1')
      .replace(/\*(.*?)\*/g, '<i>$1</i>')
      .replace(/\n/g, '<br/>');

  const exportarWord = () => {
    if (!resultadoIA || !grupoActivo) return;

    const htmlResultado =
      convertirMarkdownAHtml(resultadoIA);

    const htmlContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office'
xmlns:w='urn:schemas-microsoft-com:office:word'
xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>Planeación Didáctica</title>
<style>
  @page { margin: 2cm; size: 21.59cm 27.94cm; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 10pt; }
  td { border: 1px solid #000; padding: 6px; vertical-align: top; }
  .title { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 15px; }
  .section-content { text-align: justify; line-height: 1.45; }
  .signatures td { border: none; text-align: center; padding-top: 50px; width: 50%; }
  h1, h2, h3 { page-break-after: avoid; }
  tr { page-break-inside: avoid; }
</style>
</head>
<body>
<div class="title">PLANEACIÓN DIDÁCTICA FORMATIVA</div>

<table>
<tr>
  <td><b>Escuela:</b> ${memoria.escuela}</td>
  <td><b>Ubicación:</b> ${memoria.ubicacion}</td>
</tr>
<tr>
  <td><b>Docente:</b> ${memoria.docente}</td>
  <td><b>Revisa:</b> ${memoria.revisor}</td>
</tr>
<tr>
  <td><b>Disciplina:</b> ${grupoActivo.subject}</td>
  <td><b>Énfasis:</b> ${grupoActivo.emphasis || 'N/A'}</td>
</tr>
<tr>
  <td><b>Grado y Grupo:</b> ${grupoActivo.name}</td>
  <td><b>Fecha de Entrega:</b> ${fechaEntrega}</td>
</tr>
<tr>
  <td colspan="2"><b>Periodo:</b> ${fechaInicio} al ${fechaFin}</td>
</tr>
<tr>
  <td colspan="2"><b>Origen curricular:</b> ${
    origenCurricular === 'nacional'
      ? 'Programa Sintético / Programa Analítico'
      : 'Contenido local codiseñado'
  }</td>
</tr>
<tr>
  <td colspan="2"><b>Contenido:</b> ${textoContenidoParaDocumento()}</td>
</tr>
<tr>
  <td colspan="2"><b>PDA:</b> ${textoPDAParaDocumento()}</td>
</tr>
<tr>
  <td colspan="2"><b>Ejes articuladores:</b> ${
    ejesSeleccionados.join(', ') || 'No especificados'
  }</td>
</tr>
<tr>
  <td colspan="2"><b>Metodología:</b> ${
    metodologia === 'Personalizada'
      ? metodologiaPersonalizada
      : metodologia
  }</td>
</tr>
</table>

<div class="section-content">${htmlResultado}</div>

<br clear="all" style="page-break-before:always" />

<table class="signatures">
<tr>
<td>___________________________<br/><b>Docente</b><br/>${memoria.docente}</td>
<td>___________________________<br/><b>Revisa</b><br/>${memoria.revisor}</td>
</tr>
</table>
</body>
</html>
`;

    const blob = new Blob(
      ['\uFEFF' + htmlContent],
      {
        type: 'application/msword;charset=utf-8;',
      }
    );

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute(
      'download',
      `Planeacion_${grupoActivo.name}_${fechaInicio}.doc`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarPDF = () => {
    if (!resultadoIA || !grupoActivo) return;

    const pdf = new jsPDF();
    const marginX = 14;
    let posY = 18;
    const pageHeight =
      pdf.internal.pageSize.height;

    const nuevaPaginaSiHaceFalta = (
      espacio = 8
    ) => {
      if (posY > pageHeight - 22 - espacio) {
        pdf.addPage();
        posY = 18;
      }
    };

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(28, 81, 255);
    pdf.text(
      'PLANEACIÓN DIDÁCTICA FORMATIVA',
      105,
      posY,
      { align: 'center' }
    );
    posY += 10;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);

    const datosCabecera = [
      `Escuela: ${memoria.escuela}`,
      `Docente: ${memoria.docente}`,
      `Grupo: ${grupoActivo.name}`,
      `Disciplina: ${grupoActivo.subject}`,
      `Periodo: ${fechaInicio} a ${fechaFin}`,
      `Contenido: ${textoContenidoParaDocumento()}`,
      `PDA: ${textoPDAParaDocumento()}`,
    ];

    datosCabecera.forEach((texto) => {
      const lineas =
        pdf.splitTextToSize(texto, 180);
      lineas.forEach((linea: string) => {
        nuevaPaginaSiHaceFalta();
        pdf.text(linea, marginX, posY);
        posY += 5;
      });
    });

    posY += 3;
    pdf.setDrawColor(210, 210, 210);
    pdf.line(marginX, posY, 196, posY);
    posY += 7;

    const textoLimpio = resultadoIA
      .replace(/^#{1,3}\s/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1');

    const lineas =
      pdf.splitTextToSize(textoLimpio, 180);

    pdf.setFontSize(9.5);

    lineas.forEach((linea: string) => {
      nuevaPaginaSiHaceFalta();
      pdf.text(linea, marginX, posY);
      posY += 5;
    });

    nuevaPaginaSiHaceFalta(24);
    posY += 14;

    pdf.text(
      '___________________________',
      50,
      posY,
      { align: 'center' }
    );
    pdf.text(
      '___________________________',
      150,
      posY,
      { align: 'center' }
    );
    posY += 5;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Docente', 50, posY, {
      align: 'center',
    });
    pdf.text('Revisa', 150, posY, {
      align: 'center',
    });

    posY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(memoria.docente, 50, posY, {
      align: 'center',
    });
    pdf.text(memoria.revisor, 150, posY, {
      align: 'center',
    });

    pdf.save(
      `Planeacion_${grupoActivo.name}_${fechaInicio}.pdf`
    );
  };

  if (cargandoBase) {
    return (
      <PantallaCarga texto="Preparando el Planeador..." />
    );
  }

  return (
    <div
      style={{
        maxWidth: '1320px',
        margin: '0 auto',
        paddingBottom: '3rem',
        animation: 'fadeIn .3s ease',
      }}
    >
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '28px',
          padding: 'clamp(1.4rem, 3vw, 2.4rem)',
          marginBottom: '1.2rem',
          border:
            '1px solid var(--border-color)',
          background:
            'linear-gradient(135deg, rgba(249,115,22,.11), rgba(156,39,176,.08), rgba(28,81,255,.07))',
        }}
      >
        <div
          className="planeador-hero-grid"
          style={{
            display: 'grid',
            gridTemplateColumns:
              'minmax(0,1fr) minmax(270px,370px)',
            gap: '1.5rem',
            alignItems: 'end',
          }}
        >
          <div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '.45rem',
                padding: '.38rem .75rem',
                borderRadius: '999px',
                background:
                  'rgba(249,115,22,.10)',
                color: '#F97316',
                fontWeight: 900,
                fontSize: '.72rem',
                letterSpacing: '.07em',
                marginBottom: '.8rem',
              }}
            >
              ✨ PLANEADOR CONTEXTUALIZADO
            </span>

            <h2
              style={{
                margin: 0,
                color: 'var(--text-main)',
                fontSize:
                  'clamp(1.8rem,3.2vw,2.55rem)',
                lineHeight: 1.06,
                letterSpacing: '-.04em',
              }}
            >
              Ya no empiezas desde cero.
            </h2>

            <p
              style={{
                maxWidth: '720px',
                margin: '.8rem 0 0',
                color: 'var(--text-muted)',
                lineHeight: 1.62,
                fontSize: '.92rem',
              }}
            >
              Selecciona el grupo. Aula+ recuperará
              automáticamente su contexto y Programa
              Analítico. Tú sólo decidirás qué
              referente trabajar, cuándo hacerlo y qué
              intención tendrá la clase.
            </p>
          </div>

          <div
            style={{
              padding: '1rem',
              borderRadius: '20px',
              background: 'var(--bg-panel)',
              border:
                '1px solid var(--border-color)',
              boxShadow:
                '0 12px 36px rgba(0,0,0,.05)',
            }}
          >
            <label style={labelStyle()}>
              ¿A qué grupo vas a planear?
            </label>

            <select
              className="search-input"
              value={grupoSeleccionado}
              onChange={(e) =>
                setGrupoSeleccionado(e.target.value)
              }
              style={{
                width: '100%',
                margin: 0,
                cursor: 'pointer',
                borderRadius: '14px',
              }}
            >
              <option value="">
                — Selecciona un grupo —
              </option>

              {grupos.map((grupo) => (
                <option
                  key={grupo.id}
                  value={grupo.id}
                >
                  {grupo.name} · {grupo.subject}
                  {grupo.emphasis
                    ? ` · ${grupo.emphasis}`
                    : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {!grupoSeleccionado ? (
        <EstadoBloqueado
          icono="🎯"
          titulo="La planeación comienza con un grupo"
          descripcion="Selecciona primero el grupo. Aula+ no generará una planeación genérica ni mezclará contextos entre grupos."
        />
      ) : cargandoGrupo ? (
        <PantallaCarga
          texto={`Cargando contexto y Programa Analítico de ${
            grupoActivo?.name || 'tu grupo'
          }...`}
        />
      ) : (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit,minmax(190px,1fr))',
              gap: '.7rem',
              marginBottom: '1rem',
            }}
          >
            <EstadoCard
              icono="🏫"
              titulo="Escuela"
              correcto={contextoEscuelaListo}
              valor={
                contextoEscuelaListo
                  ? 'Contexto listo'
                  : 'Falta completar'
              }
            />

            <EstadoCard
              icono="👥"
              titulo={grupoActivo?.name || 'Grupo'}
              correcto={contextoGrupoListo}
              valor={
                contextoGrupoListo
                  ? 'Contexto listo'
                  : 'Falta completar'
              }
            />

            <EstadoCard
              icono="📚"
              titulo="Programa Analítico"
              correcto={programaListo}
              valor={
                programaListo
                  ? `${programa?.contenidos.length || 0} contenidos`
                  : 'Incompleto'
              }
            />

            <EstadoCard
              icono="🔐"
              titulo="Estado del Planeador"
              correcto={baseLista}
              valor={
                baseLista
                  ? 'Listo para planear'
                  : 'Bloqueado'
              }
            />
          </section>

          {mensaje && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '.85rem 1rem',
                borderRadius: '14px',
                background:
                  'rgba(28,81,255,.07)',
                border:
                  '1px solid rgba(28,81,255,.14)',
                color: 'var(--text-main)',
                fontSize: '.8rem',
                lineHeight: 1.5,
              }}
            >
              {mensaje}
            </div>
          )}

          {!baseLista ? (
            <EstadoBloqueado
              icono="🧭"
              titulo="Este grupo aún no está listo para planear"
              descripcion="Completa y guarda primero el Contexto de Escuela, el Contexto del Grupo y su Programa Analítico. Esta regla evita que la IA invente información o genere planeaciones desconectadas."
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'minmax(360px,.85fr) minmax(460px,1.15fr)',
                gap: '1rem',
              }}
              className="planeador-main-grid"
            >
              <form
                onSubmit={generarPlaneacion}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <CardPaso
                  numero="01"
                  icono="📘"
                  titulo="Elige qué vas a trabajar"
                  descripcion="Los referentes vienen de tu Programa Analítico; ya no necesitas volver a escribirlos."
                  color="#1C51FF"
                >
                  {programa &&
                    programa.contenidosCodisenados
                      .length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          gap: '.5rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOrigenCurricular(
                              'nacional'
                            );
                            setCodisenoSeleccionadoId(
                              ''
                            );
                          }}
                          style={chipStyle(
                            origenCurricular ===
                              'nacional',
                            '#1C51FF'
                          )}
                        >
                          🔵 Referente nacional
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOrigenCurricular(
                              'codiseno'
                            );
                            setContenidoSeleccionadoId(
                              ''
                            );
                            setPdaSeleccionadosIds(
                              []
                            );
                          }}
                          style={chipStyle(
                            origenCurricular ===
                              'codiseno',
                            '#9C27B0'
                          )}
                        >
                          🟣 Contenido local
                          codiseñado
                        </button>
                      </div>
                    )}

                  {origenCurricular ===
                  'nacional' ? (
                    <>
                      <div>
                        <label style={labelStyle()}>
                          Contenido del Programa
                          Analítico
                        </label>

                        <select
                          className="search-input"
                          value={
                            contenidoSeleccionadoId
                          }
                          onChange={(e) =>
                            cambiarContenido(
                              e.target.value
                            )
                          }
                          style={{
                            width: '100%',
                            margin: 0,
                            borderRadius: '13px',
                          }}
                        >
                          <option value="">
                            — Selecciona un
                            contenido —
                          </option>

                          {programa?.contenidos.map(
                            (contenido, index) => (
                              <option
                                key={contenido.id}
                                value={contenido.id}
                              >
                                {index + 1}.{' '}
                                {contenido.textoOficial.slice(
                                  0,
                                  110
                                )}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      {contenidoSeleccionado && (
                        <div
                          style={{
                            padding: '.9rem',
                            borderRadius: '16px',
                            background:
                              'var(--bg-input)',
                            border:
                              '1px solid var(--border-color)',
                          }}
                        >
                          <span
                            style={{
                              display: 'block',
                              color:
                                'var(--accent-blue)',
                              fontSize: '.66rem',
                              fontWeight: 900,
                              marginBottom: '.3rem',
                            }}
                          >
                            CONTENIDO OFICIAL
                          </span>

                          <p
                            style={{
                              margin: 0,
                              color:
                                'var(--text-main)',
                              fontSize: '.77rem',
                              lineHeight: 1.5,
                            }}
                          >
                            {
                              contenidoSeleccionado.textoOficial
                            }
                          </p>
                        </div>
                      )}

                      {contenidoSeleccionado && (
                        <div>
                          <label style={labelStyle()}>
                            ¿Qué PDA trabajarás?
                          </label>

                          <p style={ayudaStyle()}>
                            Puedes seleccionar uno o
                            varios PDA asociados al
                            mismo contenido.
                          </p>

                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '.55rem',
                            }}
                          >
                            {contenidoSeleccionado.pda.map(
                              (pda, index) => {
                                const activo =
                                  pdaSeleccionadosIds.includes(
                                    pda.id
                                  );

                                return (
                                  <button
                                    key={pda.id}
                                    type="button"
                                    onClick={() =>
                                      togglePDA(
                                        pda.id
                                      )
                                    }
                                    style={{
                                      textAlign:
                                        'left',
                                      padding:
                                        '.75rem',
                                      borderRadius:
                                        '14px',
                                      border: activo
                                        ? '1px solid rgba(156,39,176,.32)'
                                        : '1px solid var(--border-color)',
                                      background:
                                        activo
                                          ? 'rgba(156,39,176,.07)'
                                          : 'var(--bg-input)',
                                      color:
                                        'var(--text-main)',
                                      cursor:
                                        'pointer',
                                    }}
                                  >
                                    <span
                                      style={{
                                        display:
                                          'block',
                                        color:
                                          activo
                                            ? 'var(--accent-purple)'
                                            : 'var(--text-muted)',
                                        fontSize:
                                          '.65rem',
                                        fontWeight:
                                          900,
                                        marginBottom:
                                          '.2rem',
                                      }}
                                    >
                                      {activo
                                        ? '✓ '
                                        : '○ '}
                                      PDA {index + 1}
                                    </span>

                                    <span
                                      style={{
                                        fontSize:
                                          '.74rem',
                                        lineHeight:
                                          1.45,
                                      }}
                                    >
                                      {
                                        pda.textoOficial
                                      }
                                    </span>
                                  </button>
                                );
                              }
                            )}
                          </div>
                        </div>
                      )}

                      {contextualizaciones.length >
                        0 && (
                        <div
                          style={{
                            padding: '.8rem',
                            borderRadius: '14px',
                            background:
                              'rgba(34,164,71,.06)',
                            border:
                              '1px solid rgba(34,164,71,.12)',
                          }}
                        >
                          <span
                            style={{
                              display: 'block',
                              color:
                                'var(--accent-green)',
                              fontSize: '.66rem',
                              fontWeight: 900,
                              marginBottom: '.3rem',
                            }}
                          >
                            🌎 CONTEXTUALIZACIÓN YA
                            GUARDADA
                          </span>

                          {contextualizaciones.map(
                            (texto, index) => (
                              <p
                                key={`${texto}-${index}`}
                                style={{
                                  margin:
                                    index === 0
                                      ? 0
                                      : '.5rem 0 0',
                                  color:
                                    'var(--text-muted)',
                                  fontSize:
                                    '.72rem',
                                  lineHeight:
                                    1.45,
                                }}
                              >
                                {texto}
                              </p>
                            )
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <label style={labelStyle()}>
                        Contenido local codiseñado
                      </label>

                      <select
                        className="search-input"
                        value={
                          codisenoSeleccionadoId
                        }
                        onChange={(e) =>
                          setCodisenoSeleccionadoId(
                            e.target.value
                          )
                        }
                        style={{
                          width: '100%',
                          margin: 0,
                          borderRadius: '13px',
                        }}
                      >
                        <option value="">
                          — Selecciona contenido
                          local —
                        </option>

                        {programa?.contenidosCodisenados.map(
                          (item, index) => (
                            <option
                              key={item.id}
                              value={item.id}
                            >
                              {index + 1}.{' '}
                              {item.contenidoLocal.slice(
                                0,
                                110
                              )}
                            </option>
                          )
                        )}
                      </select>

                      {codisenoSeleccionado && (
                        <div
                          style={{
                            marginTop: '.7rem',
                            padding: '.85rem',
                            borderRadius: '15px',
                            background:
                              'rgba(156,39,176,.06)',
                            border:
                              '1px solid rgba(156,39,176,.15)',
                          }}
                        >
                          <strong
                            style={{
                              display: 'block',
                              color:
                                'var(--accent-purple)',
                              fontSize: '.68rem',
                            }}
                          >
                            🟣 CONTENIDO LOCAL
                            CODISEÑADO
                          </strong>

                          <p
                            style={{
                              color:
                                'var(--text-main)',
                              fontSize: '.75rem',
                              lineHeight: 1.45,
                            }}
                          >
                            {
                              codisenoSeleccionado.contenidoLocal
                            }
                          </p>

                          <span
                            style={{
                              display: 'block',
                              color:
                                'var(--text-muted)',
                              fontSize: '.67rem',
                              fontWeight: 900,
                              marginTop: '.4rem',
                            }}
                          >
                            PDA LOCAL
                          </span>

                          <p
                            style={{
                              margin:
                                '.2rem 0 0',
                              color:
                                'var(--text-muted)',
                              fontSize: '.73rem',
                              lineHeight: 1.45,
                            }}
                          >
                            {
                              codisenoSeleccionado.pdaLocal
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {ejesSeleccionados.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '.35rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      {ejesSeleccionados.map(
                        (eje) => (
                          <span
                            key={eje}
                            style={{
                              padding:
                                '.35rem .55rem',
                              borderRadius:
                                '999px',
                              background:
                                'rgba(28,81,255,.07)',
                              color:
                                'var(--accent-blue)',
                              fontSize:
                                '.65rem',
                              fontWeight: 800,
                            }}
                          >
                            {eje}
                          </span>
                        )
                      )}
                    </div>
                  )}
                </CardPaso>

                <CardPaso
                  numero="02"
                  icono="🗓️"
                  titulo="Define el periodo real"
                  descripcion="Aula+ organizará las sesiones de acuerdo con tus fechas, días y duración."
                  color="#F97316"
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(2,minmax(0,1fr))',
                      gap: '.7rem',
                    }}
                    className="planeador-fechas-grid"
                  >
                    <CampoFecha
                      label="Inicio"
                      value={fechaInicio}
                      onChange={setFechaInicio}
                    />

                    <CampoFecha
                      label="Fin"
                      value={fechaFin}
                      onChange={setFechaFin}
                    />
                  </div>

                  {etiquetaTemporal && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignSelf:
                          'flex-start',
                        borderRadius:
                          '999px',
                        padding:
                          '.35rem .6rem',
                        background:
                          'rgba(249,115,22,.08)',
                        color: '#F97316',
                        fontSize: '.67rem',
                        fontWeight: 900,
                      }}
                    >
                      📅 {etiquetaTemporal}
                    </span>
                  )}

                  <div>
                    <label style={labelStyle()}>
                      Días de clase
                    </label>

                    <div
                      style={{
                        display: 'flex',
                        gap: '.4rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      {DIAS.map((dia) => {
                        const activo =
                          diasClase.includes(dia);

                        return (
                          <button
                            type="button"
                            key={dia}
                            onClick={() =>
                              toggleDia(dia)
                            }
                            style={chipStyle(
                              activo,
                              '#F97316'
                            )}
                          >
                            {dia.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(2,minmax(0,1fr))',
                      gap: '.7rem',
                    }}
                    className="planeador-fechas-grid"
                  >
                    <div>
                      <label style={labelStyle()}>
                        Minutos por sesión
                      </label>

                      <input
                        type="number"
                        min="1"
                        className="search-input"
                        value={duracion}
                        onChange={(e) =>
                          setDuracion(
                            e.target.value
                          )
                        }
                        style={inputStyle()}
                      />
                    </div>

                    <CampoFecha
                      label="Fecha de entrega"
                      value={fechaEntrega}
                      onChange={setFechaEntrega}
                    />
                  </div>
                </CardPaso>

                <CardPaso
                  numero="03"
                  icono="🧠"
                  titulo="Dile a Aula+ qué necesitas"
                  descripcion="Ésta es la parte que sí cambia cada vez que planeas."
                  color="#9C27B0"
                >
                  <div>
                    <label style={labelStyle()}>
                      ¿Qué quieres trabajar o
                      conseguir?
                    </label>

                    <textarea
                      className="search-input"
                      value={instrucciones}
                      onChange={(e) =>
                        setInstrucciones(
                          e.target.value
                        )
                      }
                      placeholder="Ej. Quiero que el grupo comprenda el proceso y construya una propuesta aplicable a una situación de la escuela..."
                      style={textareaStyle(100)}
                    />
                  </div>

                  <div>
                    <label style={labelStyle()}>
                      Producto o evidencia
                      esperada
                    </label>

                    <input
                      className="search-input"
                      value={productoEsperado}
                      onChange={(e) =>
                        setProductoEsperado(
                          e.target.value
                        )
                      }
                      placeholder="Opcional. Ej. Infografía, prototipo, exposición, reporte..."
                      style={inputStyle()}
                    />
                  </div>

                  <div>
                    <label style={labelStyle()}>
                      Metodología / estrategia
                    </label>

                    <select
                      className="search-input"
                      value={metodologia}
                      onChange={(e) =>
                        setMetodologia(
                          e.target.value
                        )
                      }
                      style={{
                        width: '100%',
                        margin: 0,
                        borderRadius: '13px',
                      }}
                    >
                      {METODOLOGIAS.map(
                        (metodo) => (
                          <option
                            key={metodo}
                            value={metodo}
                          >
                            {metodo}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {metodologia ===
                    'Personalizada' && (
                    <input
                      className="search-input"
                      value={
                        metodologiaPersonalizada
                      }
                      onChange={(e) =>
                        setMetodologiaPersonalizada(
                          e.target.value
                        )
                      }
                      placeholder="Escribe tu metodología o estrategia..."
                      style={inputStyle()}
                    />
                  )}

                  <details>
                    <summary
                      style={{
                        cursor: 'pointer',
                        color:
                          'var(--text-muted)',
                        fontSize: '.75rem',
                        fontWeight: 800,
                      }}
                    >
                      Indicaciones adicionales
                    </summary>

                    <textarea
                      className="search-input"
                      value={indicacionesExtra}
                      onChange={(e) =>
                        setIndicacionesExtra(
                          e.target.value
                        )
                      }
                      placeholder="Ej. Evita tareas para casa; quiero una rúbrica breve; prioriza trabajo manual..."
                      style={{
                        ...textareaStyle(80),
                        marginTop: '.6rem',
                      }}
                    />
                  </details>
                </CardPaso>

                <button
                  type="submit"
                  disabled={
                    generando ||
                    !formularioListo
                  }
                  style={{
                    width: '100%',
                    border: 'none',
                    borderRadius: '17px',
                    padding: '1rem',
                    background:
                      'linear-gradient(135deg,var(--accent-purple),var(--accent-blue))',
                    color: 'white',
                    cursor:
                      generando ||
                      !formularioListo
                        ? 'not-allowed'
                        : 'pointer',
                    fontSize: '.95rem',
                    fontWeight: 900,
                    boxShadow:
                      '0 12px 30px rgba(103,58,183,.20)',
                    opacity:
                      formularioListo
                        ? 1
                        : 0.45,
                  }}
                >
                  {generando
                    ? '🧠 Construyendo una planeación situada...'
                    : '✨ Construir planeación contextualizada'}
                </button>
              </form>

              <section
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: '720px',
                  borderRadius: '24px',
                  overflow: 'hidden',
                  background: 'var(--bg-app)',
                  border:
                    '1px solid var(--border-color)',
                }}
              >
                <div
                  style={{
                    padding: '.9rem 1rem',
                    background:
                      'var(--bg-panel)',
                    borderBottom:
                      '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent:
                      'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '.7rem',
                  }}
                >
                  <div>
                    <strong
                      style={{
                        display: 'block',
                        color:
                          'var(--text-main)',
                        fontSize: '.82rem',
                      }}
                    >
                      Vista previa de la
                      planeación
                    </strong>

                    <span
                      style={{
                        color:
                          'var(--text-muted)',
                        fontSize: '.68rem',
                      }}
                    >
                      {grupoActivo?.name} ·{' '}
                      {grupoActivo?.subject}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '.45rem',
                      opacity: resultadoIA
                        ? 1
                        : 0.35,
                      pointerEvents: resultadoIA
                        ? 'auto'
                        : 'none',
                    }}
                  >
                    <button
                      type="button"
                      onClick={exportarWord}
                      style={exportButton(
                        '#185ABD'
                      )}
                    >
                      📄 Word
                    </button>

                    <button
                      type="button"
                      onClick={exportarPDF}
                      style={exportButton(
                        '#E53935'
                      )}
                    >
                      📕 PDF
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    padding:
                      'clamp(1rem,2.4vw,2rem)',
                    overflowY: 'auto',
                    background: '#e2e8f0',
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  {generando ? (
                    <div
                      style={{
                        minHeight: '520px',
                        display: 'grid',
                        placeItems: 'center',
                        textAlign: 'center',
                      }}
                    >
                      <div>
                        <div
                          className="loader"
                          style={{
                            width: '58px',
                            height: '58px',
                            margin:
                              '0 auto 1rem',
                            borderTopColor:
                              'var(--accent-purple)',
                          }}
                        />

                        <strong
                          style={{
                            color:
                              'var(--accent-purple)',
                            fontSize: '.9rem',
                          }}
                        >
                          Conectando contexto,
                          currículo y decisiones
                          didácticas...
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: 'white',
                        padding:
                          'clamp(1.4rem,3vw,3rem)',
                        width: '100%',
                        maxWidth: '820px',
                        minHeight: '100%',
                        boxShadow:
                          '0 5px 18px rgba(0,0,0,.10)',
                        color: '#000',
                        fontFamily:
                          'Arial, sans-serif',
                        fontSize: '11pt',
                        lineHeight: 1.6,
                        textAlign: 'justify',
                      }}
                    >
                      {resultadoIA ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html:
                              convertirMarkdownAHtml(
                                resultadoIA
                              ),
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            textAlign:
                              'center',
                            color: '#94a3b8',
                            marginTop: '28%',
                          }}
                        >
                          <span
                            style={{
                              display:
                                'block',
                              fontSize: '4rem',
                              marginBottom:
                                '1rem',
                            }}
                          >
                            📄
                          </span>

                          <strong>
                            Tu contexto ya está
                            conectado.
                          </strong>

                          <br />
                          <br />

                          Elige un referente
                          curricular, define el
                          periodo y escribe tu
                          intención didáctica.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </>
      )}

      <style>{`
        @media (max-width: 980px) {
          .planeador-main-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 720px) {
          .planeador-hero-grid,
          .planeador-fechas-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function CardPaso({
  numero,
  icono,
  titulo,
  descripcion,
  color,
  children,
}: {
  numero: string;
  icono: string;
  titulo: string;
  descripcion: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        padding: '1rem',
        borderRadius: '22px',
        background: 'var(--bg-panel)',
        border:
          '1px solid var(--border-color)',
        boxShadow:
          '0 7px 25px rgba(0,0,0,.035)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '.7rem',
          alignItems: 'flex-start',
          marginBottom: '.9rem',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '14px',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            background: `color-mix(in srgb, ${color} 11%, transparent)`,
            fontSize: '1.15rem',
          }}
        >
          {icono}
        </div>

        <div>
          <span
            style={{
              display: 'block',
              color,
              fontSize: '.65rem',
              fontWeight: 900,
              letterSpacing: '.07em',
            }}
          >
            PASO {numero}
          </span>

          <h3
            style={{
              margin: '.15rem 0',
              color: 'var(--text-main)',
              fontSize: '1rem',
            }}
          >
            {titulo}
          </h3>

          <p
            style={{
              margin: 0,
              color: 'var(--text-muted)',
              fontSize: '.73rem',
              lineHeight: 1.45,
            }}
          >
            {descripcion}
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '.85rem',
        }}
      >
        {children}
      </div>
    </section>
  );
}

function EstadoCard({
  icono,
  titulo,
  correcto,
  valor,
}: {
  icono: string;
  titulo: string;
  correcto: boolean;
  valor: string;
}) {
  return (
    <div
      style={{
        padding: '.85rem',
        borderRadius: '17px',
        background: 'var(--bg-panel)',
        border:
          '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '.65rem',
      }}
    >
      <div
        style={{
          width: '38px',
          height: '38px',
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '12px',
          background: correcto
            ? 'rgba(34,164,71,.08)'
            : 'rgba(249,115,22,.07)',
        }}
      >
        {icono}
      </div>

      <div style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            color: 'var(--text-muted)',
            fontSize: '.64rem',
            fontWeight: 800,
          }}
        >
          {titulo}
        </span>

        <strong
          style={{
            display: 'block',
            color: correcto
              ? 'var(--accent-green)'
              : '#F97316',
            fontSize: '.78rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {correcto ? '✓ ' : '○ '}
          {valor}
        </strong>
      </div>
    </div>
  );
}

function EstadoBloqueado({
  icono,
  titulo,
  descripcion,
}: {
  icono: string;
  titulo: string;
  descripcion: string;
}) {
  return (
    <div
      style={{
        minHeight: '380px',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        borderRadius: '24px',
        border:
          '1px dashed var(--border-color)',
        background: 'var(--bg-panel)',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '590px' }}>
        <div
          style={{
            width: '76px',
            height: '76px',
            margin: '0 auto 1rem',
            borderRadius: '24px',
            display: 'grid',
            placeItems: 'center',
            background:
              'linear-gradient(135deg,rgba(249,115,22,.09),rgba(156,39,176,.08))',
            fontSize: '2.1rem',
          }}
        >
          {icono}
        </div>

        <h3
          style={{
            margin: 0,
            color: 'var(--text-main)',
            fontSize: '1.3rem',
          }}
        >
          {titulo}
        </h3>

        <p
          style={{
            margin: '.7rem 0 0',
            color: 'var(--text-muted)',
            fontSize: '.82rem',
            lineHeight: 1.55,
          }}
        >
          {descripcion}
        </p>
      </div>
    </div>
  );
}

function PantallaCarga({
  texto,
}: {
  texto: string;
}) {
  return (
    <div
      style={{
        minHeight: '430px',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          className="loader"
          style={{
            margin: '0 auto 1rem',
          }}
        />

        <strong
          style={{
            color: 'var(--text-main)',
            fontSize: '.85rem',
          }}
        >
          {texto}
        </strong>
      </div>
    </div>
  );
}

function CampoFecha({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label style={labelStyle()}>
        {label}
      </label>

      <input
        type="date"
        className="search-input"
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        style={inputStyle()}
      />
    </div>
  );
}

function labelStyle(): CSSProperties {
  return {
    display: 'block',
    color: 'var(--text-main)',
    fontWeight: 900,
    fontSize: '.76rem',
    marginBottom: '.3rem',
  };
}

function ayudaStyle(): CSSProperties {
  return {
    margin: '0 0 .45rem',
    color: 'var(--text-muted)',
    fontSize: '.68rem',
    lineHeight: 1.4,
  };
}

function inputStyle(): CSSProperties {
  return {
    width: '100%',
    margin: 0,
    boxSizing: 'border-box',
    borderRadius: '13px',
  };
}

function textareaStyle(
  minHeight: number
): CSSProperties {
  return {
    width: '100%',
    minHeight: `${minHeight}px`,
    resize: 'vertical',
    margin: 0,
    boxSizing: 'border-box',
    borderRadius: '13px',
    lineHeight: 1.5,
  };
}

function chipStyle(
  activo: boolean,
  color: string
): CSSProperties {
  return {
    border: activo
      ? `1px solid color-mix(in srgb, ${color} 35%, var(--border-color))`
      : '1px solid var(--border-color)',
    background: activo
      ? `color-mix(in srgb, ${color} 8%, var(--bg-input))`
      : 'var(--bg-input)',
    color: activo
      ? color
      : 'var(--text-muted)',
    borderRadius: '999px',
    padding: '.48rem .68rem',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '.69rem',
  };
}

function exportButton(
  color: string
): CSSProperties {
  return {
    border: 'none',
    borderRadius: '10px',
    padding: '.55rem .7rem',
    background: color,
    color: 'white',
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: '.7rem',
  };
}
