import { useEffect, useMemo, useState } from 'react';
import { generarTextoIA } from '../services/aiService';
import type { CSSProperties, ReactNode } from 'react';
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
  crearProgramaAnaliticoVacio,
  guardarProgramaAnalitico,
  obtenerCorreoSesion,
} from '../services/planeacionContextService';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';

interface Grupo {
  id: string;
  name: string;
  grade: string;
  subject: string;
  emphasis?: string;
  docenteEmail?: string;
}

type VistaPrograma =
  | 'referentes'
  | 'contextualizacion'
  | 'codiseno'
  | 'organizacion';

interface PropuestaContextualizacion {
  contenidoId: string;
  pdaId: string;
  contenidoOficial: string;
  pdaOficial: string;
  contextualizacion: string;
  ejesArticuladores: string[];
  problematicasRelacionadas: string[];
  saberesComunitariosRelacionados: string[];
  decisionCurricular: 'sin_ajuste' | 'contextualizado';
  temporalidad: string;
  justificacion: string;
}

interface AnalisisCodisenoIA {
  decision: 'no_necesario' | 'posible_codiseno';
  explicacion: string;
  contenidoLocal?: string;
  pdaLocal?: string;
  justificacion?: string;
  problematicaQueLoJustifica?: string;
  evidencias?: string;
  relacionConContenidosNacionales?: string;
  ejesArticuladores?: string[];
  temporalidad?: string;
}

const EJES = [
  'Inclusión',
  'Pensamiento crítico',
  'Interculturalidad crítica',
  'Igualdad de género',
  'Vida saludable',
  'Apropiación de las culturas a través de la lectura y la escritura',
  'Artes y experiencias estéticas',
];

function crearId(prefijo: string) {
  return `${prefijo}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function textoUtil(valor?: string) {
  return Boolean(valor && valor.trim().length >= 5);
}

export default function ProgramaAnalitico() {
  const [docenteEmail, setDocenteEmail] = useState('');
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState('');

  const [contextoEscuela, setContextoEscuela] =
    useState<ContextoEscuela | null>(null);
  const [contextoGrupo, setContextoGrupo] =
    useState<ContextoGrupo | null>(null);
  const [programa, setPrograma] =
    useState<ProgramaAnaliticoGrupo | null>(null);

  const [vista, setVista] =
    useState<VistaPrograma>('referentes');

  const [cargandoGrupos, setCargandoGrupos] = useState(true);
  const [cargandoPrograma, setCargandoPrograma] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [procesandoIA, setProcesandoIA] = useState(false);

  const [mensaje, setMensaje] = useState('');
  const [nuevoProblema, setNuevoProblema] = useState('');

  const [
    propuestaContextualizacion,
    setPropuestaContextualizacion,
  ] = useState<PropuestaContextualizacion | null>(null);

  const [analisisCodiseno, setAnalisisCodiseno] =
    useState<AnalisisCodisenoIA | null>(null);

  useEffect(() => {
    const inicializar = async () => {
      const email = obtenerCorreoSesion();
      setDocenteEmail(email);

      try {
        const q = query(
          collection(db, 'groups'),
          where('docenteEmail', '==', email)
        );

        const snap = await getDocs(q);
        const lista: Grupo[] = [];

        snap.forEach((d) => {
          const data = d.data();

          lista.push({
            id: d.id,
            name: data.name || 'Grupo sin nombre',
            grade: data.grade || '',
            subject: data.subject || '',
            emphasis: data.emphasis || '',
            docenteEmail: data.docenteEmail,
          });
        });

        lista.sort((a, b) =>
          `${a.grade}-${a.name}`.localeCompare(
            `${b.grade}-${b.name}`,
            'es'
          )
        );

        setGrupos(lista);
      } catch (error) {
        console.error('Error al cargar grupos:', error);
        setMensaje('No fue posible consultar tus grupos.');
      } finally {
        setCargandoGrupos(false);
      }
    };

    inicializar();
  }, []);

  useEffect(() => {
    if (!grupoSeleccionado || !docenteEmail) {
      setPrograma(null);
      setContextoGrupo(null);
      return;
    }

    const cargarTodo = async () => {
      setCargandoPrograma(true);
      setMensaje('');
      setPropuestaContextualizacion(null);
      setAnalisisCodiseno(null);

      try {
        const [
          contextoEscuelaGuardado,
          contextoGrupoGuardado,
          programaGuardado,
        ] = await Promise.all([
          cargarContextoEscuela(docenteEmail),
          cargarContextoGrupo(
            docenteEmail,
            grupoSeleccionado
          ),
          cargarProgramaAnalitico(
            docenteEmail,
            grupoSeleccionado
          ),
        ]);

        setContextoEscuela(contextoEscuelaGuardado);
        setContextoGrupo(contextoGrupoGuardado);
        setPrograma(programaGuardado);
      } catch (error) {
        console.error(
          'Error al cargar Programa Analítico:',
          error
        );

        setPrograma(
          crearProgramaAnaliticoVacio(
            grupoSeleccionado,
            docenteEmail
          )
        );

        setMensaje(
          'No fue posible recuperar toda la información previa. Puedes continuar y guardar de nuevo.'
        );
      } finally {
        setCargandoPrograma(false);
      }
    };

    cargarTodo();
  }, [grupoSeleccionado, docenteEmail]);

  const grupoActivo = useMemo(
    () =>
      grupos.find(
        (grupo) => grupo.id === grupoSeleccionado
      ) || null,
    [grupos, grupoSeleccionado]
  );

  const contextoEscuelaListo = useMemo(() => {
    if (!contextoEscuela) return false;

    return (
      contextoEscuela.estado === 'listo' ||
      contextoEscuela.estado === 'optimizado'
    );
  }, [contextoEscuela]);

  const contextoGrupoListo = useMemo(() => {
    if (!contextoGrupo) return false;

    return (
      contextoGrupo.estado === 'listo' ||
      contextoGrupo.estado === 'optimizado'
    );
  }, [contextoGrupo]);

  const contextoListo =
    contextoEscuelaListo && contextoGrupoListo;

  const totalPDA = useMemo(() => {
    if (!programa) return 0;

    return programa.contenidos.reduce(
      (total, contenido) =>
        total + contenido.pda.length,
      0
    );
  }, [programa]);

  const pdaContextualizados = useMemo(() => {
    if (!programa) return 0;

    return programa.contenidos.reduce(
      (total, contenido) =>
        total +
        contenido.pda.filter((pda) =>
          textoUtil(pda.contextualizacion)
        ).length,
      0
    );
  }, [programa]);

  const pdaTemporalizados = useMemo(() => {
    if (!programa) return 0;

    return programa.contenidos.reduce(
      (total, contenido) =>
        total +
        contenido.pda.filter((pda) =>
          textoUtil(pda.temporalidad)
        ).length,
      0
    );
  }, [programa]);

  const avancePrograma =
    totalPDA === 0
      ? 0
      : Math.round(
          ((pdaContextualizados + pdaTemporalizados) /
            (totalPDA * 2)) *
            100
        );

  const guardar = async () => {
    if (
      !programa ||
      !grupoSeleccionado ||
      !docenteEmail
    ) {
      return;
    }

    setGuardando(true);
    setMensaje('');

    try {
      const tieneContenidos =
        programa.contenidos.length > 0;

      const todosConPDA =
        programa.contenidos.length > 0 &&
        programa.contenidos.every(
          (contenido) =>
            textoUtil(contenido.textoOficial) &&
            contenido.pda.length > 0 &&
            contenido.pda.every((pda) =>
              textoUtil(pda.textoOficial)
            )
        );

      const actualizado: ProgramaAnaliticoGrupo = {
        ...programa,
        estado:
          todosConPDA &&
          textoUtil(programa.horizonteFormativo)
            ? 'listo'
            : tieneContenidos
              ? 'en_construccion'
              : 'inicial',
      };

      await guardarProgramaAnalitico(
        docenteEmail,
        grupoSeleccionado,
        actualizado
      );

      setPrograma(actualizado);

      setMensaje(
        `✓ Programa Analítico de ${
          grupoActivo?.name || 'este grupo'
        } guardado en la nube.`
      );
    } catch (error) {
      console.error(
        'Error al guardar Programa Analítico:',
        error
      );

      setMensaje(
        'No fue posible guardar el Programa Analítico.'
      );
    } finally {
      setGuardando(false);
    }
  };

  const agregarContenido = () => {
    if (!programa) return;

    const contenido: ContenidoPrograma = {
      id: crearId('contenido'),
      textoOficial: '',
      pda: [
        {
          id: crearId('pda'),
          textoOficial: '',
          contextualizacion: '',
          ejesArticuladores: [],
          problematicasRelacionadas: [],
          saberesComunitariosRelacionados: [],
          decisionCurricular: 'sin_ajuste',
          temporalidad: '',
          activo: true,
        },
      ],
      notasDocente: '',
      activo: true,
    };

    setPrograma({
      ...programa,
      contenidos: [...programa.contenidos, contenido],
    });
  };

  const actualizarContenido = (
    contenidoId: string,
    patch: Partial<ContenidoPrograma>
  ) => {
    if (!programa) return;

    setPrograma({
      ...programa,
      contenidos: programa.contenidos.map(
        (contenido) =>
          contenido.id === contenidoId
            ? { ...contenido, ...patch }
            : contenido
      ),
    });
  };

  const eliminarContenido = (contenidoId: string) => {
    if (!programa) return;

    const confirmar = window.confirm(
      '¿Eliminar este contenido y todos sus PDA?'
    );

    if (!confirmar) return;

    setPrograma({
      ...programa,
      contenidos: programa.contenidos.filter(
        (contenido) =>
          contenido.id !== contenidoId
      ),
    });
  };

  const agregarPDA = (contenidoId: string) => {
    if (!programa) return;

    setPrograma({
      ...programa,
      contenidos: programa.contenidos.map(
        (contenido) => {
          if (contenido.id !== contenidoId) {
            return contenido;
          }

          const nuevoPDA: PDAPrograma = {
            id: crearId('pda'),
            textoOficial: '',
            contextualizacion: '',
            ejesArticuladores: [],
            problematicasRelacionadas: [],
            saberesComunitariosRelacionados: [],
            decisionCurricular: 'sin_ajuste',
            temporalidad: '',
            activo: true,
          };

          return {
            ...contenido,
            pda: [...contenido.pda, nuevoPDA],
          };
        }
      ),
    });
  };

  const actualizarPDA = (
    contenidoId: string,
    pdaId: string,
    patch: Partial<PDAPrograma>
  ) => {
    if (!programa) return;

    setPrograma({
      ...programa,
      contenidos: programa.contenidos.map(
        (contenido) => {
          if (contenido.id !== contenidoId) {
            return contenido;
          }

          return {
            ...contenido,
            pda: contenido.pda.map((pda) =>
              pda.id === pdaId
                ? { ...pda, ...patch }
                : pda
            ),
          };
        }
      ),
    });
  };

  const eliminarPDA = (
    contenidoId: string,
    pdaId: string
  ) => {
    if (!programa) return;

    setPrograma({
      ...programa,
      contenidos: programa.contenidos.map(
        (contenido) => {
          if (contenido.id !== contenidoId) {
            return contenido;
          }

          if (contenido.pda.length === 1) {
            return contenido;
          }

          return {
            ...contenido,
            pda: contenido.pda.filter(
              (pda) => pda.id !== pdaId
            ),
          };
        }
      ),
    });
  };

  const agregarProblematica = () => {
    if (!programa || !nuevoProblema.trim()) return;

    setPrograma({
      ...programa,
      problematicasPriorizadas: [
        ...programa.problematicasPriorizadas,
        nuevoProblema.trim(),
      ],
    });

    setNuevoProblema('');
  };

  const eliminarProblematica = (index: number) => {
    if (!programa) return;

    setPrograma({
      ...programa,
      problematicasPriorizadas:
        programa.problematicasPriorizadas.filter(
          (_, i) => i !== index
        ),
    });
  };

  const extraerJSON = (texto: string) => {
    const limpio = texto
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const inicio = limpio.indexOf('{');
    const fin = limpio.lastIndexOf('}');

    if (inicio === -1 || fin === -1) {
      throw new Error(
        'La IA no devolvió un objeto JSON válido.'
      );
    }

    return JSON.parse(
      limpio.slice(inicio, fin + 1)
    );
  };

  const contextoParaIA = () => ({
    escuela: {
      descripcion:
        contextoEscuela?.campos.descripcionEscuela || '',
      infraestructura:
        contextoEscuela?.campos.infraestructura || '',
      limitaciones:
        contextoEscuela?.campos.limitaciones || '',
      comunidad:
        contextoEscuela?.campos.descripcionComunidad || '',
      problematicas:
        contextoEscuela?.campos
          .problematicasComunitarias || '',
      fortalezas:
        contextoEscuela?.campos
          .fortalezasComunitarias || '',
      saberes:
        contextoEscuela?.campos.saberesComunitarios ||
        '',
      recursos:
        contextoEscuela?.campos
          .recursosDisponibles || [],
    },
    grupo: {
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
      diagnostico:
        contextoGrupo?.campos.diagnostico || '',
      ritmo:
        contextoGrupo?.campos.ritmoTrabajo || '',
      formaTrabajo:
        contextoGrupo?.campos.formaTrabajo || '',
      apoyos:
        contextoGrupo?.campos.diversidadYApoyos ||
        '',
      participacion:
        contextoGrupo?.campos
          .preferenciasParticipacion || '',
    },
  });

  const contextualizarPDAConIA = async (
    contenido: ContenidoPrograma,
    pda: PDAPrograma
  ) => {
    if (!grupoActivo || !programa) return;

    if (!contextoListo) {
      setMensaje(
        'Completa primero el contexto de la escuela y del grupo antes de pedir una contextualización con IA.'
      );
      return;
    }

    if (
      !textoUtil(contenido.textoOficial) ||
      !textoUtil(pda.textoOficial)
    ) {
      setMensaje(
        'Escribe primero el Contenido y el PDA oficiales.'
      );
      return;
    }

    setProcesandoIA(true);
    setMensaje('');

    const prompt = `
Eres asesor técnico pedagógico de Educación Básica en México y especialista en Nueva Escuela Mexicana.

Tu tarea es PROPONER una contextualización para un Contenido y un PDA que el docente ya capturó.

REGLAS:
1. NO modifiques, resumas, corrijas ni reescribas el Contenido oficial.
2. NO modifiques, resumas, corrijas ni reescribas el PDA oficial.
3. NO inventes una problemática que no tenga apoyo en el contexto proporcionado.
4. NO inventes datos de estudiantes, escuela o comunidad.
5. La contextualización debe explicar desde qué situación, ejemplo, recurso, saber comunitario, actor, producto o forma de participación podría trabajarse el PDA.
6. Selecciona ejes articuladores sólo cuando exista una relación justificable.
7. Si el PDA puede recuperarse sin una contextualización especial, indícalo como "sin_ajuste".
8. NO propongas codiseño aquí. Sólo contextualización del referente nacional.
9. La propuesta debe ser útil para alimentar posteriormente una planeación didáctica.
10. Devuelve ÚNICAMENTE JSON válido.

DATOS DEL GRUPO:
${JSON.stringify(
  {
    nombre: grupoActivo.name,
    grado: grupoActivo.grade,
    disciplina: grupoActivo.subject,
    enfasis: grupoActivo.emphasis || '',
  },
  null,
  2
)}

CONTEXTO VALIDADO:
${JSON.stringify(contextoParaIA(), null, 2)}

PROBLEMÁTICAS PRIORIZADAS POR EL DOCENTE:
${JSON.stringify(
  programa.problematicasPriorizadas,
  null,
  2
)}

CONTENIDO OFICIAL:
${contenido.textoOficial}

PDA OFICIAL:
${pda.textoOficial}

Devuelve:
{
  "contextualizacion": "propuesta situada",
  "ejesArticuladores": ["eje pertinente"],
  "problematicasRelacionadas": ["situación del contexto realmente relacionada"],
  "saberesComunitariosRelacionados": ["saber o fortaleza real del contexto si aplica"],
  "decisionCurricular": "sin_ajuste" | "contextualizado",
  "temporalidad": "sugerencia general como Septiembre, Primer trimestre o Por definir",
  "justificacion": "explicación breve de por qué la relación es pertinente"
}
`.trim();

    try {
      const texto = await generarTextoIA({
  prompt,
  temperature: 0.15,
});


      const resultado = extraerJSON(texto);

      const propuesta: PropuestaContextualizacion = {
        contenidoId: contenido.id,
        pdaId: pda.id,
        contenidoOficial: contenido.textoOficial,
        pdaOficial: pda.textoOficial,

        contextualizacion:
          resultado.contextualizacion || '',

        ejesArticuladores: Array.isArray(
          resultado.ejesArticuladores
        )
          ? resultado.ejesArticuladores
          : [],

        problematicasRelacionadas: Array.isArray(
          resultado.problematicasRelacionadas
        )
          ? resultado.problematicasRelacionadas
          : [],

        saberesComunitariosRelacionados:
          Array.isArray(
            resultado.saberesComunitariosRelacionados
          )
            ? resultado.saberesComunitariosRelacionados
            : [],

        decisionCurricular:
          resultado.decisionCurricular ===
          'contextualizado'
            ? 'contextualizado'
            : 'sin_ajuste',

        temporalidad:
          resultado.temporalidad || '',

        justificacion:
          resultado.justificacion || '',
      };

      setPropuestaContextualizacion(propuesta);
    } catch (error) {
      console.error(
        'Error al contextualizar PDA:',
        error
      );

      setMensaje(
        'La IA no pudo proponer la contextualización. El texto oficial no fue modificado.'
      );
    } finally {
      setProcesandoIA(false);
    }
  };

  const aceptarContextualizacionIA = () => {
    if (!propuestaContextualizacion) return;

    actualizarPDA(
      propuestaContextualizacion.contenidoId,
      propuestaContextualizacion.pdaId,
      {
        contextualizacion:
          propuestaContextualizacion.contextualizacion,
        ejesArticuladores:
          propuestaContextualizacion.ejesArticuladores,
        problematicasRelacionadas:
          propuestaContextualizacion.problematicasRelacionadas,
        saberesComunitariosRelacionados:
          propuestaContextualizacion.saberesComunitariosRelacionados,
        decisionCurricular:
          propuestaContextualizacion.decisionCurricular,
        temporalidad:
          propuestaContextualizacion.temporalidad,
      }
    );

    setPropuestaContextualizacion(null);

    setMensaje(
      '✨ Propuesta incorporada. Recuerda guardar el Programa Analítico cuando termines.'
    );
  };

  const analizarCodisenoConIA = async () => {
    if (!programa || !grupoActivo) return;

    if (!contextoListo) {
      setMensaje(
        'Completa primero los contextos de Escuela y Grupo.'
      );
      return;
    }

    if (programa.contenidos.length === 0) {
      setMensaje(
        'Captura primero los Contenidos y PDA nacionales disponibles. El codiseño sólo debe analizarse después de revisar lo que ya ofrece el Programa Sintético.'
      );
      return;
    }

    setProcesandoIA(true);
    setMensaje('');
    setAnalisisCodiseno(null);

    const referentes = programa.contenidos.map(
      (contenido) => ({
        contenido: contenido.textoOficial,
        pda: contenido.pda.map(
          (pda) => pda.textoOficial
        ),
      })
    );

    const prompt = `
Eres asesor técnico pedagógico de Educación Básica en México y especialista en Nueva Escuela Mexicana.

Debes analizar si existe una necesidad REAL de codiseño para este grupo.

REGLAS:
1. Primero revisa si los Contenidos y PDA nacionales capturados ya permiten abordar las situaciones priorizadas.
2. Si basta con situarlos mediante ejemplos, problemas, saberes, recursos o actores locales, responde "no_necesario".
3. Sólo responde "posible_codiseno" cuando exista un saber, fenómeno, práctica, lengua, situación o necesidad local importante que NO esté suficientemente contemplada en los referentes nacionales proporcionados.
4. NO presentes el contenido local propuesto como contenido oficial SEP.
5. NO inventes necesidades, saberes o problemáticas.
6. Basa el análisis únicamente en el contexto y los referentes suministrados.
7. Devuelve sólo JSON válido.

GRUPO:
${JSON.stringify(
  {
    nombre: grupoActivo.name,
    grado: grupoActivo.grade,
    disciplina: grupoActivo.subject,
    enfasis: grupoActivo.emphasis || '',
  },
  null,
  2
)}

CONTEXTO:
${JSON.stringify(contextoParaIA(), null, 2)}

PROBLEMÁTICAS PRIORIZADAS:
${JSON.stringify(
  programa.problematicasPriorizadas,
  null,
  2
)}

REFERENTES NACIONALES CAPTURADOS:
${JSON.stringify(referentes, null, 2)}

Devuelve:
{
  "decision": "no_necesario" | "posible_codiseno",
  "explicacion": "razón pedagógica breve",
  "contenidoLocal": "sólo si procede",
  "pdaLocal": "sólo si procede",
  "justificacion": "sólo si procede",
  "problematicaQueLoJustifica": "sólo si procede",
  "evidencias": "describe qué evidencia del contexto lo sustenta; no inventes",
  "relacionConContenidosNacionales": "cómo amplía o complementa los referentes existentes",
  "ejesArticuladores": ["sólo si procede"],
  "temporalidad": "sugerencia general o Por definir"
}
`.trim();

    try {
      const texto = await generarTextoIA({
  prompt,
  temperature: 0.1,
});
      const resultado =
        extraerJSON(texto) as AnalisisCodisenoIA;

      setAnalisisCodiseno({
        decision:
          resultado.decision ===
          'posible_codiseno'
            ? 'posible_codiseno'
            : 'no_necesario',
        explicacion:
          resultado.explicacion || '',
        contenidoLocal:
          resultado.contenidoLocal || '',
        pdaLocal: resultado.pdaLocal || '',
        justificacion:
          resultado.justificacion || '',
        problematicaQueLoJustifica:
          resultado.problematicaQueLoJustifica ||
          '',
        evidencias: resultado.evidencias || '',
        relacionConContenidosNacionales:
          resultado.relacionConContenidosNacionales ||
          '',
        ejesArticuladores: Array.isArray(
          resultado.ejesArticuladores
        )
          ? resultado.ejesArticuladores
          : [],
        temporalidad:
          resultado.temporalidad || 'Por definir',
      });
    } catch (error) {
      console.error(
        'Error al analizar codiseño:',
        error
      );

      setMensaje(
        'No fue posible completar el análisis de codiseño.'
      );
    } finally {
      setProcesandoIA(false);
    }
  };

  const aceptarCodiseno = () => {
    if (
      !programa ||
      !analisisCodiseno ||
      analisisCodiseno.decision !==
        'posible_codiseno'
    ) {
      return;
    }

    const nuevo: ContenidoCodisenado = {
      id: crearId('codiseno'),
      titulo: 'Contenido local codiseñado',
      contenidoLocal:
        analisisCodiseno.contenidoLocal || '',
      pdaLocal:
        analisisCodiseno.pdaLocal || '',
      justificacion:
        analisisCodiseno.justificacion || '',
      problematicaQueLoJustifica:
        analisisCodiseno.problematicaQueLoJustifica ||
        '',
      evidencias:
        analisisCodiseno.evidencias || '',
      relacionConContenidosNacionales:
        analisisCodiseno
          .relacionConContenidosNacionales || '',
      ejesArticuladores:
        analisisCodiseno.ejesArticuladores || [],
      temporalidad:
        analisisCodiseno.temporalidad ||
        'Por definir',
      generadoConIA: true,
      validadoPorDocente: true,
    };

    setPrograma({
      ...programa,
      contenidosCodisenados: [
        ...programa.contenidosCodisenados,
        nuevo,
      ],
    });

    setAnalisisCodiseno(null);

    setMensaje(
      '🟣 Contenido local agregado como codiseño validado. No se confunde con los referentes oficiales.'
    );
  };

  const eliminarCodiseno = (id: string) => {
    if (!programa) return;

    setPrograma({
      ...programa,
      contenidosCodisenados:
        programa.contenidosCodisenados.filter(
          (item) => item.id !== id
        ),
    });
  };

  if (cargandoGrupos) {
    return <PantallaCarga texto="Preparando tus grupos..." />;
  }

  if (grupos.length === 0) {
    return (
      <EstadoVacio
        icono="📚"
        titulo="Primero necesitas un grupo"
        descripcion="El Programa Analítico debe quedar vinculado a un grupo y disciplina concretos. Crea el grupo desde Gestión y Asistencia y vuelve aquí."
      />
    );
  }

  return (
    <div
      style={{
        maxWidth: '1220px',
        margin: '0 auto',
        paddingBottom: '3rem',
        animation: 'fadeIn .3s ease',
      }}
    >
      {/* HERO */}
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '28px',
          border: '1px solid var(--border-color)',
          background:
            'linear-gradient(135deg, rgba(156,39,176,.11), rgba(28,81,255,.08), rgba(76,175,80,.06))',
          padding: 'clamp(1.4rem, 3vw, 2.5rem)',
          marginBottom: '1.2rem',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '250px',
            height: '250px',
            borderRadius: '50%',
            right: '-90px',
            top: '-140px',
            background:
              'radial-gradient(circle, rgba(156,39,176,.20), transparent 68%)',
            pointerEvents: 'none',
          }}
        />

        <div
          className="pa-hero-grid"
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns:
              'minmax(0, 1fr) minmax(260px, 360px)',
            gap: '1.4rem',
            alignItems: 'end',
          }}
        >
          <div>
            <span
              style={{
                display: 'inline-flex',
                gap: '.4rem',
                alignItems: 'center',
                color: 'var(--accent-purple)',
                fontWeight: 900,
                fontSize: '.72rem',
                letterSpacing: '.07em',
                padding: '.38rem .72rem',
                borderRadius: '999px',
                background: 'rgba(156,39,176,.09)',
                marginBottom: '.8rem',
              }}
            >
              📚 PROGRAMA ANALÍTICO DEL GRUPO
            </span>

            <h2
              style={{
                margin: 0,
                color: 'var(--text-main)',
                fontSize:
                  'clamp(1.75rem, 3.2vw, 2.55rem)',
                lineHeight: 1.06,
                letterSpacing: '-.04em',
              }}
            >
              Organiza el currículo antes de
              <br />
              convertirlo en clases.
            </h2>

            <p
              style={{
                margin: '.85rem 0 0',
                maxWidth: '720px',
                color: 'var(--text-muted)',
                lineHeight: 1.62,
                fontSize: '.93rem',
              }}
            >
              Captura los Contenidos y PDA de tu
              Programa Sintético, relaciónalos con la
              realidad del grupo y decide cuándo
              trabajarlos. Aula+ puede sugerir, pero tú
              conservas el control curricular.
            </p>
          </div>

          <div
            style={{
              padding: '1rem',
              borderRadius: '20px',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              boxShadow:
                '0 12px 36px rgba(0,0,0,.05)',
            }}
          >
            <label
              style={{
                display: 'block',
                color: 'var(--text-main)',
                fontWeight: 900,
                fontSize: '.78rem',
                marginBottom: '.45rem',
              }}
            >
              Grupo del Programa Analítico
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
                borderRadius: '14px',
                cursor: 'pointer',
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
        <EstadoVacio
          icono="🎯"
          titulo="Selecciona el grupo antes de continuar"
          descripcion="Cada Programa Analítico conservará su propia disciplina, contexto, Contenidos, PDA, temporalidad y decisiones curriculares."
        />
      ) : cargandoPrograma || !programa ? (
        <PantallaCarga
          texto={`Cargando Programa Analítico de ${
            grupoActivo?.name || 'tu grupo'
          }...`}
        />
      ) : (
        <>
          {/* ESTADO */}
          <section
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(190px, 1fr))',
              gap: '.75rem',
              marginBottom: '1rem',
            }}
          >
            <Indicador
              icono="🏫"
              titulo="Contexto Escuela"
              valor={
                contextoEscuelaListo
                  ? 'Listo'
                  : 'Incompleto'
              }
              detalle={
                contextoEscuelaListo
                  ? 'Disponible para contextualizar'
                  : 'Complétalo antes de usar IA'
              }
              correcto={contextoEscuelaListo}
            />

            <Indicador
              icono="👥"
              titulo={`Contexto ${
                grupoActivo?.name || 'Grupo'
              }`}
              valor={
                contextoGrupoListo
                  ? 'Listo'
                  : 'Incompleto'
              }
              detalle={
                contextoGrupoListo
                  ? 'Diagnóstico disponible'
                  : 'Falta nutrir este grupo'
              }
              correcto={contextoGrupoListo}
            />

            <Indicador
              icono="📘"
              titulo="Contenidos"
              valor={String(programa.contenidos.length)}
              detalle={`${totalPDA} PDA capturados`}
              correcto={
                programa.contenidos.length > 0
              }
            />

            <Indicador
              icono="✨"
              titulo="Contextualización"
              valor={`${avancePrograma}%`}
              detalle={`${pdaContextualizados}/${totalPDA} PDA contextualizados`}
              correcto={
                totalPDA > 0 &&
                pdaContextualizados === totalPDA
              }
            />
          </section>

          {mensaje && (
            <div
              style={{
                padding: '.85rem 1rem',
                marginBottom: '1rem',
                borderRadius: '14px',
                background: 'rgba(28,81,255,.07)',
                border:
                  '1px solid rgba(28,81,255,.14)',
                color: 'var(--text-main)',
                fontSize: '.82rem',
                lineHeight: 1.5,
              }}
            >
              {mensaje}
            </div>
          )}

          {!contextoListo && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '1rem',
                borderRadius: '18px',
                background:
                  'rgba(255,193,7,.08)',
                border:
                  '1px solid rgba(255,193,7,.20)',
                display: 'flex',
                gap: '.8rem',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ fontSize: '1.3rem' }}>
                🧭
              </div>

              <div>
                <strong
                  style={{
                    color: 'var(--text-main)',
                    fontSize: '.84rem',
                  }}
                >
                  Puedes capturar tus referentes
                  curriculares, pero la IA esperará.
                </strong>

                <p
                  style={{
                    margin: '.25rem 0 0',
                    color: 'var(--text-muted)',
                    fontSize: '.76rem',
                    lineHeight: 1.5,
                  }}
                >
                  Para contextualizar o analizar
                  codiseño necesitamos primero un
                  contexto suficiente de Escuela y de
                  este Grupo. Así evitamos que la IA
                  complete vacíos con suposiciones.
                </p>
              </div>
            </div>
          )}

          {/* NAVEGACIÓN INTERNA */}
          <nav
            style={{
              display: 'flex',
              gap: '.5rem',
              overflowX: 'auto',
              padding: '.65rem',
              marginBottom: '1rem',
              borderRadius: '20px',
              background: 'var(--bg-panel)',
              border:
                '1px solid var(--border-color)',
            }}
          >
            <Tab
              activo={vista === 'referentes'}
              icono="📘"
              label="1. Contenidos y PDA"
              onClick={() =>
                setVista('referentes')
              }
            />

            <Tab
              activo={
                vista === 'contextualizacion'
              }
              icono="🌎"
              label="2. Contextualización"
              onClick={() =>
                setVista('contextualizacion')
              }
            />

            <Tab
              activo={vista === 'codiseno'}
              icono="🟣"
              label="3. Codiseño"
              onClick={() =>
                setVista('codiseno')
              }
            />

            <Tab
              activo={vista === 'organizacion'}
              icono="🗓️"
              label="4. Organización"
              onClick={() =>
                setVista('organizacion')
              }
            />
          </nav>

          {vista === 'referentes' && (
            <VistaReferentes
              programa={programa}
              grupo={grupoActivo}
              onAgregarContenido={agregarContenido}
              onActualizarContenido={
                actualizarContenido
              }
              onEliminarContenido={
                eliminarContenido
              }
              onAgregarPDA={agregarPDA}
              onActualizarPDA={actualizarPDA}
              onEliminarPDA={eliminarPDA}
            />
          )}

          {vista === 'contextualizacion' && (
            <VistaContextualizacion
              programa={programa}
              contextoListo={contextoListo}
              procesandoIA={procesandoIA}
              onContextualizar={
                contextualizarPDAConIA
              }
              onActualizarPDA={actualizarPDA}
            />
          )}

          {vista === 'codiseno' && (
            <VistaCodiseno
              programa={programa}
              contextoListo={contextoListo}
              procesandoIA={procesandoIA}
              analisis={analisisCodiseno}
              onAnalizar={analizarCodisenoConIA}
              onAceptar={aceptarCodiseno}
              onCerrarAnalisis={() =>
                setAnalisisCodiseno(null)
              }
              onEliminar={eliminarCodiseno}
            />
          )}

          {vista === 'organizacion' && (
            <VistaOrganizacion
              programa={programa}
              nuevoProblema={nuevoProblema}
              onNuevoProblema={
                setNuevoProblema
              }
              onAgregarProblema={
                agregarProblematica
              }
              onEliminarProblema={
                eliminarProblematica
              }
              onActualizarPrograma={(patch) =>
                setPrograma({
                  ...programa,
                  ...patch,
                })
              }
            />
          )}

          {/* GUARDADO */}
          <div
            style={{
              position: 'sticky',
              bottom: '1rem',
              zIndex: 8,
              marginTop: '1rem',
              padding: '.8rem',
              borderRadius: '20px',
              background:
                'color-mix(in srgb, var(--bg-panel) 92%, transparent)',
              border:
                '1px solid var(--border-color)',
              boxShadow:
                '0 15px 45px rgba(0,0,0,.13)',
              backdropFilter: 'blur(14px)',
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              gap: '.8rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ paddingLeft: '.35rem' }}>
              <strong
                style={{
                  display: 'block',
                  color: 'var(--text-main)',
                  fontSize: '.84rem',
                }}
              >
                📚 {grupoActivo?.name} ·{' '}
                {grupoActivo?.subject}
              </strong>

              <span
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '.71rem',
                }}
              >
                {programa.contenidos.length}{' '}
                contenidos · {totalPDA} PDA ·{' '}
                {pdaContextualizados}{' '}
                contextualizados
              </span>
            </div>

            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              style={{
                border: 'none',
                borderRadius: '14px',
                padding: '.85rem 1.2rem',
                minWidth: '220px',
                cursor: guardando
                  ? 'wait'
                  : 'pointer',
                background:
                  'var(--accent-purple)',
                color: 'white',
                fontWeight: 900,
                opacity: guardando ? 0.7 : 1,
              }}
            >
              {guardando
                ? 'Guardando...'
                : '💾 Guardar Programa Analítico'}
            </button>
          </div>
        </>
      )}

      {propuestaContextualizacion && (
        <ModalContextualizacion
          propuesta={
            propuestaContextualizacion
          }
          onCerrar={() =>
            setPropuestaContextualizacion(
              null
            )
          }
          onAceptar={
            aceptarContextualizacionIA
          }
        />
      )}

      <style>{`
        @media (max-width: 760px) {
          .pa-hero-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function VistaReferentes({
  programa,
  grupo,
  onAgregarContenido,
  onActualizarContenido,
  onEliminarContenido,
  onAgregarPDA,
  onActualizarPDA,
  onEliminarPDA,
}: {
  programa: ProgramaAnaliticoGrupo;
  grupo: Grupo | null;
  onAgregarContenido: () => void;
  onActualizarContenido: (
    contenidoId: string,
    patch: Partial<ContenidoPrograma>
  ) => void;
  onEliminarContenido: (
    contenidoId: string
  ) => void;
  onAgregarPDA: (
    contenidoId: string
  ) => void;
  onActualizarPDA: (
    contenidoId: string,
    pdaId: string,
    patch: Partial<PDAPrograma>
  ) => void;
  onEliminarPDA: (
    contenidoId: string,
    pdaId: string
  ) => void;
}) {
  return (
    <div
      style={{
        animation: 'fadeIn .25s ease',
      }}
    >
      <EncabezadoSeccion
        icono="📘"
        color="#1C51FF"
        etiqueta="REFERENTES NACIONALES"
        titulo="Captura primero lo que dice tu Programa Sintético"
        descripcion={`Puedes consultar el documento correspondiente a ${grupo?.subject || 'tu disciplina'} y capturar cada Contenido con uno o varios PDA. Aula+ conservará estos textos como referentes oficiales separados de cualquier contextualización.`}
        accion={
          <button
            type="button"
            onClick={onAgregarContenido}
            style={botonPrimario('#1C51FF')}
          >
            + Agregar contenido
          </button>
        }
      />

      {programa.contenidos.length === 0 ? (
        <EstadoVacio
          icono="📖"
          titulo="Aún no has capturado contenidos"
          descripcion="Empieza con el primer Contenido de tu Programa Sintético. Si tiene varios PDA, agrégalos dentro de la misma tarjeta."
          accion={
            <button
              type="button"
              onClick={onAgregarContenido}
              style={botonPrimario('#1C51FF')}
            >
              + Capturar primer contenido
            </button>
          }
        />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {programa.contenidos.map(
            (contenido, contenidoIndex) => (
              <section
                key={contenido.id}
                style={{
                  padding: '1.1rem',
                  borderRadius: '22px',
                  border:
                    '1px solid var(--border-color)',
                  background: 'var(--bg-panel)',
                  boxShadow:
                    '0 7px 26px rgba(0,0,0,.035)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent:
                      'space-between',
                    gap: '1rem',
                    alignItems: 'flex-start',
                    marginBottom: '.8rem',
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: 'block',
                        color:
                          'var(--accent-blue)',
                        fontSize: '.67rem',
                        fontWeight: 900,
                        letterSpacing: '.07em',
                      }}
                    >
                      CONTENIDO{' '}
                      {String(
                        contenidoIndex + 1
                      ).padStart(2, '0')}
                    </span>

                    <strong
                      style={{
                        color:
                          'var(--text-main)',
                        fontSize: '.88rem',
                      }}
                    >
                      Referente del Programa
                      Sintético
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onEliminarContenido(
                        contenido.id
                      )
                    }
                    style={botonIconoPeligro()}
                    title="Eliminar contenido"
                  >
                    🗑
                  </button>
                </div>

                <label style={labelStyle()}>
                  Texto oficial del Contenido
                </label>

                <p style={ayudaStyle()}>
                  Cópialo tal como aparece en tu
                  Programa Sintético. La IA no
                  modificará este campo.
                </p>

                <textarea
                  className="search-input"
                  value={
                    contenido.textoOficial
                  }
                  onChange={(e) =>
                    onActualizarContenido(
                      contenido.id,
                      {
                        textoOficial:
                          e.target.value,
                      }
                    )
                  }
                  placeholder="Pega aquí el Contenido del Programa Sintético..."
                  style={textareaStyle(96)}
                />

                <div
                  style={{
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop:
                      '1px solid var(--border-color)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent:
                        'space-between',
                      gap: '.8rem',
                      alignItems: 'center',
                      marginBottom: '.7rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          color:
                            'var(--text-main)',
                          fontSize: '.82rem',
                        }}
                      >
                        Procesos de Desarrollo de
                        Aprendizaje
                      </strong>
                      <span
                        style={{
                          display: 'block',
                          color:
                            'var(--text-muted)',
                          fontSize: '.69rem',
                          marginTop: '.15rem',
                        }}
                      >
                        Este contenido tiene{' '}
                        {contenido.pda.length}{' '}
                        PDA registrado
                        {contenido.pda.length ===
                        1
                          ? ''
                          : 's'}
                        .
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onAgregarPDA(
                          contenido.id
                        )
                      }
                      style={botonSecundario()}
                    >
                      + Agregar otro PDA
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '.7rem',
                    }}
                  >
                    {contenido.pda.map(
                      (pda, pdaIndex) => (
                        <div
                          key={pda.id}
                          style={{
                            padding: '.85rem',
                            borderRadius: '16px',
                            background:
                              'var(--bg-input)',
                            border:
                              '1px solid var(--border-color)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent:
                                'space-between',
                              gap: '.7rem',
                              alignItems:
                                'center',
                              marginBottom:
                                '.45rem',
                            }}
                          >
                            <span
                              style={{
                                color:
                                  'var(--accent-purple)',
                                fontSize:
                                  '.67rem',
                                fontWeight: 900,
                              }}
                            >
                              PDA {pdaIndex + 1}
                            </span>

                            {contenido.pda
                              .length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  onEliminarPDA(
                                    contenido.id,
                                    pda.id
                                  )
                                }
                                style={
                                  botonIconoPeligro(
                                    true
                                  )
                                }
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          <textarea
                            className="search-input"
                            value={
                              pda.textoOficial
                            }
                            onChange={(e) =>
                              onActualizarPDA(
                                contenido.id,
                                pda.id,
                                {
                                  textoOficial:
                                    e.target
                                      .value,
                                }
                              )
                            }
                            placeholder="Copia aquí el PDA correspondiente..."
                            style={textareaStyle(
                              78
                            )}
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '.9rem',
                  }}
                >
                  <label style={labelStyle()}>
                    Notas del docente
                  </label>

                  <input
                    className="search-input"
                    value={
                      contenido.notasDocente
                    }
                    onChange={(e) =>
                      onActualizarContenido(
                        contenido.id,
                        {
                          notasDocente:
                            e.target.value,
                        }
                      )
                    }
                    placeholder="Opcional. Ej. Relacionarlo con el proyecto del segundo trimestre..."
                    style={{
                      margin: 0,
                      width: '100%',
                      boxSizing: 'border-box',
                      borderRadius: '12px',
                    }}
                  />
                </div>
              </section>
            )
          )}

          <button
            type="button"
            onClick={onAgregarContenido}
            style={{
              width: '100%',
              border:
                '2px dashed var(--border-color)',
              borderRadius: '18px',
              padding: '1rem',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            + Agregar otro Contenido
          </button>
        </div>
      )}
    </div>
  );
}

function VistaContextualizacion({
  programa,
  contextoListo,
  procesandoIA,
  onContextualizar,
  onActualizarPDA,
}: {
  programa: ProgramaAnaliticoGrupo;
  contextoListo: boolean;
  procesandoIA: boolean;
  onContextualizar: (
    contenido: ContenidoPrograma,
    pda: PDAPrograma
  ) => void;
  onActualizarPDA: (
    contenidoId: string,
    pdaId: string,
    patch: Partial<PDAPrograma>
  ) => void;
}) {
  return (
    <div
      style={{
        animation: 'fadeIn .25s ease',
      }}
    >
      <EncabezadoSeccion
        icono="🌎"
        color="#22A447"
        etiqueta="CONTEXTUALIZACIÓN"
        titulo="Relaciona el currículo con la realidad"
        descripcion="Aquí no cambiamos los Contenidos ni los PDA oficiales. Registramos desde qué situación, problema, saber, recurso, actor o experiencia del contexto pueden adquirir sentido."
      />

      {programa.contenidos.length === 0 ? (
        <EstadoVacio
          icono="📘"
          titulo="Primero captura Contenidos y PDA"
          descripcion="La contextualización siempre parte de los referentes curriculares nacionales que el docente seleccionó."
        />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {programa.contenidos.map(
            (contenido, contenidoIndex) => (
              <section
                key={contenido.id}
                style={{
                  padding: '1.1rem',
                  borderRadius: '22px',
                  border:
                    '1px solid var(--border-color)',
                  background: 'var(--bg-panel)',
                }}
              >
                <div
                  style={{
                    padding: '.8rem',
                    borderRadius: '15px',
                    background:
                      'rgba(28,81,255,.06)',
                    border:
                      '1px solid rgba(28,81,255,.10)',
                    marginBottom: '.8rem',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      color:
                        'var(--accent-blue)',
                      fontSize: '.65rem',
                      fontWeight: 900,
                      letterSpacing: '.06em',
                      marginBottom: '.25rem',
                    }}
                  >
                    CONTENIDO OFICIAL{' '}
                    {contenidoIndex + 1}
                  </span>

                  <p
                    style={{
                      margin: 0,
                      color:
                        'var(--text-main)',
                      fontSize: '.81rem',
                      lineHeight: 1.5,
                    }}
                  >
                    {contenido.textoOficial ||
                      'Contenido pendiente de captura'}
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '.8rem',
                  }}
                >
                  {contenido.pda.map(
                    (pda, pdaIndex) => (
                      <div
                        key={pda.id}
                        style={{
                          padding: '1rem',
                          borderRadius: '18px',
                          border:
                            '1px solid var(--border-color)',
                          background:
                            'var(--bg-input)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent:
                              'space-between',
                            gap: '.8rem',
                            flexWrap: 'wrap',
                            marginBottom: '.7rem',
                          }}
                        >
                          <div
                            style={{
                              maxWidth: '760px',
                            }}
                          >
                            <span
                              style={{
                                display:
                                  'block',
                                color:
                                  'var(--accent-purple)',
                                fontSize:
                                  '.65rem',
                                fontWeight:
                                  900,
                                marginBottom:
                                  '.2rem',
                              }}
                            >
                              PDA OFICIAL{' '}
                              {pdaIndex + 1}
                            </span>

                            <p
                              style={{
                                margin: 0,
                                color:
                                  'var(--text-main)',
                                fontSize:
                                  '.79rem',
                                lineHeight:
                                  1.5,
                              }}
                            >
                              {pda.textoOficial ||
                                'PDA pendiente de captura'}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={
                              procesandoIA ||
                              !contextoListo
                            }
                            onClick={() =>
                              onContextualizar(
                                contenido,
                                pda
                              )
                            }
                            style={{
                              alignSelf:
                                'flex-start',
                              border: 'none',
                              borderRadius:
                                '12px',
                              padding:
                                '.7rem .85rem',
                              cursor:
                                procesandoIA ||
                                !contextoListo
                                  ? 'not-allowed'
                                  : 'pointer',
                              background:
                                'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
                              color: 'white',
                              fontWeight: 900,
                              fontSize:
                                '.73rem',
                              opacity:
                                procesandoIA ||
                                !contextoListo
                                  ? 0.45
                                  : 1,
                            }}
                          >
                            {procesandoIA
                              ? '🧠 Analizando...'
                              : '✨ Sugerir con IA'}
                          </button>
                        </div>

                        <label
                          style={labelStyle()}
                        >
                          Contextualización
                        </label>

                        <textarea
                          className="search-input"
                          value={
                            pda.contextualizacion
                          }
                          onChange={(e) =>
                            onActualizarPDA(
                              contenido.id,
                              pda.id,
                              {
                                contextualizacion:
                                  e.target.value,
                              }
                            )
                          }
                          placeholder="Ej. Se trabajará a partir de una situación observada en la escuela, recuperando..."
                          style={textareaStyle(
                            100
                          )}
                        />

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: '.7rem',
                            marginTop: '.75rem',
                          }}
                        >
                          <div>
                            <label
                              style={labelStyle()}
                            >
                              Decisión
                              curricular
                            </label>

                            <select
                              className="search-input"
                              value={
                                pda.decisionCurricular
                              }
                              onChange={(e) =>
                                onActualizarPDA(
                                  contenido.id,
                                  pda.id,
                                  {
                                    decisionCurricular:
                                      e.target
                                        .value as PDAPrograma['decisionCurricular'],
                                  }
                                )
                              }
                              style={{
                                width: '100%',
                                margin: 0,
                                borderRadius:
                                  '12px',
                              }}
                            >
                              <option value="sin_ajuste">
                                Recuperar sin
                                ajuste
                              </option>
                              <option value="contextualizado">
                                Contextualizado
                              </option>
                            </select>
                          </div>

                          <div>
                            <label
                              style={labelStyle()}
                            >
                              Temporalidad
                            </label>

                            <input
                              className="search-input"
                              value={
                                pda.temporalidad
                              }
                              onChange={(e) =>
                                onActualizarPDA(
                                  contenido.id,
                                  pda.id,
                                  {
                                    temporalidad:
                                      e.target
                                        .value,
                                  }
                                )
                              }
                              placeholder="Ej. Septiembre / 1er trimestre"
                              style={{
                                width: '100%',
                                margin: 0,
                                boxSizing:
                                  'border-box',
                                borderRadius:
                                  '12px',
                              }}
                            />
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop: '.75rem',
                          }}
                        >
                          <label
                            style={labelStyle()}
                          >
                            Ejes articuladores
                          </label>

                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '.4rem',
                            }}
                          >
                            {EJES.map((eje) => {
                              const activo =
                                pda.ejesArticuladores.includes(
                                  eje
                                );

                              return (
                                <button
                                  key={eje}
                                  type="button"
                                  onClick={() => {
                                    const siguientes =
                                      activo
                                        ? pda.ejesArticuladores.filter(
                                            (
                                              item
                                            ) =>
                                              item !==
                                              eje
                                          )
                                        : [
                                            ...pda.ejesArticuladores,
                                            eje,
                                          ];

                                    onActualizarPDA(
                                      contenido.id,
                                      pda.id,
                                      {
                                        ejesArticuladores:
                                          siguientes,
                                      }
                                    );
                                  }}
                                  style={{
                                    border:
                                      activo
                                        ? '1px solid rgba(34,164,71,.32)'
                                        : '1px solid var(--border-color)',
                                    background:
                                      activo
                                        ? 'rgba(34,164,71,.08)'
                                        : 'var(--bg-panel)',
                                    color: activo
                                      ? '#16833A'
                                      : 'var(--text-muted)',
                                    borderRadius:
                                      '999px',
                                    padding:
                                      '.4rem .6rem',
                                    cursor:
                                      'pointer',
                                    fontSize:
                                      '.68rem',
                                    fontWeight:
                                      800,
                                  }}
                                >
                                  {activo
                                    ? '✓ '
                                    : ''}
                                  {eje}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {pda
                          .problematicasRelacionadas
                          .length > 0 && (
                          <MiniLista
                            titulo="Situaciones relacionadas"
                            items={
                              pda.problematicasRelacionadas
                            }
                            color="#F97316"
                          />
                        )}

                        {pda
                          .saberesComunitariosRelacionados
                          .length > 0 && (
                          <MiniLista
                            titulo="Saberes o fortalezas comunitarias"
                            items={
                              pda.saberesComunitariosRelacionados
                            }
                            color="#22A447"
                          />
                        )}
                      </div>
                    )
                  )}
                </div>
              </section>
            )
          )}
        </div>
      )}
    </div>
  );
}

function VistaCodiseno({
  programa,
  contextoListo,
  procesandoIA,
  analisis,
  onAnalizar,
  onAceptar,
  onCerrarAnalisis,
  onEliminar,
}: {
  programa: ProgramaAnaliticoGrupo;
  contextoListo: boolean;
  procesandoIA: boolean;
  analisis: AnalisisCodisenoIA | null;
  onAnalizar: () => void;
  onAceptar: () => void;
  onCerrarAnalisis: () => void;
  onEliminar: (id: string) => void;
}) {
  return (
    <div
      style={{
        animation: 'fadeIn .25s ease',
      }}
    >
      <EncabezadoSeccion
        icono="🟣"
        color="#9C27B0"
        etiqueta="CODISEÑO"
        titulo="Sólo agrega lo local cuando realmente haga falta"
        descripcion="Aula+ primero revisará los referentes nacionales capturados. Si basta con contextualizarlos, te lo dirá. Sólo propondrá codiseño cuando detecte una necesidad local que no quede suficientemente atendida."
        accion={
          <button
            type="button"
            disabled={
              procesandoIA || !contextoListo
            }
            onClick={onAnalizar}
            style={{
              ...botonPrimario('#9C27B0'),
              opacity:
                procesandoIA || !contextoListo
                  ? 0.45
                  : 1,
              cursor:
                procesandoIA || !contextoListo
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {procesandoIA
              ? '🧠 Analizando...'
              : '✨ Analizar necesidad de codiseño'}
          </button>
        }
      />

      <div
        style={{
          padding: '1rem',
          borderRadius: '18px',
          marginBottom: '1rem',
          background: 'rgba(156,39,176,.06)',
          border:
            '1px solid rgba(156,39,176,.12)',
        }}
      >
        <strong
          style={{
            display: 'block',
            color: 'var(--text-main)',
            fontSize: '.82rem',
            marginBottom: '.25rem',
          }}
        >
          🔒 Diferencia visible dentro de Aula+
        </strong>

        <p
          style={{
            margin: 0,
            color: 'var(--text-muted)',
            fontSize: '.75rem',
            lineHeight: 1.5,
          }}
        >
          Los Contenidos y PDA nacionales
          permanecen en azul. Cualquier elemento
          surgido del codiseño se identifica en
          morado y conserva su justificación, para
          que nunca parezca un referente oficial.
        </p>
      </div>

      {analisis && (
        <section
          style={{
            marginBottom: '1rem',
            padding: '1.1rem',
            borderRadius: '20px',
            background:
              analisis.decision ===
              'posible_codiseno'
                ? 'rgba(156,39,176,.07)'
                : 'rgba(34,164,71,.07)',
            border:
              analisis.decision ===
              'posible_codiseno'
                ? '1px solid rgba(156,39,176,.16)'
                : '1px solid rgba(34,164,71,.16)',
          }}
        >
          <span
            style={{
              display: 'block',
              fontSize: '.68rem',
              fontWeight: 900,
              color:
                analisis.decision ===
                'posible_codiseno'
                  ? 'var(--accent-purple)'
                  : 'var(--accent-green)',
              marginBottom: '.25rem',
              letterSpacing: '.06em',
            }}
          >
            RESULTADO DEL ANÁLISIS
          </span>

          <h3
            style={{
              margin: 0,
              color: 'var(--text-main)',
              fontSize: '1.05rem',
            }}
          >
            {analisis.decision ===
            'posible_codiseno'
              ? '🟣 Podría justificarse un contenido local'
              : '🟢 No parece necesario codiseñar'}
          </h3>

          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '.8rem',
              lineHeight: 1.55,
            }}
          >
            {analisis.explicacion}
          </p>

          {analisis.decision ===
            'posible_codiseno' && (
            <div
              style={{
                display: 'grid',
                gap: '.7rem',
                marginTop: '.8rem',
              }}
            >
              <CajaDato
                titulo="Contenido local propuesto"
                texto={
                  analisis.contenidoLocal ||
                  'Por definir'
                }
              />

              <CajaDato
                titulo="PDA local propuesto"
                texto={
                  analisis.pdaLocal ||
                  'Por definir'
                }
              />

              <CajaDato
                titulo="Justificación"
                texto={
                  analisis.justificacion ||
                  'Por definir'
                }
              />

              <CajaDato
                titulo="Relación con referentes nacionales"
                texto={
                  analisis.relacionConContenidosNacionales ||
                  'Por definir'
                }
              />
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              gap: '.6rem',
              marginTop: '1rem',
            }}
          >
            <button
              type="button"
              onClick={onCerrarAnalisis}
              style={botonSecundario()}
            >
              Cerrar análisis
            </button>

            {analisis.decision ===
              'posible_codiseno' && (
              <button
                type="button"
                onClick={onAceptar}
                style={botonPrimario(
                  '#9C27B0'
                )}
              >
                ✓ Incorporar como codiseño
              </button>
            )}
          </div>
        </section>
      )}

      {programa.contenidosCodisenados.length ===
      0 ? (
        <EstadoVacio
          icono="🪴"
          titulo="No hay contenidos locales agregados"
          descripcion="Eso no es un problema. El codiseño sólo debe aparecer cuando exista una razón pedagógica real para ampliar los referentes nacionales."
        />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '.8rem',
          }}
        >
          {programa.contenidosCodisenados.map(
            (item, index) => (
              <section
                key={item.id}
                style={{
                  padding: '1rem',
                  borderRadius: '20px',
                  background:
                    'rgba(156,39,176,.06)',
                  border:
                    '1px solid rgba(156,39,176,.16)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent:
                      'space-between',
                    gap: '.8rem',
                    alignItems: 'flex-start',
                    marginBottom: '.7rem',
                  }}
                >
                  <div>
                    <span
                      style={{
                        color:
                          'var(--accent-purple)',
                        fontWeight: 900,
                        fontSize: '.67rem',
                        letterSpacing: '.06em',
                      }}
                    >
                      🟣 CONTENIDO LOCAL
                      CODISEÑADO {index + 1}
                    </span>

                    <h3
                      style={{
                        margin: '.2rem 0 0',
                        color:
                          'var(--text-main)',
                        fontSize: '.95rem',
                      }}
                    >
                      {item.contenidoLocal}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onEliminar(item.id)
                    }
                    style={botonIconoPeligro()}
                  >
                    🗑
                  </button>
                </div>

                <CajaDato
                  titulo="PDA local"
                  texto={item.pdaLocal}
                />

                <div
                  style={{
                    height: '.6rem',
                  }}
                />

                <CajaDato
                  titulo="Justificación"
                  texto={item.justificacion}
                />

                <div
                  style={{
                    height: '.6rem',
                  }}
                />

                <CajaDato
                  titulo="Relación con contenidos nacionales"
                  texto={
                    item.relacionConContenidosNacionales
                  }
                />
              </section>
            )
          )}
        </div>
      )}
    </div>
  );
}

function VistaOrganizacion({
  programa,
  nuevoProblema,
  onNuevoProblema,
  onAgregarProblema,
  onEliminarProblema,
  onActualizarPrograma,
}: {
  programa: ProgramaAnaliticoGrupo;
  nuevoProblema: string;
  onNuevoProblema: (valor: string) => void;
  onAgregarProblema: () => void;
  onEliminarProblema: (index: number) => void;
  onActualizarPrograma: (
    patch: Partial<ProgramaAnaliticoGrupo>
  ) => void;
}) {
  return (
    <div
      style={{
        animation: 'fadeIn .25s ease',
      }}
    >
      <EncabezadoSeccion
        icono="🗓️"
        color="#F97316"
        etiqueta="ORGANIZACIÓN CURRICULAR"
        titulo="Convierte decisiones aisladas en una ruta para el ciclo"
        descripcion="Prioriza situaciones, define un horizonte formativo y registra orientaciones generales. Las actividades concretas vendrán después, en el Planeador."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
        }}
      >
        <CardSimple
          titulo="🎯 Problemáticas o situaciones priorizadas"
          descripcion="No intentes atender todo. Registra las situaciones que realmente orientarán decisiones curriculares."
        >
          <div
            style={{
              display: 'flex',
              gap: '.55rem',
            }}
          >
            <input
              className="search-input"
              value={nuevoProblema}
              onChange={(e) =>
                onNuevoProblema(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onAgregarProblema();
                }
              }}
              placeholder="Ej. Manejo de residuos en la escuela..."
              style={{
                margin: 0,
                flex: 1,
                minWidth: 0,
                borderRadius: '12px',
              }}
            />

            <button
              type="button"
              onClick={onAgregarProblema}
              style={botonPrimario(
                '#F97316'
              )}
            >
              +
            </button>
          </div>

          {programa.problematicasPriorizadas
            .length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '.45rem',
                marginTop: '.8rem',
              }}
            >
              {programa.problematicasPriorizadas.map(
                (problema, index) => (
                  <div
                    key={`${problema}-${index}`}
                    style={{
                      display: 'flex',
                      gap: '.6rem',
                      alignItems: 'flex-start',
                      padding: '.7rem',
                      borderRadius: '12px',
                      background:
                        'var(--bg-input)',
                      border:
                        '1px solid var(--border-color)',
                    }}
                  >
                    <span
                      style={{
                        color: '#F97316',
                        fontWeight: 900,
                        fontSize: '.73rem',
                      }}
                    >
                      {index + 1}.
                    </span>

                    <span
                      style={{
                        flex: 1,
                        color:
                          'var(--text-main)',
                        fontSize: '.76rem',
                        lineHeight: 1.45,
                      }}
                    >
                      {problema}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        onEliminarProblema(
                          index
                        )
                      }
                      style={
                        botonIconoPeligro(
                          true
                        )
                      }
                    >
                      ✕
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </CardSimple>

        <CardSimple
          titulo="🌅 Horizonte formativo"
          descripcion="¿Qué quieres que se fortalezca o transforme a lo largo de estas decisiones curriculares?"
        >
          <textarea
            className="search-input"
            value={
              programa.horizonteFormativo
            }
            onChange={(e) =>
              onActualizarPrograma({
                horizonteFormativo:
                  e.target.value,
              })
            }
            placeholder="Ej. Favorecer que el alumnado analice situaciones de su entorno, tome decisiones fundamentadas y participe..."
            style={textareaStyle(145)}
          />
        </CardSimple>

        <CardSimple
          titulo="🧭 Orientaciones didácticas generales"
          descripcion="No redactes todavía cada clase. Registra criterios generales que deberán respetar las planeaciones."
        >
          <textarea
            className="search-input"
            value={
              programa.orientacionesDidacticasGenerales
            }
            onChange={(e) =>
              onActualizarPrograma({
                orientacionesDidacticasGenerales:
                  e.target.value,
              })
            }
            placeholder="Ej. Priorizar situaciones reales, trabajo colaborativo, productos auténticos y actividades posibles con los recursos disponibles..."
            style={textareaStyle(145)}
          />
        </CardSimple>

        <CardSimple
          titulo="🔎 Evaluación y retroalimentación"
          descripcion="Describe cómo se recuperarán evidencias y cómo podrán ajustarse las decisiones."
        >
          <textarea
            className="search-input"
            value={
              programa.orientacionesEvaluacion
            }
            onChange={(e) =>
              onActualizarPrograma({
                orientacionesEvaluacion:
                  e.target.value,
              })
            }
            placeholder="Ej. Recuperar evidencias de proceso, productos, autoevaluación y retroalimentación continua..."
            style={textareaStyle(145)}
          />
        </CardSimple>

        <CardSimple
          titulo="♻️ Seguimiento y actualización"
          descripcion="El Programa Analítico puede cambiar cuando la práctica aporta nueva información."
        >
          <textarea
            className="search-input"
            value={
              programa.acuerdosSeguimiento
            }
            onChange={(e) =>
              onActualizarPrograma({
                acuerdosSeguimiento:
                  e.target.value,
              })
            }
            placeholder="Ej. Revisar avances al cierre de cada periodo y ajustar temporalidad o contextualizaciones cuando sea necesario..."
            style={textareaStyle(130)}
          />
        </CardSimple>
      </div>
    </div>
  );
}

function ModalContextualizacion({
  propuesta,
  onCerrar,
  onAceptar,
}: {
  propuesta: PropuestaContextualizacion;
  onCerrar: () => void;
  onAceptar: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3500,
        background: 'rgba(10,15,30,.62)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: 'min(980px, 96vw)',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '26px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          boxShadow:
            '0 30px 100px rgba(0,0,0,.3)',
        }}
      >
        <div
          style={{
            padding: '1.2rem 1.35rem',
            borderBottom:
              '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <span
              style={{
                color:
                  'var(--accent-purple)',
                fontSize: '.67rem',
                fontWeight: 900,
                letterSpacing: '.07em',
              }}
            >
              PROPUESTA DE CONTEXTUALIZACIÓN
            </span>

            <h3
              style={{
                margin: '.2rem 0 0',
                color: 'var(--text-main)',
                fontSize: '1.25rem',
              }}
            >
              ✨ Aula+ encontró una relación
              posible
            </h3>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            style={{
              border: 'none',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              cursor: 'pointer',
              background: 'var(--bg-input)',
              color: 'var(--text-muted)',
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            overflowY: 'auto',
            padding: '1.2rem 1.35rem',
          }}
        >
          <div
            style={{
              display: 'grid',
              gap: '.8rem',
            }}
          >
            <CajaDato
              titulo="Contenido oficial — NO se modifica"
              texto={propuesta.contenidoOficial}
              color="#1C51FF"
            />

            <CajaDato
              titulo="PDA oficial — NO se modifica"
              texto={propuesta.pdaOficial}
              color="#1C51FF"
            />

            <CajaDato
              titulo="Contextualización propuesta"
              texto={
                propuesta.contextualizacion
              }
              color="#22A447"
            />

            <CajaDato
              titulo="¿Por qué podría ser pertinente?"
              texto={propuesta.justificacion}
              color="#9C27B0"
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '.7rem',
              }}
            >
              <CajaDato
                titulo="Decisión"
                texto={
                  propuesta.decisionCurricular ===
                  'contextualizado'
                    ? 'Contextualizar'
                    : 'Puede recuperarse sin ajuste'
                }
              />

              <CajaDato
                titulo="Temporalidad sugerida"
                texto={
                  propuesta.temporalidad ||
                  'Por definir'
                }
              />
            </div>

            {propuesta.ejesArticuladores
              .length > 0 && (
              <MiniLista
                titulo="Ejes sugeridos"
                items={
                  propuesta.ejesArticuladores
                }
                color="#22A447"
              />
            )}

            {propuesta
              .problematicasRelacionadas
              .length > 0 && (
              <MiniLista
                titulo="Situaciones del contexto relacionadas"
                items={
                  propuesta.problematicasRelacionadas
                }
                color="#F97316"
              />
            )}
          </div>
        </div>

        <div
          style={{
            padding: '1rem 1.35rem',
            borderTop:
              '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '.65rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={onCerrar}
            style={botonSecundario()}
          >
            Descartar
          </button>

          <button
            type="button"
            onClick={onAceptar}
            style={botonPrimario(
              '#22A447'
            )}
          >
            ✓ Aceptar propuesta
          </button>
        </div>
      </div>
    </div>
  );
}

function EncabezadoSeccion({
  icono,
  color,
  etiqueta,
  titulo,
  descripcion,
  accion,
}: {
  icono: string;
  color: string;
  etiqueta: string;
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '1rem',
        flexWrap: 'wrap',
        marginBottom: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '.8rem',
          alignItems: 'flex-start',
          maxWidth: '800px',
        }}
      >
        <div
          style={{
            width: '46px',
            height: '46px',
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '15px',
            background: `color-mix(in srgb, ${color} 11%, transparent)`,
            fontSize: '1.25rem',
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
              marginBottom: '.2rem',
            }}
          >
            {etiqueta}
          </span>

          <h3
            style={{
              margin: 0,
              color: 'var(--text-main)',
              fontSize: '1.2rem',
              letterSpacing: '-.02em',
            }}
          >
            {titulo}
          </h3>

          <p
            style={{
              margin: '.35rem 0 0',
              color: 'var(--text-muted)',
              fontSize: '.79rem',
              lineHeight: 1.5,
            }}
          >
            {descripcion}
          </p>
        </div>
      </div>

      {accion}
    </div>
  );
}

function Indicador({
  icono,
  titulo,
  valor,
  detalle,
  correcto,
}: {
  icono: string;
  titulo: string;
  valor: string;
  detalle: string;
  correcto: boolean;
}) {
  return (
    <div
      style={{
        padding: '.9rem',
        borderRadius: '18px',
        background: 'var(--bg-panel)',
        border:
          '1px solid var(--border-color)',
        display: 'flex',
        gap: '.7rem',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          borderRadius: '13px',
          background: correcto
            ? 'rgba(34,164,71,.08)'
            : 'var(--bg-input)',
        }}
      >
        {icono}
      </div>

      <div style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            color: 'var(--text-muted)',
            fontSize: '.66rem',
            fontWeight: 800,
            marginBottom: '.08rem',
          }}
        >
          {titulo}
        </span>

        <strong
          style={{
            display: 'block',
            color: correcto
              ? 'var(--accent-green)'
              : 'var(--text-main)',
            fontSize: '.88rem',
          }}
        >
          {valor}
        </strong>

        <span
          style={{
            display: 'block',
            color: 'var(--text-muted)',
            fontSize: '.65rem',
            marginTop: '.06rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {detalle}
        </span>
      </div>
    </div>
  );
}

function Tab({
  activo,
  icono,
  label,
  onClick,
}: {
  activo: boolean;
  icono: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: '1 0 190px',
        border: activo
          ? '1px solid rgba(156,39,176,.18)'
          : '1px solid transparent',
        borderRadius: '14px',
        background: activo
          ? 'rgba(156,39,176,.07)'
          : 'transparent',
        color: activo
          ? 'var(--accent-purple)'
          : 'var(--text-muted)',
        padding: '.7rem .8rem',
        cursor: 'pointer',
        fontWeight: 900,
        fontSize: '.76rem',
        whiteSpace: 'nowrap',
      }}
    >
      {icono} {label}
    </button>
  );
}

function CardSimple({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        padding: '1rem',
        borderRadius: '20px',
        background: 'var(--bg-panel)',
        border:
          '1px solid var(--border-color)',
      }}
    >
      <h3
        style={{
          margin: 0,
          color: 'var(--text-main)',
          fontSize: '.95rem',
        }}
      >
        {titulo}
      </h3>

      <p
        style={{
          margin: '.3rem 0 .8rem',
          color: 'var(--text-muted)',
          fontSize: '.73rem',
          lineHeight: 1.45,
        }}
      >
        {descripcion}
      </p>

      {children}
    </section>
  );
}

function MiniLista({
  titulo,
  items,
  color,
}: {
  titulo: string;
  items: string[];
  color: string;
}) {
  return (
    <div
      style={{
        marginTop: '.75rem',
        padding: '.75rem',
        borderRadius: '14px',
        border:
          '1px solid var(--border-color)',
        background: 'var(--bg-panel)',
      }}
    >
      <span
        style={{
          display: 'block',
          color,
          fontSize: '.67rem',
          fontWeight: 900,
          marginBottom: '.4rem',
        }}
      >
        {titulo}
      </span>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '.4rem',
        }}
      >
        {items.map((item, index) => (
          <span
            key={`${item}-${index}`}
            style={{
              padding: '.35rem .55rem',
              borderRadius: '999px',
              background: 'var(--bg-input)',
              color: 'var(--text-muted)',
              fontSize: '.67rem',
              lineHeight: 1.3,
            }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function CajaDato({
  titulo,
  texto,
  color = 'var(--text-muted)',
}: {
  titulo: string;
  texto: string;
  color?: string;
}) {
  return (
    <div
      style={{
        padding: '.8rem',
        borderRadius: '14px',
        background: 'var(--bg-input)',
        border:
          '1px solid var(--border-color)',
      }}
    >
      <span
        style={{
          display: 'block',
          color,
          fontSize: '.65rem',
          fontWeight: 900,
          marginBottom: '.25rem',
          letterSpacing: '.04em',
        }}
      >
        {titulo}
      </span>

      <p
        style={{
          margin: 0,
          color: 'var(--text-main)',
          fontSize: '.76rem',
          lineHeight: 1.5,
        }}
      >
        {texto || '—'}
      </p>
    </div>
  );
}

function EstadoVacio({
  icono,
  titulo,
  descripcion,
  accion,
}: {
  icono: string;
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: '330px',
        padding: '2rem 1.2rem',
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        borderRadius: '24px',
        border:
          '1px dashed var(--border-color)',
        background: 'var(--bg-panel)',
      }}
    >
      <div style={{ maxWidth: '570px' }}>
        <div
          style={{
            width: '72px',
            height: '72px',
            margin: '0 auto .9rem',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '23px',
            background:
              'linear-gradient(135deg, rgba(28,81,255,.08), rgba(156,39,176,.08))',
            fontSize: '2rem',
          }}
        >
          {icono}
        </div>

        <h3
          style={{
            margin: 0,
            color: 'var(--text-main)',
            fontSize: '1.25rem',
          }}
        >
          {titulo}
        </h3>

        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '.82rem',
            lineHeight: 1.55,
          }}
        >
          {descripcion}
        </p>

        {accion}
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
            fontSize: '.88rem',
          }}
        >
          {texto}
        </strong>
      </div>
    </div>
  );
}

function labelStyle(): CSSProperties {
  return {
    display: 'block',
    color: 'var(--text-main)',
    fontWeight: 900,
    fontSize: '.76rem',
    marginBottom: '.25rem',
  };
}

function ayudaStyle(): CSSProperties {
  return {
    margin: '0 0 .45rem',
    color: 'var(--text-muted)',
    fontSize: '.69rem',
    lineHeight: 1.4,
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

function botonPrimario(
  color: string
): CSSProperties {
  return {
    border: 'none',
    borderRadius: '12px',
    padding: '.72rem .9rem',
    background: color,
    color: 'white',
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: '.74rem',
    whiteSpace: 'nowrap',
  };
}

function botonSecundario(): CSSProperties {
  return {
    border:
      '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '.65rem .8rem',
    background: 'var(--bg-input)',
    color: 'var(--text-main)',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '.72rem',
  };
}

function botonIconoPeligro(
  compacto = false
): CSSProperties {
  return {
    border: 'none',
    width: compacto ? '28px' : '34px',
    height: compacto ? '28px' : '34px',
    borderRadius: '10px',
    display: 'grid',
    placeItems: 'center',
    background:
      'rgba(229,57,53,.08)',
    color: 'var(--accent-red)',
    cursor: 'pointer',
    flexShrink: 0,
    fontSize: compacto
      ? '.75rem'
      : '.9rem',
  };
}
