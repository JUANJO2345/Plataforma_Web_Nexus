const { sequelize, Etapa, Nivel, Partida, ResultadoNivel } = require('../models');
const { QueryTypes, DataTypes } = require('sequelize');

const CATALOGO = [
  { clave: 'abstraccion', nombre: 'Abstracción', niveles: 3 },
  { clave: 'pensamiento_computacional', nombre: 'Pensamiento computacional', niveles: 4 },
  { clave: 'descomposicion', nombre: 'Descomposición', niveles: 4 },
  { clave: 'reconocimiento_patrones', nombre: 'Reconocimiento de patrones', niveles: 4 }
];

function leerDatosHeredados(valor) {
  try {
    return typeof valor === 'string' ? JSON.parse(valor) : valor;
  } catch {
    throw new Error('Hay una partida con datos heredados ilegibles; se conserva la columna antigua para revisión.');
  }
}

async function inicializarPartidas() {
  const catalogo = new Map();
  for (const [indice, definicion] of CATALOGO.entries()) {
    const [etapa] = await Etapa.findOrCreate({
      where: { clave: definicion.clave },
      defaults: { nombre: definicion.nombre, orden: indice + 1 }
    });
    const niveles = new Map();
    for (let orden = 1; orden <= definicion.niveles; orden += 1) {
      const clave = `n${orden}`;
      const [nivel] = await Nivel.findOrCreate({
        where: { etapaId: etapa.id, clave },
        defaults: { nombre: `Nivel ${orden}`, orden }
      });
      niveles.set(clave, nivel);
    }
    catalogo.set(definicion.clave, niveles);
  }

  const columnas = await sequelize.getQueryInterface().describeTable('Partidas');
  if (!columnas.fecha) {
    await sequelize.getQueryInterface().addColumn('Partidas', 'fecha', {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    });
    await sequelize.query('UPDATE Partidas SET fecha = CURRENT_TIMESTAMP WHERE fecha IS NULL');
  }
  if (!columnas.claveSeed) {
    await sequelize.getQueryInterface().addColumn('Partidas', 'claveSeed', {
      type: DataTypes.STRING,
      allowNull: true
    });
  }
  if (!columnas.observacion) {
    await sequelize.getQueryInterface().addColumn('Partidas', 'observacion', {
      type: DataTypes.TEXT,
      allowNull: true
    });
  }
  const indices = await sequelize.getQueryInterface().showIndex('Partidas');
  if (!indices.some((indice) => indice.name === 'partidas_clave_seed_unique')) {
    await sequelize.getQueryInterface().addIndex('Partidas', ['claveSeed'], {
      name: 'partidas_clave_seed_unique',
      unique: true
    });
  }
  if (!columnas.stage) return;

  const partidas = await sequelize.query('SELECT id, stage FROM Partidas WHERE stage IS NOT NULL', {
    type: QueryTypes.SELECT
  });
  for (const partida of partidas) {
    const datos = leerDatosHeredados(partida.stage);
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
      throw new Error(`La partida ${partida.id} tiene datos heredados en un formato no compatible.`);
    }
    let resultadosImportados = 0;

    // Compatibilidad con los registros antiguos de ejemplo que no usaban claves de etapa.
    if (Object.hasOwn(datos, 'level') && Object.hasOwn(datos, 'score')
      && Number.isInteger(Number(datos.level)) && Number.isFinite(Number(datos.score))) {
      const nivelClave = `n${Math.max(1, Number(datos.level))}`;
      const niveles = catalogo.get('abstraccion');
      let nivel = niveles.get(nivelClave);
      if (!nivel) {
        const etapa = await Etapa.findOne({ where: { clave: 'abstraccion' } });
        [nivel] = await Nivel.findOrCreate({
          where: { etapaId: etapa.id, clave: nivelClave },
          defaults: { nombre: `Nivel ${datos.level}`, orden: Number(datos.level) }
        });
      }
      await ResultadoNivel.findOrCreate({
        where: { partidaId: partida.id, nivelId: nivel.id },
        defaults: { puntaje: Math.max(0, Number(datos.score) || 0), tiempoSegundos: 0 }
      });
      resultadosImportados += 1;
      continue;
    }
    for (const [claveEtapa, niveles] of Object.entries(datos)) {
      const nivelesCatalogo = catalogo.get(claveEtapa);
      if (!nivelesCatalogo) {
        throw new Error(`La partida ${partida.id} contiene una etapa heredada desconocida: ${claveEtapa}.`);
      }
      if (!niveles || typeof niveles !== 'object' || Array.isArray(niveles)) {
        throw new Error(`La etapa ${claveEtapa} de la partida ${partida.id} tiene niveles inválidos.`);
      }
      for (const [claveNivel, valores] of Object.entries(niveles)) {
        let nivel = nivelesCatalogo.get(claveNivel);
        // Conserva resultados históricos si una etapa tenía más niveles que el catálogo inicial.
        if (!nivel && /^n\d+$/.test(claveNivel)) {
          const orden = Number(claveNivel.slice(1));
          const etapa = await Etapa.findOne({ where: { clave: claveEtapa } });
          [nivel] = await Nivel.findOrCreate({
            where: { etapaId: etapa.id, clave: claveNivel },
            defaults: { nombre: `Nivel ${orden}`, orden }
          });
          nivelesCatalogo.set(claveNivel, nivel);
        }
        if (!nivel || !valores || typeof valores !== 'object' || Array.isArray(valores)) {
          throw new Error(`La partida ${partida.id} contiene un resultado de nivel inválido.`);
        }
        await ResultadoNivel.findOrCreate({
          where: { partidaId: partida.id, nivelId: nivel.id },
          defaults: {
            puntaje: Math.max(0, Number(valores.puntaje) || 0),
            tiempoSegundos: Math.max(0, Number(valores.tiempo_seg) || 0)
          }
        });
        resultadosImportados += 1;
      }
    }
    if (Object.keys(datos).length > 0 && resultadosImportados === 0) {
      throw new Error(`No se pudieron migrar resultados de la partida ${partida.id}; se conserva la columna antigua.`);
    }
  }

  await sequelize.getQueryInterface().removeColumn('Partidas', 'stage');
}

module.exports = { inicializarPartidas, CATALOGO };
