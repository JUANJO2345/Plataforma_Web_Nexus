const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const sequelize = require('./config/database');
const Partida = require('./models/Partida');
const Usuario = require('./models/Usuario');

const app = express();

// ==========================================
// RELACIONES ENTRE MODELOS
// ==========================================
// Una partida pertenece a un operador. Esta relación permite consultar
// telemetrías, rankings e historial sin depender de correos guardados como texto suelto.
Usuario.hasMany(Partida, {
  foreignKey: 'usuarioId',
  as: 'partidas',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

Partida.belongsTo(Usuario, {
  foreignKey: 'usuarioId',
  as: 'usuario'
});

const incluirUsuarioEnPartida = {
  model: Usuario,
  as: 'usuario',
  attributes: ['id', 'nombre', 'correo', 'rol']
};

function serializarPartida(partida) {
  const data = partida.toJSON();
  return {
    ...data,
    username: data.usuario?.correo || data.username || null
  };
}

async function buscarUsuarioParaPartida(body) {
  if (body.usuarioId) {
    return Usuario.findByPk(body.usuarioId);
  }

  const identificador = body.username || body.correo;
  if (!identificador) return null;

  return Usuario.findOne({
    where: { correo: identificador.toLowerCase().trim() }
  });
}

// ==========================================
// MIDDLEWARES (SIEMPRE PRIMERO)
// ==========================================
app.use(cors());
app.use(express.json()); // Permite a Express entender cuerpos JSON en los POST y PUT.

// ==========================================
// ENDPOINTS DE AUTENTICACIÓN (LOGIN / REGISTER)
// ==========================================

// Registro de operadores. Soporta 'username'/'password' de React y 'correo'/'contrasena' de Thunder Client.
app.post('/api/auth/register', async (req, res) => {
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

    res.status(201).json({
      id: nuevoUsuario.id,
      username: nuevoUsuario.correo,
      rol: nuevoUsuario.rol,
      status: 'AUTHORIZED'
    });
  } catch (error) {
    console.error('[!] Error crítico en registro:', error.message);
    res.status(500).json({ message: `Error en registro: ${error.message}` });
  }
});

// Inicio de sesión / Login.
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('\n--- [API_LOGIN_REQUEST] ---');
    console.log('Body recibido:', req.body);

    const identificador = req.body.username || req.body.correo;
    const clave = req.body.password || req.body.contrasena;

    if (!identificador || !clave) {
      return res.status(400).json({ message: 'Correo y clave requeridos.' });
    }

    const correoLimpio = identificador.toLowerCase().trim();
    console.log('>> Buscando operador:', correoLimpio);

    const usuario = await Usuario.findOne({ where: { correo: correoLimpio } });
    if (!usuario) {
      console.log(`[!] Login fallido: el correo ${correoLimpio} no existe.`);
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const passwordValido = await bcrypt.compare(clave, usuario.contrasena);
    if (!passwordValido) {
      console.log(`[!] Login fallido: contraseña incorrecta para ${correoLimpio}.`);
      return res.status(401).json({ message: 'Fallo en la verificación de seguridad.' });
    }

    console.log(`>> [SUCCESS] Enlace establecido para: ${correoLimpio}`);

    res.json({
      id: usuario.id,
      username: usuario.correo,
      rol: usuario.rol,
      status: 'LINK_ESTABLISHED'
    });
  } catch (error) {
    console.error('[!] Error crítico en login:', error.message);
    res.status(500).json({ message: `Error en el núcleo de Auth: ${error.message}` });
  }
});

// ==========================================
// ENDPOINTS DE PARTIDAS
// ==========================================

// Obtener todas las partidas con su operador asociado.
app.get('/api/partidas', async (req, res) => {
  try {
    const partidas = await Partida.findAll({
      include: [incluirUsuarioEnPartida],
      order: [['id', 'ASC']]
    });

    res.json(partidas.map(serializarPartida));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las partidas', detalle: error.message });
  }
});

// Obtener una partida específica por ID.
app.get('/api/partidas/:id', async (req, res) => {
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
});

// Crear o registrar una partida asociada a un operador existente.
app.post('/api/partidas', async (req, res) => {
  try {
    const usuario = await buscarUsuarioParaPartida(req.body);
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
});

// Actualizar una partida existente.
app.put('/api/partidas/:id', async (req, res) => {
  try {
    const partida = await Partida.findByPk(req.params.id);
    if (!partida) return res.status(404).json({ error: 'Partida no encontrada' });

    const cambios = {};
    if (req.body.stage) cambios.stage = req.body.stage;

    if (req.body.usuarioId || req.body.username || req.body.correo) {
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
});

// Eliminar una partida.
app.delete('/api/partidas/:id', async (req, res) => {
  try {
    const filasBorradas = await Partida.destroy({ where: { id: req.params.id } });
    if (filasBorradas === 0) return res.status(404).json({ error: 'Partida no encontrada' });

    res.json({ message: 'Partida eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la partida', detalle: error.message });
  }
});

// ==========================================
// ENDPOINTS DE USUARIOS (VISTA ADMIN / CRUD)
// ==========================================

// Obtener todos los usuarios.
app.get('/api/usuarios', async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: { exclude: ['contrasena'] },
      order: [['id', 'ASC']]
    });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los usuarios', detalle: error.message });
  }
});

// Obtener un usuario por ID.
app.get('/api/usuarios/:id', async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id, {
      attributes: { exclude: ['contrasena'] }
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el usuario por ID', detalle: error.message });
  }
});

// Crear usuario desde el CRUD de admin. También cifra la contraseña.
app.post('/api/usuarios', async (req, res) => {
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
});

// Actualizar usuario.
app.put('/api/usuarios/:id', async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Si en la actualización viene una contraseña nueva, se cifra antes de guardar.
    if (req.body.contrasena) {
      req.body.contrasena = await bcrypt.hash(req.body.contrasena, 10);
    }

    await usuario.update(req.body);
    const { contrasena: _, ...usuarioSeguro } = usuario.toJSON();
    res.json({ message: 'Usuario actualizado con éxito', usuario: usuarioSeguro });
  } catch (error) {
    res.status(400).json({ error: 'Error al actualizar el usuario', detalle: error.message });
  }
});

// Eliminar usuario.
app.delete('/api/usuarios/:id', async (req, res) => {
  try {
    const filasBorradas = await Usuario.destroy({ where: { id: req.params.id } });
    if (filasBorradas === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el usuario', detalle: error.message });
  }
});

// ==========================================
// CONEXIÓN Y ARRANQUE DEL SISTEMA
// ==========================================
const PORT = 3000;
sequelize.sync({ alter: true })
  .then(() => {
    console.log('\n==================================================');
    console.log('Conectado a SQLite mediante Sequelize');
    app.listen(PORT, () => console.log(`Servidor API REST corriendo en http://localhost:${PORT}`));
    console.log('==================================================\n');
  })
  .catch(err => console.error('No se pudo conectar a la base de datos:', err));
