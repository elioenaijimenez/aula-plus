import { useState } from 'react';
import ChatIA from './ChatIA';
import PlaneadorDidactico from './PlaneadorDidactico';
import ContextoEscuela from './ContextoEscuela';
import ContextoGrupo from './ContextoGrupo';
import ProgramaAnalitico from './ProgramaAnalitico';

type VistaActiva =
  | 'escuela'
  | 'grupo'
  | 'programa'
  | 'planeacion'
  | 'consultas';

interface PasoRuta {
  id: VistaActiva;
  numero: string;
  titulo: string;
  subtitulo: string;
  icono: string;
  color: string;
}

const PASOS: PasoRuta[] = [
  {
    id: 'escuela',
    numero: '01',
    titulo: 'Escuela',
    subtitulo: 'Realidad escolar y comunitaria',
    icono: '🏫',
    color: '#1C51FF',
  },
  {
    id: 'grupo',
    numero: '02',
    titulo: 'Grupo',
    subtitulo: 'Diagnóstico y características',
    icono: '👥',
    color: '#22A447',
  },
  {
    id: 'programa',
    numero: '03',
    titulo: 'Programa Analítico',
    subtitulo: 'Contenidos, PDA y contextualización',
    icono: '📚',
    color: '#9C27B0',
  },
  {
    id: 'planeacion',
    numero: '04',
    titulo: 'Planeador',
    subtitulo: 'Diseña la intervención didáctica',
    icono: '✨',
    color: '#F97316',
  },
  {
    id: 'consultas',
    numero: '05',
    titulo: 'Asistente IA',
    subtitulo: 'Consulta y acompaña tu práctica',
    icono: '💬',
    color: '#607D8B',
  },
];

export default function ModuloIA({
  onVolver,
}: {
  onVolver?: () => void;
}) {
  const [vistaActiva, setVistaActiva] =
    useState<VistaActiva>('escuela');

  const pasoActual =
    PASOS.find((paso) => paso.id === vistaActiva) || PASOS[0];

  return (
    <div
      style={{
        animation: 'fadeIn 0.3s',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.2rem',
      }}
    >
      {/* CABECERA */}
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '30px',
          border: '1px solid var(--border-color)',
          background:
            'linear-gradient(135deg, rgba(28,81,255,.10), rgba(156,39,176,.09), rgba(249,115,22,.07))',
          padding: 'clamp(1.25rem, 3vw, 2.3rem)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '270px',
            height: '270px',
            borderRadius: '50%',
            right: '-100px',
            top: '-140px',
            background:
              'radial-gradient(circle, rgba(156,39,176,.19), transparent 68%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'absolute',
            width: '210px',
            height: '210px',
            borderRadius: '50%',
            left: '35%',
            bottom: '-170px',
            background:
              'radial-gradient(circle, rgba(28,81,255,.15), transparent 68%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1.3rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ maxWidth: '760px' }}>
            {onVolver && (
              <button
                onClick={onVolver}
                className="pill-btn"
                style={{
                  marginBottom: '1rem',
                  background: 'var(--bg-panel)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                  padding: '.45rem .8rem',
                }}
              >
                ← Volver al Inicio
              </button>
            )}

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '.45rem',
                padding: '.38rem .75rem',
                borderRadius: '999px',
                background: 'rgba(156,39,176,.09)',
                color: 'var(--accent-purple)',
                fontSize: '.73rem',
                fontWeight: 900,
                letterSpacing: '.06em',
                marginBottom: '.8rem',
              }}
            >
              ✦ AULA+ · DISEÑO DIDÁCTICO ASISTIDO
            </span>

            <h2
              style={{
                margin: 0,
                color: 'var(--text-main)',
                fontSize: 'clamp(1.8rem, 3.3vw, 2.7rem)',
                lineHeight: 1.04,
                letterSpacing: '-.04em',
              }}
            >
              Planea desde tu realidad,
              <br />
              no desde una plantilla genérica.
            </h2>

            <p
              style={{
                margin: '.9rem 0 0',
                maxWidth: '710px',
                color: 'var(--text-muted)',
                lineHeight: 1.65,
                fontSize: '.96rem',
              }}
            >
              Construye una sola vez la información que Aula+ necesita para
              conocer tu escuela y tus grupos. Después conviértela en decisiones
              curriculares, Programa Analítico y planeaciones personalizadas.
            </p>
          </div>

          <div
            style={{
              minWidth: '235px',
              maxWidth: '290px',
              borderRadius: '22px',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              padding: '1rem',
              boxShadow: '0 14px 38px rgba(0,0,0,.06)',
            }}
          >
            <span
              style={{
                display: 'block',
                color: 'var(--text-muted)',
                fontSize: '.69rem',
                fontWeight: 800,
                letterSpacing: '.05em',
                marginBottom: '.55rem',
              }}
            >
              ESTÁS TRABAJANDO EN
            </span>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '.7rem',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '14px',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '1.2rem',
                  background: `color-mix(in srgb, ${pasoActual.color} 11%, transparent)`,
                }}
              >
                {pasoActual.icono}
              </div>

              <div>
                <strong
                  style={{
                    display: 'block',
                    color: 'var(--text-main)',
                    fontSize: '.92rem',
                  }}
                >
                  {pasoActual.titulo}
                </strong>

                <span
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '.72rem',
                    lineHeight: 1.35,
                  }}
                >
                  {pasoActual.subtitulo}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RUTA CURRICULAR */}
      <section
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: '24px',
          padding: '.8rem',
          boxShadow: '0 8px 28px rgba(0,0,0,.035)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '.55rem',
            overflowX: 'auto',
            padding: '.1rem',
            scrollbarWidth: 'thin',
          }}
        >
          {PASOS.map((paso, index) => {
            const activo = vistaActiva === paso.id;

            return (
              <div
                key={paso.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flex: '1 0 190px',
                  minWidth: '190px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setVistaActiva(paso.id)}
                  style={{
                    width: '100%',
                    minHeight: '78px',
                    borderRadius: '18px',
                    border: activo
                      ? `1px solid color-mix(in srgb, ${paso.color} 45%, var(--border-color))`
                      : '1px solid transparent',
                    background: activo
                      ? `color-mix(in srgb, ${paso.color} 9%, var(--bg-input))`
                      : 'transparent',
                    cursor: 'pointer',
                    padding: '.75rem',
                    textAlign: 'left',
                    transition: 'all .2s ease',
                  }}
                  className="aula-ruta-btn"
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '.7rem',
                    }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '12px',
                        flexShrink: 0,
                        display: 'grid',
                        placeItems: 'center',
                        background: activo
                          ? `color-mix(in srgb, ${paso.color} 15%, transparent)`
                          : 'var(--bg-input)',
                        fontSize: '1.05rem',
                      }}
                    >
                      {paso.icono}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          color: paso.color,
                          fontSize: '.62rem',
                          fontWeight: 900,
                          letterSpacing: '.07em',
                          marginBottom: '.12rem',
                        }}
                      >
                        PASO {paso.numero}
                      </span>

                      <strong
                        style={{
                          display: 'block',
                          color: activo
                            ? 'var(--text-main)'
                            : 'var(--text-muted)',
                          fontSize: '.82rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {paso.titulo}
                      </strong>
                    </div>
                  </div>
                </button>

                {index < PASOS.length - 1 && (
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      margin: '0 .18rem',
                      color: 'var(--border-color)',
                      fontWeight: 900,
                      fontSize: '1rem',
                    }}
                  >
                    ›
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* CONTENIDO */}
      <section
        style={{
          flex: 1,
          minHeight: '520px',
        }}
      >
        {vistaActiva === 'escuela' && <ContextoEscuela />}

        {vistaActiva === 'grupo' && <ContextoGrupo />}

        {vistaActiva === 'programa' && <ProgramaAnalitico />}

        {vistaActiva === 'planeacion' && (
          <div style={{ animation: 'fadeIn .25s ease' }}>
            <AvisoTransicionPlaneador />
            <PlaneadorDidactico />
          </div>
        )}

        {vistaActiva === 'consultas' && (
          <div style={{ animation: 'fadeIn .25s ease' }}>
            <ChatIA />
          </div>
        )}
      </section>

      <style>{`
        .aula-ruta-btn:hover {
          transform: translateY(-1px);
          background: var(--bg-input) !important;
        }

        @media (max-width: 720px) {
          .aula-ruta-btn {
            min-height: 70px !important;
          }
        }
      `}</style>
    </div>
  );
}

function AvisoTransicionPlaneador() {
  return (
    <div
      style={{
        marginBottom: '1rem',
        padding: '1rem 1.1rem',
        borderRadius: '18px',
        border: '1px solid rgba(249,115,22,.18)',
        background: 'rgba(249,115,22,.07)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '.8rem',
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
          background: 'rgba(249,115,22,.10)',
        }}
      >
        🛠️
      </div>

      <div>
        <strong
          style={{
            display: 'block',
            color: 'var(--text-main)',
            fontSize: '.84rem',
            marginBottom: '.2rem',
          }}
        >
          Planeador actual en transición
        </strong>

        <p
          style={{
            margin: 0,
            color: 'var(--text-muted)',
            fontSize: '.76rem',
            lineHeight: 1.5,
          }}
        >
          El Programa Analítico ya está conectado. El siguiente cambio será
          transformar este Planeador para que obligatoriamente utilice el grupo
          activo, su contexto y los Contenidos/PDA guardados, eliminando el
          contexto genérico.
        </p>
      </div>
    </div>
  );
}
