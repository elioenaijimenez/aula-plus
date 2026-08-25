/**
 * Aula+ · API segura para Gemini
 *
 * El navegador llamará a:
 * POST /api/gemini
 *
 * La clave GEMINI_API_KEY solamente existe
 * en el servidor de Vercel.
 */

const ALLOWED_MODELS = new Set([
  'gemini-3-flash-preview',
]);

const MAX_PROMPT_CHARS = 120000;

function enviarJSON(res, status, data) {
  res.status(status).json(data);
}

export default async function handler(req, res) {
  // Permitimos únicamente solicitudes POST.
  if (req.method !== 'POST') {
    enviarJSON(res, 405, {
      ok: false,
      error: 'Método no permitido.',
    });

    return;
  }

  // Esta variable se obtiene desde
  // Vercel → Environment Variables.
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error(
      '[Aula+] GEMINI_API_KEY no está configurada.'
    );

    enviarJSON(res, 500, {
      ok: false,
      error:
        'El servicio de Inteligencia Artificial no está configurado.',
    });

    return;
  }

  const body =
    req.body && typeof req.body === 'object'
      ? req.body
      : {};

  const prompt =
    typeof body.prompt === 'string'
      ? body.prompt.trim()
      : '';

  const model =
    typeof body.model === 'string'
      ? body.model
      : 'gemini-3-flash-preview';

  const temperature =
    typeof body.temperature === 'number'
      ? Math.max(
          0,
          Math.min(body.temperature, 1)
        )
      : 0.25;

  // Evitamos solicitudes vacías.
  if (!prompt) {
    enviarJSON(res, 400, {
      ok: false,
      error: 'El prompt está vacío.',
    });

    return;
  }

  // Evitamos solicitudes excesivamente grandes.
  if (prompt.length > MAX_PROMPT_CHARS) {
    enviarJSON(res, 413, {
      ok: false,
      error:
        'La solicitud es demasiado extensa.',
    });

    return;
  }

  // Evitamos que el navegador pueda elegir
  // cualquier modelo arbitrariamente.
  if (!ALLOWED_MODELS.has(model)) {
    enviarJSON(res, 400, {
      ok: false,
      error: 'Modelo no permitido.',
    });

    return;
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/` +
    `v1beta/models/${model}:generateContent`;

  try {
    const respuestaGemini = await fetch(
      endpoint,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',

          // La clave viaja de Vercel hacia Google.
          // Nunca desde el navegador del docente.
          'x-goog-api-key': apiKey,
        },

        body: JSON.stringify({
          contents: [
            {
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
      }
    );

    const datosGemini =
      await respuestaGemini.json();

    if (!respuestaGemini.ok) {
      console.error(
        '[Aula+] Error Gemini:',
        respuestaGemini.status,
        datosGemini?.error?.message ||
          'Sin detalle'
      );

      enviarJSON(res, 502, {
        ok: false,
        error:
          'El motor de IA no pudo completar la solicitud.',
      });

      return;
    }

    const texto =
      datosGemini?.candidates?.[0]
        ?.content?.parts?.[0]?.text;

    if (
      !texto ||
      typeof texto !== 'string'
    ) {
      console.error(
        '[Aula+] Gemini respondió sin texto.'
      );

      enviarJSON(res, 502, {
        ok: false,
        error:
          'El motor de IA devolvió una respuesta incompleta.',
      });

      return;
    }

    enviarJSON(res, 200, {
      ok: true,
      text: texto,
      model,
    });
  } catch (error) {
    console.error(
      '[Aula+] Error de conexión con Gemini:',
      error
    );

    enviarJSON(res, 500, {
      ok: false,
      error:
        'No fue posible conectar con el servicio de IA.',
    });
  }
}