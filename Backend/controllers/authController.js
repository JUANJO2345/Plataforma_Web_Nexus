const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Usuario, sequelize } = require('../models');
const { JWT_SECRET } = require('../middlewares/auth');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Registro de operadores
async function register(req, res, next) {
  try {
    const body = req.body || {};
    const identificador = body.username !== undefined ? body.username : body.correo;
    const clave = body.password !== undefined ? body.password : body.contrasena;

    if (typeof identificador !== 'string' || typeof clave !== 'string') {
      const msg = 'Correo y contraseña deben ser cadenas de texto válidas.';
      return res.status(400).json({ message: msg, error: msg });
    }

    const correoLimpio = identificador.toLowerCase().trim();
    if (!correoLimpio || !clave) {
      const msg = 'Faltan parámetros obligatorios.';
      return res.status(400).json({ message: msg, error: msg });
    }

    if (!EMAIL_REGEX.test(correoLimpio)) {
      const msg = 'Formato de correo inválido.';
      return res.status(400).json({ message: msg, error: msg });
    }

    if (clave.length < 6) {
      const msg = 'La contraseña debe tener al menos 6 caracteres.';
      return res.status(400).json({ message: msg, error: msg });
    }

    // Verificación: no se permite registrar el mismo correo dos veces.
    const usuarioExiste = await Usuario.findOne({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('correo')), correoLimpio)
    });
    if (usuarioExiste) {
      const msg = 'El correo ya está registrado.';
      return res.status(409).json({ message: msg, error: msg });
    }

    const nombreOpcional = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    const nombreFinal = nombreOpcional || correoLimpio.split('@')[0];

    // Cifrado de contraseña con bcrypt.
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(clave, saltRounds);

    const nuevoUsuario = await Usuario.create({
      nombre: nombreFinal,
      correo: correoLimpio,
      contrasena: hashedPassword
    });

    const token = jwt.sign(
      { id: nuevoUsuario.id, correo: nuevoUsuario.correo, rol: nuevoUsuario.rol },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      id: nuevoUsuario.id,
      nombre: nuevoUsuario.nombre,
      correo: nuevoUsuario.correo,
      username: nuevoUsuario.correo,
      rol: nuevoUsuario.rol,
      token,
      status: 'AUTHORIZED'
    });
  } catch (error) {
    console.error('[!] Error crítico en registro:', error.message);
    next(error);
  }
}

// Inicio de sesión / Login
async function login(req, res, next) {
  try {
    const body = req.body || {};
    const identificador = body.username !== undefined ? body.username : body.correo;
    const clave = body.password !== undefined ? body.password : body.contrasena;

    if (typeof identificador !== 'string' || typeof clave !== 'string' || !identificador.trim() || !clave) {
      const msg = 'Correo y clave requeridos.';
      return res.status(400).json({ message: msg, error: msg });
    }

    const identificadorLimpio = identificador.toLowerCase().trim();

    const usuario = await Usuario.findOne({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('correo')), identificadorLimpio)
    });

    const passwordValido = usuario ? await bcrypt.compare(clave, usuario.contrasena) : false;
    if (!usuario || !passwordValido) {
      const msg = 'Credenciales inválidas.';
      return res.status(401).json({ message: msg, error: msg });
    }

    const token = jwt.sign(
      { id: usuario.id, correo: usuario.correo, rol: usuario.rol },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      username: usuario.correo,
      rol: usuario.rol,
      token,
      status: 'LINK_ESTABLISHED'
    });
  } catch (error) {
    console.error('[!] Error crítico en login:', error.message);
    next(error);
  }
}

// Verificación de sesión actual contra base de datos
async function me(req, res, next) {
  try {
    const usuario = await Usuario.findByPk(req.usuario.id, {
      attributes: ['id', 'nombre', 'correo', 'rol']
    });

    if (!usuario) {
      const msg = 'Sesión inválida o usuario no encontrado.';
      return res.status(401).json({ message: msg, error: msg });
    }

    return res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      username: usuario.correo,
      rol: usuario.rol
    });
  } catch (error) {
    console.error('[!] Error al validar sesión actual (/me):', error.message);
    next(error);
  }
}

module.exports = {
  register,
  login,
  me
};
