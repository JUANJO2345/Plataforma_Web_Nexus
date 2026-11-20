const { Op } = require('sequelize');
const { Partida, Usuario, Grupo, Etapa, Nivel, ResultadoNivel } = require('../models');
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

async function obtenerEstudiantesDeProfesor(profesorId) {
  const grupos = await Grupo.findAll({
    where: { profesorId: Number(profesorId) },
    include: [{
      model: Usuario,
      as: 'estudiantes',
      attributes: ['id'],
      through: { attributes: [] }
    }]
  });

  const ids = new Set();
  for (const grupo of grupos) {
    for (const estudiante of grupo.estudiantes || []) {
      ids.add(Number(estudiante.id));
    }
  }
  return Array.from(ids);
}

function serializarPartidaRanking(partida) {
  const data = partida.toJSON();
  const nombreFallback = data.username ? String(data.username).split('@')[0] : 'Operador';
  return {
    id: data.id,
    usuarioId: data.usuarioId,
    nombre: data.usuario?.nombre || nombreFallback,
    fecha: data.fecha || data.createdAt || null,
    resultados: (data.resultados || []).map((r) => ({
      id: r.id,
      partidaId: r.partidaId,
      nivelId: r.nivelId,
      puntaje: Number(r.puntaje) || 0,
      tiempoSegundos: Number(r.tiempoSegundos) || 0,
      nivel: r.nivel ? {
        id: r.nivel.id,
        etapaId: r.nivel.etapaId,
        clave: r.nivel.clave,
        nombre: r.nivel.nombre,
        orden: r.nivel.orden,
        puntajeMaximo: r.nivel.puntajeMaximo,
        etapa: r.nivel.etapa ? {
          id: r.nivel.etapa.id,
          nombre: r.nivel.etapa.nombre,
          clave: r.nivel.etapa.clave,
          orden: r.nivel.etapa.orden
        } : null
      } : null
    }))
  };
}

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
    const rol = req.usuario.rol || 'estudiante';
    const whereClause = {};

    if (rol === 'profesor') {
      const studentIds = await obtenerEstudiantesDeProfesor(req.usuario.id);
      if (studentIds.length === 0) {
        return res.json([]);
      }
      whereClause.usuarioId = { [Op.in]: studentIds };
    } else if (rol !== 'admin') {
      whereClause.usuarioId = Number(req.usuario.id);
    }

    const partidas = await Partida.findAll({
      where: whereClause,
      include: [incluirUsuarioEnPartida, incluirResultados],
      order: [['id', 'ASC']]
    });
    res.json(partidas.map(serializarPartida));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las partidas', detalle: error.message });
  }
}

async function obtenerRanking(req, res) {
  try {
    const whereClause = {};
    const rawGrupoId = req.query.grupoId;

    if (rawGrupoId !== undefined && String(rawGrupoId).trim() !== '' && String(rawGrupoId).trim().toLowerCase() !== 'global') {
      const grupoId = Number(rawGrupoId);
      if (!Number.isInteger(grupoId) || grupoId < 1) {
        return res.status(400).json({ error: 'El parámetro grupoId debe ser un entero positivo.' });
      }

      const grupo = await Grupo.findByPk(grupoId, {
        include: [{
          model: Usuario,
          as: 'estudiantes',
          attributes: ['id'],
          through: { attributes: [] }
        }]
      });

      if (!grupo || !grupo.estudiantes || grupo.estudiantes.length === 0) {
        return res.json([]);
      }

      const studentIds = grupo.estudiantes.map((e) => Number(e.id));
      whereClause.usuarioId = { [Op.in]: studentIds };
    }

    const partidas = await Partida.findAll({
      where: whereClause,
      include: [incluirUsuarioEnPartida, incluirResultados],
      order: [['id', 'ASC']]
    });
    res.json(partidas.map(serializarPartidaRanking));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el ranking de partidas', detalle: error.message });
  }
}

async function obtenerPorId(req, res) {
  try {
    const partida = await buscarPartidaCompleta(req.params.id);
    if (!partida) return res.status(404).json({ error: 'Partida no encontrada' });

    const rol = req.usuario.rol || 'estudiante';
    if (rol === 'profesor') {
      const studentIds = await obtenerEstudiantesDeProfesor(req.usuario.id);
      if (partida.usuarioId == null || !studentIds.includes(Number(partida.usuarioId))) {
        return res.status(403).json({ error: 'Acceso denegado: Esta partida no pertenece a un estudiante de tus grupos.' });
      }
    } else if (rol !== 'admin') {
      if (partida.usuarioId == null || Number(partida.usuarioId) !== Number(req.usuario.id)) {
        return res.status(403).json({ error: 'Acceso denegado: No tienes permiso para consultar esta partida.' });
      }
    }

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

    const body = req.body || {};
    const esPropietario = partida.usuarioId != null && Number(partida.usuarioId) === Number(req.usuario.id);
    if (req.usuario.rol !== 'admin' && !esPropietario) {
      await transaction.rollback();
      return res.status(403).json({ error: 'No tienes permiso para modificar esta partida.' });
    }

    const intentaCambiarDueno = (
      (body.usuarioId !== undefined && Number(body.usuarioId) !== Number(partida.usuarioId))
      || (body.username !== undefined && String(body.username).toLowerCase().trim() !== String(partida.username || req.usuario.correo || '').toLowerCase().trim())
      || (body.correo !== undefined && String(body.correo).toLowerCase().trim() !== String(req.usuario.correo || partida.username || '').toLowerCase().trim())
    );
    if (req.usuario.rol !== 'admin' && intentaCambiarDueno) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Solo un administrador puede reasignar el propietario de una partida.' });
    }

    if (body.resultados !== undefined) {
      const resultados = normalizarResultados(body.resultados);
      await reemplazarResultados(partida, resultados, transaction);
    }

    if (req.usuario.rol === 'admin' && (body.usuarioId || body.username || body.correo)) {
      const usuario = await buscarUsuarioParaPartida(body);
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

async function guardarObservacion(req, res) {
  try {
    const { id } = req.params;
    const { observacion } = req.body;

    const partida = await Partida.findByPk(id);
    if (!partida) {
      return res.status(404).json({ error: 'Registro de partida no encontrado' });
    }

    if (req.usuario.rol !== 'profesor' && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo un profesor o administrador puede registrar observaciones en este registro.' });
    }

    if (req.usuario.rol === 'profesor') {
      const studentIds = await obtenerEstudiantesDeProfesor(req.usuario.id);
      if (partida.usuarioId == null || !studentIds.includes(Number(partida.usuarioId))) {
        return res.status(403).json({ error: 'Solo puedes registrar observaciones en partidas de estudiantes inscritos en tus grupos.' });
      }
    }

    await partida.update({
      observacion: typeof observacion === 'string' ? observacion.trim() : null
    });

    const partidaActualizada = await buscarPartidaCompleta(id);
    res.json({
      message: 'Observación registrada correctamente para este registro.',
      partida: serializarPartida(partidaActualizada)
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar la observación', detalle: error.message });
  }
}

module.exports = {
  obtenerTodas,
  obtenerRanking,
  obtenerPorId,
  crear,
  actualizar,
  guardarObservacion,
  eliminar,
  obtenerCatalogo
};
