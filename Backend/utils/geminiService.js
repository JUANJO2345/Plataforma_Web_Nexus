const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Normaliza y valida una propuesta para cumplir estrictamente con el formato {"clave": 0 o 1}.
 * Rechaza arrays, booleanos (true/false), textos u otros números.
 */
function validarFormatoPropuesta(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('La propuesta generada debe ser un objeto JSON plano no vacío.');
  }

  const keys = Object.keys(data);
  if (keys.length === 0) {
    throw new Error('El objeto JSON no contiene elementos o claves.');
  }

  const sanitized = {};

  for (const rawKey of keys) {
    const key = String(rawKey).trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!key) {
      throw new Error(`Clave inválida detectada: "${rawKey}".`);
    }

    const val = data[rawKey];

    // Regla estricta: NO se aceptan booleanos (true/false) ni texto ni otros números
    if (typeof val === 'boolean') {
      throw new Error(`El valor para "${rawKey}" es booleano (${val}). Solo se aceptan los enteros 0 o 1.`);
    }

    if (val !== 0 && val !== 1) {
      throw new Error(`El valor para "${rawKey}" debe ser exactamente 0 o 1. Recibido: ${JSON.stringify(val)}.`);
    }

    sanitized[key] = val;
  }

  return sanitized;
}

/**
 * Genera una propuesta de configuración de elementos VR usando Gemini Flash.
 */
async function generarPropuestaGemini({ tema, peticion, elementosSugeridos }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('La variable de entorno GEMINI_API_KEY no está configurada en el backend.');
  }

  const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const modelCandidates = Array.from(new Set([
    preferredModel,
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest'
  ]));

  const genAI = new GoogleGenerativeAI(apiKey);

  const prompt = `
Eres un asistente de IA para una plataforma educativa y de evaluación en Realidad Virtual (VR).
El profesor solicita configurar qué objetos o elementos del entorno 3D deben estar activos (1) o inactivos (0) en el juego VR.

Tema de la experiencia VR: "${tema || 'General / Juego VR'}"
Petición del profesor: "${peticion || 'Configurar elementos relevantes para la sesión'}"
${elementosSugeridos && elementosSugeridos.length > 0 ? `Elementos específicos solicitados: ${JSON.stringify(elementosSugeridos)}` : ''}

REGLAS ESTRICTAS DE FORMATO:
1. Responde ÚNICAMENTE con un objeto JSON plano.
2. Cada clave debe ser el nombre del objeto o elemento (en minúsculas con guiones bajos, ej. "microscopio", "tubo_ensayo", "bata_proteccion").
3. Cada valor DEBE SER ESTRICTAMENTE el número entero 1 (activo/verdadero) o 0 (inactivo/falso).
4. NO utilices booleanos (true/false).
5. NO utilices texto como valor ni ningún número diferente de 0 y 1.
6. NO envíes explicaciones, markdown adicional ni comentarios. Solo el objeto JSON.

Ejemplo de salida válida:
{
  "objeto_a": 1,
  "objeto_b": 0,
  "objeto_c": 1
}
`;

  let lastError = null;

  for (const modelName of modelCandidates) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const rawText = response.text();

      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch (err) {
        throw new Error(`Gemini devolvió una respuesta que no es un JSON válido: ${rawText}`);
      }

      // Validación y sanitización estricta
      const propuestaValidada = validarFormatoPropuesta(parsed);
      return propuestaValidada;
    } catch (err) {
      lastError = err;
      // Si el error es 404 (modelo retirado o no disponible) o 503 (alta demanda), probamos el siguiente candidato
      const isRetryable = err.status === 404 || err.status === 503 ||
        (err.message && (err.message.includes('404') || err.message.includes('503') || err.message.includes('not found') || err.message.includes('demand')));

      if (isRetryable) {
        console.warn(`[GeminiService] Modelo ${modelName} no disponible (${err.message}). Reintentando con siguiente modelo Flash...`);
        continue;
      }
      // Si es un error de clave inválida u otro error fatal, lo lanzamos de inmediato
      throw err;
    }
  }

  throw lastError || new Error('No se pudo generar propuesta con los modelos Flash disponibles.');
}

module.exports = {
  generarPropuestaGemini,
  validarFormatoPropuesta
};
