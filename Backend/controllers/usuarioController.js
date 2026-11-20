const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { Usuario } = require('../models');

const ROLES_VALIDOS = ['admin', 'profesor', 'estudiante'];

// Obtener todos los usuarios (solo admin y profesor)
async function obtenerTodos(req, res, next) {
  try {
    const whereClause = req.usuario.rol === 'profesor'
      ? { rol: { [Op.in]: ['estudiante', 'user'] } }
      : {};

    const usuarios = await Usuario.findAll({
      where: whereClause,
      attributes: { exclude: ['contrasena'] },
      order: [['id', 'ASC']]
    });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los usuarios', detalle: error.message });
  }
}

// Obtener un usuario por ID
async function obtenerPorId(req, res, next) {
  try {
    if (req.usuario.rol !== 'admin' && Number(req.usuario.id) !== Number(req.params.id)) {
      return res.status(403).json({ error: 'Acceso denegado: No tienes permiso para consultar este usuario.' });
    }

    const usuario = await Usuario.findByPk(req.params.id, {
      attributes: { exclude: ['contrasena'] }
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el usuario por ID', detalle: error.message });
  }
}

// Crear usuario desde el CRUD de admin
async function crear(req, res, next) {
  try {
    const { correo, contrasena, nombre, rol } = req.body;
    if (!correo || !contrasena) {
      return res.status(400).json({ error: 'Faltan parámetros obligatorios (correo y contraseña).' });
    }

    let rolFinal = 'estudiante';
    if (rol !== undefined && rol !== null && rol !== '') {
      if (!ROLES_VALIDOS.includes(rol)) {
        return res.status(400).json({ error: `Rol inválido. Valores permitidos: ${ROLES_VALIDOS.join(', ')}.` });
      }
      rolFinal = rol;
    }

    const correoLimpio = correo.toLowerCase().trim();
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(contrasena, saltRounds);

    const nuevoUsuario = await Usuario.create({
      nombre: (typeof nombre === 'string' && nombre.trim()) ? nombre.trim() : correoLimpio.split('@')[0],
      correo: correoLimpio,
      contrasena: hashedPassword,
      rol: rolFinal
    });
    const { contrasena: _, ...usuarioSeguro } = nuevoUsuario.toJSON();
    res.status(201).json(usuarioSeguro);
  } catch (error) {
    res.status(400).json({ error: 'Error al registrar el usuario', detalle: error.message });
  }
}

// Actualizar usuario
async function actualizar(req, res, next) {
  try {
    if (req.usuario.rol !== 'admin' && Number(req.usuario.id) !== Number(req.params.id)) {
      return res.status(403).json({ error: 'Acceso denegado: No tienes permiso para modificar este usuario.' });
    }

    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const body = req.body || {};
    const cambios = {};

    if (typeof body.nombre === 'string' && body.nombre.trim() !== '') {
      cambios.nombre = body.nombre.trim();
    }

    if (typeof body.correo === 'string' && body.correo.trim() !== '') {
      cambios.correo = body.correo.toLowerCase().trim();
    }

    // Solo admin puede modificar el rol del usuario
    if (req.usuario.rol === 'admin' && body.rol !== undefined) {
      if (!ROLES_VALIDOS.includes(body.rol)) {
        return res.status(400).json({ error: `Rol inválido. Valores permitidos: ${ROLES_VALIDOS.join(', ')}.` });
      }
      cambios.rol = body.rol;
    }

    // Si en la actualización viene una contraseña nueva no vacía, se cifra antes de guardar.
    if (typeof body.contrasena === 'string' && body.contrasena.trim() !== '') {
      cambios.contrasena = await bcrypt.hash(body.contrasena, 10);
    }

    await usuario.update(cambios);
    const { contrasena: _, ...usuarioSeguro } = usuario.toJSON();
    res.json({ message: 'Usuario actualizado con éxito', usuario: usuarioSeguro });
  } catch (error) {
    res.status(400).json({ error: 'Error al actualizar el usuario', detalle: error.message });
  }
}

// Eliminar usuario
async function eliminar(req, res, next) {
  try {
    const filasBorradas = await Usuario.destroy({ where: { id: req.params.id } });
    if (filasBorradas === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el usuario', detalle: error.message });
  }
}

module.exports = {
  obtenerTodos,
  obtenerPorId,
  crear,
  actualizar,
  eliminar
};
