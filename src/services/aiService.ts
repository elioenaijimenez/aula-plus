/**
 * Aula+ · Servicio único de Inteligencia Artificial
 *
 * Este archivo es la única puerta del frontend hacia Gemini.
 *
 * El navegador NO conoce la API key.
 * Todas las solicitudes pasan por:
 *
 *   POST /api/gemini
 *
 * La clave GEMINI_API_KEY permanece exclusivamente
 * en el servidor de Vercel.
 */

export interface SolicitudIA {
  prompt: string;
  temperature?: number;
  model?: 'gemini-3-flash-preview';
}

export interface RespuestaIA {
  ok: boolean;
  text: string;
  model?: string;
}

interface ErrorServidorIA {
  ok?: boolean;
  error?: string;
}

const DEFAULT_MODEL = 'gemini-3-flash-preview' as const;
const DEFAULT_TEMPERATURE = 0.25;
const MAX_PROMPT_CHARS = 120_000;

function normalizarTemperature(
  temperature?: number
): number {
  if (
    typeof temperature !== 'number' ||
    Number.isNaN(temperature)
  ) {
    return DEFAULT_TEMPERATURE;
  }

  return Math.max(
    0,
    Math.min(temperature, 1)
  );
}

function validarPrompt(prompt: string): string {
  const limpio = prompt.trim();

  if (!limpio) {
    throw new Error(
      'No se puede enviar una solicitud vacía a la IA.'
    );
  }

  if (limpio.length > MAX_PROMPT_CHARS) {
    throw new Error(
      'La solicitud es demasiado extensa para procesarse.'
    );
  }

  return limpio;
}

/**
 * Llama al endpoint seguro de Aula+.
 *
 * Ejemplo:
 *
 * const texto = await generarTextoIA({
 *   prompt: 'Propón una actividad...',
 *   temperature: 0.2,
 * });
 */
export async function generarTextoIA(
  solicitud: SolicitudIA
): Promise<string> {
  const prompt = validarPrompt(
    solicitud.prompt
  );

  const temperature =
    normalizarTemperature(
      solicitud.temperature
    );

  const model =
    solicitud.model ||
    DEFAULT_MODEL;

  let response: Response;

  try {
    response = await fetch(
      '/api/gemini',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          prompt,
          temperature,
          model,
        }),
      }
    );
  } catch (error) {
    console.error(
      '[Aula+] No fue posible conectar con /api/gemini:',
      error
    );

    throw new Error(
      'No fue posible conectar con el servicio de Inteligencia Artificial.'
    );
  }

  let data:
    | RespuestaIA
    | ErrorServidorIA;

  try {
    data = await response.json();
  } catch (error) {
    console.error(
      '[Aula+] /api/gemini devolvió una respuesta no JSON:',
      error
    );

    throw new Error(
      'El servicio de Inteligencia Artificial devolvió una respuesta inválida.'
    );
  }

  if (!response.ok) {
    const mensaje =
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : 'El servicio de Inteligencia Artificial no pudo completar la solicitud.';

    console.error(
      '[Aula+] Error desde /api/gemini:',
      response.status,
      mensaje
    );

    throw new Error(mensaje);
  }

  if (
    !('ok' in data) ||
    data.ok !== true ||
    !('text' in data) ||
    typeof data.text !== 'string' ||
    !data.text.trim()
  ) {
    console.error(
      '[Aula+] Respuesta incompleta desde /api/gemini:',
      data
    );

    throw new Error(
      'La Inteligencia Artificial devolvió una respuesta incompleta.'
    );
  }

  return data.text;
}

/**
 * Variante útil cuando un componente necesita
 * conservar también metadatos de la respuesta.
 */
export async function generarRespuestaIA(
  solicitud: SolicitudIA
): Promise<RespuestaIA> {
  const prompt = validarPrompt(
    solicitud.prompt
  );

  const temperature =
    normalizarTemperature(
      solicitud.temperature
    );

  const model =
    solicitud.model ||
    DEFAULT_MODEL;

  let response: Response;

  try {
    response = await fetch(
      '/api/gemini',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          prompt,
          temperature,
          model,
        }),
      }
    );
  } catch (error) {
    console.error(
      '[Aula+] Error de red hacia /api/gemini:',
      error
    );

    throw new Error(
      'No fue posible conectar con el servicio de Inteligencia Artificial.'
    );
  }

  let data:
    | RespuestaIA
    | ErrorServidorIA;

  try {
    data = await response.json();
  } catch (error) {
    console.error(
      '[Aula+] Respuesta no válida desde /api/gemini:',
      error
    );

    throw new Error(
      'El servicio de Inteligencia Artificial devolvió una respuesta inválida.'
    );
  }

  if (!response.ok) {
    const mensaje =
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : 'El servicio de Inteligencia Artificial no pudo completar la solicitud.';

    throw new Error(mensaje);
  }

  if (
    !('ok' in data) ||
    data.ok !== true ||
    !('text' in data) ||
    typeof data.text !== 'string' ||
    !data.text.trim()
  ) {
    throw new Error(
      'La Inteligencia Artificial devolvió una respuesta incompleta.'
    );
  }

  return {
    ok: true,
    text: data.text,
    model:
      'model' in data &&
      typeof data.model === 'string'
        ? data.model
        : model,
  };
}

/**
 * Convierte un error desconocido en un mensaje
 * listo para mostrar en la interfaz.
 */
export function obtenerMensajeErrorIA(
  error: unknown
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return (
    'Ocurrió un problema al procesar la solicitud con Inteligencia Artificial.'
  );
}
