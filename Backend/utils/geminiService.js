const { GoogleGenerativeAI } = require('@google/generative-ai');

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

function getGeminiModel() {
  const model = (process.env.GEMINI_MODEL || '').trim();
  return model || DEFAULT_GEMINI_MODEL;
}

const CATEGORIAS_VALIDAS = [
  'Puntos Criticos de Congestion',
  'Flujo entre Zonas',
  'Horas Pico',
  'Capacidad del sistema'
];

const MIN_BOTONES = 40;
const MAX_BOTONES = 60;
const MIN_CATEGORIAS = 3;
const MAX_CATEGORIAS = 5;
const MAX_LONGITUD_CATEGORIA = 80;

/**
 * JSON original exacto utilizado por la plataforma VR (43 botones).
 */
const ORIGINAL_JSON = {
  botones: [
    { texto: '5M registros ciudadanos (identidad digital soberana)', ponderacion: 1.0 },
    { texto: '18M identidades biométricas activas', ponderacion: 1.0 },
    { texto: '12M trámites digitales/mes', ponderacion: 1.0 },
    { texto: '2.5M firmas digitales/mes', ponderacion: 1.0 },
    { texto: '4.000 servicios públicos digitalizados', ponderacion: 1.0 },
    { texto: 'Índice de satisfacción ciudadana en tiempo real', ponderacion: 1.0 },
    { texto: '15.000 millones de eventos de red/día', ponderacion: 0, categoria: 'Puntos Criticos de Congestion' },
    { texto: 'Intentos de intrusión detectados', ponderacion: 1.0 },
    { texto: 'Integridad de infraestructuras críticas', ponderacion: 0, categoria: 'Puntos Criticos de Congestion' },
    { texto: 'Riesgo sistémico estimado (score IA)', ponderacion: 0, categoria: 'Puntos Criticos de Congestion' },
    { texto: '25 millones de habitantes', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: '12 líneas de metro', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: '350 rutas de autobús', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: '5 autopistas principales', ponderacion: 0 },
    { texto: '5 corredores aéreos', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: '100 rutas de vehículos aéreos', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: 'Densidad promedio: 18.000 hab/km²', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: 'Distribución por zonas (residencial, comercial, industrial)', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: '12.5 millones de viajes laborales diarios', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: '4 millones de desplazamientos educativos', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: '8 millones de viajes ocasionales diarios', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: 'Tiempo promedio de viaje: 42 minutos', ponderacion: 0, categoria: 'Horas Pico' },
    { texto: 'Modos de transporte utilizados:\n Metro 28%\n Autobús 24%\n Vehículo privado 30%\n Vehículos aéreos 8%\n Micromovilidad 10%', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: 'Metro:\n* 12 Líneas\n* 310 estaciones\n* 1.450 trenes', ponderacion: 0 },
    { texto: 'Autobuses:\n * 350 rutas\n* 18.000 autobuses eléctricos/autónomos\n* 350 rutas\n* 9.000 paradas inteligentes', ponderacion: 0 },
    { texto: 'Autopistas principales:\n * autopistas de alta capacidad\n * 1.200 km de vías rápidas\n * 4.500 cámaras inteligentes\n * 12.000 sensores de flujo vehicular', ponderacion: 0, categoria: 'Capacidad del sistema' },
    { texto: 'Corredor aéreo:\n * Vehiculos aéreos activos: 60.000\n * Verti-Puertos: 450\n * Rutas aereas: 100\n * Operaciones diarias promedio: 1.800.000 vuelos\n * Tiempo medio de vuelo: 12 minutos', ponderacion: 0, categoria: 'Capacidad del sistema' },
    { texto: 'Corredor aéreo:\n * Separación mínima horizontal: 50 m\n * Separación vertical mínima: 30 m', ponderacion: 1.0 },
    { texto: 'Corredor Norte a Sur (Ejecutiva):\n * Longitud: 48km\n * Capacidad simultánea máxima: 4.200 vehículos\n * Flujo máximo: 22.000 veh/hora\n * Velocidad promedio: 180 km/h\n * Velocidad máxima permitida: 220 km/h', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: 'Corredor Norte a Sur (Ejecutiva):\n * Ancho operativo: 600 m\n * Altitud asignada: 350–450 m', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: 'Corredor Este a Oeste (Comercial):\n * Longitud: 62 km\n * Capacidad simultánea máxima: 6.000 vehículos\n * Flujo máximo: 31.000 veh/hora\n * Velocidad promedio: 160 km/h\n * Velocidad máxima permitida: 200 km/h\n * Densidad crítica: 0.12 veh/km³\n * Tasa de ocupación: 85%', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: 'Perimetral circular:\n * Longitud: 110 km\n * Capacidad simultánea máxima: 9.500 vehículos\n * Flujo máximo: 38.000 veh/hora\n * Velocidad promedio: 200 km/h\n * Velocidad máxima: 250 km/h\n * Densidad crítica: 0.10 veh/km³\n * Tasa ocupación: 71%\n * Tiempo medio de vuelta completa: 33 min', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: 'Industrial–Logístico:\n * Longitud: 54 km\n * Capacidad simultánea máxima: 5.800 vehículos\n * Flujo máximo: 29.000 veh/hora\n * Velocidad máxima: 170 km/h', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: 'Alta velocidad interUrbano:\n * Longitud: 95 km\n * Capacidad simultánea máxima: 3.500 vehículos\n * Flujo máximo: 18.000 veh/hora\n * Velocidad promedio: 280 km/h\n * Velocidad máxima: 320 km/h', ponderacion: 0 },
    { texto: '8 millones de viajes diarios', ponderacion: 0 },
    { texto: '65% de viajes ocurren entre 6–9 a.m. y 5–8 p.m.', ponderacion: 0, categoria: 'Horas Pico' },
    { texto: '70% de los viajes tienen destino en el Centro', ponderacion: 0, categoria: 'Flujo entre Zonas' },
    { texto: 'Línea 3 del metro opera al 140% de su capacidad', ponderacion: 0, categoria: 'Puntos Criticos de Congestion' },
    { texto: '3 autopistas concentran el 75% del tráfico', ponderacion: 0, categoria: 'Puntos Criticos de Congestion' },
    { texto: 'Zonas Norte y Sur son principalmente residenciales', ponderacion: 0 },
    { texto: 'Centro y Este concentran empleo y universidades', ponderacion: 0 },
    { texto: '30% de los autobuses viajan con menos del 40% de ocupación', ponderacion: 0 },
    { texto: 'Contaminación aumenta 25% en horas pico', ponderacion: 1.0 }
  ]
};

/**
 * Devuelve una copia profunda del JSON original sin mutar la plantilla base.
 */
function obtenerJsonOriginal() {
  return JSON.parse(JSON.stringify(ORIGINAL_JSON));
}

/**
 * Serializa el JSON de botones conservando "ponderacion": 1.0 y "ponderacion": 0.
 */
function formatearJsonBotones(data) {
  return JSON.stringify(data, null, 2).replace(/"ponderacion":\s*1(?![.\d])/g, '"ponderacion": 1.0');
}

/**
 * Genera una clave normalizada (sin tildes, minúsculas y espacios colapsados)
 * para agrupar y comparar categorías dinámicas.
 */
function claveCategoria(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Limpia espacios repetidos en una categoría y devuelve null si queda vacía o no es texto.
 */
function sanitizarNombreCategoria(raw) {
  if (typeof raw !== 'string') return null;
  const limpia = raw.replace(/\s+/g, ' ').trim();
  return limpia.length > 0 ? limpia : null;
}

/**
 * Valida estrictamente que la estructura cumpla con {"botones": [...]} de 40 a 60 elementos,
 * con texto no vacío, ponderacion (0 o 1/1.0) y categoria opcional agrupada en 3 a 5 categorías distintas.
 */
function validarFormatoPropuesta(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('La propuesta debe ser un objeto JSON con la propiedad "botones".');
  }

  if (!Array.isArray(data.botones)) {
    throw new Error('El JSON debe contener la propiedad "botones" como un arreglo.');
  }

  if (data.botones.length < MIN_BOTONES || data.botones.length > MAX_BOTONES) {
    throw new Error(
      `El arreglo "botones" debe contener entre ${MIN_BOTONES} y ${MAX_BOTONES} elementos. Recibidos: ${data.botones.length}.`
    );
  }

  const categoriasCanonicas = new Map();

  const botonesValidados = data.botones.map((item, idx) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`El elemento en la posición ${idx} debe ser un objeto válido.`);
    }

    if (typeof item.texto !== 'string' || item.texto.trim().length === 0) {
      throw new Error(`El campo "texto" en la posición ${idx} debe ser una cadena de texto no vacía.`);
    }

    const pond = item.ponderacion;
    if (typeof pond === 'boolean' || (pond !== 0 && pond !== 1)) {
      throw new Error(`El campo "ponderacion" en la posición ${idx} debe ser exactamente 0 o 1.0. Recibido: ${JSON.stringify(pond)}.`);
    }

    const botonSanitizado = {
      texto: item.texto,
      ponderacion: pond === 1 ? 1.0 : 0
    };

    if (item.categoria !== undefined && item.categoria !== null && item.categoria !== '') {
      if (typeof item.categoria !== 'string') {
        throw new Error(`Categoría inválida en la posición ${idx}: debe ser una cadena de texto.`);
      }
      const catLimpia = sanitizarNombreCategoria(item.categoria);
      if (!catLimpia || catLimpia.length > MAX_LONGITUD_CATEGORIA) {
        throw new Error(
          `Categoría inválida en la posición ${idx}: debe tener entre 1 y ${MAX_LONGITUD_CATEGORIA} caracteres.`
        );
      }
      const clave = claveCategoria(catLimpia);
      if (!clave) {
        throw new Error(`Categoría inválida en la posición ${idx}: "${item.categoria}".`);
      }
      if (!categoriasCanonicas.has(clave)) {
        categoriasCanonicas.set(clave, catLimpia);
      }
      botonSanitizado.categoria = categoriasCanonicas.get(clave);
    }

    return botonSanitizado;
  });

  if (categoriasCanonicas.size < MIN_CATEGORIAS || categoriasCanonicas.size > MAX_CATEGORIAS) {
    throw new Error(
      `La propuesta debe contener entre ${MIN_CATEGORIAS} y ${MAX_CATEGORIAS} categorías distintas. Recibidas: ${categoriasCanonicas.size}.`
    );
  }

  return { botones: botonesValidados };
}

/**
 * Normaliza y reconstruye la respuesta dinámica de Gemini respetando los textos,
 * cifras, ponderaciones y entre 3 y 5 categorías temáticas generadas para 40 a 60 botones.
 */
function reconstruirPropuestaDesdePlantilla(parsed) {
  const rawBotones = Array.isArray(parsed) ? parsed : parsed?.botones;

  if (!Array.isArray(rawBotones) || rawBotones.length === 0) {
    throw new Error('Gemini no devolvió el arreglo "botones" esperado.');
  }

  const botonesNormalizados = [];

  for (const candidato of rawBotones) {
    let textoFinal = '';
    if (typeof candidato === 'string') {
      textoFinal = candidato.trim();
    } else if (candidato && typeof candidato === 'object' && !Array.isArray(candidato) && typeof candidato.texto === 'string') {
      textoFinal = candidato.texto.trim();
    }

    if (!textoFinal) {
      continue;
    }

    let ponderacionFinal = 0;
    if (candidato && typeof candidato === 'object' && candidato.ponderacion !== undefined) {
      const pond = candidato.ponderacion;
      if (pond === 1 || pond === '1' || pond === '1.0' || pond === true) {
        ponderacionFinal = 1.0;
      } else if (pond === 0 || pond === '0' || pond === false) {
        ponderacionFinal = 0;
      } else if (typeof pond === 'number' && Number.isFinite(pond)) {
        ponderacionFinal = pond >= 0.5 ? 1.0 : 0;
      }
    }

    const boton = {
      texto: textoFinal,
      ponderacion: ponderacionFinal
    };

    if (candidato && typeof candidato === 'object') {
      const catLimpia = sanitizarNombreCategoria(candidato.categoria);
      if (catLimpia && catLimpia.length <= MAX_LONGITUD_CATEGORIA && claveCategoria(catLimpia)) {
        boton.categoria = catLimpia;
      }
    }

    botonesNormalizados.push(boton);
  }

  const botonesRecortados = botonesNormalizados.slice(0, MAX_BOTONES);

  const frecuencias = new Map();
  let orden = 0;
  for (const boton of botonesRecortados) {
    if (!boton.categoria) continue;
    const clave = claveCategoria(boton.categoria);
    const existente = frecuencias.get(clave);
    if (existente) {
      existente.count += 1;
    } else {
      frecuencias.set(clave, {
        nombre: boton.categoria,
        count: 1,
        orden
      });
      orden += 1;
    }
  }

  const clavesPermitidas = new Map();
  if (frecuencias.size > MAX_CATEGORIAS) {
    const topCategorias = Array.from(frecuencias.entries())
      .sort((a, b) => (b[1].count - a[1].count) || (a[1].orden - b[1].orden))
      .slice(0, MAX_CATEGORIAS);
    for (const [clave, info] of topCategorias) {
      clavesPermitidas.set(clave, info.nombre);
    }
  } else {
    for (const [clave, info] of frecuencias.entries()) {
      clavesPermitidas.set(clave, info.nombre);
    }
  }

  const botonesReconstruidos = botonesRecortados.map((boton) => {
    const resultado = {
      texto: boton.texto,
      ponderacion: boton.ponderacion
    };
    if (boton.categoria) {
      const clave = claveCategoria(boton.categoria);
      if (clavesPermitidas.has(clave)) {
        resultado.categoria = clavesPermitidas.get(clave);
      }
    }
    return resultado;
  });

  return validarFormatoPropuesta({ botones: botonesReconstruidos });
}

/**
 * Genera una propuesta completamente dinámica (cifras, métricas, ponderaciones y 3-5 categorías)
 * adaptada al tema indicado por el usuario, con entre 40 y 60 botones y ~40% incorrectos (ponderación 0).
 */
async function generarPropuestaGemini({ tema, peticion, elementosSugeridos }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('La variable de entorno GEMINI_API_KEY no está configurada en el backend.');
  }

  const preferredModel = getGeminiModel();
  const modelCandidates = Array.from(new Set([
    preferredModel,
    DEFAULT_GEMINI_MODEL,
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest'
  ]));

  const genAI = new GoogleGenerativeAI(apiKey);

  const prompt = `
Eres un diseñador experto de escenarios de simulación sistémica y tableros de datos para una plataforma educativa en Realidad Virtual (VR).
Tu tarea es crear desde cero un conjunto COMPLETAMENTE NUEVO y DINÁMICO de entre ${MIN_BOTONES} y ${MAX_BOTONES} tarjetas/botones de información y entre ${MIN_CATEGORIAS} y ${MAX_CATEGORIAS} categorías temáticas sobre el tema solicitado, manteniendo estrictamente el esquema JSON requerido.

Tema solicitado: "${tema || 'Sistema Urbano Inteligente'}"
${peticion ? `Instrucciones adicionales del usuario: "${peticion}"` : ''}
${elementosSugeridos && elementosSugeridos.length > 0 ? `Conceptos o elementos clave a incorporar: ${JSON.stringify(elementosSugeridos)}` : ''}

ESQUEMA DE SALIDA OBLIGATORIO:
Debes responder ÚNICAMENTE con un objeto JSON válido con la forma:
{
  "botones": [
    { "texto": "...", "ponderacion": 1.0 },
    { "texto": "...", "ponderacion": 0, "categoria": "Nombre de Categoria Tematica" }
  ]
}

REGLAS ESTRICTAS PARA QUE TODO SEA DINÁMICO Y NO DAÑE EL JSON:
1. Cantidad de botones:
   - El arreglo "botones" DEBE contener entre ${MIN_BOTONES} y ${MAX_BOTONES} objetos (mínimo ${MIN_BOTONES}, máximo ${MAX_BOTONES}; elige una cantidad natural dentro del rango, por ejemplo entre 45 y 55 según la riqueza del tema).
2. Cifras, métricas y unidades 100% nuevas y realistas para "${tema || 'Sistema Urbano Inteligente'}":
   - INVENTA todas las cifras, cantidades, porcentajes, horarios, capacidades, tiempos, flujos y unidades de medida propias del dominio del tema (por ejemplo: MW, camas, pacientes/h, TEUs, m³/s, transacciones/s, ms, hectáreas, etc., según el tema).
   - PROHIBIDO copiar cifras, métricas o listas fijas de otros dominios (no repitas 5M, 18M, 12M, 25 millones, 42 minutos, 48km, 140%, etc.). Varía los órdenes de magnitud y haz cada escenario auténtico y distinto.
3. Variedad de formatos en "texto":
   - Combina aproximadamente 65%–70% de tarjetas breves de una sola línea y 30%–35% de tarjetas detalladas multilínea con título y viñetas usando saltos de línea y asteriscos (por ejemplo: "Subsistema Alpha:\\n* Capacidad instalada: ...\\n* Tasa de carga: ...\\n* Latencia media: ..."), diseñando atributos propios del tema elegido.
4. PROPORCIÓN 40% INCORRECTOS ("ponderacion": 0) / 60% CORRECTOS ("ponderacion": 1.0) Y CONTRASTE ESTRICTO:
   - Cada objeto DEBE tener "ponderacion" igual a 1.0 o 0 (nunca booleanos ni otros números).
   - Alrededor del 40% del total de botones DEBEN ser incorrectos/distractores con "ponderacion": 0, y el 60% restante DEBEN ser correctos/relevantes con "ponderacion": 1.0, mezclados en distintas posiciones del arreglo (no agrupados todos al inicio o al final).
   - Referencias de conteo según el total elegido:
     * Si generas 40 botones: ~16 con "ponderacion": 0 (40%) y ~24 con "ponderacion": 1.0 (60%).
     * Si generas 50 botones: ~20 con "ponderacion": 0 (40%) y ~30 con "ponderacion": 1.0 (60%).
     * Si generas 60 botones: ~24 con "ponderacion": 0 (40%) y ~36 con "ponderacion": 1.0 (60%).
   - REGLA PARA "ponderacion": 1.0 (~60% — BOTONES CORRECTOS / RELEVANTES):
     * Deben contener datos clave, métricas operativas relevantes, alertas críticas, saturaciones, cuellos de botella, indicadores de capacidad, flujos principales, ventanas críticas y variables determinantes útiles para analizar y tomar decisiones sobre el tema/petición.
   - REGLA PARA "ponderacion": 0 (~40% — BOTONES INCORRECTOS / DISTRACTORES FÁCILES DE DESCARTAR):
     * Cualquier estudiante debe poder identificarlos y descartarlos frente a los de 1.0.
     * Redacta los botones con "ponderacion": 0 ÚNICAMENTE como:
       a) Operación completamente normal, estable y holgada sin impacto decisorio (ocupación baja o moderada de 15%–55%, tiempos de espera cortos de 1–5 min, inventarios completos, equipos 100% operativos).
       b) Distractores administrativos, triviales o irrelevantes para el análisis del escenario (cafetería, papelería, estacionamiento de visitas, jardinería, trámites rutinarios, carnets, decoración o datos descriptivos inconsecuentes).
     * PROHIBICIÓN LÉXICA Y NUMÉRICA EN "ponderacion": 0: NUNCA uses en ellos palabras de alarma o fallo ("Alerta", "Crítico", "Colapso", "Déficit", "Desabastecimiento", "Saturación", "Cuello de botella", "Severo", "Demora", "Retraso", "Faltante", "Al límite", "Riesgo", "Urgente") ni cifras de sobrecarga, abandono o escasez.
5. Distribución dinámica de ${MIN_CATEGORIAS} a ${MAX_CATEGORIAS} categorías (campo "categoria" opcional):
   - Diseña entre ${MIN_CATEGORIAS} y ${MAX_CATEGORIAS} categorías temáticas propias del tema solicitado (nombres breves y claros en español de 2 a 4 palabras, usando exactamente el mismo string en todos los botones que pertenezcan a una misma categoría).
   - NUNCA generes menos de ${MIN_CATEGORIAS} ni más de ${MAX_CATEGORIAS} categorías distintas en todo el JSON, y asegúrate de que cada una aparezca en varios botones.
   - El campo "categoria" es opcional tanto en botones correctos (1.0) como en incorrectos (0): asigna una de tus ${MIN_CATEGORIAS}–${MAX_CATEGORIAS} categorías a alrededor del 65%–80% de los botones y deja el 20%–35% restante SIN la propiedad "categoria".
   - Coherencia entre "categoria" y "ponderacion":
     * Si un botón tiene "ponderacion": 0 y además posee una "categoria", su texto NO debe describir un problema ni un indicador crítico: debe reflejar un aspecto despejado/holgado o un dato trivial/distractor dentro de esa temática, para que nunca compita en importancia con los botones de "ponderacion": 1.0.
6. Ningún "texto" puede estar vacío. No incluyas propiedades extra ni explicaciones o markdown fuera del objeto JSON.
`;

  let lastError = null;

  for (const modelName of modelCandidates) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.85,
          maxOutputTokens: 8192
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

      const propuestaValidada = reconstruirPropuestaDesdePlantilla(parsed);
      return propuestaValidada;
    } catch (err) {
      lastError = err;
      const isRetryable = err.status === 404 || err.status === 503 ||
        (err.message && (err.message.includes('404') || err.message.includes('503') || err.message.includes('not found') || err.message.includes('demand')));

      if (isRetryable) {
        console.warn(`[GeminiService] Modelo ${modelName} no disponible (${err.message}). Reintentando con siguiente modelo Flash...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('No se pudo generar propuesta con los modelos Flash disponibles.');
}

module.exports = {
  DEFAULT_GEMINI_MODEL,
  getGeminiModel,
  ORIGINAL_JSON,
  CATEGORIAS_VALIDAS,
  MIN_BOTONES,
  MAX_BOTONES,
  MIN_CATEGORIAS,
  MAX_CATEGORIAS,
  obtenerJsonOriginal,
  formatearJsonBotones,
  generarPropuestaGemini,
  validarFormatoPropuesta,
  reconstruirPropuestaDesdePlantilla
};
