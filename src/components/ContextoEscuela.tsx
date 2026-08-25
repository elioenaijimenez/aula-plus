import { useEffect, useMemo, useState } from 'react';
import { generarTextoIA } from '../services/aiService';
import type {
  ContextoEscuela,
  ContextoEscuelaCampos,
} from '../services/planeacionContextService';
import {
  calcularEstadoContextoEscuela,
  cargarContextoEscuela,
  crearContextoEscuelaVacio,
  etiquetaEstadoContexto,
  guardarContextoEscuela,
  obtenerCorreoSesion,
} from '../services/planeacionContextService';

const RECURSOS = [
  'Computadoras',
  'Internet',
  'Proyector',
  'Televisión / Pantalla',
  'Impresora',
  'Biblioteca',
  'Material reciclado',
  'Espacios exteriores',
  'Laboratorio / Taller',
  'Celulares de estudiantes',
];

const FUENTES = [
  'Observación docente',
  'Evaluación diagnóstica',
  'Estudiantes',
  'Familias',
  'Consejo Técnico Escolar',
  'Registros escolares',
  'Recorridos por la comunidad',
  'Autoridades / actores comunitarios',
];

type CampoTexto = Exclude<
  keyof ContextoEscuelaCampos,
  'recursosDisponibles' | 'fuentesInformacion'
>;

interface PropuestaIA {
  campos: ContextoEscuelaCampos;
}

export default function ContextoEscuela() {
  const [docenteEmail, setDocenteEmail] = useState('');
  const [contexto, setContexto] = useState<ContextoEscuela>(
    crearContextoEscuelaVacio()
  );

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mejorando, setMejorando] = useState(false);

  const [propuestaIA, setPropuestaIA] = useState<PropuestaIA | null>(null);
  const [mostrarRevision, setMostrarRevision] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    const cargar = async () => {
      const email = obtenerCorreoSesion();
      setDocenteEmail(email);

      try {
        const guardado = await cargarContextoEscuela(email);
        setContexto(guardado);
      } catch (error) {
        console.error('Error al cargar contexto escolar:', error);
        setMensaje('No fue posible cargar tu contexto desde la nube.');
      } finally {
        setCargando(false);
      }
    };

    cargar();
  }, []);

  const estadoActual = useMemo(
    () =>
      calcularEstadoContextoEscuela(
        contexto.campos,
        contexto.mejoradoPorIA,
        contexto.validadoPorDocente
      ),
    [
      contexto.campos,
      contexto.mejoradoPorIA,
      contexto.validadoPorDocente,
    ]
  );

  const badgeEstado = etiquetaEstadoContexto(estadoActual);

  const progreso = useMemo(() => {
    const camposImportantes = [
      contexto.campos.descripcionEscuela,
      contexto.campos.infraestructura,
      contexto.campos.descripcionComunidad,
      contexto.campos.problematicasComunitarias,
      contexto.campos.fortalezasComunitarias,
      contexto.campos.saberesComunitarios,
    ];

    const completos = camposImportantes.filter(
      (valor) => valor.trim().length >= 5
    ).length;

    return Math.round((completos / camposImportantes.length) * 100);
  }, [contexto.campos]);

  const actualizarTexto = (campo: CampoTexto, valor: string) => {
    setContexto((prev) => ({
      ...prev,
      campos: {
        ...prev.campos,
        [campo]: valor,
      },
      mejoradoPorIA: false,
      validadoPorDocente: false,
    }));
  };

  const alternarRecurso = (recurso: string) => {
    setContexto((prev) => {
      const existe = prev.campos.recursosDisponibles.includes(recurso);

      return {
        ...prev,
        campos: {
          ...prev.campos,
          recursosDisponibles: existe
            ? prev.campos.recursosDisponibles.filter((r) => r !== recurso)
            : [...prev.campos.recursosDisponibles, recurso],
        },
        mejoradoPorIA: false,
        validadoPorDocente: false,
      };
    });
  };

  const alternarFuente = (fuente: string) => {
    setContexto((prev) => {
      const existe = prev.campos.fuentesInformacion.includes(fuente);

      return {
        ...prev,
        campos: {
          ...prev.campos,
          fuentesInformacion: existe
            ? prev.campos.fuentesInformacion.filter((f) => f !== fuente)
            : [...prev.campos.fuentesInformacion, fuente],
        },
        mejoradoPorIA: false,
        validadoPorDocente: false,
      };
    });
  };

  const guardar = async () => {
    if (!docenteEmail) return;

    setGuardando(true);
    setMensaje('');

    try {
      const actualizado: ContextoEscuela = {
        ...contexto,
        estado: estadoActual,
      };

      await guardarContextoEscuela(docenteEmail, actualizado);
      setContexto(actualizado);
      setMensaje('✓ Contexto escolar guardado en la nube.');
    } catch (error) {
      console.error('Error al guardar contexto escolar:', error);
      setMensaje('No fue posible guardar el contexto.');
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
      throw new Error('La IA no devolvió un objeto JSON.');
    }

    return JSON.parse(limpio.slice(inicio, fin + 1));
  };

  const mejorarContexto = async () => {
    const tieneBase =
      contexto.campos.descripcionEscuela.trim() ||
      contexto.campos.descripcionComunidad.trim() ||
      contexto.campos.problematicasComunitarias.trim();

    if (!tieneBase) {
      setMensaje(
        'Primero escribe algunas características reales de tu escuela o comunidad.'
      );
      return;
    }

    setMejorando(true);
    setMensaje('');

    const prompt = `
Eres asesor técnico pedagógico de Educación Básica en México, especialista en Nueva Escuela Mexicana, contextualización curricular y redacción profesional.

Tu tarea NO es inventar información.
Debes conservar exactamente el sentido, la intención y los hechos escritos por el docente.

Transforma notas cotidianas en un contexto socioeducativo claro, profesional, útil para tomar decisiones curriculares y didácticas.

REGLAS OBLIGATORIAS:
1. No inventes estadísticas, diagnósticos, recursos, problemáticas, actores ni características.
2. No agregues información que el docente no haya proporcionado.
3. No conviertas opiniones en hechos.
4. No culpes a estudiantes, familias o comunidad.
5. Conserva fortalezas además de necesidades.
6. Redacta de forma clara y profesional, sin lenguaje exageradamente académico.
7. No modifiques las listas de recursos disponibles ni fuentes de información.
8. Devuelve ÚNICAMENTE JSON válido, sin markdown ni comentarios.

DATOS ORIGINALES DEL DOCENTE:
${JSON.stringify(contexto.campos, null, 2)}

Devuelve exactamente esta estructura:
{
  "descripcionEscuela": "texto mejorado",
  "infraestructura": "texto mejorado",
  "recursosDisponibles": ["mismos valores recibidos"],
  "limitaciones": "texto mejorado",
  "descripcionComunidad": "texto mejorado",
  "actividadesFamiliaresComunitarias": "texto mejorado",
  "problematicasComunitarias": "texto mejorado",
  "fortalezasComunitarias": "texto mejorado",
  "saberesComunitarios": "texto mejorado",
  "fuentesInformacion": ["mismos valores recibidos"],
  "observaciones": "texto mejorado"
}
`.trim();

    try {
      const texto = await generarTextoIA({
  prompt,
  temperature: 0.2,
});

      const resultado = extraerJSON(texto);

      const camposMejorados: ContextoEscuelaCampos = {
        descripcionEscuela:
          resultado.descripcionEscuela ??
          contexto.campos.descripcionEscuela,
        infraestructura:
          resultado.infraestructura ??
          contexto.campos.infraestructura,
        recursosDisponibles:
          contexto.campos.recursosDisponibles,
        limitaciones:
          resultado.limitaciones ??
          contexto.campos.limitaciones,
        descripcionComunidad:
          resultado.descripcionComunidad ??
          contexto.campos.descripcionComunidad,
        actividadesFamiliaresComunitarias:
          resultado.actividadesFamiliaresComunitarias ??
          contexto.campos.actividadesFamiliaresComunitarias,
        problematicasComunitarias:
          resultado.problematicasComunitarias ??
          contexto.campos.problematicasComunitarias,
        fortalezasComunitarias:
          resultado.fortalezasComunitarias ??
          contexto.campos.fortalezasComunitarias,
        saberesComunitarios:
          resultado.saberesComunitarios ??
          contexto.campos.saberesComunitarios,
        fuentesInformacion:
          contexto.campos.fuentesInformacion,
        observaciones:
          resultado.observaciones ??
          contexto.campos.observaciones,
      };

      setPropuestaIA({ campos: camposMejorados });
      setMostrarRevision(true);
    } catch (error) {
      console.error('Error al mejorar contexto:', error);
      setMensaje(
        'La IA no pudo estructurar el contexto. Tus datos originales no se modificaron.'
      );
    } finally {
      setMejorando(false);
    }
  };

  const aceptarPropuestaIA = async () => {
    if (!propuestaIA || !docenteEmail) return;

    const actualizado: ContextoEscuela = {
      ...contexto,
      camposOriginales:
        contexto.camposOriginales || { ...contexto.campos },
      campos: propuestaIA.campos,
      mejoradoPorIA: true,
      validadoPorDocente: true,
      estado: calcularEstadoContextoEscuela(
        propuestaIA.campos,
        true,
        true
      ),
      version: Math.max(contexto.version || 1, 1) + 1,
    };

    setGuardando(true);

    try {
      await guardarContextoEscuela(docenteEmail, actualizado);
      setContexto(actualizado);
      setMostrarRevision(false);
      setPropuestaIA(null);
      setMensaje(
        '✨ Contexto mejorado, validado por ti y guardado en la nube.'
      );
    } catch (error) {
      console.error('Error al aceptar propuesta:', error);
      setMensaje('No fue posible guardar la versión mejorada.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div
        style={{
          minHeight: '500px',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div className="loader" style={{ margin: '0 auto 1rem' }} />
          <strong style={{ color: 'var(--text-main)' }}>
            Preparando tu contexto escolar...
          </strong>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        animation: 'fadeIn 0.35s ease',
        maxWidth: '1180px',
        margin: '0 auto',
        paddingBottom: '3rem',
      }}
    >
      {/* HERO */}
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '28px',
          padding: 'clamp(1.4rem, 3vw, 2.6rem)',
          marginBottom: '1.4rem',
          border: '1px solid var(--border-color)',
          background:
            'linear-gradient(135deg, rgba(28,81,255,.10), rgba(156,39,176,.10), rgba(255,193,7,.08))',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '220px',
            height: '220px',
            borderRadius: '50%',
            right: '-70px',
            top: '-90px',
            background:
              'radial-gradient(circle, rgba(156,39,176,.18), transparent 68%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1.2rem',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ maxWidth: '720px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '.45rem',
                padding: '.38rem .75rem',
                borderRadius: '999px',
                background: 'rgba(28,81,255,.09)',
                color: 'var(--accent-blue)',
                fontSize: '.78rem',
                fontWeight: 800,
                letterSpacing: '.03em',
                marginBottom: '.9rem',
              }}
            >
              🏫 CONTEXTO BASE DE LA ESCUELA
            </span>

            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(1.7rem, 3vw, 2.5rem)',
                color: 'var(--text-main)',
                lineHeight: 1.05,
                letterSpacing: '-.035em',
              }}
            >
              Cuéntale a Aula+ dónde enseñas.
            </h2>

            <p
              style={{
                margin: '.9rem 0 0',
                maxWidth: '680px',
                color: 'var(--text-muted)',
                lineHeight: 1.65,
                fontSize: '1rem',
              }}
            >
              Escribe con naturalidad. No necesitas redactar como especialista:
              la IA puede ayudarte a ordenar tus palabras sin cambiar lo que
              realmente sucede en tu escuela y comunidad.
            </p>
          </div>

          <div
            style={{
              minWidth: '210px',
              padding: '1rem 1.1rem',
              borderRadius: '20px',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 12px 35px rgba(0,0,0,.05)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '.55rem',
                marginBottom: '.65rem',
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>
                {badgeEstado.emoji}
              </span>
              <strong
                style={{
                  color: 'var(--text-main)',
                  fontSize: '.9rem',
                }}
              >
                {badgeEstado.label}
              </strong>
            </div>

            <div
              style={{
                height: '8px',
                borderRadius: '999px',
                background: 'var(--bg-input)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progreso}%`,
                  borderRadius: '999px',
                  background:
                    'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))',
                  transition: 'width .35s ease',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '.45rem',
                fontSize: '.76rem',
                color: 'var(--text-muted)',
              }}
            >
              <span>Información útil</span>
              <strong>{progreso}%</strong>
            </div>
          </div>
        </div>
      </section>

      {mensaje && (
        <div
          style={{
            marginBottom: '1.2rem',
            padding: '.9rem 1rem',
            borderRadius: '14px',
            background: 'rgba(28,81,255,.07)',
            border: '1px solid rgba(28,81,255,.15)',
            color: 'var(--text-main)',
            fontSize: '.9rem',
          }}
        >
          {mensaje}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.2rem',
        }}
      >
        {/* ESCUELA */}
        <Card
          numero="01"
          icono="🏫"
          titulo="Mi escuela"
          descripcion="Describe sólo lo que realmente influye en la enseñanza."
          color="var(--accent-blue)"
        >
          <Campo
            etiqueta="¿Cómo es tu escuela?"
            ayuda="Piensa en tamaño, organización, espacios y condiciones que influyen en tus clases."
            placeholder="Ej. Es una secundaria técnica de turno vespertino. Cuenta con talleres, aulas regulares y patio central..."
            valor={contexto.campos.descripcionEscuela}
            onChange={(v) => actualizarTexto('descripcionEscuela', v)}
          />

          <Campo
            etiqueta="¿Con qué infraestructura cuentas?"
            ayuda="Menciona espacios y condiciones físicas que sí importan al planear."
            placeholder="Ej. El taller tiene mesas de trabajo; la conectividad es irregular y algunas aulas cuentan con pantalla..."
            valor={contexto.campos.infraestructura}
            onChange={(v) => actualizarTexto('infraestructura', v)}
          />

          <Campo
            etiqueta="¿Qué limitaciones debemos tener presentes?"
            ayuda="Escribe lo que no quieres que una planeación dé por hecho."
            placeholder="Ej. No siempre hay internet; no todos los equipos funcionan; las impresiones son limitadas..."
            valor={contexto.campos.limitaciones}
            onChange={(v) => actualizarTexto('limitaciones', v)}
          />
        </Card>

        {/* COMUNIDAD */}
        <Card
          numero="02"
          icono="🌎"
          titulo="Mi comunidad"
          descripcion="Aquí la comunidad deja de ser un dato y se vuelve una fuente de aprendizaje."
          color="var(--accent-purple)"
        >
          <Campo
            etiqueta="¿Cómo es la comunidad?"
            ayuda="Describe características sociales, culturales, territoriales o económicas que conozcas."
            placeholder="Ej. La escuela se encuentra en una comunidad con actividad comercial, agrícola y tradiciones locales..."
            valor={contexto.campos.descripcionComunidad}
            onChange={(v) => actualizarTexto('descripcionComunidad', v)}
          />

          <Campo
            etiqueta="¿A qué se dedican las familias o qué actividades son comunes?"
            ayuda="Oficios, actividades productivas, comercio, servicios o prácticas cotidianas."
            placeholder="Ej. Algunas familias se dedican al comercio, agricultura, servicios y pequeños negocios..."
            valor={contexto.campos.actividadesFamiliaresComunitarias}
            onChange={(v) =>
              actualizarTexto('actividadesFamiliaresComunitarias', v)
            }
          />

          <Campo
            etiqueta="¿Qué situaciones o problemas vale la pena comprender?"
            ayuda="No busques 'el problema perfecto'. Escribe situaciones reales observables."
            placeholder="Ej. Se observan problemas de residuos, uso del agua, movilidad, convivencia o uso de redes sociales..."
            valor={contexto.campos.problematicasComunitarias}
            onChange={(v) =>
              actualizarTexto('problematicasComunitarias', v)
            }
          />
        </Card>

        {/* FORTALEZAS */}
        <Card
          numero="03"
          icono="✨"
          titulo="Lo valioso que ya existe"
          descripcion="Contextualizar no significa hacer una lista de carencias."
          color="var(--accent-green)"
        >
          <Campo
            etiqueta="¿Qué fortalezas tiene la comunidad?"
            ayuda="Personas, organizaciones, espacios, prácticas o recursos que podrían enriquecer una experiencia escolar."
            placeholder="Ej. Existe participación de familias en eventos, comercios locales, artesanos y espacios comunitarios..."
            valor={contexto.campos.fortalezasComunitarias}
            onChange={(v) =>
              actualizarTexto('fortalezasComunitarias', v)
            }
          />

          <Campo
            etiqueta="¿Qué saberes, tradiciones u oficios locales podrían aprovecharse?"
            ayuda="Sólo registra aquellos que realmente conozcas."
            placeholder="Ej. Técnicas de cultivo, preparación de alimentos, comercio local, artesanías, organización comunitaria..."
            valor={contexto.campos.saberesComunitarios}
            onChange={(v) =>
              actualizarTexto('saberesComunitarios', v)
            }
          />

          <Campo
            etiqueta="Algo más que la IA debe saber de la escuela"
            ayuda="Este campo es libre y opcional."
            placeholder="Ej. Durante ciertos meses hay actividades escolares que modifican los tiempos de clase..."
            valor={contexto.campos.observaciones}
            onChange={(v) => actualizarTexto('observaciones', v)}
          />
        </Card>

        {/* RECURSOS */}
        <Card
          numero="04"
          icono="🧰"
          titulo="Recursos reales"
          descripcion="Selecciona sólo aquello que puedes utilizar de forma razonable."
          color="#F97316"
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '.55rem',
            }}
          >
            {RECURSOS.map((recurso) => {
              const activo =
                contexto.campos.recursosDisponibles.includes(recurso);

              return (
                <button
                  key={recurso}
                  type="button"
                  onClick={() => alternarRecurso(recurso)}
                  style={{
                    border: activo
                      ? '1px solid rgba(28,81,255,.35)'
                      : '1px solid var(--border-color)',
                    background: activo
                      ? 'rgba(28,81,255,.09)'
                      : 'var(--bg-input)',
                    color: activo
                      ? 'var(--accent-blue)'
                      : 'var(--text-muted)',
                    borderRadius: '999px',
                    padding: '.55rem .8rem',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '.78rem',
                    transition: 'all .2s ease',
                  }}
                >
                  {activo ? '✓ ' : '+ '}
                  {recurso}
                </button>
              );
            })}
          </div>

          <div
            style={{
              marginTop: '1.1rem',
              padding: '1rem',
              borderRadius: '16px',
              background: 'rgba(249,115,22,.06)',
              border: '1px solid rgba(249,115,22,.12)',
              color: 'var(--text-muted)',
              fontSize: '.84rem',
              lineHeight: 1.55,
            }}
          >
            💡 Aula+ utilizará esta información para evitar sugerir materiales o
            tecnología que tu escuela realmente no tiene.
          </div>
        </Card>

        {/* EVIDENCIAS */}
        <Card
          numero="05"
          icono="🔎"
          titulo="¿De dónde sale esta información?"
          descripcion="No necesitas documentos formales para todo; sí conviene reconocer la fuente."
          color="#0EA5E9"
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '.65rem',
            }}
          >
            {FUENTES.map((fuente) => {
              const activo =
                contexto.campos.fuentesInformacion.includes(fuente);

              return (
                <button
                  key={fuente}
                  type="button"
                  onClick={() => alternarFuente(fuente)}
                  style={{
                    textAlign: 'left',
                    border: activo
                      ? '1px solid rgba(14,165,233,.35)'
                      : '1px solid var(--border-color)',
                    background: activo
                      ? 'rgba(14,165,233,.08)'
                      : 'var(--bg-input)',
                    color: activo
                      ? '#0284C7'
                      : 'var(--text-muted)',
                    borderRadius: '14px',
                    padding: '.75rem',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '.8rem',
                  }}
                >
                  {activo ? '✓ ' : '○ '}
                  {fuente}
                </button>
              );
            })}
          </div>
        </Card>

        {/* IA */}
        <Card
          numero="06"
          icono="🧠"
          titulo="Aula+ lo articula contigo"
          descripcion="Primero escribe la realidad. Después deja que la IA te ayude a expresarla mejor."
          color="var(--accent-purple)"
        >
          <div
            style={{
              padding: '1rem',
              borderRadius: '18px',
              background:
                'linear-gradient(135deg, rgba(156,39,176,.09), rgba(28,81,255,.06))',
              border: '1px solid rgba(156,39,176,.15)',
            }}
          >
            <strong
              style={{
                color: 'var(--text-main)',
                display: 'block',
                marginBottom: '.45rem',
              }}
            >
              La IA no escribirá una escuela imaginaria.
            </strong>
            <p
              style={{
                margin: 0,
                color: 'var(--text-muted)',
                lineHeight: 1.55,
                fontSize: '.86rem',
              }}
            >
              Sólo reorganizará lo que tú escribiste para convertirlo en un
              contexto útil para contextualizar contenidos, PDA y futuras
              planeaciones.
            </p>
          </div>

          <button
            type="button"
            onClick={mejorarContexto}
            disabled={mejorando}
            style={{
              width: '100%',
              marginTop: '1rem',
              border: 'none',
              padding: '.95rem 1rem',
              borderRadius: '14px',
              cursor: mejorando ? 'wait' : 'pointer',
              background:
                'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
              color: 'white',
              fontWeight: 800,
              fontSize: '.9rem',
              boxShadow: '0 10px 24px rgba(103,58,183,.20)',
              opacity: mejorando ? 0.7 : 1,
            }}
          >
            {mejorando
              ? '🧠 Organizando tus ideas...'
              : '✨ Mejorar contexto con IA'}
          </button>

          {contexto.mejoradoPorIA && (
            <div
              style={{
                marginTop: '.7rem',
                textAlign: 'center',
                fontSize: '.78rem',
                color: 'var(--accent-green)',
                fontWeight: 700,
              }}
            >
              ✓ Esta versión ya fue mejorada y validada por ti.
            </div>
          )}
        </Card>
      </div>

      {/* ACTION BAR */}
      <div
        style={{
          position: 'sticky',
          bottom: '1rem',
          zIndex: 5,
          marginTop: '1.4rem',
          padding: '.8rem',
          borderRadius: '20px',
          background: 'color-mix(in srgb, var(--bg-panel) 92%, transparent)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 14px 40px rgba(0,0,0,.12)',
          backdropFilter: 'blur(14px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ paddingLeft: '.4rem' }}>
          <strong
            style={{
              display: 'block',
              color: 'var(--text-main)',
              fontSize: '.88rem',
            }}
          >
            {badgeEstado.emoji} {badgeEstado.label}
          </strong>
          <span
            style={{
              color: 'var(--text-muted)',
              fontSize: '.75rem',
            }}
          >
            El contexto se guarda con tu usuario y estará disponible en otros
            dispositivos.
          </span>
        </div>

        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          style={{
            border: 'none',
            borderRadius: '14px',
            padding: '.85rem 1.25rem',
            background: 'var(--accent-blue)',
            color: 'white',
            cursor: guardando ? 'wait' : 'pointer',
            fontWeight: 800,
            minWidth: '190px',
            opacity: guardando ? 0.7 : 1,
          }}
        >
          {guardando ? 'Guardando...' : '💾 Guardar contexto'}
        </button>
      </div>

      {/* REVISIÓN IA */}
      {mostrarRevision && propuestaIA && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            background: 'rgba(10,15,30,.58)',
            backdropFilter: 'blur(7px)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              width: 'min(1050px, 96vw)',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '26px',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 30px 90px rgba(0,0,0,.25)',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.4rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '1rem',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <span
                  style={{
                    color: 'var(--accent-purple)',
                    fontSize: '.75rem',
                    fontWeight: 900,
                    letterSpacing: '.08em',
                  }}
                >
                  REVISIÓN ANTES DE GUARDAR
                </span>
                <h3
                  style={{
                    margin: '.25rem 0 0',
                    color: 'var(--text-main)',
                    fontSize: '1.35rem',
                  }}
                >
                  ✨ La IA organizó tus ideas
                </h3>
                <p
                  style={{
                    margin: '.35rem 0 0',
                    color: 'var(--text-muted)',
                    fontSize: '.85rem',
                  }}
                >
                  Tú decides si esta versión representa correctamente tu
                  realidad.
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
                  fontSize: '1rem',
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
                    'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '1rem',
                }}
              >
                <Comparacion
                  titulo="Cómo es la escuela"
                  original={contexto.campos.descripcionEscuela}
                  mejorado={propuestaIA.campos.descripcionEscuela}
                />
                <Comparacion
                  titulo="Infraestructura"
                  original={contexto.campos.infraestructura}
                  mejorado={propuestaIA.campos.infraestructura}
                />
                <Comparacion
                  titulo="Limitaciones"
                  original={contexto.campos.limitaciones}
                  mejorado={propuestaIA.campos.limitaciones}
                />
                <Comparacion
                  titulo="Comunidad"
                  original={contexto.campos.descripcionComunidad}
                  mejorado={propuestaIA.campos.descripcionComunidad}
                />
                <Comparacion
                  titulo="Actividades familiares y comunitarias"
                  original={
                    contexto.campos.actividadesFamiliaresComunitarias
                  }
                  mejorado={
                    propuestaIA.campos.actividadesFamiliaresComunitarias
                  }
                />
                <Comparacion
                  titulo="Situaciones relevantes"
                  original={contexto.campos.problematicasComunitarias}
                  mejorado={propuestaIA.campos.problematicasComunitarias}
                />
                <Comparacion
                  titulo="Fortalezas"
                  original={contexto.campos.fortalezasComunitarias}
                  mejorado={propuestaIA.campos.fortalezasComunitarias}
                />
                <Comparacion
                  titulo="Saberes comunitarios"
                  original={contexto.campos.saberesComunitarios}
                  mejorado={propuestaIA.campos.saberesComunitarios}
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
                  background: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  padding: '.8rem 1rem',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                Conservar mi versión
              </button>

              <button
                type="button"
                onClick={aceptarPropuestaIA}
                disabled={guardando}
                style={{
                  border: 'none',
                  background:
                    'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
                  color: 'white',
                  padding: '.8rem 1.15rem',
                  borderRadius: '12px',
                  cursor: guardando ? 'wait' : 'pointer',
                  fontWeight: 800,
                  minWidth: '220px',
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
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '24px',
        padding: '1.25rem',
        boxShadow: '0 8px 30px rgba(0,0,0,.035)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '.8rem',
          alignItems: 'flex-start',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '14px',
            display: 'grid',
            placeItems: 'center',
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
            flexShrink: 0,
            fontSize: '1.15rem',
          }}
        >
          {icono}
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '.5rem',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: '.68rem',
                fontWeight: 900,
                color,
                letterSpacing: '.08em',
              }}
            >
              PASO {numero}
            </span>
          </div>

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
              fontSize: '.8rem',
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
          fontWeight: 800,
          fontSize: '.84rem',
          marginBottom: '.25rem',
        }}
      >
        {etiqueta}
      </label>

      <p
        style={{
          margin: '0 0 .45rem',
          color: 'var(--text-muted)',
          fontSize: '.74rem',
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
          minHeight: '92px',
          resize: 'vertical',
          margin: 0,
          lineHeight: 1.5,
          boxSizing: 'border-box',
          borderRadius: '14px',
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
          background: 'var(--bg-panel)',
          borderBottom: '1px solid var(--border-color)',
          fontWeight: 800,
          color: 'var(--text-main)',
          fontSize: '.82rem',
        }}
      >
        {titulo}
      </div>

      <div style={{ padding: '.85rem' }}>
        <span
          style={{
            display: 'block',
            color: 'var(--text-muted)',
            fontSize: '.68rem',
            fontWeight: 900,
            letterSpacing: '.06em',
            marginBottom: '.25rem',
          }}
        >
          TÚ ESCRIBISTE
        </span>
        <p
          style={{
            margin: 0,
            color: 'var(--text-muted)',
            fontSize: '.8rem',
            lineHeight: 1.5,
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
            fontSize: '.68rem',
            fontWeight: 900,
            letterSpacing: '.06em',
            marginBottom: '.25rem',
          }}
        >
          AULA+ PROPONE
        </span>
        <p
          style={{
            margin: 0,
            color: 'var(--text-main)',
            fontSize: '.82rem',
            lineHeight: 1.55,
          }}
        >
          {mejorado || '—'}
        </p>
      </div>
    </div>
  );
}
