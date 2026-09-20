const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { Usuario, sequelize } = require('../models');
const { JWT_SECRET } = require('../middlewares/auth');

// Registro de operadores
async function register(req, res, next) {
  try {
    console.log('\n--- [API_REGISTER_REQUEST] ---');
    console.log('Body recibido:', req.body);

    const identificador = req.body.username || req.body.correo;
    const clave = req.body.password || req.body.contrasena;

    if (!identificador || !clave) {
      console.log('[!] Registro rechazado: faltan parámetros en el Body.');
      return res.status(400).json({ message: 'Faltan parámetros obligatorios.' });
    }

    const correoLimpio = identificador.toLowerCase().trim();

    // Verificación: no se permite registrar el mismo operador dos veces.
    const usuarioExiste = await Usuario.findOne({ where: { correo: correoLimpio } });
    if (usuarioExiste) {
      console.log(`[!] Registro rechazado: el correo ${correoLimpio} ya existe.`);
      return res.status(400).json({ message: 'El nombre de operador ya está registrado.' });
    }

    // Nombre automático: toma lo que esté antes del '@' para llenar el campo obligatorio del modelo.
    const nombreAutomatico = correoLimpio.split('@')[0];

    // Cifrado de contraseña con bcrypt.
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(clave, saltRounds);

    const nuevoUsuario = await Usuario.create({
      nombre: nombreAutomatico,
      correo: correoLimpio,
      contrasena: hashedPassword
    });

    console.log(`>> [SUCCESS] Nuevo operador creado con éxito: ${correoLimpio} (Nombre: ${nombreAutomatico})`);

    const token = jwt.sign(
      { id: nuevoUsuario.id, correo: nuevoUsuario.correo, rol: nuevoUsuario.rol },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      id: nuevoUsuario.id,
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
    console.log('\n--- [API_LOGIN_REQUEST] ---');
    console.log('Body recibido:', req.body);

    const identificador = req.body.username || req.body.correo;
    const clave = req.body.password || req.body.contrasena;

    if (!identificador || !clave) {
      return res.status(400).json({ message: 'Correo y clave requeridos.' });
    }

    const identificadorLimpio = identificador.toLowerCase().trim();
    console.log('>> Buscando operador:', identificadorLimpio);

    const usuario = await Usuario.findOne({
      where: {
        [Op.or]: [
          sequelize.where(sequelize.fn('LOWER', sequelize.col('correo')), identificadorLimpio),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('nombre')), identificadorLimpio),
          { correo: { [Op.like]: `${identificadorLimpio}@%` } }
        ]
      }
    });

    if (!usuario) {
      console.log(`[!] Login fallido: el usuario o correo ${identificadorLimpio} no existe.`);
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const passwordValido = await bcrypt.compare(clave, usuario.contrasena);
    if (!passwordValido) {
      console.log(`[!] Login fallido: contraseña incorrecta para ${identificadorLimpio}.`);
      return res.status(401).json({ message: 'Fallo en la verificación de seguridad.' });
    }

    console.log(`>> [SUCCESS] Enlace establecido para: ${identificadorLimpio}`);

    const token = jwt.sign(
      { id: usuario.id, correo: usuario.correo, rol: usuario.rol },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      id: usuario.id,
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

module.exports = {
  register,
  login
};
