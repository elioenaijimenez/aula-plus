import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * AULA+ · Capa de datos del sistema de planeación contextualizada
 *
 * Estructura Firestore:
 *
 * teacher_settings/{docenteEmail}
 *   ├─ memoriaEscolar
 *   ├─ contextoEscuela
 *   └─ preferenciasPlaneacion
 *
 * teacher_settings/{docenteEmail}/group_contexts/{groupId}
 * teacher_settings/{docenteEmail}/analytic_programs/{groupId}
 *
 * Esta estructura conserva compatibilidad con teacher_settings,
 * que ya utiliza el proyecto, pero separa correctamente la información
 * institucional de la información específica de cada grupo.
 */

export type EstadoContexto =
  | 'inicial'
  | 'en_construccion'
  | 'listo'
  | 'optimizado';

export type DecisionCurricular =
  | 'sin_ajuste'
  | 'contextualizado'
  | 'codiseno';

export interface MemoriaEscolar {
  escuela: string;
  ubicacion: string;
  docente: string;
  revisor: string;
}

export interface ContextoEscuelaCampos {
  descripcionEscuela: string;
  infraestructura: string;
  recursosDisponibles: string[];
  limitaciones: string;

  descripcionComunidad: string;
  actividadesFamiliaresComunitarias: string;
  problematicasComunitarias: string;
  fortalezasComunitarias: string;
  saberesComunitarios: string;

  fuentesInformacion: string[];
  observaciones: string;
}

export interface ContextoEscuela {
  campos: ContextoEscuelaCampos;

  // Copia previa a la mejora con IA.
  camposOriginales?: ContextoEscuelaCampos;

  estado: EstadoContexto;
  mejoradoPorIA: boolean;
  validadoPorDocente: boolean;
  version: number;

  updatedAt?: unknown;
  improvedAt?: unknown;
}

export interface ContextoGrupoCampos {
  descripcionGeneral: string;
  saberesPrevios: string;
  dificultades: string;
  fortalezas: string;
  intereses: string;

  ritmoTrabajo: 'lento' | 'moderado' | 'rapido' | 'variable' | '';
  formaTrabajo:
    | 'individual'
    | 'parejas'
    | 'equipos'
    | 'variable'
    | '';

  diagnostico: string;
  diversidadYApoyos: string;
  preferenciasParticipacion: string;
  observaciones: string;
}

export interface ContextoGrupo {
  groupId: string;
  docenteEmail: string;
  campos: ContextoGrupoCampos;

  // Conserva lo que escribió originalmente el docente.
  camposOriginales?: ContextoGrupoCampos;

  estado: EstadoContexto;
  mejoradoPorIA: boolean;
  validadoPorDocente: boolean;
  version: number;

  updatedAt?: unknown;
  improvedAt?: unknown;
}

export interface PDAPrograma {
  id: string;

  /**
   * Siempre conservar literal el texto capturado como referente oficial.
   * La IA NO debe reemplazar este valor.
   */
  textoOficial: string;

  /**
   * Aquí vive la decisión situada, separada del texto oficial.
   */
  contextualizacion: string;

  ejesArticuladores: string[];
  problematicasRelacionadas: string[];
  saberesComunitariosRelacionados: string[];

  decisionCurricular: DecisionCurricular;
  temporalidad: string;

  activo: boolean;
}

export interface ContenidoPrograma {
  id: string;

  /**
   * Texto del contenido del Programa Sintético.
   * Debe conservarse separado de cualquier contextualización.
   */
  textoOficial: string;

  pda: PDAPrograma[];

  notasDocente: string;
  activo: boolean;
}

export interface ContenidoCodisenado {
  id: string;
  titulo: string;
  contenidoLocal: string;
  pdaLocal: string;
  justificacion: string;

  problematicaQueLoJustifica: string;
  evidencias: string;
  relacionConContenidosNacionales: string;

  ejesArticuladores: string[];
  temporalidad: string;

  generadoConIA: boolean;
  validadoPorDocente: boolean;
}

export interface ProgramaAnaliticoGrupo {
  groupId: string;
  docenteEmail: string;

  problematicasPriorizadas: string[];
  horizonteFormativo: string;

  contenidos: ContenidoPrograma[];
  contenidosCodisenados: ContenidoCodisenado[];

  orientacionesDidacticasGenerales: string;
  orientacionesEvaluacion: string;
  acuerdosSeguimiento: string;

  estado: 'inicial' | 'en_construccion' | 'listo';
  version: number;

  updatedAt?: unknown;
}

export interface PreferenciasPlaneacion {
  estructuraDocumento?: string[];
  reglasIA?: string;
  metodologiaPreferida?: string;
}

const contextoEscuelaVacio: ContextoEscuelaCampos = {
  descripcionEscuela: '',
  infraestructura: '',
  recursosDisponibles: [],
  limitaciones: '',

  descripcionComunidad: '',
  actividadesFamiliaresComunitarias: '',
  problematicasComunitarias: '',
  fortalezasComunitarias: '',
  saberesComunitarios: '',

  fuentesInformacion: [],
  observaciones: '',
};

const contextoGrupoVacio: ContextoGrupoCampos = {
  descripcionGeneral: '',
  saberesPrevios: '',
  dificultades: '',
  fortalezas: '',
  intereses: '',

  ritmoTrabajo: '',
  formaTrabajo: '',

  diagnostico: '',
  diversidadYApoyos: '',
  preferenciasParticipacion: '',
  observaciones: '',
};

export function crearContextoEscuelaVacio(): ContextoEscuela {
  return {
    campos: { ...contextoEscuelaVacio },
    estado: 'inicial',
    mejoradoPorIA: false,
    validadoPorDocente: false,
    version: 1,
  };
}

export function crearContextoGrupoVacio(
  groupId: string,
  docenteEmail: string
): ContextoGrupo {
  return {
    groupId,
    docenteEmail,
    campos: { ...contextoGrupoVacio },
    estado: 'inicial',
    mejoradoPorIA: false,
    validadoPorDocente: false,
    version: 1,
  };
}

export function crearProgramaAnaliticoVacio(
  groupId: string,
  docenteEmail: string
): ProgramaAnaliticoGrupo {
  return {
    groupId,
    docenteEmail,

    problematicasPriorizadas: [],
    horizonteFormativo: '',

    contenidos: [],
    contenidosCodisenados: [],

    orientacionesDidacticasGenerales: '',
    orientacionesEvaluacion: '',
    acuerdosSeguimiento: '',

    estado: 'inicial',
    version: 1,
  };
}

/**
 * Lee el correo exactamente de la misma sesión que ya utiliza Aula+.
 */
export function obtenerCorreoSesion(): string {
  const sessionLocal = localStorage.getItem('aulaPlusSession');

  if (!sessionLocal) return 'docente_default';

  try {
    const sessionData = JSON.parse(sessionLocal);

    return (
      sessionData?.user?.email ||
      sessionData?.email ||
      'docente_default'
    );
  } catch {
    return 'docente_default';
  }
}

function textoTieneContenido(valor: string | undefined): boolean {
  return Boolean(valor && valor.trim().length >= 5);
}

/**
 * El estado NO pretende calificar al docente.
 * Sólo indica si ya existe suficiente información para personalizar
 * una planeación con mayor seguridad.
 */
export function calcularEstadoContextoEscuela(
  campos: ContextoEscuelaCampos,
  mejoradoPorIA = false,
  validadoPorDocente = false
): EstadoContexto {
  const esenciales = [
    campos.descripcionEscuela,
    campos.infraestructura,
    campos.descripcionComunidad,
    campos.problematicasComunitarias,
    campos.fortalezasComunitarias,
  ];

  const completos = esenciales.filter(textoTieneContenido).length;

  if (
    completos >= 4 &&
    mejoradoPorIA &&
    validadoPorDocente
  ) {
    return 'optimizado';
  }

  if (completos >= 4) return 'listo';
  if (completos >= 2) return 'en_construccion';

  return 'inicial';
}

export function calcularEstadoContextoGrupo(
  campos: ContextoGrupoCampos,
  mejoradoPorIA = false,
  validadoPorDocente = false
): EstadoContexto {
  const esenciales = [
    campos.descripcionGeneral,
    campos.saberesPrevios,
    campos.dificultades,
    campos.fortalezas,
    campos.intereses,
    campos.diagnostico,
  ];

  const completos = esenciales.filter(textoTieneContenido).length;

  if (
    completos >= 5 &&
    mejoradoPorIA &&
    validadoPorDocente
  ) {
    return 'optimizado';
  }

  if (completos >= 5) return 'listo';
  if (completos >= 3) return 'en_construccion';

  return 'inicial';
}

/* =========================================================
   ESCUELA
   ========================================================= */

export async function cargarContextoEscuela(
  docenteEmail: string
): Promise<ContextoEscuela> {
  const ref = doc(db, 'teacher_settings', docenteEmail);
  const snap = await getDoc(ref);

  if (!snap.exists() || !snap.data().contextoEscuela) {
    return crearContextoEscuelaVacio();
  }

  const guardado = snap.data().contextoEscuela as ContextoEscuela;

  return {
    ...crearContextoEscuelaVacio(),
    ...guardado,
    campos: {
      ...contextoEscuelaVacio,
      ...(guardado.campos || {}),
    },
  };
}

export async function guardarContextoEscuela(
  docenteEmail: string,
  contexto: ContextoEscuela
): Promise<void> {
  const estado = calcularEstadoContextoEscuela(
    contexto.campos,
    contexto.mejoradoPorIA,
    contexto.validadoPorDocente
  );

  await setDoc(
    doc(db, 'teacher_settings', docenteEmail),
    {
      contextoEscuela: {
        ...contexto,
        estado,
        version: contexto.version || 1,
        updatedAt: serverTimestamp(),
      },
    },
    { merge: true }
  );
}

export async function guardarContextoEscuelaMejorado(
  docenteEmail: string,
  camposOriginales: ContextoEscuelaCampos,
  camposMejorados: ContextoEscuelaCampos
): Promise<void> {
  const contexto: ContextoEscuela = {
    campos: camposMejorados,
    camposOriginales,

    mejoradoPorIA: true,
    validadoPorDocente: false,

    estado: calcularEstadoContextoEscuela(
      camposMejorados,
      true,
      false
    ),

    version: 2,
    improvedAt: serverTimestamp(),
  };

  await guardarContextoEscuela(docenteEmail, contexto);
}

/* =========================================================
   GRUPO
   ========================================================= */

function refContextoGrupo(
  docenteEmail: string,
  groupId: string
) {
  return doc(
    db,
    'teacher_settings',
    docenteEmail,
    'group_contexts',
    groupId
  );
}

export async function cargarContextoGrupo(
  docenteEmail: string,
  groupId: string
): Promise<ContextoGrupo> {
  const snap = await getDoc(
    refContextoGrupo(docenteEmail, groupId)
  );

  if (!snap.exists()) {
    return crearContextoGrupoVacio(
      groupId,
      docenteEmail
    );
  }

  const guardado = snap.data() as ContextoGrupo;

  return {
    ...crearContextoGrupoVacio(
      groupId,
      docenteEmail
    ),
    ...guardado,
    campos: {
      ...contextoGrupoVacio,
      ...(guardado.campos || {}),
    },
  };
}

export async function guardarContextoGrupo(
  docenteEmail: string,
  groupId: string,
  contexto: ContextoGrupo
): Promise<void> {
  const estado = calcularEstadoContextoGrupo(
    contexto.campos,
    contexto.mejoradoPorIA,
    contexto.validadoPorDocente
  );

  await setDoc(
    refContextoGrupo(docenteEmail, groupId),
    {
      ...contexto,
      groupId,
      docenteEmail,
      estado,
      version: contexto.version || 1,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function guardarContextoGrupoMejorado(
  docenteEmail: string,
  groupId: string,
  camposOriginales: ContextoGrupoCampos,
  camposMejorados: ContextoGrupoCampos
): Promise<void> {
  const contexto: ContextoGrupo = {
    groupId,
    docenteEmail,

    campos: camposMejorados,
    camposOriginales,

    mejoradoPorIA: true,
    validadoPorDocente: false,

    estado: calcularEstadoContextoGrupo(
      camposMejorados,
      true,
      false
    ),

    version: 2,
    improvedAt: serverTimestamp(),
  };

  await guardarContextoGrupo(
    docenteEmail,
    groupId,
    contexto
  );
}

/* =========================================================
   PROGRAMA ANALÍTICO
   ========================================================= */

function refProgramaAnalitico(
  docenteEmail: string,
  groupId: string
) {
  return doc(
    db,
    'teacher_settings',
    docenteEmail,
    'analytic_programs',
    groupId
  );
}

export async function cargarProgramaAnalitico(
  docenteEmail: string,
  groupId: string
): Promise<ProgramaAnaliticoGrupo> {
  const snap = await getDoc(
    refProgramaAnalitico(docenteEmail, groupId)
  );

  if (!snap.exists()) {
    return crearProgramaAnaliticoVacio(
      groupId,
      docenteEmail
    );
  }

  const guardado =
    snap.data() as ProgramaAnaliticoGrupo;

  return {
    ...crearProgramaAnaliticoVacio(
      groupId,
      docenteEmail
    ),
    ...guardado,
    contenidos: guardado.contenidos || [],
    contenidosCodisenados:
      guardado.contenidosCodisenados || [],
    problematicasPriorizadas:
      guardado.problematicasPriorizadas || [],
  };
}

export async function guardarProgramaAnalitico(
  docenteEmail: string,
  groupId: string,
  programa: ProgramaAnaliticoGrupo
): Promise<void> {
  await setDoc(
    refProgramaAnalitico(docenteEmail, groupId),
    {
      ...programa,
      groupId,
      docenteEmail,
      version: programa.version || 1,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/* =========================================================
   PREFERENCIAS DEL DOCENTE
   ========================================================= */

export async function cargarPreferenciasPlaneacion(
  docenteEmail: string
): Promise<PreferenciasPlaneacion> {
  const ref = doc(db, 'teacher_settings', docenteEmail);
  const snap = await getDoc(ref);

  if (!snap.exists()) return {};

  return (
    (snap.data()
      .preferenciasPlaneacion as PreferenciasPlaneacion) ||
    {}
  );
}

export async function guardarPreferenciasPlaneacion(
  docenteEmail: string,
  preferencias: PreferenciasPlaneacion
): Promise<void> {
  await setDoc(
    doc(db, 'teacher_settings', docenteEmail),
    {
      preferenciasPlaneacion: preferencias,
      preferenciasPlaneacionUpdatedAt:
        serverTimestamp(),
    },
    { merge: true }
  );
}

/* =========================================================
   HELPERS PARA UI
   ========================================================= */

export function etiquetaEstadoContexto(
  estado: EstadoContexto
): {
  label: string;
  emoji: string;
} {
  switch (estado) {
    case 'optimizado':
      return {
        label: 'Optimizado y validado',
        emoji: '✨',
      };

    case 'listo':
      return {
        label: 'Listo para planear',
        emoji: '🟢',
      };

    case 'en_construccion':
      return {
        label: 'En construcción',
        emoji: '🟡',
      };

    default:
      return {
        label: 'Contexto inicial',
        emoji: '🔴',
      };
  }
}
