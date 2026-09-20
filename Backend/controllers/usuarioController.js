const bcrypt = require('bcrypt');
const { Usuario } = require('../models');

// Obtener todos los usuarios (solo admin y profesor)
async function obtenerTodos(req, res, next) {
  try {
    const usuarios = await Usuario.findAll({
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

    const correoLimpio = correo.toLowerCase().trim();
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(contrasena, saltRounds);

    const nuevoUsuario = await Usuario.create({
      nombre: nombre || correoLimpio.split('@')[0],
      correo: correoLimpio,
      contrasena: hashedPassword,
      rol: rol || 'user'
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

    // Solo admin puede modificar el rol del usuario
    if (req.body.rol && req.usuario.rol !== 'admin') {
      delete req.body.rol;
    }

    // Si en la actualización viene una contraseña nueva no vacía, se cifra antes de guardar.
    if (req.body.contrasena && typeof req.body.contrasena === 'string' && req.body.contrasena.trim() !== '') {
      req.body.contrasena = await bcrypt.hash(req.body.contrasena, 10);
    } else {
      delete req.body.contrasena;
    }

    await usuario.update(req.body);
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
