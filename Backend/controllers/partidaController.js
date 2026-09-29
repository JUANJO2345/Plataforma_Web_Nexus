const { Partida, Usuario, Etapa, Nivel, ResultadoNivel } = require('../models');
const {
  incluirUsuarioEnPartida,
  serializarPartida,
  buscarUsuarioParaPartida
} = require('../utils/helpers');

const incluirResultados = {
  model: ResultadoNivel,
  as: 'resultados',
  include: [{
    model: Nivel,
    as: 'nivel',
    include: [{ model: Etapa, as: 'etapa' }]
  }]
};

async function buscarPartidaCompleta(id) {
  return Partida.findByPk(id, {
    include: [incluirUsuarioEnPartida, incluirResultados]
  });
}

function normalizarResultados(resultados) {
  if (!Array.isArray(resultados) || resultados.length === 0) {
    throw new Error('La partida debe incluir al menos un resultado de nivel.');
  }

  return resultados.map((resultado) => ({
    nivelId: Number(resultado.nivelId),
    puntaje: Number(resultado.puntaje),
    tiempoSegundos: Number(resultado.tiempoSegundos)
  }));
}

function validarResultados(resultados) {
  const valoresInvalidos = resultados.some((resultado) => (
    !Number.isInteger(resultado.nivelId)
    || resultado.nivelId < 1
    || !Number.isInteger(resultado.puntaje)
    || resultado.puntaje < 0
    || !Number.isInteger(resultado.tiempoSegundos)
    || resultado.tiempoSegundos < 0
  ));

  if (valoresInvalidos) {
    throw new Error('Cada resultado debe incluir un nivel y puntaje y tiempo como enteros no negativos.');
  }

  const nivelIds = resultados.map((resultado) => resultado.nivelId);
  if (new Set(nivelIds).size !== nivelIds.length) {
    throw new Error('No se puede repetir un nivel en la misma partida.');
  }
}

async function reemplazarResultados(partida, resultados, transaction) {
  validarResultados(resultados);
  const nivelIds = resultados.map((resultado) => resultado.nivelId);
  const nivelesEncontrados = await Nivel.count({
    where: { id: nivelIds },
    transaction
  });

  if (nivelesEncontrados !== nivelIds.length) {
    throw new Error('Uno o más niveles no existen.');
  }

  await ResultadoNivel.destroy({ where: { partidaId: partida.id }, transaction });
  await ResultadoNivel.bulkCreate(
    resultados.map((resultado) => ({ ...resultado, partidaId: partida.id })),
    { transaction }
  );
}

async function obtenerTodas(req, res) {
  try {
    const partidas = await Partida.findAll({
      include: [incluirUsuarioEnPartida, incluirResultados],
      order: [['id', 'ASC']]
    });
    res.json(partidas.map(serializarPartida));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las partidas', detalle: error.message });
  }
}

async function obtenerPorId(req, res) {
  try {
    const partida = await buscarPartidaCompleta(req.params.id);
    if (!partida) return res.status(404).json({ error: 'Partida no encontrada' });
    res.json(serializarPartida(partida));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la partida por ID', detalle: error.message });
  }
}

async function crear(req, res) {
  let transaction;
  try {
    transaction = await Partida.sequelize.transaction();
    const usuario = req.usuario.rol === 'admin'
      ? await buscarUsuarioParaPartida(req.body) || await Usuario.findByPk(req.usuario.id)
      : await Usuario.findByPk(req.usuario.id);

    if (!usuario) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Debe asignarse un usuario registrado a la partida.' });
    }

    const resultados = normalizarResultados(req.body.resultados);
    validarResultados(resultados);
    const partida = await Partida.create({
      usuarioId: usuario.id,
      username: usuario.correo
    }, { transaction });

    await reemplazarResultados(partida, resultados, transaction);
    await transaction.commit();
    res.status(201).json(serializarPartida(await buscarPartidaCompleta(partida.id)));
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    res.status(400).json({ error: 'Error al registrar la partida', detalle: error.message });
  }
}

async function actualizar(req, res) {
  let transaction;
  try {
    transaction = await Partida.sequelize.transaction();
    const partida = await Partida.findByPk(req.params.id);
    if (!partida) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Partida no encontrada' });
    }

    const esPropietario = Number(partida.usuarioId) === Number(req.usuario.id);
    if (req.usuario.rol !== 'admin' && !esPropietario) {
      await transaction.rollback();
      return res.status(403).json({ error: 'No tienes permiso para modificar esta partida.' });
    }

    if (req.body.resultados !== undefined) {
      const resultados = normalizarResultados(req.body.resultados);
      await reemplazarResultados(partida, resultados, transaction);
    }

    if (req.usuario.rol === 'admin' && (req.body.usuarioId || req.body.username || req.body.correo)) {
      const usuario = await buscarUsuarioParaPartida(req.body);
      if (!usuario) throw new Error('El usuario asignado no existe.');
      await partida.update({ usuarioId: usuario.id, username: usuario.correo }, { transaction });
    }

    await transaction.commit();
    const partidaActualizada = await buscarPartidaCompleta(partida.id);
    res.json({
      message: 'Partida actualizada con éxito',
      partida: serializarPartida(partidaActualizada)
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    res.status(400).json({ error: 'Error al actualizar la partida', detalle: error.message });
  }
}

async function eliminar(req, res) {
  try {
    const filasEliminadas = await Partida.destroy({ where: { id: req.params.id } });
    if (filasEliminadas === 0) return res.status(404).json({ error: 'Partida no encontrada' });
    res.json({ message: 'Partida eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la partida', detalle: error.message });
  }
}

async function obtenerCatalogo(req, res) {
  try {
    const etapas = await Etapa.findAll({
      where: { activa: true },
      include: [{ model: Nivel, as: 'niveles' }],
      order: [['orden', 'ASC']]
    });
    res.json(etapas.map((etapa) => ({
      ...etapa.toJSON(),
      niveles: etapa.niveles.sort((a, b) => a.orden - b.orden)
    })));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener etapas y niveles', detalle: error.message });
  }
}

module.exports = {
  obtenerTodas,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  obtenerCatalogo
};
