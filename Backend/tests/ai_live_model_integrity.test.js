const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { generarPropuestaGemini, getGeminiModel } = require('../utils/geminiService');
const { evaluarIntegridadRespuestaIA } = require('./helpers/aiIntegrityEvaluator');

const LIVE_ENABLED = process.env.RUN_LIVE_AI_TESTS === '1';

const ESCENARIOS_EN_VIVO = [
  {
    nombre: 'Escenario 1: Hospitalario',
    tema: 'Sistema Hospitalario y Urgencias',
    peticion: 'Enfocar los puntos críticos en saturación de quirófanos y tiempos de respuesta de ambulancias.',
    elementosSugeridos: ['UCI Pediátrica', 'Triaje']
  },
  {
    nombre: 'Escenario 2: Red Eléctrica',
    tema: 'Red Eléctrica Inteligente',
    peticion: 'Evaluar picos de demanda industrial y estabilidad de subestaciones.',
    elementosSugeridos: ['Subestación Norte', 'Almacenamiento BESS']
  },
  {
    nombre: 'Escenario 3: Logística Portuaria (sin petición ni sugeridos)',
    tema: 'Logística Portuaria y Aduanas',
    peticion: '',
    elementosSugeridos: []
  }
];

describe(
  'Live Gemini Model Response Integrity Suite',
  {
    skip: !LIVE_ENABLED
      ? 'Omitida en modo offline; ejecuta con RUN_LIVE_AI_TESTS=1 para evaluar el modelo real de Gemini'
      : false,
    concurrency: false
  },
  () => {
    before(() => {
      require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
      assert.ok(
        (process.env.GEMINI_API_KEY || '').trim(),
        'GEMINI_API_KEY es obligatoria para pruebas en vivo'
      );
    });

    for (const escenario of ESCENARIOS_EN_VIVO) {
      describe(escenario.nombre, { timeout: 60000, concurrency: false }, () => {
        let propuesta = null;
        let latenciaMs = 0;
        let reporte = null;
        let errorGeneracion = null;

        before(async () => {
          const t0 = Date.now();
          try {
            propuesta = await generarPropuestaGemini({
              tema: escenario.tema,
              peticion: escenario.peticion,
              elementosSugeridos: escenario.elementosSugeridos
            });
            latenciaMs = Date.now() - t0;
            reporte = evaluarIntegridadRespuestaIA(propuesta, {
              tema: escenario.tema,
              elementosSugeridos: escenario.elementosSugeridos
            });
          } catch (err) {
            latenciaMs = Date.now() - t0;
            errorGeneracion = err;
          }
        }, { timeout: 60000 });

        it('Integridad estructural estricta (contrato JSON/VR)', { timeout: 60000 }, (t) => {
          t.diagnostic(`Modelo configurado: ${getGeminiModel()} | Latencia: ${latenciaMs} ms`);
          assert.ifError(errorGeneracion);
          assert.ok(reporte, 'Se esperaba un reporte de integridad.');

          const m = reporte.metricas;
          if (m) {
            t.diagnostic(
              `Botones: ${m.totalBotones} | Correctos(1.0): ${m.totalCorrectos} | ` +
              `Incorrectos(0): ${m.totalIncorrectos} (${m.porcentajeCeros}%) | ` +
              `Categorías: ${m.totalCategorias} | Duplicados: ${m.duplicadosTextoCount} | ` +
              `Copias original: ${m.copiasOriginalesCount}`
            );
          }

          assert.equal(
            reporte.estructuraValida,
            true,
            `Errores estructurales detectados:\n${JSON.stringify(reporte.erroresEstructurales, null, 2)}`
          );
        });

        it('Integridad semántica y adherencia al prompt (calidad del modelo)', { timeout: 60000 }, (t) => {
          assert.ifError(errorGeneracion);
          assert.ok(reporte, 'Se esperaba un reporte de integridad.');

          const m = reporte.metricas;
          t.diagnostic(JSON.stringify({
            latenciaMs,
            totalBotones: m.totalBotones,
            correctos: m.totalCorrectos,
            incorrectos: m.totalIncorrectos,
            porcentajeCeros: m.porcentajeCeros,
            transicionesMezcla: m.transicionesPonderacion,
            totalCategorias: m.totalCategorias,
            categorias: m.categorias,
            conCategoria: m.conCategoriaCount,
            sinCategoria: m.sinCategoriaCount,
            porcentajeConCategoria: m.porcentajeConCategoria,
            multilinea: m.multilineaCount,
            unilinea: m.unilineaCount,
            multilineaConVinetas: m.multilineaConVinetasCount,
            porcentajeMultilinea: m.porcentajeMultilinea,
            prohibidosEnCeroCount: m.prohibidosEnCeroCount,
            prohibidosSinNegacionCount: m.prohibidosSinNegacionCount,
            fugasOriginalCount: m.fugasOriginalCount,
            elementosEncontrados: m.elementosEncontrados,
            elementosFaltantes: m.elementosFaltantes
          }, null, 2));

          assert.equal(
            reporte.calidadValida,
            true,
            `Advertencias semánticas/calidad detectadas:\n${JSON.stringify(reporte.advertenciasCalidad, null, 2)}`
          );
        });
      });
    }
  }
);
