const { describe, it, before, after, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { google } = require('googleapis');
const geminiService = require('../utils/geminiService');
const {
  FRONTEND_DIR,
  startTestServer,
  seedBaselineFixtures,
  requestJson
} = require('./helpers/testHarness');
const {
  normalizarTexto,
  evaluarIntegridadRespuestaIA
} = require('./helpers/aiIntegrityEvaluator');

const {
  DEFAULT_GEMINI_MODEL,
  ORIGINAL_JSON,
  obtenerJsonOriginal,
  formatearJsonBotones,
  generarPropuestaGemini,
  validarFormatoPropuesta,
  reconstruirPropuestaDesdePlantilla
} = geminiService;

function buildBalancedProposal({
  count = 50,
  categories = ['Capacidad Quirúrgica', 'Respuesta Prehospitalaria', 'Triaje de Emergencias', 'Gestión de Camas'],
  zeroCount = 20,
  ratioConCategoria = 0.74,
  ratioMultilinea = 0.32,
  topicPrefix = 'Indicador clínico',
  includeSuggestions = []
} = {}) {
  const conCategoriaTarget = Math.round(count * ratioConCategoria);
  const multilineaTarget = Math.round(count * ratioMultilinea);

  const botones = Array.from({ length: count }, (_, idx) => {
    const prevBucket = Math.floor((idx * zeroCount) / count);
    const currBucket = Math.floor(((idx + 1) * zeroCount) / count);
    const esCero = currBucket > prevBucket;
    const ponderacion = esCero ? 0 : 1.0;

    const esMultilinea = idx < multilineaTarget;
    let texto;
    if (esCero) {
      texto = esMultilinea
        ? `Área administrativa #${idx + 1}:\n* Operación estable al ${20 + (idx % 25)}%\n* Personal completo disponible\n* Tiempo de atención: ${2 + (idx % 3)} min`
        : `${topicPrefix} rutinario #${idx + 1}: archivo y cafetería operando normalmente con 30% de ocupación`;
    } else {
      texto = esMultilinea
        ? `Subsistema operativo #${idx + 1}:\n* Carga registrada: ${82 + (idx % 16)}%\n* Volumen horario: ${120 + idx * 7} eventos/h\n* Latencia media: ${14 + (idx % 12)} min`
        : `${topicPrefix} clave #${idx + 1}: flujo principal con carga del ${80 + (idx % 18)}% en ventana operativa`;
    }

    const boton = { texto, ponderacion };
    if (categories.length > 0 && idx < conCategoriaTarget) {
      boton.categoria = categories[idx % categories.length];
    }
    return boton;
  });

  if (Array.isArray(includeSuggestions) && includeSuggestions.length > 0) {
    const oneIndices = botones
      .map((b, idx) => (b.ponderacion === 1 ? idx : -1))
      .filter((idx) => idx !== -1);
    includeSuggestions.forEach((sug, sIdx) => {
      const targetIdx = oneIndices[oneIndices.length - 1 - sIdx];
      if (targetIdx === undefined) return;
      botones[targetIdx] = {
        ...botones[targetIdx],
        ponderacion: 1.0,
        texto: `${sug}: monitoreo operativo activo con carga del ${85 + sIdx}% (#${targetIdx + 1})`
      };
    });
  }

  return { botones };
}

describe('Suite 1 — Integridad de esquema, sanitización y serialización (geminiService)', () => {
  it('rechaza entradas raíz inválidas, elementos no objeto y texto vacío/no string', () => {
    for (const invalidRoot of [null, undefined, 'texto', 123, [], {}]) {
      assert.throws(() => validarFormatoPropuesta(invalidRoot), /objeto JSON|arreglo/);
    }

    const base40 = buildBalancedProposal({ count: 40, zeroCount: 16 }).botones;

    for (const badItem of [null, undefined, [], 'solo-string', 42]) {
      const mut = base40.map((b, i) => (i === 5 ? badItem : b));
      assert.throws(() => validarFormatoPropuesta({ botones: mut }), /objeto válido/);
    }

    for (const badText of ['', '   ', '\n\t  ', null, undefined, 100]) {
      const mut = base40.map((b, i) => (i === 3 ? { ...b, texto: badText } : b));
      assert.throws(() => validarFormatoPropuesta({ botones: mut }), /no vacía/);
    }
  });

  it('valida estrictamente ponderacion (rechaza strings, booleanos, decimales != 1.0, NaN/Infinity; normaliza -0)', () => {
    const base40 = buildBalancedProposal({ count: 40, zeroCount: 16 }).botones;

    for (const invalidPond of ['0', '1', '1.0', true, false, 0.5, -1, 2, null, undefined, NaN, Infinity]) {
      const mut = base40.map((b, i) => (i === 0 ? { ...b, ponderacion: invalidPond } : b));
      assert.throws(() => validarFormatoPropuesta({ botones: mut }), /0 o 1\.0/);
    }

    const withNegZeroAndOne = base40.map((b, i) => {
      if (i === 0) return { ...b, ponderacion: -0 };
      if (i === 1) return { ...b, ponderacion: 1 };
      return b;
    });
    const validated = validarFormatoPropuesta({ botones: withNegZeroAndOne });
    assert.equal(Object.is(validated.botones[0].ponderacion, 0), true);
    assert.equal(validated.botones[1].ponderacion, 1.0);
  });

  it('elimina propiedades extra en el objeto raíz y en cada botón', () => {
    const base = buildBalancedProposal({ count: 40, zeroCount: 16 });
    const dirty = {
      explicacion: 'No debe persistirse',
      meta: { modelo: 'test' },
      botones: base.botones.map((b, idx) => ({
        ...b,
        id: idx + 1,
        score: 99,
        extra: { nested: true }
      }))
    };

    const validated = validarFormatoPropuesta(dirty);
    assert.deepEqual(Object.keys(validated), ['botones']);
    for (const btn of validated.botones) {
      const keys = Object.keys(btn);
      assert.ok(keys.every((k) => k === 'texto' || k === 'ponderacion' || k === 'categoria'));
      assert.equal(btn.id, undefined);
      assert.equal(btn.score, undefined);
      assert.equal(btn.extra, undefined);
    }
  });

  it('valida, omite vacías y canoniza categorías en validarFormatoPropuesta', () => {
    const base = buildBalancedProposal({
      count: 40,
      categories: ['Gestión Clínica', 'Capacidad Crítica', 'Rutas Activas'],
      zeroCount: 16
    }).botones;

    // undefined, null y '' se tratan como sin categoría (no fallan y no se incluyen)
    const withEmptyCats = base.map((b, idx) => {
      if (idx === 35) return { texto: b.texto, ponderacion: b.ponderacion, categoria: undefined };
      if (idx === 36) return { texto: b.texto, ponderacion: b.ponderacion, categoria: null };
      if (idx === 37) return { texto: b.texto, ponderacion: b.ponderacion, categoria: '' };
      return b;
    });
    const validEmpty = validarFormatoPropuesta({ botones: withEmptyCats });
    assert.equal('categoria' in validEmpty.botones[35], false);
    assert.equal('categoria' in validEmpty.botones[36], false);
    assert.equal('categoria' in validEmpty.botones[37], false);

    // Categorías inválidas: espacios en blanco, no string, solo diacrítico, >80 chars
    for (const badCat of ['   ', 123, {}, '\u0301', 'C'.repeat(81)]) {
      const mut = base.map((b, idx) => (idx === 0 ? { ...b, categoria: badCat } : b));
      assert.throws(() => validarFormatoPropuesta({ botones: mut }), /Categoría inválida/);
    }

    // Exactamente 80 caracteres es válido
    const maxLenCat = 'A'.repeat(80);
    const with80 = base.map((b, idx) => (idx === 0 ? { ...b, categoria: maxLenCat } : b));
    const res80 = validarFormatoPropuesta({ botones: with80 });
    assert.equal(res80.botones[0].categoria, maxLenCat);

    // Canonización de tildes, mayúsculas y espacios múltiples al primer nombre visto
    const withVariants = base.map((b, idx) => {
      if (idx === 3) return { ...b, categoria: '  gestion   clinica ' };
      if (idx === 6) return { ...b, categoria: 'GESTIÓN CLÍNICA' };
      return b;
    });
    const resCanon = validarFormatoPropuesta({ botones: withVariants });
    assert.equal(resCanon.botones[3].categoria, 'Gestión Clínica');
    assert.equal(resCanon.botones[6].categoria, 'Gestión Clínica');
  });

  it('reconstruirPropuestaDesdePlantilla normaliza salidas heterogéneas del LLM y preserva formato multilínea', () => {
    const rawArray = Array.from({ length: 46 }, (_, idx) => {
      if (idx === 0) return 'Tarjeta en texto plano sin objeto';
      if (idx === 1) return { texto: '   ', ponderacion: 1 }; // descartado por vacío
      if (idx === 2) return { texto: null, ponderacion: 0 }; // descartado por inválido

      const pondChoices = ['1', '1.0', true, 0.5, 0.8, '0', false, 0.49, -1, NaN, Infinity, 'texto', null];
      const pond = pondChoices[idx % pondChoices.length];

      const cats = ['Energía Solar', 'Red Troncal', 'Almacenamiento BESS', 'Subestaciones'];
      let categoria = idx < 36 ? cats[idx % cats.length] : undefined;
      if (idx === 4) categoria = 'X'.repeat(81); // descartada sin romper las 4 válidas
      if (idx === 5) categoria = 999; // descartada sin romper las 4 válidas
      if (idx === 7) categoria = '   '; // descartada

      const texto = idx === 10
        ? '  Subestación Norte:\n* Carga: 91%\n* Transformadores: 3/4  '
        : `Métrica energética #${idx}`;

      return { texto, ponderacion: pond, categoria };
    });

    const reconstructed = reconstruirPropuestaDesdePlantilla(rawArray);
    assert.equal(reconstructed.botones.length, 44);
    assert.equal(reconstructed.botones[0].texto, 'Tarjeta en texto plano sin objeto');
    assert.equal(reconstructed.botones[0].ponderacion, 0);
    assert.equal('categoria' in reconstructed.botones[2], false); // idx=4 original -> posición 2 tras 2 descartados
    assert.equal(reconstructed.botones[8].texto, 'Subestación Norte:\n* Carga: 91%\n* Transformadores: 3/4');

    // Verificar tabla de coerción de ponderacion:
    // idx=3 -> pondChoices[3]=0.5 -> 1.0 (posición 1 tras descartar idx 1 y 2)
    assert.equal(reconstructed.botones[1].ponderacion, 1.0);
    // idx=8 -> pondChoices[8]=-1 -> 0 (posición 6)
    assert.equal(reconstructed.botones[6].ponderacion, 0);
    // idx=9 -> pondChoices[9]=NaN -> 0 (posición 7)
    assert.equal(reconstructed.botones[7].ponderacion, 0);

    // Si después de descartar categorías inválidas quedan < 3 categorías, debe fallar
    const fewerCats = buildBalancedProposal({
      count: 42,
      categories: ['Cat Uno', 'Cat Dos', 'X'.repeat(85)],
      zeroCount: 17
    });
    assert.throws(() => reconstruirPropuestaDesdePlantilla(fewerCats), /entre 3 y 5/);

    // Si tras descartar textos vacíos quedan < 40 botones, debe fallar
    const withEmptyDrop = [
      ...buildBalancedProposal({ count: 39, zeroCount: 15 }).botones,
      { texto: '   ', ponderacion: 1 },
      { texto: '', ponderacion: 0 }
    ];
    assert.throws(() => reconstruirPropuestaDesdePlantilla({ botones: withEmptyDrop }), /entre 40 y 60/);

    // Empate de frecuencia al podar > 5 categorías: conserva las 5 primeras por orden de aparición
    const tieBotones = Array.from({ length: 42 }, (_, idx) => {
      const catNames = ['Alfa', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta'];
      const cat = idx < 35 ? catNames[Math.floor(idx / 5)] : undefined; // exactamente 5 cada una
      return { texto: `Elemento empate #${idx + 1}`, ponderacion: idx < 17 ? 0 : 1.0, categoria: cat };
    });
    const pruned = reconstruirPropuestaDesdePlantilla({ botones: tieBotones });
    const kept = new Set(pruned.botones.map((b) => b.categoria).filter(Boolean));
    assert.deepEqual(kept, new Set(['Alfa', 'Beta', 'Gamma', 'Delta', 'Epsilon']));
  });

  it('formatearJsonBotones conserva 1.0 / 0, protege texto interno y mantiene round-trip con obtenerJsonOriginal', () => {
    const sample = buildBalancedProposal({ count: 40, zeroCount: 16 });
    sample.botones[0] = {
      texto: 'Valor "1", "10", "100" y "ponderacion": 1 dentro del texto',
      ponderacion: 1,
      categoria: sample.botones[0].categoria
    };
    sample.botones[1] = {
      texto: 'Texto con ponderacion: 1 sin comillas',
      ponderacion: 0,
      categoria: sample.botones[1].categoria
    };

    const jsonText = formatearJsonBotones(sample);
    assert.match(jsonText, /"ponderacion": 1\.0/);
    assert.match(jsonText, /"ponderacion": 0/);
    assert.equal(/(?<!\\)"ponderacion":\s*1(?![.\d])/.test(jsonText), false);

    const reparsed = JSON.parse(jsonText);
    assert.equal(reparsed.botones[0].texto, sample.botones[0].texto);
    assert.equal(reparsed.botones[1].texto, sample.botones[1].texto);
    assert.deepStrictEqual(validarFormatoPropuesta(reparsed), validarFormatoPropuesta(sample));

    // obtenerJsonOriginal devuelve copia profunda aislada y válida
    const orig1 = obtenerJsonOriginal();
    const orig2 = obtenerJsonOriginal();
    assert.equal(orig1.botones.length, 43);
    assert.deepStrictEqual(orig1, ORIGINAL_JSON);
    orig1.botones[0].texto = 'MUTADO';
    assert.notEqual(orig2.botones[0].texto, 'MUTADO');
    assert.notEqual(ORIGINAL_JSON.botones[0].texto, 'MUTADO');
    assert.equal(validarFormatoPropuesta(orig2).botones.length, 43);
  });
});

describe('Suite 2 — Integridad de generarPropuestaGemini ante salidas corruptas y fallbacks (mock de SDK)', () => {
  let prevApiKey;
  let prevModel;

  before(() => {
    prevApiKey = process.env.GEMINI_API_KEY;
    prevModel = process.env.GEMINI_MODEL;
  });

  afterEach(() => {
    mock.restoreAll();
    if (prevApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevApiKey;
    if (prevModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = prevModel;
  });

  it('lanza error claro si falta GEMINI_API_KEY sin invocar getGenerativeModel', async () => {
    delete process.env.GEMINI_API_KEY;
    let called = false;
    mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => {
      called = true;
      return { generateContent: async () => ({}) };
    });

    await assert.rejects(
      () => generarPropuestaGemini({ tema: 'Red Eléctrica', peticion: 'Test' }),
      /GEMINI_API_KEY/
    );
    assert.equal(called, false);
  });

  it('construye prompt con tema, peticion, elementosSugeridos y rangos, y sanitiza propiedades extra', async () => {
    process.env.GEMINI_API_KEY = 'synthetic-key-suite2';
    process.env.GEMINI_MODEL = 'gemini-custom-test';

    let capturedConfig = null;
    let capturedPrompt = null;
    const rawProposal = buildBalancedProposal({
      count: 48,
      zeroCount: 19,
      includeSuggestions: ['Subestación Norte']
    });
    const dirtyResponse = {
      explicacion: 'Texto extra que debe ser removido',
      botones: rawProposal.botones.map((b, idx) => ({ ...b, idExtra: idx }))
    };

    mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', (config) => {
      capturedConfig = config;
      return {
        generateContent: async (prompt) => {
          capturedPrompt = prompt;
          return {
            response: {
              text: () => JSON.stringify(dirtyResponse)
            }
          };
        }
      };
    });

    const result = await generarPropuestaGemini({
      tema: 'Red Eléctrica Inteligente',
      peticion: 'Evaluar picos industriales',
      elementosSugeridos: ['Subestación Norte', 'Almacenamiento BESS']
    });

    assert.equal(capturedConfig.model, 'gemini-custom-test');
    assert.equal(capturedConfig.generationConfig.responseMimeType, 'application/json');
    assert.match(capturedPrompt, /Red Eléctrica Inteligente/);
    assert.match(capturedPrompt, /Evaluar picos industriales/);
    assert.match(capturedPrompt, /Subestación Norte/);
    assert.match(capturedPrompt, /Almacenamiento BESS/);
    assert.match(capturedPrompt, /entre 40 y 60/);
    assert.match(capturedPrompt, /entre 3 y 5/);

    assert.equal(result.botones.length, 48);
    assert.equal('explicacion' in result, false);
    assert.equal('idExtra' in result.botones[0], false);
  });

  it('rechaza salidas no JSON, truncadas, con markdown fence o vacías sin reintentar otros modelos', async () => {
    process.env.GEMINI_API_KEY = 'synthetic-key-suite2';
    const corruptOutputs = [
      'Aquí tienes el resultado solicitado sin formato JSON.',
      '{"botones":[{"texto":"cortado"',
      '```json\n{"botones":[]}\n```',
      ''
    ];

    for (const rawText of corruptOutputs) {
      let attempts = 0;
      mock.restoreAll();
      mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => {
        attempts += 1;
        return {
          generateContent: async () => ({
            response: { text: () => rawText }
          })
        };
      });

      await assert.rejects(
        () => generarPropuestaGemini({ tema: 'Hospital', peticion: 'Test' }),
        /no es un JSON válido/
      );
      assert.equal(attempts, 1);
    }
  });

  it('rechaza JSON estructuralmente inválido ({}, botones vacío, 39 botones, 2 categorías) en el primer intento', async () => {
    process.env.GEMINI_API_KEY = 'synthetic-key-suite2';
    const invalidPayloads = [
      {},
      { botones: [] },
      buildBalancedProposal({ count: 39, zeroCount: 15 }),
      buildBalancedProposal({ count: 42, categories: ['Solo Uno', 'Solo Dos'], zeroCount: 17 })
    ];

    for (const payload of invalidPayloads) {
      let attempts = 0;
      mock.restoreAll();
      mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => {
        attempts += 1;
        return {
          generateContent: async () => ({
            response: { text: () => JSON.stringify(payload) }
          })
        };
      });

      await assert.rejects(
        () => generarPropuestaGemini({ tema: 'Puerto', peticion: 'Test' })
      );
      assert.equal(attempts, 1);
    }
  });

  it('hace fallback entre modelCandidates ante errores 404/503/"not found"/"demand" y retorna la primera válida', async () => {
    process.env.GEMINI_API_KEY = 'synthetic-key-suite2';
    process.env.GEMINI_MODEL = 'gemini-missing-custom';

    const triedModels = [];
    const valid50 = buildBalancedProposal({ count: 50, zeroCount: 20 });

    mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', ({ model }) => {
      triedModels.push(model);
      return {
        generateContent: async () => {
          if (triedModels.length === 1) {
            const e = new Error('404 model not found');
            e.status = 404;
            throw e;
          }
          if (triedModels.length === 2) {
            const e = new Error('503 high demand');
            e.status = 503;
            throw e;
          }
          if (triedModels.length === 3) {
            throw new Error('Model not found in region');
          }
          if (triedModels.length === 4) {
            throw new Error('Service temporarily overloaded by demand');
          }
          return {
            response: { text: () => JSON.stringify(valid50) }
          };
        }
      };
    });

    const prevWarn = console.warn;
    console.warn = () => {};
    let res;
    try {
      res = await generarPropuestaGemini({ tema: 'Hospital', peticion: 'Fallback' });
    } finally {
      console.warn = prevWarn;
    }

    assert.deepEqual(triedModels, [
      'gemini-missing-custom',
      DEFAULT_GEMINI_MODEL,
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest'
    ]);
    assert.equal(res.botones.length, 50);
  });

  it('falla rápido ante errores no reintentables (401/403) y propaga error cuando todos los candidatos fallan', async () => {
    process.env.GEMINI_API_KEY = 'synthetic-key-suite2';
    delete process.env.GEMINI_MODEL;

    // Caso 401 no reintentable
    let attempts401 = 0;
    mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => {
      attempts401 += 1;
      return {
        generateContent: async () => {
          const e = new Error('API key not valid');
          e.status = 401;
          throw e;
        }
      };
    });
    await assert.rejects(
      () => generarPropuestaGemini({ tema: 'Hospital', peticion: 'Auth' }),
      /API key not valid/
    );
    assert.equal(attempts401, 1);

    // Caso 403 no reintentable
    mock.restoreAll();
    let attempts403 = 0;
    mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => {
      attempts403 += 1;
      return {
        generateContent: async () => {
          const e = new Error('Permission denied');
          e.status = 403;
          throw e;
        }
      };
    });
    await assert.rejects(
      () => generarPropuestaGemini({ tema: 'Hospital', peticion: 'Perm' }),
      /Permission denied/
    );
    assert.equal(attempts403, 1);

    // Caso todos los candidatos fallan con 503
    mock.restoreAll();
    const triedAll = [];
    mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', ({ model }) => {
      triedAll.push(model);
      return {
        generateContent: async () => {
          const e = new Error(`503 unavailable on ${model}`);
          e.status = 503;
          throw e;
        }
      };
    });
    const prevWarn = console.warn;
    console.warn = () => {};
    try {
      await assert.rejects(
        () => generarPropuestaGemini({ tema: 'Hospital', peticion: 'AllFail' }),
        /503 unavailable on gemini-flash-latest/
      );
    } finally {
      console.warn = prevWarn;
    }
    assert.equal(triedAll.length, 4); // DEFAULT_GEMINI_MODEL deduplicado + 3 fallbacks
  });
});

describe('Suite 3 — Integridad end-to-end de la API HTTP /api/ai/* con Gemini y Drive simulados', () => {
  let harness;
  let fx;
  let driveMock;
  let geminiMock;

  const driveState = {
    content: JSON.stringify(ORIGINAL_JSON, null, 2),
    getCalls: [],
    updateCalls: [],
    failGet: false
  };

  before(async () => {
    driveMock = mock.method(google, 'drive', () => ({
      files: {
        get: async (params) => {
          driveState.getCalls.push(params);
          if (driveState.failGet) {
            throw new Error('Simulated Drive read failure');
          }
          return { data: driveState.content };
        },
        update: async (params) => {
          driveState.updateCalls.push({
            fileId: params.fileId,
            mimeType: params.media?.mimeType,
            body: params.media?.body
          });
          driveState.content = params.media?.body;
          return { data: { id: params.fileId } };
        }
      }
    }));

    harness = await startTestServer({
      GEMINI_API_KEY: 'synthetic-gemini-key',
      GEMINI_MODEL: 'gemini-3.5-flash-lite',
      GOOGLE_DRIVE_FILE_ID: 'mock-drive-file-id',
      GOOGLE_CLIENT_EMAIL: 'mock-sa@nexus.test',
      GOOGLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nMOCK\\n-----END PRIVATE KEY-----\\n',
      AI_RATE_LIMIT_MAX: '200'
    });
    fx = await seedBaselineFixtures(harness);
  });

  afterEach(() => {
    if (geminiMock) {
      geminiMock.mock.restore();
      geminiMock = null;
    }
    driveState.failGet = false;
  });

  after(async () => {
    if (geminiMock) geminiMock.mock.restore();
    if (driveMock) driveMock.mock.restore();
    if (harness) await harness.stop();
  });

  it('POST /api/ai/propuesta retorna 200 con propuesta íntegra sin tocar Drive y 400 con body vacío', async () => {
    const validProposal = buildBalancedProposal({
      count: 50,
      zeroCount: 20,
      includeSuggestions: ['UCI Pediátrica', 'Triaje']
    });
    let geminiCalls = 0;

    geminiMock = mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => ({
      generateContent: async () => {
        geminiCalls += 1;
        return { response: { text: () => JSON.stringify(validProposal) } };
      }
    }));

    const updatesBefore = driveState.updateCalls.length;
    const emptyRes = await requestJson(harness.baseUrl, '/api/ai/propuesta', {
      method: 'POST',
      token: fx.users.profA.token,
      body: {}
    });
    assert.equal(emptyRes.status, 400);
    assert.equal(geminiCalls, 0);

    const res = await requestJson(harness.baseUrl, '/api/ai/propuesta', {
      method: 'POST',
      token: fx.users.profA.token,
      body: {
        tema: 'Sistema Hospitalario y Urgencias',
        peticion: 'Saturación de quirófanos',
        elementosSugeridos: ['UCI Pediátrica', 'Triaje']
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(geminiCalls, 1);
    assert.equal(driveState.updateCalls.length, updatesBefore);

    const reporte = evaluarIntegridadRespuestaIA(res.body.propuesta, {
      tema: 'Sistema Hospitalario y Urgencias',
      elementosSugeridos: ['UCI Pediátrica', 'Triaje']
    });
    assert.equal(reporte.estructuraValida, true, JSON.stringify(reporte.erroresEstructurales));
    assert.equal(reporte.calidadValida, true, JSON.stringify(reporte.advertenciasCalidad));
  });

  it('POST /api/ai/propuesta retorna 500 sin propuesta parcial cuando Gemini devuelve salida corrupta', async () => {
    const updatesBefore = driveState.updateCalls.length;
    const prevError = console.error;
    console.error = () => {};

    try {
      for (const rawText of ['no-json-valido', JSON.stringify(buildBalancedProposal({ count: 35, zeroCount: 14 }))]) {
        if (geminiMock) geminiMock.mock.restore();
        geminiMock = mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => ({
          generateContent: async () => ({
            response: { text: () => rawText }
          })
        }));

        const res = await requestJson(harness.baseUrl, '/api/ai/propuesta', {
          method: 'POST',
          token: fx.users.profA.token,
          body: { tema: 'Sistema Hídrico', peticion: 'Generar' }
        });

        assert.equal(res.status, 500);
        assert.ok(res.body.error);
        assert.equal(res.body.propuesta, undefined);
        assert.equal(driveState.updateCalls.length, updatesBefore);
      }
    } finally {
      console.error = prevError;
    }
  });

  it('POST /api/ai/aplicar valida, limpia propiedades extra, actualiza Drive con 1.0/0 y registra AiAuditLog', async () => {
    const previousDriveSnapshot = '{"botones":[{"texto":"Previo","ponderacion":1.0}]}';
    driveState.content = previousDriveSnapshot;
    const updatesBefore = driveState.updateCalls.length;

    const baseProposal = buildBalancedProposal({ count: 45, zeroCount: 18 });
    const dirtyProposal = {
      extraRoot: 'inyeccion-raiz',
      botones: baseProposal.botones.map((b, i) => ({ ...b, injected: `x-${i}` }))
    };

    const applyRes = await requestJson(harness.baseUrl, '/api/ai/aplicar', {
      method: 'POST',
      token: fx.users.profA.token,
      body: {
        tema: 'Red Eléctrica',
        peticion: 'Aplicar versión revisada',
        propuesta: dirtyProposal
      }
    });

    assert.equal(applyRes.status, 200);
    assert.equal(applyRes.body.success, true);
    assert.equal(applyRes.body.archivoId, 'mock-drive-file-id');
    assert.ok(applyRes.body.auditId);

    assert.equal(driveState.updateCalls.length, updatesBefore + 1);
    const lastUpdate = driveState.updateCalls[driveState.updateCalls.length - 1];
    assert.equal(lastUpdate.fileId, 'mock-drive-file-id');
    assert.equal(lastUpdate.mimeType, 'application/json');

    const expectedFormatted = formatearJsonBotones(validarFormatoPropuesta(dirtyProposal));
    assert.equal(lastUpdate.body, expectedFormatted);
    assert.equal(/(?<!\\)"ponderacion":\s*1(?![.\d])/.test(lastUpdate.body), false);
    assert.equal('injected' in applyRes.body.propuesta.botones[0], false);

    const auditRecord = await harness.models.AiAuditLog.findByPk(applyRes.body.auditId);
    assert.ok(auditRecord);
    assert.equal(auditRecord.contenidoAnterior, previousDriveSnapshot);
    assert.equal(auditRecord.contenidoNuevo, expectedFormatted);
    assert.deepStrictEqual(
      validarFormatoPropuesta(JSON.parse(auditRecord.contenidoNuevo)),
      applyRes.body.propuesta
    );

    const histRes = await requestJson(harness.baseUrl, '/api/ai/historial', {
      token: fx.users.profA.token
    });
    assert.equal(histRes.status, 200);
    assert.equal(histRes.body[0].id, applyRes.body.auditId);
    assert.equal(histRes.body[0].usuario.correo, fx.users.profA.user.correo);
  });

  it('POST /api/ai/aplicar rechaza payloads corruptos con 400 sin tocar Drive ni AiAuditLog, y tolera fallo de lectura backup', async () => {
    const updatesBefore = driveState.updateCalls.length;
    const logsBefore = await harness.models.AiAuditLog.count();

    const base45 = buildBalancedProposal({ count: 45, zeroCount: 18 }).botones;
    const badPayloads = [
      { botones: base45.slice(0, 39) },
      { botones: base45.map((b, idx) => ({ ...b, categoria: `Cat Unica ${idx % 6}` })) },
      { botones: base45.map((b, idx) => (idx === 0 ? { ...b, ponderacion: 0.5 } : b)) }
    ];

    for (const propuesta of badPayloads) {
      const badRes = await requestJson(harness.baseUrl, '/api/ai/aplicar', {
        method: 'POST',
        token: fx.users.profA.token,
        body: { tema: 'Inválida', propuesta }
      });
      assert.equal(badRes.status, 400);
    }

    assert.equal(driveState.updateCalls.length, updatesBefore);
    assert.equal(await harness.models.AiAuditLog.count(), logsBefore);

    // Tolerar fallo de lectura de respaldo previo (contenidoAnterior: null)
    driveState.failGet = true;
    const prevWarn = console.warn;
    console.warn = () => {};
    let backupFailRes;
    try {
      backupFailRes = await requestJson(harness.baseUrl, '/api/ai/aplicar', {
        method: 'POST',
        token: fx.users.admin1.token,
        body: {
          tema: 'Sin Backup Previo',
          peticion: 'Lectura Drive fallida',
          propuesta: { botones: base45 }
        }
      });
    } finally {
      console.warn = prevWarn;
    }

    assert.equal(backupFailRes.status, 200);
    const savedLog = await harness.models.AiAuditLog.findByPk(backupFailRes.body.auditId);
    assert.equal(savedLog.contenidoAnterior, null);
    assert.equal(savedLog.contenidoNuevo, formatearJsonBotones(validarFormatoPropuesta({ botones: base45 })));
  });

  it('POST /api/ai/restaurar escribe ORIGINAL_JSON formateado en Drive y registra AiAuditLog con respaldo', async () => {
    const previoEnDrive = '{"botones":[{"texto":"Modificado temporal","ponderacion":0}]}';
    driveState.content = previoEnDrive;

    const res = await requestJson(harness.baseUrl, '/api/ai/restaurar', {
      method: 'POST',
      token: fx.users.admin1.token
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.propuesta.botones.length, 43);

    const expectedOriginalFormatted = formatearJsonBotones(ORIGINAL_JSON);
    assert.equal(driveState.content, expectedOriginalFormatted);
    assert.equal(/(?<!\\)"ponderacion":\s*1(?![.\d])/.test(driveState.content), false);

    const log = await harness.models.AiAuditLog.findByPk(res.body.auditId);
    assert.ok(log);
    assert.equal(log.contenidoAnterior, previoEnDrive);
    assert.equal(log.contenidoNuevo, expectedOriginalFormatted);
  });
});

describe('Suite 4 — Verificación del evaluador de integridad semántica y calidad (aiIntegrityEvaluator)', () => {
  it('acepta una propuesta sintética equilibrada (estructuraValida=true y calidadValida=true)', () => {
    const propuesta = buildBalancedProposal({
      count: 50,
      zeroCount: 20,
      includeSuggestions: ['UCI Pediátrica', 'Triaje']
    });

    const reporte = evaluarIntegridadRespuestaIA(propuesta, {
      tema: 'Sistema Hospitalario y Urgencias',
      elementosSugeridos: ['UCI Pediátrica', 'Triaje']
    });

    assert.equal(reporte.estructuraValida, true, JSON.stringify(reporte.erroresEstructurales));
    assert.equal(reporte.calidadValida, true, JSON.stringify(reporte.advertenciasCalidad));
    assert.equal(reporte.metricas.totalBotones, 50);
    assert.equal(reporte.metricas.porcentajeCeros, 40);
    assert.ok(reporte.metricas.transicionesPonderacion >= 6);
  });

  it('detecta textos duplicados y clase única en ponderaciones como fallos estructurales', () => {
    const dupProp = buildBalancedProposal({ count: 40, zeroCount: 16 });
    dupProp.botones[10].texto = dupProp.botones[0].texto.toUpperCase();
    const repDup = evaluarIntegridadRespuestaIA(dupProp);
    assert.equal(repDup.estructuraValida, false);
    assert.ok(repDup.erroresEstructurales.some((e) => e.codigo === 'TEXTOS_DUPLICADOS'));

    const soloUnos = buildBalancedProposal({ count: 40, zeroCount: 0 });
    const repUnos = evaluarIntegridadRespuestaIA(soloUnos);
    assert.equal(repUnos.estructuraValida, false);
    assert.ok(repUnos.erroresEstructurales.some((e) => e.codigo === 'CLASE_UNICA_PONDERACION'));

    const soloCeros = buildBalancedProposal({ count: 40, zeroCount: 40 });
    const repCeros = evaluarIntegridadRespuestaIA(soloCeros);
    assert.equal(repCeros.estructuraValida, false);
    assert.ok(repCeros.erroresEstructurales.some((e) => e.codigo === 'CLASE_UNICA_PONDERACION'));
  });

  it('detecta proporción sesgada de ceros, falta de mezcla y falta de variedad de formato', () => {
    const sesgada = buildBalancedProposal({ count: 50, zeroCount: 30 }); // 60% ceros
    const repSesgada = evaluarIntegridadRespuestaIA(sesgada);
    assert.equal(repSesgada.estructuraValida, true);
    assert.equal(repSesgada.calidadValida, false);
    assert.ok(repSesgada.advertenciasCalidad.some((a) => a.codigo === 'PROPORCION_CEROS'));

    // Agrupados: 20 ceros seguidos + 30 unos seguidos -> 1 transición
    const agrupada = buildBalancedProposal({ count: 50, zeroCount: 20 });
    agrupada.botones.sort((a, b) => a.ponderacion - b.ponderacion);
    const repAgrupada = evaluarIntegridadRespuestaIA(agrupada);
    assert.ok(repAgrupada.advertenciasCalidad.some((a) => a.codigo === 'MEZCLA_PONDERACIONES'));

    const todoMulti = buildBalancedProposal({ count: 50, zeroCount: 20, ratioMultilinea: 1 });
    assert.ok(
      evaluarIntegridadRespuestaIA(todoMulti).advertenciasCalidad.some(
        (a) => a.codigo === 'VARIEDAD_FORMATO_TEXTO'
      )
    );

    const nadaMulti = buildBalancedProposal({ count: 50, zeroCount: 20, ratioMultilinea: 0 });
    assert.ok(
      evaluarIntegridadRespuestaIA(nadaMulti).advertenciasCalidad.some(
        (a) => a.codigo === 'VARIEDAD_FORMATO_TEXTO'
      )
    );
  });

  it('detecta cobertura extrema de categorías y categorías poco pobladas', () => {
    const sinHuecos = buildBalancedProposal({ count: 50, zeroCount: 20, ratioConCategoria: 1 });
    const repSinHuecos = evaluarIntegridadRespuestaIA(sinHuecos);
    assert.ok(repSinHuecos.advertenciasCalidad.some((a) => a.codigo === 'COBERTURA_CATEGORIAS'));

    const pocoPoblada = buildBalancedProposal({
      count: 40,
      categories: ['Cat A', 'Cat B', 'Cat C'],
      zeroCount: 16,
      ratioConCategoria: 0.75
    });
    // Reasignar todos los Cat C excepto uno a Cat A
    let catCSeen = 0;
    pocoPoblada.botones = pocoPoblada.botones.map((b) => {
      if (b.categoria === 'Cat C') {
        catCSeen += 1;
        if (catCSeen > 1) return { ...b, categoria: 'Cat A' };
      }
      return b;
    });
    const repPocoPoblada = evaluarIntegridadRespuestaIA(pocoPoblada);
    assert.ok(repPocoPoblada.advertenciasCalidad.some((a) => a.codigo === 'CATEGORIA_POCO_POBLADA'));
  });

  it('detecta términos prohibidos en ponderacion 0 distinguiendo prohibidosEnCero vs prohibidosSinNegacion', () => {
    const prop = buildBalancedProposal({ count: 50, zeroCount: 20 });
    const zeroIndices = prop.botones
      .map((b, idx) => (b.ponderacion === 0 ? idx : -1))
      .filter((idx) => idx !== -1);

    prop.botones[zeroIndices[0]].texto = 'Alerta crítica por saturación severa en módulo auxiliar';
    prop.botones[zeroIndices[1]].texto = 'Trámite sin demora en ventanilla administrativa';

    const rep = evaluarIntegridadRespuestaIA(prop);
    assert.ok(rep.advertenciasCalidad.some((a) => a.codigo === 'PROHIBICION_LEXICA_CERO'));
    assert.equal(rep.metricas.prohibidosEnCeroCount, 2);
    assert.equal(rep.metricas.prohibidosSinNegacionCount, 1);
  });

  it('detecta fugas de ORIGINAL_JSON y elementosSugeridos faltantes', () => {
    const prop = buildBalancedProposal({ count: 50, zeroCount: 20 });
    prop.botones[2].texto = ORIGINAL_JSON.botones[0].texto;
    prop.botones[4].texto = 'Corredor Norte a Sur con 25 millones de habitantes en prueba ajena';

    const rep = evaluarIntegridadRespuestaIA(prop, {
      tema: 'Sistema Hospitalario y Urgencias',
      elementosSugeridos: ['UCI Pediátrica', 'Banco de Sangre']
    });

    assert.equal(rep.estructuraValida, false);
    assert.ok(rep.erroresEstructurales.some((e) => e.codigo === 'COPIA_LITERAL_ORIGINAL'));
    assert.ok(rep.advertenciasCalidad.some((a) => a.codigo === 'FUGA_METRICAS_ORIGINAL'));
    assert.ok(rep.advertenciasCalidad.some((a) => a.codigo === 'ELEMENTOS_SUGERIDOS_FALTANTES'));
    assert.deepEqual(rep.metricas.elementosFaltantes, ['UCI Pediátrica', 'Banco de Sangre']);
  });
});

describe('Suite 5 — Consistencia de la sección de IA en FrontEnd (ContenidoIaPanel.jsx)', () => {
  const iaPanelPath = path.join(FRONTEND_DIR, 'src', 'components', 'ContenidoIaPanel.jsx');
  const iaSrc = fs.readFileSync(iaPanelPath, 'utf8');

  it('extraerCategorias replica la normalización NFD + sin tildes + minúsculas + espacios colapsados del backend', () => {
    assert.match(iaSrc, /function\s+extraerCategorias\s*\(/);
    assert.match(iaSrc, /\.normalize\(['"]NFD['"]\)/);
    assert.match(iaSrc, /\\u0300-\\u036f/);
    assert.match(iaSrc, /\.toLowerCase\(\)/);
    assert.match(iaSrc, /\.replace\(\/\\s\+\/g,\s*['"] ['"]\)\.trim\(\)/);

    const fnMatch = iaSrc.match(/function\s+extraerCategorias\s*\(botones\s*=\s*\[\]\)\s*\{[\s\S]*?\n\}/);
    assert.ok(fnMatch, 'Se esperaba encontrar el cuerpo de extraerCategorias');
    const extraerCategorias = new Function(`return (${fnMatch[0]})`)();

    const extracted = extraerCategorias([
      { texto: 'A', ponderacion: 1, categoria: '  Gestión   Clínica ' },
      { texto: 'B', ponderacion: 0, categoria: 'gestion clinica' },
      { texto: 'C', ponderacion: 1, categoria: 'GESTIÓN CLÍNICA' },
      { texto: 'D', ponderacion: 0 },
      { texto: 'E', ponderacion: 1, categoria: 'Flujo Crítico' }
    ]);
    assert.deepEqual(extracted, ['Gestión Clínica', 'Flujo Crítico']);
    assert.equal(normalizarTexto(extracted[0]), 'gestion clinica');
  });

  it('formatearJsonVista coincide con formatearJsonBotones en el formateo de 1.0 y métricas dinámicas', () => {
    assert.match(iaSrc, /function\s+formatearJsonVista\s*\(/);
    assert.match(iaSrc, /\.replace\(\/"ponderacion":\\s\*1\(\?!\[\.\\d\]\)\/g,\s*['"]"ponderacion": 1\.0['"]\)/);

    const fnMatch = iaSrc.match(/function\s+formatearJsonVista\s*\(data\)\s*\{[\s\S]*?\n\}/);
    assert.ok(fnMatch, 'Se esperaba encontrar el cuerpo de formatearJsonVista');
    const formatearJsonVista = new Function(`return (${fnMatch[0]})`)();

    const sample = buildBalancedProposal({ count: 40, zeroCount: 16 });
    assert.equal(formatearJsonVista(sample), formatearJsonBotones(sample));

    assert.match(iaSrc, /\btotalBotones\b/);
    assert.match(iaSrc, /\btotalCorrectos\b/);
    assert.match(iaSrc, /\btotalIncorrectos\b/);
    assert.match(iaSrc, /\bporcentajeIncorrectos\b/);
    assert.match(iaSrc, /\bcategoriasActivas\b/);
    assert.match(iaSrc, /!parsed\s*\|\|\s*!Array\.isArray\(parsed\.botones\)/);
  });
});
