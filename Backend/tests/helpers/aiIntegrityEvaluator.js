const assert = require('node:assert/strict');
const {
  ORIGINAL_JSON,
  MIN_BOTONES,
  MAX_BOTONES,
  MIN_CATEGORIAS,
  MAX_CATEGORIAS,
  validarFormatoPropuesta,
  formatearJsonBotones
} = require('../../utils/geminiService');

const ALLOWED_BUTTON_KEYS = new Set(['texto', 'ponderacion', 'categoria']);
const STOPWORDS = new Set([
  'de', 'del', 'la', 'las', 'los', 'el', 'en', 'y', 'o', 'con', 'para', 'por', 'un', 'una'
]);

/**
 * Normaliza un texto eliminando diacríticos, pasando a minúsculas y colapsando espacios.
 */
function normalizarTexto(str) {
  if (typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const FORBIDDEN_ZERO_PATTERNS = [
  { label: 'alerta', regex: /(?<![a-z0-9])alertas?(?![a-z0-9])/g },
  { label: 'critico', regex: /(?<![a-z0-9])critic[oa]s?(?![a-z0-9])/g },
  { label: 'colapso', regex: /(?<![a-z0-9])colapsos?(?![a-z0-9])/g },
  { label: 'deficit', regex: /(?<![a-z0-9])deficits?(?![a-z0-9])/g },
  { label: 'desabastecimiento', regex: /(?<![a-z0-9])desabastecimientos?(?![a-z0-9])/g },
  { label: 'saturacion', regex: /(?<![a-z0-9])saturaci(?:on|ones)(?![a-z0-9])/g },
  { label: 'cuello de botella', regex: /(?<![a-z0-9])cuellos?\s+de\s+botella(?![a-z0-9])/g },
  { label: 'severo', regex: /(?<![a-z0-9])sever[oa]s?(?![a-z0-9])/g },
  { label: 'demora', regex: /(?<![a-z0-9])demoras?(?![a-z0-9])/g },
  { label: 'retraso', regex: /(?<![a-z0-9])retrasos?(?![a-z0-9])/g },
  { label: 'faltante', regex: /(?<![a-z0-9])faltantes?(?![a-z0-9])/g },
  { label: 'al limite', regex: /(?<![a-z0-9])al\s+limite(?![a-z0-9])/g },
  { label: 'riesgo', regex: /(?<![a-z0-9])riesgos?(?![a-z0-9])/g },
  { label: 'urgente', regex: /(?<![a-z0-9])urgentes?(?![a-z0-9])/g }
];

const NEGATION_PREFIX_REGEX = /(?:^|[^a-z0-9])(?:sin|cero|ningun[oa]?|ausencia de|libre de)\s+$/;

const ORIGINAL_SIGNATURE_PATTERNS = [
  { label: '5m registros ciudadanos', regex: /(?<![a-z0-9])5m\s+registros\s+ciudadanos(?![a-z0-9])/ },
  { label: '18m identidades biometricas', regex: /(?<![a-z0-9])18m\s+identidades\s+biometricas(?![a-z0-9])/ },
  { label: '12m tramites digitales', regex: /(?<![a-z0-9])12m\s+tramites\s+digitales(?![a-z0-9])/ },
  { label: '25 millones de habitantes', regex: /(?<![a-z0-9])25\s+millones\s+de\s+habitantes(?![a-z0-9])/ },
  { label: 'tiempo promedio de viaje: 42 minutos', regex: /tiempo\s+promedio\s+de\s+viaje:\s*42\s+minutos/ },
  { label: 'corredor norte a sur', regex: /(?<![a-z0-9])corredor\s+norte\s+a\s+sur(?![a-z0-9])/ },
  { label: 'linea 3 del metro opera al 140%', regex: /linea\s+3\s+del\s+metro\s+opera\s+al\s+140%/ },
  { label: '15.000 millones de eventos de red', regex: /15\.000\s+millones\s+de\s+eventos\s+de\s+red/ }
];

const ORIGINAL_TEXTOS_NORMALIZADOS = new Set(
  ORIGINAL_JSON.botones.map((btn) => normalizarTexto(btn.texto))
);

const DEFAULT_UMBRALES = {
  minBotones: MIN_BOTONES,
  maxBotones: MAX_BOTONES,
  minCategorias: MIN_CATEGORIAS,
  maxCategorias: MAX_CATEGORIAS,
  minPorcentajeCeros: 25,
  maxPorcentajeCeros: 55,
  minTransicionesMezcla: 6,
  minPorcentajeConCategoria: 50,
  maxPorcentajeConCategoria: 90,
  minBotonesPorCategoria: 2,
  minPorcentajeMultilinea: 10,
  maxPorcentajeMultilinea: 65
};

function detectarTerminosProhibidosEnTexto(textoNormalizado) {
  const todos = [];
  const sinNegacion = [];

  for (const { label, regex } of FORBIDDEN_ZERO_PATTERNS) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(textoNormalizado)) !== null) {
      const prefix = textoNormalizado.slice(0, match.index);
      const negado = NEGATION_PREFIX_REGEX.test(prefix);
      todos.push({ label, fragmento: match[0], negado });
      if (!negado) {
        sinNegacion.push({ label, fragmento: match[0] });
      }
    }
  }

  return { todos, sinNegacion };
}

function verificarElementoSugeridoEnBotones(elemento, textosNormalizados) {
  const elemNorm = normalizarTexto(elemento);
  if (!elemNorm) return true;

  const tokensSig = elemNorm
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok.length >= 3 && !STOPWORDS.has(tok));

  return textosNormalizados.some((textoNorm) => {
    if (textoNorm.includes(elemNorm)) return true;
    if (tokensSig.length > 0 && tokensSig.every((tok) => textoNorm.includes(tok))) {
      return true;
    }
    return false;
  });
}

/**
 * Evalúa integralmente una propuesta IA tanto a nivel estructural estricto (contrato JSON/VR)
 * como a nivel semántico y de adherencia al prompt de Gemini.
 */
function evaluarIntegridadRespuestaIA(propuesta, opciones = {}) {
  const {
    tema = '',
    elementosSugeridos = [],
    esTemaMovilidadOriginal = false,
    umbrales = {}
  } = opciones;

  const cfg = { ...DEFAULT_UMBRALES, ...umbrales };
  const erroresEstructurales = [];
  const advertenciasCalidad = [];

  let propuestaValidada;
  try {
    propuestaValidada = validarFormatoPropuesta(propuesta);
  } catch (err) {
    erroresEstructurales.push({
      codigo: 'VALIDACION_FORMATO',
      mensaje: err.message
    });
    return {
      estructuraValida: false,
      calidadValida: false,
      erroresEstructurales,
      advertenciasCalidad,
      metricas: null
    };
  }

  const rootExtraKeys = Object.keys(propuesta).filter((key) => key !== 'botones');
  if (rootExtraKeys.length > 0) {
    erroresEstructurales.push({
      codigo: 'PROPIEDADES_EXTRA_RAIZ',
      mensaje: `El objeto raíz contiene propiedades no permitidas: ${rootExtraKeys.join(', ')}`,
      detalle: rootExtraKeys
    });
  }

  const botonesEntrada = propuesta.botones;
  const extraButtonProps = [];
  const categoriasRawPorClave = new Map();
  const categoriasNoCanonicas = [];

  botonesEntrada.forEach((btn, idx) => {
    const extraKeys = Object.keys(btn).filter((key) => !ALLOWED_BUTTON_KEYS.has(key));
    if (extraKeys.length > 0) {
      extraButtonProps.push({ indice: idx, extraKeys });
    }
    if (typeof btn.ponderacion !== 'number' || (btn.ponderacion !== 0 && btn.ponderacion !== 1)) {
      erroresEstructurales.push({
        codigo: 'PONDERACION_NO_NUMERICA',
        mensaje: `El botón #${idx} tiene ponderación inválida: ${JSON.stringify(btn.ponderacion)}`
      });
    }
    if (typeof btn.categoria === 'string' && btn.categoria.trim().length > 0) {
      const limpia = btn.categoria.replace(/\s+/g, ' ').trim();
      const clave = normalizarTexto(limpia);
      if (!categoriasRawPorClave.has(clave)) {
        categoriasRawPorClave.set(clave, btn.categoria);
      } else if (categoriasRawPorClave.get(clave) !== btn.categoria) {
        categoriasNoCanonicas.push({
          indice: idx,
          esperada: categoriasRawPorClave.get(clave),
          recibida: btn.categoria
        });
      }
      if (btn.categoria !== limpia) {
        categoriasNoCanonicas.push({
          indice: idx,
          esperada: limpia,
          recibida: btn.categoria
        });
      }
    }
  });

  if (extraButtonProps.length > 0) {
    erroresEstructurales.push({
      codigo: 'PROPIEDADES_EXTRA_BOTON',
      mensaje: `Se detectaron botones con propiedades no permitidas (${extraButtonProps.length}).`,
      detalle: extraButtonProps
    });
  }

  if (categoriasNoCanonicas.length > 0) {
    erroresEstructurales.push({
      codigo: 'CATEGORIAS_NO_CANONICAS',
      mensaje: `Existen variantes sin canonizar en "categoria" (${categoriasNoCanonicas.length}).`,
      detalle: categoriasNoCanonicas
    });
  }

  const botones = propuestaValidada.botones;
  const totalBotones = botones.length;
  const totalCorrectos = botones.filter((b) => b.ponderacion === 1).length;
  const totalIncorrectos = totalBotones - totalCorrectos;

  // Verificación de round-trip con formatearJsonBotones
  let formateado = '';
  try {
    formateado = formatearJsonBotones(propuestaValidada);
    const reparsed = JSON.parse(formateado);
    assert.deepStrictEqual(reparsed, propuestaValidada);

    if (/(?<!\\)"ponderacion":\s*1(?![.\d])/.test(formateado)) {
      erroresEstructurales.push({
        codigo: 'FORMATO_PONDERACION_SIN_DECIMAL',
        mensaje: 'Se encontró "ponderacion": 1 sin sufijo .0 en el JSON formateado.'
      });
    }

    const matchesOne = formateado.match(/(?<!\\)"ponderacion":\s*1\.0(?=[,\s\r\n}])/g) || [];
    const matchesZero = formateado.match(/(?<!\\)"ponderacion":\s*0(?=[,\s\r\n}])/g) || [];
    if (matchesOne.length !== totalCorrectos || matchesZero.length !== totalIncorrectos) {
      erroresEstructurales.push({
        codigo: 'CONTEO_SERIALIZACION_PONDERACION',
        mensaje: `El conteo serializado (1.0=${matchesOne.length}, 0=${matchesZero.length}) no coincide con los botones (${totalCorrectos}/${totalIncorrectos}).`
      });
    }
  } catch (err) {
    erroresEstructurales.push({
      codigo: 'ROUND_TRIP_FORMATEO',
      mensaje: `Fallo en round-trip de formatearJsonBotones: ${err.message}`
    });
  }

  // Duplicados de texto normalizado
  const vistosTexto = new Map();
  const duplicadosTexto = [];
  const textosNormalizados = [];

  botones.forEach((btn, idx) => {
    const norm = normalizarTexto(btn.texto);
    textosNormalizados.push(norm);
    if (vistosTexto.has(norm)) {
      duplicadosTexto.push({
        texto: btn.texto,
        primero: vistosTexto.get(norm),
        duplicado: idx
      });
    } else {
      vistosTexto.set(norm, idx);
    }
  });

  if (duplicadosTexto.length > 0) {
    erroresEstructurales.push({
      codigo: 'TEXTOS_DUPLICADOS',
      mensaje: `Se detectaron ${duplicadosTexto.length} botón(es) con texto duplicado.`,
      detalle: duplicadosTexto
    });
  }

  if (totalCorrectos === 0 || totalIncorrectos === 0) {
    erroresEstructurales.push({
      codigo: 'CLASE_UNICA_PONDERACION',
      mensaje: `La propuesta debe contener botones con ponderación 1.0 y 0 (correctos=${totalCorrectos}, incorrectos=${totalIncorrectos}).`
    });
  }

  const copiasOriginales = [];
  if (!esTemaMovilidadOriginal) {
    botones.forEach((btn, idx) => {
      if (ORIGINAL_TEXTOS_NORMALIZADOS.has(textosNormalizados[idx])) {
        copiasOriginales.push({ indice: idx, texto: btn.texto });
      }
    });
    if (copiasOriginales.length > 0) {
      erroresEstructurales.push({
        codigo: 'COPIA_LITERAL_ORIGINAL',
        mensaje: `Se detectaron ${copiasOriginales.length} botón(es) copiados literalmente del JSON original.`,
        detalle: copiasOriginales
      });
    }
  }

  // Métricas generales y evaluación semántica
  const porcentajeCeros = Number(((totalIncorrectos / totalBotones) * 100).toFixed(1));
  let transicionesPonderacion = 0;
  for (let i = 1; i < botones.length; i += 1) {
    const prev = botones[i - 1].ponderacion === 1 ? 1 : 0;
    const curr = botones[i].ponderacion === 1 ? 1 : 0;
    if (prev !== curr) transicionesPonderacion += 1;
  }

  const conteoCategorias = {};
  let conCategoriaCount = 0;
  for (const btn of botones) {
    if (btn.categoria) {
      conCategoriaCount += 1;
      conteoCategorias[btn.categoria] = (conteoCategorias[btn.categoria] || 0) + 1;
    }
  }
  const sinCategoriaCount = totalBotones - conCategoriaCount;
  const porcentajeConCategoria = Number(((conCategoriaCount / totalBotones) * 100).toFixed(1));
  const categoriasUnicas = Object.keys(conteoCategorias);

  let multilineaCount = 0;
  let multilineaConVinetasCount = 0;
  for (const btn of botones) {
    if (btn.texto.includes('\n')) {
      multilineaCount += 1;
      if (/^\s*\*/m.test(btn.texto)) {
        multilineaConVinetasCount += 1;
      }
    }
  }
  const unilineaCount = totalBotones - multilineaCount;
  const porcentajeMultilinea = Number(((multilineaCount / totalBotones) * 100).toFixed(1));

  // 1. PROPORCION_CEROS
  if (porcentajeCeros < cfg.minPorcentajeCeros || porcentajeCeros > cfg.maxPorcentajeCeros) {
    advertenciasCalidad.push({
      codigo: 'PROPORCION_CEROS',
      mensaje: `Porcentaje de botones con ponderacion 0 (${porcentajeCeros}%) fuera del rango [${cfg.minPorcentajeCeros}%, ${cfg.maxPorcentajeCeros}%].`,
      detalle: { totalIncorrectos, totalBotones, porcentajeCeros }
    });
  }

  // 2. MEZCLA_PONDERACIONES
  if (transicionesPonderacion < cfg.minTransicionesMezcla) {
    advertenciasCalidad.push({
      codigo: 'MEZCLA_PONDERACIONES',
      mensaje: `Mezcla insuficiente entre ponderaciones 0 y 1.0 (transiciones=${transicionesPonderacion}, mínimo=${cfg.minTransicionesMezcla}).`,
      detalle: { transicionesPonderacion }
    });
  }

  // 3. COBERTURA_CATEGORIAS
  if (
    porcentajeConCategoria < cfg.minPorcentajeConCategoria ||
    porcentajeConCategoria > cfg.maxPorcentajeConCategoria ||
    sinCategoriaCount === 0
  ) {
    advertenciasCalidad.push({
      codigo: 'COBERTURA_CATEGORIAS',
      mensaje: `Cobertura de categorías (${porcentajeConCategoria}%, sinCategoria=${sinCategoriaCount}) fuera de [${cfg.minPorcentajeConCategoria}%, ${cfg.maxPorcentajeConCategoria}%] con al menos 1 botón sin categoría.`,
      detalle: { conCategoriaCount, sinCategoriaCount, porcentajeConCategoria }
    });
  }

  // 4. CATEGORIA_POCO_POBLADA
  const categoriasPocoPobladas = Object.entries(conteoCategorias)
    .filter(([, count]) => count < cfg.minBotonesPorCategoria)
    .map(([categoria, count]) => ({ categoria, count }));
  if (categoriasPocoPobladas.length > 0) {
    advertenciasCalidad.push({
      codigo: 'CATEGORIA_POCO_POBLADA',
      mensaje: `Hay categorías con menos de ${cfg.minBotonesPorCategoria} botones.`,
      detalle: categoriasPocoPobladas
    });
  }

  // 5. VARIEDAD_FORMATO_TEXTO
  if (
    porcentajeMultilinea < cfg.minPorcentajeMultilinea ||
    porcentajeMultilinea > cfg.maxPorcentajeMultilinea ||
    (multilineaCount > 0 && multilineaConVinetasCount === 0)
  ) {
    advertenciasCalidad.push({
      codigo: 'VARIEDAD_FORMATO_TEXTO',
      mensaje: `Variedad de formato fuera de rango (multilínea=${porcentajeMultilinea}%, con viñetas '*'` +
        `=${multilineaConVinetasCount}/${multilineaCount}; esperado [${cfg.minPorcentajeMultilinea}%, ${cfg.maxPorcentajeMultilinea}%]).`,
      detalle: { multilineaCount, unilineaCount, multilineaConVinetasCount, porcentajeMultilinea }
    });
  }

  // 6. PROHIBICION_LEXICA_CERO
  const prohibidosEnCero = [];
  const prohibidosSinNegacion = [];
  botones.forEach((btn, idx) => {
    if (btn.ponderacion !== 0) return;
    const { todos, sinNegacion } = detectarTerminosProhibidosEnTexto(textosNormalizados[idx]);
    if (todos.length > 0) {
      prohibidosEnCero.push({
        indice: idx,
        texto: btn.texto,
        coincidencias: todos
      });
    }
    if (sinNegacion.length > 0) {
      prohibidosSinNegacion.push({
        indice: idx,
        texto: btn.texto,
        coincidencias: sinNegacion
      });
    }
  });
  if (prohibidosEnCero.length > 0) {
    advertenciasCalidad.push({
      codigo: 'PROHIBICION_LEXICA_CERO',
      mensaje: `Se detectaron ${prohibidosEnCero.length} botón(es) con ponderacion 0 usando términos de alarma/fallo prohibidos por el prompt.`,
      detalle: {
        totalBotonesAfectados: prohibidosEnCero.length,
        totalSinNegacion: prohibidosSinNegacion.length,
        ejemplos: prohibidosEnCero.slice(0, 5)
      }
    });
  }

  // 7. FUGA_METRICAS_ORIGINAL
  const fugasOriginal = [];
  if (!esTemaMovilidadOriginal) {
    botones.forEach((btn, idx) => {
      const matched = ORIGINAL_SIGNATURE_PATTERNS
        .filter(({ regex }) => regex.test(textosNormalizados[idx]))
        .map(({ label }) => label);
      if (matched.length > 0) {
        fugasOriginal.push({ indice: idx, texto: btn.texto, patrones: matched });
      }
    });
    if (fugasOriginal.length > 0) {
      advertenciasCalidad.push({
        codigo: 'FUGA_METRICAS_ORIGINAL',
        mensaje: `Se detectaron ${fugasOriginal.length} fuga(s) de métricas características de ORIGINAL_JSON en el tema "${tema}".`,
        detalle: fugasOriginal
      });
    }
  }

  // 8. ELEMENTOS_SUGERIDOS_FALTANTES
  const elementosLista = Array.isArray(elementosSugeridos)
    ? elementosSugeridos.filter((e) => typeof e === 'string' && e.trim().length > 0)
    : [];
  const elementosEncontrados = [];
  const elementosFaltantes = [];
  for (const elem of elementosLista) {
    if (verificarElementoSugeridoEnBotones(elem, textosNormalizados)) {
      elementosEncontrados.push(elem);
    } else {
      elementosFaltantes.push(elem);
    }
  }
  if (elementosFaltantes.length > 0) {
    advertenciasCalidad.push({
      codigo: 'ELEMENTOS_SUGERIDOS_FALTANTES',
      mensaje: `Faltan elementos sugeridos en los botones generados: ${elementosFaltantes.join(', ')}`,
      detalle: { elementosEncontrados, elementosFaltantes }
    });
  }

  return {
    estructuraValida: erroresEstructurales.length === 0,
    calidadValida: erroresEstructurales.length === 0 && advertenciasCalidad.length === 0,
    erroresEstructurales,
    advertenciasCalidad,
    metricas: {
      tema,
      totalBotones,
      totalCorrectos,
      totalIncorrectos,
      porcentajeCeros,
      transicionesPonderacion,
      categorias: conteoCategorias,
      totalCategorias: categoriasUnicas.length,
      conCategoriaCount,
      sinCategoriaCount,
      porcentajeConCategoria,
      multilineaCount,
      unilineaCount,
      multilineaConVinetasCount,
      porcentajeMultilinea,
      duplicadosTextoCount: duplicadosTexto.length,
      prohibidosEnCeroCount: prohibidosEnCero.length,
      prohibidosSinNegacionCount: prohibidosSinNegacion.length,
      prohibidosEnCero,
      prohibidosSinNegacion,
      copiasOriginalesCount: copiasOriginales.length,
      fugasOriginalCount: fugasOriginal.length,
      elementosEncontrados,
      elementosFaltantes
    }
  };
}

module.exports = {
  DEFAULT_UMBRALES,
  FORBIDDEN_ZERO_PATTERNS,
  ORIGINAL_SIGNATURE_PATTERNS,
  ORIGINAL_TEXTOS_NORMALIZADOS,
  normalizarTexto,
  evaluarIntegridadRespuestaIA
};
