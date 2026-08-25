import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  ContextoGrupo,
  ContextoGrupoCampos,
} from '../services/planeacionContextService';
import {
  calcularEstadoContextoGrupo,
  cargarContextoGrupo,
  crearContextoGrupoVacio,
  etiquetaEstadoContexto,
  guardarContextoGrupo,
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

type CampoTexto = Exclude<
  keyof ContextoGrupoCampos,
  'ritmoTrabajo' | 'formaTrabajo'
>;

type Ritmo = ContextoGrupoCampos['ritmoTrabajo'];
type FormaTrabajo = ContextoGrupoCampos['formaTrabajo'];

interface PropuestaIA {
  campos: ContextoGrupoCampos;
}

const RITMOS: Array<{
  value: Ritmo;
  label: string;
  descripcion: string;
}> = [
  {
    value: 'lento',
    label: 'Necesita más tiempo',
    descripcion: 'El grupo suele requerir pausas, modelado o periodos amplios.',
  },
  {
    value: 'moderado',
    label: 'Ritmo moderado',
    descripcion: 'Avanza de manera estable con tiempos habituales.',
  },
  {
    value: 'rapido',
    label: 'Avanza rápido',
    descripcion: 'Suele terminar pronto y puede requerir ampliaciones o retos.',
  },
  {
    value: 'variable',
    label: 'Muy variable',
    descripcion: 'Existen diferencias marcadas entre estudiantes o equipos.',
  },
];

const FORMAS_TRABAJO: Array<{
  value: FormaTrabajo;
  label: string;
  icono: string;
}> = [
  { value: 'individual', label: 'Individual', icono: '👤' },
  { value: 'parejas', label: 'Parejas', icono: '👥' },
  { value: 'equipos', label: 'Equipos', icono: '🧩' },
  { value: 'variable', label: 'Depende de la actividad', icono: '🔄' },
];

export default function ContextoGrupo() {
  const [docenteEmail, setDocenteEmail] = useState('');
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState('');

  const [contexto, setContexto] = useState<ContextoGrupo | null>(null);

  const [cargandoGrupos, setCargandoGrupos] = useState(true);
  const [cargandoContexto, setCargandoContexto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mejorando, setMejorando] = useState(false);

  const [mensaje, setMensaje] = useState('');
  const [propuestaIA, setPropuestaIA] = useState<PropuestaIA | null>(null);
  const [mostrarRevision, setMostrarRevision] = useState(false);

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
          `${a.grade}-${a.name}`.localeCompare(`${b.grade}-${b.name}`, 'es')
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
      setContexto(null);
      return;
    }

    const cargar = async () => {
      setCargandoContexto(true);
      setMensaje('');
      setPropuestaIA(null);
      setMostrarRevision(false);

      try {
        const guardado = await cargarContextoGrupo(
          docenteEmail,
          grupoSeleccionado
        );

        setContexto(guardado);
      } catch (error) {
        console.error('Error al cargar contexto del grupo:', error);
        setContexto(
          crearContextoGrupoVacio(grupoSeleccionado, docenteEmail)
        );
        setMensaje(
          'No se encontró información previa. Puedes comenzar el contexto de este grupo.'
        );
      } finally {
        setCargandoContexto(false);
      }
    };

    cargar();
  }, [grupoSeleccionado, docenteEmail]);

  const grupoActivo = useMemo(
    () => grupos.find((g) => g.id === grupoSeleccionado) || null,
    [grupos, grupoSeleccionado]
  );

  const estadoActual = useMemo(() => {
    if (!contexto) return 'inicial' as const;

    return calcularEstadoContextoGrupo(
      contexto.campos,
      contexto.mejoradoPorIA,
      contexto.validadoPorDocente
    );
  }, [contexto]);

  const badgeEstado = etiquetaEstadoContexto(estadoActual);

  const progreso = useMemo(() => {
    if (!contexto) return 0;

    const importantes = [
      contexto.campos.descripcionGeneral,
      contexto.campos.saberesPrevios,
      contexto.campos.dificultades,
      contexto.campos.fortalezas,
      contexto.campos.intereses,
      contexto.campos.diagnostico,
      contexto.campos.diversidadYApoyos,
      contexto.campos.preferenciasParticipacion,
    ];

    const completos = importantes.filter(
      (valor) => valor.trim().length >= 5
    ).length;

    return Math.round((completos / importantes.length) * 100);
  }, [contexto]);

  const actualizarTexto = (campo: CampoTexto, valor: string) => {
    setContexto((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        campos: {
          ...prev.campos,
          [campo]: valor,
        },
        mejoradoPorIA: false,
        validadoPorDocente: false,
      };
    });
  };

  const actualizarRitmo = (valor: Ritmo) => {
    setContexto((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        campos: {
          ...prev.campos,
          ritmoTrabajo: valor,
        },
        mejoradoPorIA: false,
        validadoPorDocente: false,
      };
    });
  };

  const actualizarFormaTrabajo = (valor: FormaTrabajo) => {
    setContexto((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        campos: {
          ...prev.campos,
          formaTrabajo: valor,
        },
        mejoradoPorIA: false,
        validadoPorDocente: false,
      };
    });
  };

  const guardar = async () => {
    if (!contexto || !grupoSeleccionado || !docenteEmail) return;

    setGuardando(true);
    setMensaje('');

    try {
      const actualizado: ContextoGrupo = {
        ...contexto,
        estado: estadoActual,
      };

      await guardarContextoGrupo(
        docenteEmail,
        grupoSeleccionado,
        actualizado
      );

      setContexto(actualizado);
      setMensaje(
        `✓ Contexto de ${grupoActivo?.name || 'este grupo'} guardado en la nube.`
      );
    } catch (error) {
      console.error('Error al guardar contexto de grupo:', error);
      setMensaje('No fue posible guardar el contexto del grupo.');
    } finally {
      setGuardando(false);
    }
  };

  const extraerJSON = (texto: string) => {
    const limpio = texto
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const inicio = limpio.indexOf('{');
    const fin = limpio.lastIndexOf('}');

    if (inicio === -1 || fin === -1) {
      throw new Error('La IA no devolvió JSON válido.');
    }

    return JSON.parse(limpio.slice(inicio, fin + 1));
  };

  const mejorarContexto = async () => {
    if (!contexto || !grupoActivo) return;

    const tieneBase = [
      contexto.campos.descripcionGeneral,
      contexto.campos.saberesPrevios,
      contexto.campos.dificultades,
      contexto.campos.fortalezas,
      contexto.campos.intereses,
      contexto.campos.diagnostico,
    ].some((valor) => valor.trim().length >= 5);

    if (!tieneBase) {
      setMensaje(
        'Primero cuéntanos algunas características reales de este grupo.'
      );
      return;
    }

    setMejorando(true);
    setMensaje('');

    const prompt = `
Eres asesor técnico pedagógico de Educación Básica en México, especialista en Nueva Escuela Mexicana, inclusión, diagnóstico pedagógico y contextualización.

Vas a mejorar la REDACCIÓN de un contexto de grupo que escribió un docente.

GRUPO:
- Nombre: ${grupoActivo.name}
- Grado: ${grupoActivo.grade}
- Disciplina / asignatura: ${grupoActivo.subject}
- Énfasis: ${grupoActivo.emphasis || 'No aplica'}

REGLAS OBLIGATORIAS:
1. Conserva el significado, intención y hechos proporcionados por el docente.
2. NO inventes alumnos, cantidades, porcentajes, diagnósticos, condiciones médicas, resultados, intereses ni problemas.
3. NO conviertas una observación del docente en diagnóstico clínico.
4. NO etiquetes al grupo de forma rígida.
5. Evita frases culpabilizadoras.
6. Convierte dificultades en información útil para decisiones didácticas.
7. Reconoce fortalezas e intereses, no sólo carencias.
8. Si un campo está vacío, déjalo vacío; NO lo completes.
9. Conserva exactamente los valores de "ritmoTrabajo" y "formaTrabajo".
10. Redacta con claridad profesional, pero con lenguaje comprensible para docentes.
11. Devuelve ÚNICAMENTE JSON válido. No uses markdown.

DATOS ESCRITOS POR EL DOCENTE:
${JSON.stringify(contexto.campos, null, 2)}

Devuelve exactamente:
{
  "descripcionGeneral": "texto mejorado",
  "saberesPrevios": "texto mejorado",
  "dificultades": "texto mejorado",
  "fortalezas": "texto mejorado",
  "intereses": "texto mejorado",
  "ritmoTrabajo": "${contexto.campos.ritmoTrabajo}",
  "formaTrabajo": "${contexto.campos.formaTrabajo}",
  "diagnostico": "texto mejorado",
  "diversidadYApoyos": "texto mejorado",
  "preferenciasParticipacion": "texto mejorado",
  "observaciones": "texto mejorado"
}
`.trim();

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error('No existe VITE_GEMINI_API_KEY.');
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.15,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini respondió ${response.status}`);
      }

      const data = await response.json();
      const texto =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!texto) {
        throw new Error('La IA no devolvió contenido.');
      }

      const resultado = extraerJSON(texto);

      const camposMejorados: ContextoGrupoCampos = {
        descripcionGeneral:
          resultado.descripcionGeneral ??
          contexto.campos.descripcionGeneral,

        saberesPrevios:
          resultado.saberesPrevios ??
          contexto.campos.saberesPrevios,

        dificultades:
          resultado.dificultades ??
          contexto.campos.dificultades,

        fortalezas:
          resultado.fortalezas ??
          contexto.campos.fortalezas,

        intereses:
          resultado.intereses ??
          contexto.campos.intereses,

        ritmoTrabajo: contexto.campos.ritmoTrabajo,
        formaTrabajo: contexto.campos.formaTrabajo,

        diagnostico:
          resultado.diagnostico ??
          contexto.campos.diagnostico,

        diversidadYApoyos:
          resultado.diversidadYApoyos ??
          contexto.campos.diversidadYApoyos,

        preferenciasParticipacion:
          resultado.preferenciasParticipacion ??
          contexto.campos.preferenciasParticipacion,

        observaciones:
          resultado.observaciones ??
          contexto.campos.observaciones,
      };

      setPropuestaIA({ campos: camposMejorados });
      setMostrarRevision(true);
    } catch (error) {
      console.error('Error al mejorar contexto de grupo:', error);
      setMensaje(
        'La IA no pudo estructurar el contexto. Tu información original permanece intacta.'
      );
    } finally {
      setMejorando(false);
    }
  };

  const aceptarPropuestaIA = async () => {
    if (
      !contexto ||
      !propuestaIA ||
      !grupoSeleccionado ||
      !docenteEmail
    ) {
      return;
    }

    const actualizado: ContextoGrupo = {
      ...contexto,
      camposOriginales:
        contexto.camposOriginales || { ...contexto.campos },
      campos: propuestaIA.campos,
      mejoradoPorIA: true,
      validadoPorDocente: true,
      estado: calcularEstadoContextoGrupo(
        propuestaIA.campos,
        true,
        true
      ),
      version: Math.max(contexto.version || 1, 1) + 1,
    };

    setGuardando(true);

    try {
      await guardarContextoGrupo(
        docenteEmail,
        grupoSeleccionado,
        actualizado
      );

      setContexto(actualizado);
      setPropuestaIA(null);
      setMostrarRevision(false);
      setMensaje(
        `✨ Contexto de ${grupoActivo?.name || 'este grupo'} mejorado, validado y guardado.`
      );
    } catch (error) {
      console.error('Error al guardar mejora:', error);
      setMensaje('No fue posible guardar la versión mejorada.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargandoGrupos) {
    return (
      <div
        style={{
          minHeight: '480px',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div className="loader" style={{ margin: '0 auto 1rem' }} />
          <strong style={{ color: 'var(--text-main)' }}>
            Buscando tus grupos...
          </strong>
        </div>
      </div>
    );
  }

  if (grupos.length === 0) {
    return (
      <div
        style={{
          maxWidth: '760px',
          margin: '2rem auto',
          padding: '3rem 1.5rem',
          borderRadius: '28px',
          background: 'var(--bg-panel)',
          border: '2px dashed var(--border-color)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '4rem', marginBottom: '.8rem' }}>👥</div>
        <h2
          style={{
            margin: 0,
            color: 'var(--text-main)',
            fontSize: '1.6rem',
          }}
        >
          Primero crea un grupo
        </h2>
        <p
          style={{
            color: 'var(--text-muted)',
            maxWidth: '560px',
            margin: '.8rem auto 0',
            lineHeight: 1.6,
          }}
        >
          Aula+ necesita saber a qué grupo pertenece cada contexto. Crea tus
          grupos desde Gestión y Asistencia y después vuelve aquí.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '1180px',
        margin: '0 auto',
        paddingBottom: '3rem',
        animation: 'fadeIn .35s ease',
      }}
    >
      {/* SELECTOR / HERO */}
      <section
        style={{
          borderRadius: '28px',
          padding: 'clamp(1.4rem, 3vw, 2.5rem)',
          marginBottom: '1.3rem',
          background:
            'linear-gradient(135deg, rgba(76,175,80,.10), rgba(28,81,255,.08), rgba(156,39,176,.08))',
          border: '1px solid var(--border-color)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '260px',
            height: '260px',
            borderRadius: '50%',
            right: '-100px',
            bottom: '-150px',
            background:
              'radial-gradient(circle, rgba(76,175,80,.18), transparent 67%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 360px)',
            gap: '1.5rem',
            alignItems: 'end',
          }}
          className="contexto-grupo-hero"
        >
          <div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '.4rem',
                borderRadius: '999px',
                padding: '.38rem .75rem',
                background: 'rgba(76,175,80,.10)',
                color: 'var(--accent-green)',
                fontSize: '.75rem',
                fontWeight: 900,
                letterSpacing: '.05em',
                marginBottom: '.8rem',
              }}
            >
              👥 CONTEXTO ESPECÍFICO DEL GRUPO
            </span>

            <h2
              style={{
                margin: 0,
                color: 'var(--text-main)',
                fontSize: 'clamp(1.7rem, 3vw, 2.4rem)',
                letterSpacing: '-.035em',
                lineHeight: 1.07,
              }}
            >
              Cada grupo aprende desde una realidad distinta.
            </h2>

            <p
              style={{
                margin: '.8rem 0 0',
                color: 'var(--text-muted)',
                maxWidth: '680px',
                lineHeight: 1.6,
              }}
            >
              Elige el grupo antes de escribir. Lo que registres aquí sólo se
              utilizará para personalizar las planeaciones de ese grupo.
            </p>
          </div>

          <div
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              padding: '1rem',
              boxShadow: '0 12px 36px rgba(0,0,0,.05)',
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
              ¿Qué grupo quieres contextualizar?
            </label>

            <select
              className="search-input"
              value={grupoSeleccionado}
              onChange={(e) => setGrupoSeleccionado(e.target.value)}
              style={{
                margin: 0,
                cursor: 'pointer',
                width: '100%',
                borderRadius: '14px',
              }}
            >
              <option value="">— Selecciona un grupo —</option>
              {grupos.map((grupo) => (
                <option key={grupo.id} value={grupo.id}>
                  {grupo.name} · {grupo.subject}
                  {grupo.emphasis ? ` · ${grupo.emphasis}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {!grupoSeleccionado ? (
        <SeleccionPendiente />
      ) : cargandoContexto || !contexto ? (
        <div
          style={{
            minHeight: '420px',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div className="loader" style={{ margin: '0 auto 1rem' }} />
            <strong style={{ color: 'var(--text-main)' }}>
              Preparando el contexto de {grupoActivo?.name}...
            </strong>
          </div>
        </div>
      ) : (
        <>
          {/* RESUMEN DEL GRUPO */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
              marginBottom: '1.2rem',
              padding: '1rem 1.1rem',
              borderRadius: '20px',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '.8rem',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '15px',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(28,81,255,.09)',
                  fontSize: '1.3rem',
                }}
              >
                🎓
              </div>

              <div>
                <strong
                  style={{
                    display: 'block',
                    color: 'var(--text-main)',
                    fontSize: '1rem',
                  }}
                >
                  {grupoActivo?.name}
                </strong>
                <span
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '.78rem',
                  }}
                >
                  {grupoActivo?.subject}
                  {grupoActivo?.emphasis
                    ? ` · ${grupoActivo.emphasis}`
                    : ''}
                </span>
              </div>
            </div>

            <div
              style={{
                minWidth: '230px',
                display: 'flex',
                alignItems: 'center',
                gap: '.8rem',
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '.72rem',
                    marginBottom: '.35rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>
                    {badgeEstado.emoji} {badgeEstado.label}
                  </span>
                  <strong>{progreso}%</strong>
                </div>

                <div
                  style={{
                    height: '7px',
                    borderRadius: '999px',
                    background: 'var(--bg-input)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${progreso}%`,
                      height: '100%',
                      borderRadius: '999px',
                      background:
                        'linear-gradient(90deg, var(--accent-green), var(--accent-blue))',
                      transition: 'width .3s ease',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {mensaje && (
            <div
              style={{
                marginBottom: '1.1rem',
                padding: '.85rem 1rem',
                borderRadius: '14px',
                background: 'rgba(28,81,255,.07)',
                border: '1px solid rgba(28,81,255,.14)',
                color: 'var(--text-main)',
                fontSize: '.86rem',
              }}
            >
              {mensaje}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(330px, 1fr))',
              gap: '1.15rem',
            }}
          >
            <Card
              numero="01"
              icono="👀"
              titulo="Así es este grupo"
              descripcion="Descríbelo como lo vives en clase; Aula+ se encargará después de articularlo."
              color="var(--accent-blue)"
            >
              <Campo
                etiqueta="¿Cómo describirías al grupo?"
                ayuda="Participación, convivencia, autonomía, organización o cualquier rasgo que realmente influya al enseñar."
                placeholder="Ej. Es un grupo participativo, disfruta las actividades prácticas y suele necesitar instrucciones breves para organizarse..."
                valor={contexto.campos.descripcionGeneral}
                onChange={(v) =>
                  actualizarTexto('descripcionGeneral', v)
                }
              />

              <Campo
                etiqueta="¿Qué saben o qué pueden hacer actualmente?"
                ayuda="Recupera conocimientos, habilidades o experiencias previas relacionadas con tu disciplina."
                placeholder="Ej. Reconocen herramientas básicas, pueden seguir instrucciones sencillas y algunos ya tienen experiencia previa..."
                valor={contexto.campos.saberesPrevios}
                onChange={(v) =>
                  actualizarTexto('saberesPrevios', v)
                }
              />
            </Card>

            <Card
              numero="02"
              icono="🧭"
              titulo="Lo que necesitan fortalecer"
              descripcion="No necesitas diagnosticar; basta con describir lo que observas."
              color="#F97316"
            >
              <Campo
                etiqueta="¿Qué se les dificulta?"
                ayuda="Escribe conductas o desempeños observables, no etiquetas."
                placeholder="Ej. Les cuesta sostener actividades de lectura prolongada, organizar información y administrar el tiempo..."
                valor={contexto.campos.dificultades}
                onChange={(v) =>
                  actualizarTexto('dificultades', v)
                }
              />

              <Campo
                etiqueta="¿Qué mostró tu diagnóstico?"
                ayuda="Puedes resumir evaluaciones diagnósticas, trabajos iniciales, ejercicios o evidencias."
                placeholder="Ej. En las actividades iniciales la mayoría identifica conceptos básicos, pero requiere apoyo para aplicarlos en situaciones nuevas..."
                valor={contexto.campos.diagnostico}
                onChange={(v) =>
                  actualizarTexto('diagnostico', v)
                }
              />
            </Card>

            <Card
              numero="03"
              icono="⭐"
              titulo="Fortalezas e intereses"
              descripcion="Una buena planeación también parte de lo que el grupo ya hace bien."
              color="var(--accent-green)"
            >
              <Campo
                etiqueta="¿Qué hacen bien?"
                ayuda="Piensa en capacidades, actitudes, dinámicas o formas de colaboración que puedas aprovechar."
                placeholder="Ej. Colaboran bien en tareas prácticas, muestran creatividad y varios estudiantes apoyan a sus compañeros..."
                valor={contexto.campos.fortalezas}
                onChange={(v) =>
                  actualizarTexto('fortalezas', v)
                }
              />

              <Campo
                etiqueta="¿Qué les interesa?"
                ayuda="Temas, herramientas, problemas, actividades o formatos que suelen generar participación."
                placeholder="Ej. Tecnología, retos prácticos, videos cortos, actividades relacionadas con situaciones de su comunidad..."
                valor={contexto.campos.intereses}
                onChange={(v) =>
                  actualizarTexto('intereses', v)
                }
              />
            </Card>

            <Card
              numero="04"
              icono="⏱️"
              titulo="Ritmo y organización"
              descripcion="Estas decisiones ayudan a que la IA proponga tiempos y agrupamientos realistas."
              color="var(--accent-purple)"
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    color: 'var(--text-main)',
                    fontWeight: 900,
                    fontSize: '.83rem',
                    marginBottom: '.55rem',
                  }}
                >
                  ¿Cómo describirías el ritmo general?
                </label>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '.55rem',
                  }}
                >
                  {RITMOS.map((ritmo) => {
                    const activo =
                      contexto.campos.ritmoTrabajo === ritmo.value;

                    return (
                      <button
                        key={ritmo.value}
                        type="button"
                        onClick={() =>
                          actualizarRitmo(ritmo.value)
                        }
                        title={ritmo.descripcion}
                        style={{
                          textAlign: 'left',
                          padding: '.75rem',
                          minHeight: '72px',
                          borderRadius: '14px',
                          cursor: 'pointer',
                          border: activo
                            ? '1px solid rgba(156,39,176,.35)'
                            : '1px solid var(--border-color)',
                          background: activo
                            ? 'rgba(156,39,176,.09)'
                            : 'var(--bg-input)',
                          color: activo
                            ? 'var(--accent-purple)'
                            : 'var(--text-muted)',
                          fontWeight: 800,
                          fontSize: '.77rem',
                        }}
                      >
                        {activo ? '✓ ' : ''}
                        {ritmo.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    color: 'var(--text-main)',
                    fontWeight: 900,
                    fontSize: '.83rem',
                    margin: '.35rem 0 .55rem',
                  }}
                >
                  ¿Qué organización suele funcionar mejor?
                </label>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '.55rem',
                  }}
                >
                  {FORMAS_TRABAJO.map((forma) => {
                    const activo =
                      contexto.campos.formaTrabajo === forma.value;

                    return (
                      <button
                        key={forma.value}
                        type="button"
                        onClick={() =>
                          actualizarFormaTrabajo(forma.value)
                        }
                        style={{
                          borderRadius: '999px',
                          border: activo
                            ? '1px solid rgba(28,81,255,.35)'
                            : '1px solid var(--border-color)',
                          background: activo
                            ? 'rgba(28,81,255,.08)'
                            : 'var(--bg-input)',
                          color: activo
                            ? 'var(--accent-blue)'
                            : 'var(--text-muted)',
                          padding: '.55rem .75rem',
                          cursor: 'pointer',
                          fontWeight: 800,
                          fontSize: '.77rem',
                        }}
                      >
                        {forma.icono} {forma.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card
              numero="05"
              icono="🤝"
              titulo="Participación y apoyos"
              descripcion="Describe necesidades educativas sin convertir el contexto en un expediente personal."
              color="#0EA5E9"
            >
              <div
                style={{
                  padding: '.85rem',
                  borderRadius: '14px',
                  background: 'rgba(14,165,233,.07)',
                  border: '1px solid rgba(14,165,233,.12)',
                  color: 'var(--text-muted)',
                  fontSize: '.76rem',
                  lineHeight: 1.5,
                }}
              >
                🔐 Evita escribir nombres completos, diagnósticos médicos o
                información sensible de estudiantes. Describe el apoyo que
                necesitan en el aula.
              </div>

              <Campo
                etiqueta="¿Qué apoyos, ajustes o condiciones conviene considerar?"
                ayuda="Por ejemplo: instrucciones segmentadas, más tiempo, apoyos visuales, lectura acompañada o alternativas para participar."
                placeholder="Ej. Algunos estudiantes requieren instrucciones paso a paso y más tiempo; funcionan bien los ejemplos visuales y las demostraciones..."
                valor={contexto.campos.diversidadYApoyos}
                onChange={(v) =>
                  actualizarTexto('diversidadYApoyos', v)
                }
              />

              <Campo
                etiqueta="¿Cómo suelen participar y aprender mejor?"
                ayuda="Puedes registrar preferencias observadas sin etiquetar permanentemente a los estudiantes."
                placeholder="Ej. El grupo responde mejor cuando combina explicación breve, demostración, práctica y socialización..."
                valor={
                  contexto.campos.preferenciasParticipacion
                }
                onChange={(v) =>
                  actualizarTexto(
                    'preferenciasParticipacion',
                    v
                  )
                }
              />
            </Card>

            <Card
              numero="06"
              icono="🧠"
              titulo="Convierte observaciones en decisiones"
              descripcion="Aula+ puede ayudarte a expresar pedagógicamente lo que tú ya sabes de tu grupo."
              color="var(--accent-purple)"
            >
              <Campo
                etiqueta="¿Hay algo más que nunca debería olvidar al planear para este grupo?"
                ayuda="Campo libre para condiciones particulares de trabajo."
                placeholder="Ej. Los viernes existe menos tiempo efectivo; la revisión individual toma varios minutos; el grupo disfruta presentar sus productos..."
                valor={contexto.campos.observaciones}
                onChange={(v) =>
                  actualizarTexto('observaciones', v)
                }
              />

              <div
                style={{
                  padding: '1rem',
                  borderRadius: '16px',
                  background:
                    'linear-gradient(135deg, rgba(156,39,176,.08), rgba(28,81,255,.06))',
                  border: '1px solid rgba(156,39,176,.14)',
                }}
              >
                <strong
                  style={{
                    display: 'block',
                    color: 'var(--text-main)',
                    marginBottom: '.35rem',
                    fontSize: '.85rem',
                  }}
                >
                  ✨ Mejorar contexto no significa inventarlo.
                </strong>
                <p
                  style={{
                    margin: 0,
                    color: 'var(--text-muted)',
                    fontSize: '.78rem',
                    lineHeight: 1.5,
                  }}
                >
                  La IA sólo reorganizará tus observaciones para convertirlas
                  en información útil al decidir actividades, apoyos, tiempos
                  y evaluación.
                </p>
              </div>

              <button
                type="button"
                onClick={mejorarContexto}
                disabled={mejorando}
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '.95rem 1rem',
                  cursor: mejorando ? 'wait' : 'pointer',
                  background:
                    'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
                  color: 'white',
                  fontWeight: 900,
                  boxShadow: '0 10px 24px rgba(103,58,183,.19)',
                  opacity: mejorando ? 0.7 : 1,
                }}
              >
                {mejorando
                  ? '🧠 Articulando el contexto...'
                  : '✨ Mejorar contexto con IA'}
              </button>

              {contexto.mejoradoPorIA && (
                <span
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    color: 'var(--accent-green)',
                    fontWeight: 800,
                    fontSize: '.75rem',
                  }}
                >
                  ✓ Contexto mejorado y validado por el docente.
                </span>
              )}
            </Card>
          </div>

          {/* BARRA INFERIOR */}
          <div
            style={{
              position: 'sticky',
              bottom: '1rem',
              zIndex: 8,
              marginTop: '1.3rem',
              padding: '.8rem',
              borderRadius: '20px',
              background:
                'color-mix(in srgb, var(--bg-panel) 92%, transparent)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 14px 42px rgba(0,0,0,.12)',
              backdropFilter: 'blur(14px)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '.8rem',
            }}
          >
            <div style={{ paddingLeft: '.35rem' }}>
              <strong
                style={{
                  display: 'block',
                  color: 'var(--text-main)',
                  fontSize: '.86rem',
                }}
              >
                {badgeEstado.emoji} {badgeEstado.label}
              </strong>
              <span
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '.72rem',
                }}
              >
                Contexto exclusivo de {grupoActivo?.name}.
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
                minWidth: '210px',
                cursor: guardando ? 'wait' : 'pointer',
                background: 'var(--accent-blue)',
                color: 'white',
                fontWeight: 900,
                opacity: guardando ? 0.7 : 1,
              }}
            >
              {guardando
                ? 'Guardando...'
                : '💾 Guardar contexto del grupo'}
            </button>
          </div>
        </>
      )}

      {/* MODAL REVISIÓN IA */}
      {mostrarRevision && propuestaIA && contexto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            background: 'rgba(10,15,30,.60)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              width: 'min(1080px, 96vw)',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: '26px',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 30px 100px rgba(0,0,0,.28)',
            }}
          >
            <div
              style={{
                padding: '1.2rem 1.4rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div>
                <span
                  style={{
                    display: 'block',
                    color: 'var(--accent-purple)',
                    fontWeight: 900,
                    fontSize: '.7rem',
                    letterSpacing: '.08em',
                    marginBottom: '.2rem',
                  }}
                >
                  CONTEXTO DE {grupoActivo?.name?.toUpperCase()}
                </span>

                <h3
                  style={{
                    margin: 0,
                    color: 'var(--text-main)',
                    fontSize: '1.35rem',
                  }}
                >
                  ✨ Revisa antes de aceptar
                </h3>

                <p
                  style={{
                    margin: '.35rem 0 0',
                    color: 'var(--text-muted)',
                    fontSize: '.8rem',
                  }}
                >
                  La información sigue siendo tuya. Aula+ sólo mejoró su
                  articulación pedagógica.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMostrarRevision(false)}
                style={{
                  border: 'none',
                  background: 'var(--bg-input)',
                  color: 'var(--text-muted)',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                overflowY: 'auto',
                padding: '1.2rem 1.4rem',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(310px, 1fr))',
                  gap: '1rem',
                }}
              >
                <Comparacion
                  titulo="Descripción general"
                  original={contexto.campos.descripcionGeneral}
                  mejorado={
                    propuestaIA.campos.descripcionGeneral
                  }
                />
                <Comparacion
                  titulo="Saberes previos"
                  original={contexto.campos.saberesPrevios}
                  mejorado={propuestaIA.campos.saberesPrevios}
                />
                <Comparacion
                  titulo="Dificultades"
                  original={contexto.campos.dificultades}
                  mejorado={propuestaIA.campos.dificultades}
                />
                <Comparacion
                  titulo="Fortalezas"
                  original={contexto.campos.fortalezas}
                  mejorado={propuestaIA.campos.fortalezas}
                />
                <Comparacion
                  titulo="Intereses"
                  original={contexto.campos.intereses}
                  mejorado={propuestaIA.campos.intereses}
                />
                <Comparacion
                  titulo="Diagnóstico"
                  original={contexto.campos.diagnostico}
                  mejorado={propuestaIA.campos.diagnostico}
                />
                <Comparacion
                  titulo="Apoyos y diversidad"
                  original={contexto.campos.diversidadYApoyos}
                  mejorado={
                    propuestaIA.campos.diversidadYApoyos
                  }
                />
                <Comparacion
                  titulo="Participación"
                  original={
                    contexto.campos.preferenciasParticipacion
                  }
                  mejorado={
                    propuestaIA.campos.preferenciasParticipacion
                  }
                />
                <Comparacion
                  titulo="Observaciones"
                  original={contexto.campos.observaciones}
                  mejorado={propuestaIA.campos.observaciones}
                />
              </div>
            </div>

            <div
              style={{
                padding: '1rem 1.4rem',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '.7rem',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMostrarRevision(false);
                  setPropuestaIA(null);
                }}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '.8rem 1rem',
                  cursor: 'pointer',
                  background: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontWeight: 800,
                }}
              >
                Conservar mis palabras
              </button>

              <button
                type="button"
                onClick={aceptarPropuestaIA}
                disabled={guardando}
                style={{
                  border: 'none',
                  borderRadius: '12px',
                  padding: '.8rem 1.15rem',
                  minWidth: '230px',
                  cursor: guardando ? 'wait' : 'pointer',
                  background:
                    'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
                  color: 'white',
                  fontWeight: 900,
                }}
              >
                {guardando
                  ? 'Guardando...'
                  : '✓ Aceptar y guardar mejora'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 760px) {
          .contexto-grupo-hero {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function SeleccionPendiente() {
  return (
    <div
      style={{
        minHeight: '400px',
        display: 'grid',
        placeItems: 'center',
        padding: '1.5rem',
        borderRadius: '26px',
        border: '1px dashed var(--border-color)',
        background: 'var(--bg-panel)',
      }}
    >
      <div
        style={{
          maxWidth: '560px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '78px',
            height: '78px',
            margin: '0 auto 1rem',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '24px',
            background:
              'linear-gradient(135deg, rgba(28,81,255,.10), rgba(156,39,176,.10))',
            fontSize: '2.2rem',
          }}
        >
          🎯
        </div>

        <h3
          style={{
            margin: 0,
            color: 'var(--text-main)',
            fontSize: '1.35rem',
          }}
        >
          Primero selecciona a quién vas a enseñar
        </h3>

        <p
          style={{
            margin: '.7rem 0 0',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            fontSize: '.9rem',
          }}
        >
          Aula+ no utilizará un contexto genérico. Cada grupo conservará sus
          propios saberes previos, fortalezas, dificultades, intereses, ritmo
          y apoyos.
        </p>
      </div>
    </div>
  );
}

function Card({
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
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '24px',
        padding: '1.25rem',
        boxShadow: '0 8px 28px rgba(0,0,0,.035)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '.8rem',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '14px',
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
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
              fontSize: '.67rem',
              fontWeight: 900,
              letterSpacing: '.08em',
            }}
          >
            PASO {numero}
          </span>

          <h3
            style={{
              margin: '.15rem 0 .15rem',
              color: 'var(--text-main)',
              fontSize: '1.05rem',
            }}
          >
            {titulo}
          </h3>

          <p
            style={{
              margin: 0,
              color: 'var(--text-muted)',
              fontSize: '.78rem',
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
          gap: '1rem',
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Campo({
  etiqueta,
  ayuda,
  placeholder,
  valor,
  onChange,
}: {
  etiqueta: string;
  ayuda: string;
  placeholder: string;
  valor: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          color: 'var(--text-main)',
          fontWeight: 900,
          fontSize: '.83rem',
          marginBottom: '.25rem',
        }}
      >
        {etiqueta}
      </label>

      <p
        style={{
          margin: '0 0 .45rem',
          color: 'var(--text-muted)',
          fontSize: '.72rem',
          lineHeight: 1.4,
        }}
      >
        {ayuda}
      </p>

      <textarea
        className="search-input"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          minHeight: '95px',
          resize: 'vertical',
          margin: 0,
          boxSizing: 'border-box',
          borderRadius: '14px',
          lineHeight: 1.5,
        }}
      />
    </div>
  );
}

function Comparacion({
  titulo,
  original,
  mejorado,
}: {
  titulo: string;
  original: string;
  mejorado: string;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: '18px',
        overflow: 'hidden',
        background: 'var(--bg-input)',
      }}
    >
      <div
        style={{
          padding: '.7rem .85rem',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-panel)',
          color: 'var(--text-main)',
          fontWeight: 900,
          fontSize: '.8rem',
        }}
      >
        {titulo}
      </div>

      <div style={{ padding: '.85rem' }}>
        <span
          style={{
            display: 'block',
            color: 'var(--text-muted)',
            fontWeight: 900,
            fontSize: '.66rem',
            letterSpacing: '.06em',
            marginBottom: '.25rem',
          }}
        >
          TU OBSERVACIÓN
        </span>

        <p
          style={{
            margin: 0,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            fontSize: '.78rem',
          }}
        >
          {original || '—'}
        </p>

        <div
          style={{
            height: '1px',
            background: 'var(--border-color)',
            margin: '.8rem 0',
          }}
        />

        <span
          style={{
            display: 'block',
            color: 'var(--accent-purple)',
            fontWeight: 900,
            fontSize: '.66rem',
            letterSpacing: '.06em',
            marginBottom: '.25rem',
          }}
        >
          AULA+ LO ARTICULA
        </span>

        <p
          style={{
            margin: 0,
            color: 'var(--text-main)',
            lineHeight: 1.55,
            fontSize: '.8rem',
          }}
        >
          {mejorado || '—'}
        </p>
      </div>
    </div>
  );
}
