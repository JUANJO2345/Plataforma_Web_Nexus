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
 * Normaliza una categoría comparando sin distinguir mayúsculas o tildes contra CATEGORIAS_VALIDAS.
 * Devuelve la categoría canónica o null si no corresponde a ninguna válida.
 */
function normalizarCategoria(rawCategoria) {
  if (typeof rawCategoria !== 'string') return null;
  const limpiar = (s) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const buscada = limpiar(rawCategoria);
  if (!buscada) return null;

  return CATEGORIAS_VALIDAS.find((cat) => limpiar(cat) === buscada) || null;
}

/**
 * Valida estrictamente que la estructura cumpla con {"botones": [...]} de 43 elementos,
 * con texto no vacío, ponderacion (0 o 1/1.0) y categoria opcional dentro de las 4 válidas.
 */
function validarFormatoPropuesta(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('La propuesta debe ser un objeto JSON con la propiedad "botones".');
  }

  if (!Array.isArray(data.botones)) {
    throw new Error('El JSON debe contener la propiedad "botones" como un arreglo.');
  }

  const totalEsperado = ORIGINAL_JSON.botones.length;
  if (data.botones.length !== totalEsperado) {
    throw new Error(`El arreglo "botones" debe contener exactamente ${totalEsperado} elementos. Recibidos: ${data.botones.length}.`);
  }

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
      if (!CATEGORIAS_VALIDAS.includes(item.categoria)) {
        throw new Error(`Categoría inválida en la posición ${idx}: "${item.categoria}".`);
      }
      botonSanitizado.categoria = item.categoria;
    }

    return botonSanitizado;
  });

  return { botones: botonesValidados };
}

/**
 * Normaliza y reconstruye la respuesta dinámica de Gemini respetando los textos,
 * cifras, ponderaciones y categorías generadas, garantizando exactamente 43 botones válidos.
 */
function reconstruirPropuestaDesdePlantilla(parsed) {
  const rawBotones = Array.isArray(parsed) ? parsed : parsed?.botones;

  if (!Array.isArray(rawBotones) || rawBotones.length === 0) {
    throw new Error('Gemini no devolvió el arreglo "botones" esperado.');
  }

  const totalEsperado = ORIGINAL_JSON.botones.length;
  const botonesReconstruidos = [];

  for (let idx = 0; idx < totalEsperado; idx += 1) {
    const slotOriginal = ORIGINAL_JSON.botones[idx];
    const candidato = idx < rawBotones.length ? rawBotones[idx] : null;

    let textoFinal = '';
    if (typeof candidato === 'string') {
      textoFinal = candidato;
    } else if (candidato && typeof candidato === 'object' && typeof candidato.texto === 'string') {
      textoFinal = candidato.texto;
    }

    if (textoFinal.trim().length === 0) {
      textoFinal = slotOriginal.texto;
    }

    let ponderacionFinal = slotOriginal.ponderacion;
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
      const categoriaNormalizada = normalizarCategoria(candidato.categoria);
      if (categoriaNormalizada) {
        boton.categoria = categoriaNormalizada;
      }
    } else if (!candidato && slotOriginal.categoria) {
      boton.categoria = slotOriginal.categoria;
    }

    botonesReconstruidos.push(boton);
  }

  return validarFormatoPropuesta({ botones: botonesReconstruidos });
}

/**
 * Genera una propuesta completamente dinámica (cifras, métricas, ponderaciones y categorías)
 * adaptada al tema indicado por el usuario, manteniendo la estructura de 43 botones.
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
Tu tarea es crear desde cero un conjunto COMPLETAMENTE NUEVO y DINÁMICO de exactamente ${ORIGINAL_JSON.botones.length} tarjetas/botones de información sobre el tema solicitado, manteniendo estrictamente el esquema JSON requerido.

Tema solicitado: "${tema || 'Sistema Urbano Inteligente'}"
${peticion ? `Instrucciones adicionales del usuario: "${peticion}"` : ''}
${elementosSugeridos && elementosSugeridos.length > 0 ? `Conceptos o elementos clave a incorporar: ${JSON.stringify(elementosSugeridos)}` : ''}

ESQUEMA DE SALIDA OBLIGATORIO:
Debes responder ÚNICAMENTE con un objeto JSON válido con la forma:
{
  "botones": [
    { "texto": "...", "ponderacion": 1.0 },
    { "texto": "...", "ponderacion": 0, "categoria": "Flujo entre Zonas" }
  ]
}

REGLAS ESTRICTAS PARA QUE TODO SEA DINÁMICO Y NO DAÑE EL JSON:
1. Cantidad exacta: el arreglo "botones" DEBE contener EXACTAMENTE ${ORIGINAL_JSON.botones.length} objetos.
2. Cifras, métricas y unidades 100% nuevas y realistas para "${tema || 'Sistema Urbano Inteligente'}":
   - INVENTA todas las cifras, cantidades, porcentajes, horarios, capacidades, tiempos, flujos y unidades de medida propias del dominio del tema (por ejemplo: MW, camas, pacientes/h, TEUs, m³/s, transacciones/s, ms, hectáreas, etc., según el tema).
   - PROHIBIDO copiar cifras, métricas o listas fijas de otros dominios (no repitas 5M, 18M, 12M, 25 millones, 42 minutos, 48km, 140%, etc.). Varía los órdenes de magnitud y haz cada escenario auténtico y distinto.
3. Variedad de formatos en "texto":
   - Combina ~30 tarjetas breves de una sola línea y ~13 tarjetas detalladas multilínea con título y viñetas usando saltos de línea y asteriscos (por ejemplo: "Subsistema Alpha:\\n* Capacidad instalada: ...\\n* Tasa de carga: ...\\n* Latencia media: ..."), diseñando atributos propios del tema elegido.
4. CONTRASTE ESTRICTO ENTRE BOTONES IMPORTANTES ("ponderacion": 1.0) Y NO SELECCIONADOS ("ponderacion": 0):
   - Cada objeto DEBE tener "ponderacion" igual a 1.0 o 0 (nunca booleanos ni otros números).
   - Asigna "ponderacion": 1.0 a entre 8 y 12 botones repartidos en distintas posiciones del arreglo, y "ponderacion": 0 a los demás (31 a 35 botones).
   - REGLA PARA "ponderacion": 1.0 (ÚNICOS BOTONES CRÍTICOS / IMPORTANTES):
     * SOLO los botones con "ponderacion": 1.0 pueden describir problemas reales, alertas críticas, saturaciones graves (>90%–140%), desabastecimientos, cuellos de botella severos, demoras alarmantes, fallas operativas o indicadores prioritarios para la toma de decisiones del tema/petición.
   - REGLA PARA "ponderacion": 0 (NO SELECCIONADOS — FÁCILES DE DISTINGUIR Y DESCARTAR):
     * Cualquier persona debe notar de inmediato que estos botones NO son críticos ni urgentes frente a los de 1.0.
     * Redacta los botones con "ponderacion": 0 ÚNICAMENTE como:
       a) Operación normal, estable y holgada (ocupación baja o moderada de 15%–60%, tiempos de espera cortos de 1–5 min, inventarios completos con semanas de autonomía, equipos 100% operativos).
       b) Distractores administrativos, generales o irrelevantes para una crisis (datos de cafetería, papelería, estacionamiento, jardinería, trámites rutinarios, superficie del edificio, carnets o estadísticas descriptivas neutras).
     * PROHIBICIÓN LÉXICA Y NUMÉRICA EN "ponderacion": 0: NUNCA uses en ellos palabras de alarma o fallo ("Alerta", "Crítico", "Colapso", "Déficit", "Desabastecimiento", "Saturación", "Cuello de botella", "Severo", "Demora", "Retraso", "Faltante", "Al límite", "Riesgo", "Urgente") ni cifras de sobrecarga, abandono o escasez.
5. Distribución dinámica de "categoria" (campo opcional):
   - Un botón puede incluir "categoria" o omitirla.
   - Cuando la incluyas, su valor DEBE ser EXACTAMENTE uno de estos 4 strings (respetando mayúsculas y ausencia de tildes):
     * "Puntos Criticos de Congestion"
     * "Flujo entre Zonas"
     * "Horas Pico"
     * "Capacidad del sistema"
   - Distribuye los botones dinámicamente: incluye alrededor de 24 a 31 botones repartidos entre las 4 categorías (asegurando que las 4 aparezcan) y deja entre 12 y 19 botones SIN la propiedad "categoria".
   - Coherencia entre "categoria" y "ponderacion":
     * Si un botón tiene "ponderacion": 0 y además posee una "categoria", su texto NO debe describir un problema ni una urgencia: debe reflejar un punto monitoreado despejado/sin congestión, un flujo fluido normal, una franja horaria informativa estable o una capacidad holgada/descriptiva, para que nunca compita en importancia con los botones de "ponderacion": 1.0.
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
  obtenerJsonOriginal,
  formatearJsonBotones,
  generarPropuestaGemini,
  validarFormatoPropuesta,
  reconstruirPropuestaDesdePlantilla
};
