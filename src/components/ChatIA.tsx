import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  FormEvent,
  MouseEvent,
} from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import TutorialTooltip from './TutorialTooltip';

import type {
  ContextoEscuela,
  ContextoGrupo,
  ProgramaAnaliticoGrupo,
} from '../services/planeacionContextService';

import {
  cargarContextoEscuela,
  cargarContextoGrupo,
  cargarProgramaAnalitico,
  obtenerCorreoSesion,
} from '../services/planeacionContextService';

interface Mensaje {
  rol: 'user' | 'ia';
  texto: string;
}

interface GrupoInfo {
  id: string;
  name: string;
  grade: string;
  subject: string;
  emphasis?: string;
  docenteEmail?: string;
}

interface MemoriaEscolar {
  escuela: string;
  ubicacion: string;
  docente: string;
  revisor: string;
}

interface ChatGuardado {
  id: string;
  titulo: string;
  mensajes: Mensaje[];
  updatedAt: any;
  groupId?: string;
  groupName?: string;
}

export default function ChatIA() {
  const [userEmail, setUserEmail] = useState('');
  const [docenteNombre, setDocenteNombre] =
    useState('Colega Docente');

  const [memoria, setMemoria] =
    useState<MemoriaEscolar>({
      escuela: 'Escuela Secundaria',
      ubicacion: 'México',
      docente: 'Docente',
      revisor: 'Dirección',
    });

  const [grupos, setGrupos] =
    useState<GrupoInfo[]>([]);
  const [grupoSeleccionado, setGrupoSeleccionado] =
    useState('');

  const [contextoEscuela, setContextoEscuela] =
    useState<ContextoEscuela | null>(null);

  const [contextoGrupo, setContextoGrupo] =
    useState<ContextoGrupo | null>(null);

  const [programa, setPrograma] =
    useState<ProgramaAnaliticoGrupo | null>(null);

  const [cargandoInicial, setCargandoInicial] =
    useState(true);
  const [cargandoGrupo, setCargandoGrupo] =
    useState(false);

  const [mensajes, setMensajes] =
    useState<Mensaje[]>([]);
  const [objetivo, setObjetivo] = useState('');
  const [escribiendo, setEscribiendo] =
    useState(false);

  const [historial, setHistorial] =
    useState<ChatGuardado[]>([]);
  const [chatActivoId, setChatActivoId] =
    useState<string | null>(null);
  const [
    menuHistorialAbierto,
    setMenuHistorialAbierto,
  ] = useState(false);

  const [mensajeSistema, setMensajeSistema] =
    useState('');

  const mensajesEndRef =
    useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    mensajesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensajes, escribiendo]);

  const grupoActivo = useMemo(
    () =>
      grupos.find(
        (grupo) =>
          grupo.id === grupoSeleccionado
      ) || null,
    [grupos, grupoSeleccionado]
  );

  const contextoEscuelaListo =
    contextoEscuela?.estado === 'listo' ||
    contextoEscuela?.estado === 'optimizado';

  const contextoGrupoListo =
    contextoGrupo?.estado === 'listo' ||
    contextoGrupo?.estado === 'optimizado';

  const programaDisponible =
    Boolean(programa) &&
    Boolean(programa?.contenidos?.length);

  const contextoCompleto =
    Boolean(grupoActivo) &&
    contextoEscuelaListo &&
    contextoGrupoListo &&
    programaDisponible;

  const cargarHistorialNube = async (
    email: string
  ) => {
    try {
      const qHistorial = query(
        collection(db, 'teacher_chats'),
        where('docenteEmail', '==', email)
      );

      const snapHistorial =
        await getDocs(qHistorial);

      const listaHistorial: ChatGuardado[] = [];

      snapHistorial.forEach((d) => {
        listaHistorial.push({
          id: d.id,
          ...d.data(),
        } as ChatGuardado);
      });

      listaHistorial.sort((a, b) => {
        const timeA =
          a.updatedAt?.seconds || 0;
        const timeB =
          b.updatedAt?.seconds || 0;

        return timeB - timeA;
      });

      setHistorial(
        listaHistorial.slice(0, 20)
      );
    } catch (error) {
      console.error(
        'Error al cargar historial:',
        error
      );
    }
  };

  useEffect(() => {
    const inicializar = async () => {
      const email = obtenerCorreoSesion();
      setUserEmail(email);

      const sessionLocal =
        localStorage.getItem('aulaPlusSession');

      const sessionData = sessionLocal
        ? JSON.parse(sessionLocal)
        : null;

      let nombre =
        sessionData?.user?.nombre ||
        'Docente';

      try {
        const [snapGrupos, docMemoria] =
          await Promise.all([
            getDocs(
              query(
                collection(db, 'groups'),
                where(
                  'docenteEmail',
                  '==',
                  email
                )
              )
            ),
            getDoc(
              doc(
                db,
                'teacher_settings',
                email
              )
            ),
          ]);

        const lista: GrupoInfo[] = [];

        snapGrupos.forEach((d) => {
          const data = d.data();

          lista.push({
            id: d.id,
            name:
              data.name ||
              'Grupo sin nombre',
            grade: data.grade || '',
            subject: data.subject || '',
            emphasis:
              data.emphasis || '',
            docenteEmail:
              data.docenteEmail || email,
          });
        });

        lista.sort((a, b) =>
          `${a.grade}-${a.name}`.localeCompare(
            `${b.grade}-${b.name}`,
            'es'
          )
        );

        setGrupos(lista);

        let datosMemoria: MemoriaEscolar =
          {
            escuela:
              'Escuela Secundaria',
            ubicacion: 'México',
            docente: nombre,
            revisor: 'Dirección',
          };

        if (
          docMemoria.exists() &&
          docMemoria.data().memoriaEscolar
        ) {
          const m =
            docMemoria.data()
              .memoriaEscolar;

          datosMemoria = {
            escuela:
              m.escuela || 'Escuela',
            ubicacion:
              m.ubicacion || 'México',
            docente:
              m.docente ||
              nombre ||
              'Docente',
            revisor:
              m.revisor || 'Dirección',
          };

          if (m.docente) {
            nombre = m.docente;
          }
        }

        setMemoria(datosMemoria);
        setDocenteNombre(nombre);

        setMensajes([
          {
            rol: 'ia',
            texto:
              `¡Hola, ${nombre}! 🧠\n\nSoy tu asistente pedagógico Aula+. ` +
              `Selecciona un grupo para que pueda consultar su contexto y Programa Analítico antes de responderte.`,
          },
        ]);

        await cargarHistorialNube(
          email
        );
      } catch (error) {
        console.error(
          'Error al iniciar ChatIA:',
          error
        );

        setMensajeSistema(
          'No fue posible cargar toda la información del asistente.'
        );
      } finally {
        setCargandoInicial(false);
      }
    };

    inicializar();
  }, []);

  const cargarDatosGrupo = async (
    groupId: string
  ) => {
    if (!groupId || !userEmail) {
      setContextoEscuela(null);
      setContextoGrupo(null);
      setPrograma(null);
      return;
    }

    setCargandoGrupo(true);
    setMensajeSistema('');

    try {
      const [
        escuela,
        grupo,
        programaGuardado,
      ] = await Promise.all([
        cargarContextoEscuela(
          userEmail
        ),
        cargarContextoGrupo(
          userEmail,
          groupId
        ),
        cargarProgramaAnalitico(
          userEmail,
          groupId
        ),
      ]);

      setContextoEscuela(escuela);
      setContextoGrupo(grupo);
      setPrograma(programaGuardado);
    } catch (error) {
      console.error(
        'Error al cargar contexto del grupo:',
        error
      );

      setMensajeSistema(
        'No fue posible cargar todo el contexto del grupo. El asistente no inventará los datos faltantes.'
      );
    } finally {
      setCargandoGrupo(false);
    }
  };

  const saludoGrupo = (
    nombreGrupo?: string
  ) => {
    const nombre =
      docenteNombre || 'Docente';

    if (!nombreGrupo) {
      return (
        `¡Hola, ${nombre}! 🧠\n\n` +
        'Selecciona un grupo antes de comenzar una consulta contextualizada.'
      );
    }

    return (
      `Listo, ${nombre}. 🎓\n\n` +
      `Ahora estoy trabajando con **${nombreGrupo}**. ` +
      'Consultaré únicamente la información de este grupo, su contexto y su Programa Analítico. ¿En qué te ayudo?'
    );
  };

  const iniciarNuevaConversacion = (
    nombreGrupo?: string
  ) => {
    setChatActivoId(null);

    setMensajes([
      {
        rol: 'ia',
        texto: saludoGrupo(
          nombreGrupo ||
            grupoActivo?.name
        ),
      },
    ]);

    setObjetivo('');
    setMenuHistorialAbierto(false);
  };

  const cambiarGrupo = async (
    groupId: string
  ) => {
    setGrupoSeleccionado(groupId);

    if (!groupId) {
      setContextoEscuela(null);
      setContextoGrupo(null);
      setPrograma(null);
      iniciarNuevaConversacion('');
      return;
    }

    const grupo = grupos.find(
      (item) => item.id === groupId
    );

    await cargarDatosGrupo(groupId);

    setChatActivoId(null);
    setMensajes([
      {
        rol: 'ia',
        texto: saludoGrupo(
          grupo?.name || 'este grupo'
        ),
      },
    ]);
  };

  const cargarConversacionPrevia =
    async (chat: ChatGuardado) => {
      setMenuHistorialAbierto(false);
      setMensajeSistema('');

      if (chat.groupId) {
        setGrupoSeleccionado(
          chat.groupId
        );

        await cargarDatosGrupo(
          chat.groupId
        );
      } else {
        setGrupoSeleccionado('');
        setContextoGrupo(null);
        setPrograma(null);

        setMensajeSistema(
          'Esta conversación fue creada antes del nuevo sistema por grupos. Puedes leerla, pero selecciona un grupo antes de continuarla.'
        );
      }

      setChatActivoId(chat.id);
      setMensajes(
        Array.isArray(chat.mensajes)
          ? chat.mensajes
          : []
      );
    };

  const eliminarChat = async (
    idChat: string,
    e: MouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();

    if (
      !window.confirm(
        '¿Seguro que deseas eliminar esta conversación permanentemente?'
      )
    ) {
      return;
    }

    try {
      await deleteDoc(
        doc(
          db,
          'teacher_chats',
          idChat
        )
      );

      setHistorial((prev) =>
        prev.filter(
          (chat) =>
            chat.id !== idChat
        )
      );

      if (chatActivoId === idChat) {
        iniciarNuevaConversacion();
      }
    } catch (error) {
      console.error(
        'Error al eliminar chat:',
        error
      );

      alert(
        'No fue posible eliminar la conversación.'
      );
    }
  };

  const construirContexto = () => {
    if (!grupoActivo) {
      return '';
    }

    const programaResumido = {
      estado:
        programa?.estado ||
        'no_disponible',

      problematicasPriorizadas:
        programa?.problematicasPriorizadas ||
        [],

      horizonteFormativo:
        programa?.horizonteFormativo ||
        '',

      orientacionesDidacticas:
        programa
          ?.orientacionesDidacticasGenerales ||
        '',

      orientacionesEvaluacion:
        programa
          ?.orientacionesEvaluacion ||
        '',

      contenidos:
        programa?.contenidos.map(
          (contenido) => ({
            contenidoOficial:
              contenido.textoOficial,

            pda: contenido.pda.map(
              (pda) => ({
                textoOficial:
                  pda.textoOficial,

                contextualizacion:
                  pda.contextualizacion,

                ejes:
                  pda.ejesArticuladores,

                problematicas:
                  pda.problematicasRelacionadas,

                temporalidad:
                  pda.temporalidad,
              })
            ),
          })
        ) || [],

      contenidosCodisenados:
        programa?.contenidosCodisenados.map(
          (item) => ({
            tipo:
              'CONTENIDO LOCAL CODISEÑADO',
            contenidoLocal:
              item.contenidoLocal,
            pdaLocal:
              item.pdaLocal,
            justificacion:
              item.justificacion,
            relacionConContenidosNacionales:
              item.relacionConContenidosNacionales,
          })
        ) || [],
    };

    return `
[IDENTIDAD DEL DOCENTE]
- Docente: ${memoria.docente}
- Escuela: ${memoria.escuela}
- Ubicación: ${memoria.ubicacion}
- Nivel: Educación Secundaria

[GRUPO ACTIVO]
- Grupo: ${grupoActivo.name}
- Grado: ${grupoActivo.grade}
- Disciplina: ${grupoActivo.subject}
- Énfasis: ${grupoActivo.emphasis || 'No aplica'}

[CONTEXTO DE ESCUELA Y COMUNIDAD]
${JSON.stringify(
  {
    estado:
      contextoEscuela?.estado ||
      'no_registrado',

    descripcion:
      contextoEscuela?.campos
        .descripcionEscuela || '',

    infraestructura:
      contextoEscuela?.campos
        .infraestructura || '',

    recursos:
      contextoEscuela?.campos
        .recursosDisponibles || [],

    limitaciones:
      contextoEscuela?.campos
        .limitaciones || '',

    comunidad:
      contextoEscuela?.campos
        .descripcionComunidad || '',

    actividadesFamiliaresComunitarias:
      contextoEscuela?.campos
        .actividadesFamiliaresComunitarias ||
      '',

    problematicas:
      contextoEscuela?.campos
        .problematicasComunitarias || '',

    fortalezas:
      contextoEscuela?.campos
        .fortalezasComunitarias || '',

    saberes:
      contextoEscuela?.campos
        .saberesComunitarios || '',
  },
  null,
  2
)}

[CONTEXTO ESPECÍFICO DEL GRUPO]
${JSON.stringify(
  {
    estado:
      contextoGrupo?.estado ||
      'no_registrado',

    descripcion:
      contextoGrupo?.campos
        .descripcionGeneral || '',

    saberesPrevios:
      contextoGrupo?.campos
        .saberesPrevios || '',

    dificultades:
      contextoGrupo?.campos
        .dificultades || '',

    fortalezas:
      contextoGrupo?.campos
        .fortalezas || '',

    intereses:
      contextoGrupo?.campos
        .intereses || '',

    ritmo:
      contextoGrupo?.campos
        .ritmoTrabajo || '',

    formaTrabajo:
      contextoGrupo?.campos
        .formaTrabajo || '',

    diagnostico:
      contextoGrupo?.campos
        .diagnostico || '',

    apoyos:
      contextoGrupo?.campos
        .diversidadYApoyos || '',

    participacion:
      contextoGrupo?.campos
        .preferenciasParticipacion ||
      '',

    observaciones:
      contextoGrupo?.campos
        .observaciones || '',
  },
  null,
  2
)}

[PROGRAMA ANALÍTICO DEL GRUPO]
${JSON.stringify(
  programaResumido,
  null,
  2
)}

[REGLAS DEL ASISTENTE]
1. Responde para el GRUPO ACTIVO. No mezcles información de otros grupos.
2. Usa la información guardada como contexto; si un dato no está registrado, dilo y NO lo inventes.
3. Distingue siempre entre:
   a) Contenidos/PDA oficiales capturados por el docente.
   b) Contextualizaciones.
   c) Contenidos locales codiseñados.
4. Nunca presentes un contenido local codiseñado como si fuera un referente oficial.
5. No inventes Contenidos o PDA oficiales.
6. No cambies el sentido de un Contenido/PDA cuando el docente te pida trabajar con uno ya registrado.
7. No diagnostiques estudiantes ni deduzcas condiciones médicas.
8. Describe necesidades del alumnado de forma funcional, respetuosa y pedagógica.
9. Respeta infraestructura, limitaciones, tiempos y recursos reales.
10. Si la consulta no requiere usar el Programa Analítico, no lo fuerces.
11. Si propones una metodología, justifica brevemente por qué es pertinente para la consulta.
12. Cuando ayude, termina con una sección breve "💡 Aplicación en ${grupoActivo.name}".
13. Si el docente pregunta por otro grupo, indícale que debe cambiar el grupo activo para evitar mezclar contextos.
`.trim();
  };

  const construirHistorialReciente = (
    mensajesActuales: Mensaje[]
  ) => {
    const recientes =
      mensajesActuales.slice(-12);

    return recientes
      .map((mensaje) => {
        const rol =
          mensaje.rol === 'user'
            ? 'DOCENTE'
            : 'ASISTENTE';

        return `[${rol}]\n${mensaje.texto}`;
      })
      .join('\n\n');
  };

  const enviarMensaje = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!objetivo.trim()) return;

    if (!grupoActivo) {
      setMensajeSistema(
        'Selecciona primero un grupo para evitar respuestas genéricas o mezcla de contextos.'
      );
      return;
    }

    const textoUsuario =
      objetivo.trim();

    const nuevosMensajes: Mensaje[] = [
      ...mensajes,
      {
        rol: 'user',
        texto: textoUsuario,
      },
    ];

    setMensajes(nuevosMensajes);
    setObjetivo('');
    setEscribiendo(true);
    setMensajeSistema('');

    try {
      const apiKey =
        import.meta.env
          .VITE_GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error(
          'No existe VITE_GEMINI_API_KEY.'
        );
      }

      const contexto =
        construirContexto();

      const historialReciente =
        construirHistorialReciente(
          nuevosMensajes.slice(0, -1)
        );

      const promptCompleto = `
${contexto}

[HISTORIAL RECIENTE DE ESTA CONVERSACIÓN]
${
  historialReciente ||
  'No hay mensajes previos relevantes.'
}

[NUEVA CONSULTA DEL DOCENTE]
${textoUsuario}

Responde directamente a la consulta actual. Mantén continuidad con el historial cuando sea relevante y prioriza la información real del grupo activo.
`.trim();

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text:
                      promptCompleto,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.3,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Gemini respondió ${response.status}`
        );
      }

      const data =
        await response.json();

      const textoIA =
        data?.candidates?.[0]
          ?.content?.parts?.[0]
          ?.text ||
        '⚠️ No fue posible recuperar una respuesta completa.';

      const mensajesFinales: Mensaje[] =
        [
          ...nuevosMensajes,
          {
            rol: 'ia',
            texto: textoIA,
          },
        ];

      setMensajes(mensajesFinales);

      if (!chatActivoId) {
        const nuevoDoc =
          await addDoc(
            collection(
              db,
              'teacher_chats'
            ),
            {
              docenteEmail:
                userEmail,

              groupId:
                grupoActivo.id,

              groupName:
                grupoActivo.name,

              titulo:
                textoUsuario.substring(
                  0,
                  45
                ) +
                (textoUsuario.length >
                45
                  ? '...'
                  : ''),

              mensajes:
                mensajesFinales,

              updatedAt:
                serverTimestamp(),
            }
          );

        setChatActivoId(
          nuevoDoc.id
        );
      } else {
        await updateDoc(
          doc(
            db,
            'teacher_chats',
            chatActivoId
          ),
          {
            mensajes:
              mensajesFinales,

            groupId:
              grupoActivo.id,

            groupName:
              grupoActivo.name,

            updatedAt:
              serverTimestamp(),
          }
        );
      }

      await cargarHistorialNube(
        userEmail
      );
    } catch (error) {
      console.error(
        'Error al conectar con IA:',
        error
      );

      setMensajes((prev) => [
        ...prev,
        {
          rol: 'ia',
          texto:
            '⚠️ No se pudo establecer conexión con el asistente pedagógico.',
        },
      ]);
    } finally {
      setEscribiendo(false);
    }
  };

  const copiarPortapapeles = (
    texto: string
  ) => {
    navigator.clipboard.writeText(
      texto
    );

    alert(
      '📋 Respuesta copiada al portapapeles.'
    );
  };

  const exportarChatPDF = () => {
    if (mensajes.length <= 1) {
      alert(
        'No hay suficientes mensajes para exportar.'
      );
      return;
    }

    const historialHtml =
      mensajes
        .map((mensaje) => {
          const remitente =
            mensaje.rol === 'user'
              ? `<b>${memoria.docente} (Docente):</b>`
              : `<b>Asistente Pedagógico Aula+:</b>`;

          const contenido =
            mensaje.texto
              .replace(
                /\*\*(.*?)\*\*/g,
                '<b>$1</b>'
              )
              .replace(
                /\*(.*?)\*/g,
                '<i>$1</i>'
              )
              .replace(
                /\n/g,
                '<br/>'
              );

          const estilo =
            mensaje.rol === 'user'
              ? 'background-color:#f0f4ff;border-left:4px solid #1c51ff;'
              : 'background-color:#f9fafb;border-left:4px solid #8b5cf6;';

          return `
<div style="margin-bottom:20px;padding:15px;${estilo}font-size:12pt;line-height:1.6;border-radius:8px;">
  <div style="margin-bottom:8px;color:#333;font-size:11pt;">${remitente}</div>
  <div>${contenido}</div>
</div>`;
        })
        .join('');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Consulta Pedagógica IA</title>
<style>
body{
  font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
  font-size:12pt;
  color:#333;
  padding:40px;
  max-width:800px;
  margin:0 auto;
}
table{
  width:100%;
  border-collapse:collapse;
  margin-bottom:30px;
  font-size:11pt;
}
td{
  border:1px solid #ddd;
  padding:10px;
}
.title{
  text-align:center;
  font-size:18pt;
  font-weight:bold;
  margin-bottom:20px;
  color:#1c51ff;
  text-transform:uppercase;
  letter-spacing:1px;
}
.signatures td{
  border:none;
  text-align:center;
  padding-top:70px;
  width:50%;
  font-size:11pt;
}
@media print{
  body{padding:0;}
}
</style>
</head>
<body>
<div class="title">REPORTE DE CONSULTA PEDAGÓGICA (IA)</div>

<table>
<tr>
  <td><b>Escuela:</b> ${memoria.escuela}</td>
  <td><b>Ubicación:</b> ${memoria.ubicacion}</td>
</tr>
<tr>
  <td><b>Docente:</b> ${memoria.docente}</td>
  <td><b>Fecha:</b> ${new Date().toLocaleDateString()}</td>
</tr>
<tr>
  <td><b>Grupo consultado:</b> ${grupoActivo?.name || 'No especificado'}</td>
  <td><b>Disciplina:</b> ${grupoActivo?.subject || 'No especificada'}</td>
</tr>
</table>

<div style="margin-top:30px;">
${historialHtml}
</div>

<table class="signatures">
<tr>
<td>
___________________________
<br/><br/>
<b>Docente</b>
<br/>
${memoria.docente}
</td>
<td>
___________________________
<br/><br/>
<b>Sello / Revisa</b>
<br/>
${memoria.revisor}
</td>
</tr>
</table>

<script>
window.onload=function(){
  window.print();
}
</script>
</body>
</html>`;

    const printWindow =
      window.open('', '_blank');

    if (printWindow) {
      printWindow.document.write(
        htmlContent
      );
      printWindow.document.close();
    } else {
      alert(
        'Tu navegador bloqueó la ventana emergente. Permítela para generar el documento.'
      );
    }
  };

  if (cargandoInicial) {
    return (
      <div
        style={{
          minHeight: '520px',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div
          className="loader"
          style={{
            width: '52px',
            height: '52px',
          }}
        />
      </div>
    );
  }

  if (grupos.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '4rem 1.5rem',
          background:
            'var(--bg-panel)',
          borderRadius: '24px',
          border:
            '2px dashed var(--accent-red)',
          animation:
            'fadeIn 0.4s',
        }}
      >
        <span
          style={{
            fontSize: '4rem',
            display: 'block',
            marginBottom: '1rem',
          }}
        >
          👥
        </span>

        <h2
          style={{
            color:
              'var(--text-main)',
          }}
        >
          Primero crea un grupo
        </h2>

        <p
          style={{
            color:
              'var(--text-muted)',
            maxWidth: '600px',
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          El nuevo asistente trabaja
          por grupo para evitar mezclar
          diagnósticos, contextos y
          referentes curriculares.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background:
          'var(--bg-app)',
        borderRadius: '24px',
        border:
          '1px solid var(--border-color)',
        height: '74vh',
        minHeight: '590px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* HISTORIAL */}
      {menuHistorialAbierto && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: '100%',
            maxWidth: '360px',
            background:
              'var(--bg-panel)',
            zIndex: 20,
            borderRight:
              '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow:
              '5px 0 25px rgba(0,0,0,.08)',
          }}
        >
          <div
            style={{
              padding: '1.2rem',
              borderBottom:
                '1px solid var(--border-color)',
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <strong
                style={{
                  display:
                    'block',
                  color:
                    'var(--text-main)',
                }}
              >
                Tus consultas
              </strong>

              <span
                style={{
                  color:
                    'var(--text-muted)',
                  fontSize:
                    '.7rem',
                }}
              >
                Historial reciente
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setMenuHistorialAbierto(
                  false
                )
              }
              style={{
                border: 'none',
                background:
                  'var(--bg-input)',
                color:
                  'var(--text-muted)',
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              padding: '1rem',
            }}
          >
            <button
              type="button"
              onClick={() =>
                iniciarNuevaConversacion()
              }
              className="pill-btn"
              style={{
                width: '100%',
                background:
                  'var(--accent-purple)',
                color: 'white',
                fontWeight: 800,
              }}
            >
              + Nueva conversación
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding:
                '0 1rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '.65rem',
            }}
          >
            {historial.length === 0 ? (
              <p
                style={{
                  textAlign: 'center',
                  color:
                    'var(--text-muted)',
                  fontSize:
                    '.8rem',
                  marginTop: '2rem',
                }}
              >
                No hay chats recientes.
              </p>
            ) : (
              historial.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() =>
                    cargarConversacionPrevia(
                      chat
                    )
                  }
                  style={{
                    padding:
                      '.75rem',
                    background:
                      chatActivoId ===
                      chat.id
                        ? 'rgba(28,81,255,.08)'
                        : 'var(--bg-input)',
                    borderRadius:
                      '13px',
                    cursor: 'pointer',
                    border:
                      chatActivoId ===
                      chat.id
                        ? '1px solid rgba(28,81,255,.28)'
                        : '1px solid var(--border-color)',
                    display: 'flex',
                    gap: '.6rem',
                    alignItems:
                      'center',
                  }}
                >
                  <div
                    style={{
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        color:
                          'var(--text-main)',
                        fontWeight:
                          800,
                        fontSize:
                          '.76rem',
                        overflow:
                          'hidden',
                        textOverflow:
                          'ellipsis',
                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      💬 {chat.titulo}
                    </p>

                    <span
                      style={{
                        display:
                          'block',
                        marginTop:
                          '.2rem',
                        color:
                          chat.groupName
                            ? 'var(--accent-blue)'
                            : 'var(--text-muted)',
                        fontSize:
                          '.64rem',
                      }}
                    >
                      {chat.groupName
                        ? `🎓 ${chat.groupName}`
                        : '◌ Conversación anterior sin grupo'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) =>
                      eliminarChat(
                        chat.id,
                        e
                      )
                    }
                    style={{
                      border: 'none',
                      background:
                        'transparent',
                      color:
                        'var(--accent-red)',
                      cursor:
                        'pointer',
                      fontSize:
                        '1rem',
                    }}
                    title="Eliminar chat"
                  >
                    🗑
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* CABECERA */}
      <div
        style={{
          padding: '.9rem 1rem',
          borderBottom:
            '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent:
            'space-between',
          background:
            'var(--bg-panel)',
          flexWrap: 'wrap',
          gap: '.75rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '.7rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() =>
              setMenuHistorialAbierto(
                true
              )
            }
            className="pill-btn"
            style={{
              padding:
                '.48rem .75rem',
              background:
                'var(--bg-input)',
              color:
                'var(--text-main)',
              border:
                '1px solid var(--border-color)',
            }}
          >
            ☰ Historial
          </button>

          <div
            style={{
              display: 'flex',
              alignItems:
                'center',
              gap: '.55rem',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                display: 'grid',
                placeItems:
                  'center',
                borderRadius:
                  '13px',
                background:
                  'linear-gradient(135deg,rgba(156,39,176,.10),rgba(28,81,255,.08))',
              }}
            >
              🎓
            </div>

            <div>
              <strong
                style={{
                  display:
                    'block',
                  color:
                    'var(--text-main)',
                  fontSize:
                    '.87rem',
                }}
              >
                Asistente Aula+
              </strong>

              <span
                style={{
                  display:
                    'inline-block',
                  marginTop:
                    '.1rem',
                  fontSize:
                    '.65rem',
                  fontWeight:
                    800,
                  color:
                    contextoCompleto
                      ? 'var(--accent-green)'
                      : grupoActivo
                        ? '#F97316'
                        : 'var(--text-muted)',
                }}
              >
                {contextoCompleto
                  ? '✨ Contexto curricular completo'
                  : grupoActivo
                    ? '◐ Contexto parcial'
                    : '○ Selecciona un grupo'}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '.55rem',
            flexWrap: 'wrap',
          }}
        >
          <select
            className="search-input"
            value={grupoSeleccionado}
            onChange={(e) =>
              cambiarGrupo(
                e.target.value
              )
            }
            disabled={cargandoGrupo}
            style={{
              width: 'min(280px,70vw)',
              margin: 0,
              borderRadius:
                '12px',
              cursor:
                cargandoGrupo
                  ? 'wait'
                  : 'pointer',
              fontSize:
                '.78rem',
            }}
          >
            <option value="">
              — Grupo para consultar —
            </option>

            {grupos.map((grupo) => (
              <option
                key={grupo.id}
                value={grupo.id}
              >
                {grupo.name} ·{' '}
                {grupo.subject}
                {grupo.emphasis
                  ? ` · ${grupo.emphasis}`
                  : ''}
              </option>
            ))}
          </select>

          <TutorialTooltip
            mensaje="Genera un reporte imprimible de esta consulta incluyendo el grupo con el que trabajaste."
            posicion="left"
          >
            <button
              type="button"
              onClick={exportarChatPDF}
              className="pill-btn"
              style={{
                fontSize:
                  '.76rem',
                padding:
                  '.5rem .75rem',
                background:
                  'var(--accent-blue)',
                color: 'white',
                border: 'none',
                fontWeight:
                  800,
              }}
            >
              📄 Exportar
            </button>
          </TutorialTooltip>
        </div>
      </div>

      {/* ESTADO DE CONTEXTO */}
      {grupoActivo && (
        <div
          style={{
            padding:
              '.55rem .9rem',
            borderBottom:
              '1px solid var(--border-color)',
            background:
              'color-mix(in srgb,var(--bg-panel) 82%,transparent)',
            display: 'flex',
            alignItems:
              'center',
            gap: '.45rem',
            flexWrap:
              'wrap',
          }}
        >
          <MiniEstado
            icono="🏫"
            texto="Escuela"
            listo={
              contextoEscuelaListo
            }
          />

          <MiniEstado
            icono="👥"
            texto="Grupo"
            listo={
              contextoGrupoListo
            }
          />

          <MiniEstado
            icono="📚"
            texto="Programa Analítico"
            listo={
              programaDisponible
            }
          />

          <span
            style={{
              marginLeft:
                'auto',
              color:
                'var(--text-muted)',
              fontSize:
                '.65rem',
            }}
          >
            {cargandoGrupo
              ? 'Cargando contexto...'
              : `${grupoActivo.name} · ${grupoActivo.subject}`}
          </span>
        </div>
      )}

      {mensajeSistema && (
        <div
          style={{
            margin:
              '.7rem .9rem 0',
            padding:
              '.7rem .85rem',
            borderRadius:
              '12px',
            background:
              'rgba(249,115,22,.07)',
            border:
              '1px solid rgba(249,115,22,.15)',
            color:
              'var(--text-main)',
            fontSize:
              '.72rem',
            lineHeight: 1.45,
          }}
        >
          {mensajeSistema}
        </div>
      )}

      {/* MENSAJES */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          background:
            'var(--bg-app)',
        }}
      >
        {mensajes.map(
          (mensaje, index) => (
            <div
              key={index}
              style={{
                alignSelf:
                  mensaje.rol ===
                  'user'
                    ? 'flex-end'
                    : 'flex-start',
                maxWidth: '86%',
              }}
            >
              <div
                style={{
                  fontSize:
                    '.68rem',
                  color:
                    'var(--text-muted)',
                  marginBottom:
                    '.3rem',
                  marginLeft:
                    '.45rem',
                  textAlign:
                    mensaje.rol ===
                    'user'
                      ? 'right'
                      : 'left',
                  fontWeight:
                    800,
                }}
              >
                {mensaje.rol ===
                'user'
                  ? 'Tú'
                  : grupoActivo
                    ? `Aula+ · ${grupoActivo.name}`
                    : 'Asistente Aula+'}
              </div>

              <div
                style={{
                  background:
                    mensaje.rol ===
                    'user'
                      ? 'linear-gradient(135deg,var(--accent-purple),var(--accent-blue))'
                      : 'var(--bg-panel)',
                  color:
                    mensaje.rol ===
                    'user'
                      ? 'white'
                      : 'var(--text-main)',
                  padding:
                    '1rem 1.1rem',
                  borderRadius:
                    mensaje.rol ===
                    'user'
                      ? '18px 18px 3px 18px'
                      : '18px 18px 18px 3px',
                  border:
                    mensaje.rol ===
                    'ia'
                      ? '1px solid var(--border-color)'
                      : 'none',
                  whiteSpace:
                    'pre-wrap',
                  lineHeight: 1.58,
                  fontSize:
                    '.9rem',
                  boxShadow:
                    '0 5px 18px rgba(0,0,0,.045)',
                }}
              >
                {mensaje.texto}
              </div>

              {mensaje.rol ===
                'ia' && (
                <div
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'flex-start',
                    marginTop:
                      '.4rem',
                    marginLeft:
                      '.45rem',
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      copiarPortapapeles(
                        mensaje.texto
                      )
                    }
                    style={{
                      background:
                        'transparent',
                      border: 'none',
                      color:
                        'var(--text-muted)',
                      fontSize:
                        '.68rem',
                      cursor:
                        'pointer',
                      padding: 0,
                      fontWeight:
                        800,
                    }}
                  >
                    📋 Copiar
                  </button>
                </div>
              )}
            </div>
          )
        )}

        {escribiendo && (
          <div
            style={{
              alignSelf:
                'flex-start',
              background:
                'var(--bg-panel)',
              padding:
                '.85rem 1rem',
              borderRadius:
                '18px 18px 18px 3px',
              border:
                '1px solid var(--border-color)',
              color:
                'var(--accent-purple)',
              fontSize:
                '.76rem',
              fontWeight: 800,
            }}
          >
            <span className="pulse-fast">
              Analizando el contexto de{' '}
              {grupoActivo?.name ||
                'tu grupo'}
              ... 🧠
            </span>
          </div>
        )}

        <div
          ref={mensajesEndRef}
        />
      </div>

      {/* ENVÍO */}
      <form
        onSubmit={enviarMensaje}
        style={{
          padding: '.85rem',
          background:
            'var(--bg-panel)',
          borderTop:
            '1px solid var(--border-color)',
          display: 'flex',
          gap: '.65rem',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          className="search-input"
          placeholder={
            grupoActivo
              ? `Consulta sobre ${grupoActivo.name}...`
              : 'Selecciona primero un grupo...'
          }
          value={objetivo}
          onChange={(e) =>
            setObjetivo(
              e.target.value
            )
          }
          disabled={
            escribiendo ||
            !grupoActivo ||
            cargandoGrupo
          }
          style={{
            flex: 1,
            margin: 0,
            border:
              grupoActivo
                ? '2px solid var(--accent-purple)'
                : '1px solid var(--border-color)',
            padding: '.85rem',
            fontSize: '.86rem',
            borderRadius:
              '12px',
            opacity:
              grupoActivo
                ? 1
                : 0.55,
          }}
        />

        <button
          type="submit"
          disabled={
            escribiendo ||
            !objetivo.trim() ||
            !grupoActivo ||
            cargandoGrupo
          }
          className="pill-btn hover-opacity"
          style={{
            background:
              'var(--accent-purple)',
            color: 'white',
            padding:
              '.85rem 1.2rem',
            whiteSpace:
              'nowrap',
            fontWeight: 800,
            fontSize:
              '.82rem',
            opacity:
              grupoActivo &&
              objetivo.trim()
                ? 1
                : 0.45,
          }}
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

function MiniEstado({
  icono,
  texto,
  listo,
}: {
  icono: string;
  texto: string;
  listo: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '.25rem',
        padding: '.28rem .48rem',
        borderRadius: '999px',
        background: listo
          ? 'rgba(34,164,71,.07)'
          : 'rgba(249,115,22,.07)',
        color: listo
          ? 'var(--accent-green)'
          : '#F97316',
        fontSize: '.62rem',
        fontWeight: 800,
      }}
    >
      {icono}{' '}
      {listo ? '✓' : '○'}{' '}
      {texto}
    </span>
  );
}
