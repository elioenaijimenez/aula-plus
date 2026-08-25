/**
 * Aula+ · API segura de Inteligencia Artificial
 *
 * Ruta:
 * GET  /api/gemini  -> comprobación del servicio
 * POST /api/gemini  -> consulta a Gemini
 *
 * La clave GEMINI_API_KEY permanece exclusivamente
 * en Vercel.
 */

const MODELO_PERMITIDO = 'gemini-3-flash-preview';
const MAX_PROMPT_CHARS = 120000;

function respuestaJSON(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type':
          'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );
}

/**
 * Esta ruta nos permite comprobar fácilmente
 * si Vercel reconoció la función.
 */
export function GET() {
  return respuestaJSON({
    ok: true,
    service: 'Aula+ IA',
    status: 'online',
    message:
      'La función /api/gemini está activa. Usa POST para consultar la IA.',
  });
}

/**
 * Solicitud real a Gemini.
 */
export async function POST(request) {
  try {
    /* ============================
       1. VERIFICAR API KEY
       ============================ */

    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error(
        '[Aula+] GEMINI_API_KEY no está configurada.'
      );

      return respuestaJSON(
        {
          ok: false,
          error:
            'El servicio de Inteligencia Artificial no está configurado.',
        },
        500
      );
    }

    /* ============================
       2. LEER BODY
       ============================ */

    let body;

    try {
      body = await request.json();
    } catch (error) {
      console.error(
        '[Aula+] JSON recibido inválido:',
        error
      );

      return respuestaJSON(
        {
          ok: false,
          error:
            'La solicitud enviada al servicio de IA no es válida.',
        },
        400
      );
    }

    const prompt =
      typeof body?.prompt === 'string'
        ? body.prompt.trim()
        : '';

    const model =
      typeof body?.model === 'string'
        ? body.model
        : MODELO_PERMITIDO;

    const temperature =
      typeof body?.temperature === 'number'
        ? Math.max(
            0,
            Math.min(body.temperature, 1)
          )
        : 0.25;

    /* ============================
       3. VALIDACIONES
       ============================ */

    if (!prompt) {
      return respuestaJSON(
        {
          ok: false,
          error:
            'No se recibió contenido para procesar.',
        },
        400
      );
    }

    if (
      prompt.length >
      MAX_PROMPT_CHARS
    ) {
      return respuestaJSON(
        {
          ok: false,
          error:
            'La solicitud es demasiado extensa.',
        },
        413
      );
    }

    if (
      model !==
      MODELO_PERMITIDO
    ) {
      return respuestaJSON(
        {
          ok: false,
          error:
            'El modelo solicitado no está permitido.',
        },
        400
      );
    }

    /* ============================
       4. CONSULTAR GEMINI
       ============================ */

    const endpoint =
      `https://generativelanguage.googleapis.com/` +
      `v1beta/models/${model}:generateContent`;

    const respuestaGemini =
      await fetch(endpoint, {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          'x-goog-api-key':
            apiKey,
        },

        body: JSON.stringify({
          contents: [
            {
              role: 'user',

              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],

          generationConfig: {
            temperature,
          },
        }),
      });

    /* ============================
       5. LEER RESPUESTA GOOGLE
       ============================ */

    const raw =
      await respuestaGemini.text();

    let datosGemini;

    try {
      datosGemini =
        JSON.parse(raw);
    } catch (error) {
      console.error(
        '[Aula+] Gemini devolvió contenido no JSON:',
        raw.substring(0, 500)
      );

      return respuestaJSON(
        {
          ok: false,
          error:
            'El motor de IA devolvió una respuesta inesperada.',
        },
        502
      );
    }

    /* ============================
       6. ERROR DE GEMINI
       ============================ */

    if (
      !respuestaGemini.ok
    ) {
      console.error(
        '[Aula+] Gemini error:',
        respuestaGemini.status,
        datosGemini?.error
          ?.message ||
          datosGemini
      );

      return respuestaJSON(
        {
          ok: false,
          error:
            'Gemini no pudo completar la solicitud.',
        },
        502
      );
    }

    /* ============================
       7. EXTRAER TEXTO
       ============================ */

    const texto =
      datosGemini
        ?.candidates?.[0]
        ?.content?.parts
        ?.map((parte) =>
          typeof parte?.text ===
          'string'
            ? parte.text
            : ''
        )
        .join('')
        .trim();

    if (!texto) {
      console.error(
        '[Aula+] Gemini respondió sin texto utilizable:',
        datosGemini
      );

      return respuestaJSON(
        {
          ok: false,
          error:
            'La Inteligencia Artificial devolvió una respuesta vacía.',
        },
        502
      );
    }

    /* ============================
       8. RESPUESTA A AULA+
       ============================ */

    return respuestaJSON({
      ok: true,
      text: texto,
      model,
    });
  } catch (error) {
    console.error(
      '[Aula+] Error general /api/gemini:',
      error
    );

    return respuestaJSON(
      {
        ok: false,
        error:
          'No fue posible procesar la solicitud de Inteligencia Artificial.',
      },
      500
    );
  }
}