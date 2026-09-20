const { Partida, Usuario } = require('../models');
const {
  incluirUsuarioEnPartida,
  serializarPartida,
  buscarUsuarioParaPartida
} = require('../utils/helpers');

// Obtener todas las partidas con su operador asociado
async function obtenerTodas(req, res, next) {
  try {
    const partidas = await Partida.findAll({
      include: [incluirUsuarioEnPartida],
      order: [['id', 'ASC']]
    });

    res.json(partidas.map(serializarPartida));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las partidas', detalle: error.message });
  }
}

// Obtener una partida específica por ID
async function obtenerPorId(req, res, next) {
  try {
    const partida = await Partida.findByPk(req.params.id, {
      include: [incluirUsuarioEnPartida]
    });
    if (!partida) {
      return res.status(404).json({ error: 'Partida no encontrada' });
    }

    res.json(serializarPartida(partida));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la partida por ID', detalle: error.message });
  }
}

// Crear o registrar una partida asociada a un operador
async function crear(req, res, next) {
  try {
    let usuario;
    if (req.usuario.rol === 'admin') {
      usuario = await buscarUsuarioParaPartida(req.body);
      if (!usuario) {
        usuario = await Usuario.findByPk(req.usuario.id);
      }
    } else {
      // Los estudiantes/operadores solo registran partidas bajo su propia identidad autenticada
      usuario = await Usuario.findByPk(req.usuario.id);
    }

    if (!usuario) {
      return res.status(400).json({ error: 'Debe asignarse un operador registrado a la partida.' });
    }

    const nuevaPartida = await Partida.create({
      usuarioId: usuario.id,
      username: usuario.correo,
      stage: req.body.stage
    });

    const partidaConUsuario = await Partida.findByPk(nuevaPartida.id, {
      include: [incluirUsuarioEnPartida]
    });

    res.status(201).json(serializarPartida(partidaConUsuario));
  } catch (error) {
    res.status(400).json({ error: 'Error al registrar la partida', detalle: error.message });
  }
}

// Actualizar una partida existente
async function actualizar(req, res, next) {
  try {
    const partida = await Partida.findByPk(req.params.id);
    if (!partida) return res.status(404).json({ error: 'Partida no encontrada' });

    // Solo admin o el propio usuario dueño de la partida puede modificarla
    if (req.usuario.rol !== 'admin' && Number(partida.usuarioId) !== Number(req.usuario.id)) {
      return res.status(403).json({ error: 'Acceso denegado: No tienes permiso para modificar esta partida.' });
    }

    const cambios = {};
    if (req.body.stage) cambios.stage = req.body.stage;

    if (req.usuario.rol === 'admin' && (req.body.usuarioId || req.body.username || req.body.correo)) {
      const usuario = await buscarUsuarioParaPartida(req.body);
      if (!usuario) {
        return res.status(400).json({ error: 'El operador asignado no existe.' });
      }
      cambios.usuarioId = usuario.id;
      cambios.username = usuario.correo;
    }

    await partida.update(cambios);

    const partidaActualizada = await Partida.findByPk(partida.id, {
      include: [incluirUsuarioEnPartida]
    });

    res.json({
      message: 'Partida actualizada con éxito',
      partida: serializarPartida(partidaActualizada)
    });
  } catch (error) {
    res.status(400).json({ error: 'Error al actualizar la partida', detalle: error.message });
  }
}

// Eliminar una partida
async function eliminar(req, res, next) {
  try {
    const filasBorradas = await Partida.destroy({ where: { id: req.params.id } });
    if (filasBorradas === 0) return res.status(404).json({ error: 'Partida no encontrada' });

    res.json({ message: 'Partida eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la partida', detalle: error.message });
  }
}

module.exports = {
  obtenerTodas,
  obtenerPorId,
  crear,
  actualizar,
  eliminar
};
