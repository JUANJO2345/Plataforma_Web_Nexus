const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const sequelize = require('./config/database');
const Partida = require('./models/Partida');
const Usuario = require('./models/Usuario');
const Grupo = require('./models/Grupo');
const GrupoEstudiante = require('./models/GrupoEstudiante');

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

// Relación Grupo -> Profesor (Usuario)
Grupo.belongsTo(Usuario, {
  foreignKey: 'profesorId',
  as: 'profesor',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

Usuario.hasMany(Grupo, {
  foreignKey: 'profesorId',
  as: 'gruposImpartidos'
});

// Relación Muchos a Muchos: Grupo <-> Usuario (Estudiantes)
Grupo.belongsToMany(Usuario, {
  through: GrupoEstudiante,
  foreignKey: 'grupoId',
  otherKey: 'estudianteId',
  as: 'estudiantes'
});

Usuario.belongsToMany(Grupo, {
  through: GrupoEstudiante,
  foreignKey: 'estudianteId',
  otherKey: 'grupoId',
  as: 'gruposInscritos'
});

const incluirUsuarioEnPartida = {
  model: Usuario,
  as: 'usuario',
  attributes: ['id', 'nombre', 'correo', 'rol']
};

const incluirDetallesGrupo = [
  {
    model: Usuario,
    as: 'profesor',
    attributes: ['id', 'nombre', 'correo', 'rol']
  },
  {
    model: Usuario,
    as: 'estudiantes',
    attributes: ['id', 'nombre', 'correo', 'rol'],
    through: { attributes: [] }
  }
];

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

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'nexus_net_runner_secret_key_2024';

// ==========================================
// MIDDLEWARES (SIEMPRE PRIMERO)
// ==========================================
app.use(cors());
app.use(express.json()); // Permite a Express entender cuerpos JSON en los POST y PUT.

// Middleware de Autenticación por JWT Token
function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.split(' ')[1]
    : req.headers['x-access-token'] || req.query.token;

  if (!token) {
    req.usuario = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (!err && decoded) {
      req.usuario = decoded;
    } else {
      req.usuario = null;
    }
    next();
  });
}

// Middleware de Control de Acceso basado en Roles (RBAC)
function requerirRol(rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Acceso no autenticado: Token de sesión ausente o inválido.' });
    }
    const rol = req.usuario.rol || 'estudiante';
    if (!rolesPermitidos.includes(rol)) {
      return res.status(403).json({ error: `Acceso restringido: Se requiere rol ${rolesPermitidos.join(' o ')}.` });
    }
    next();
  };
}

app.use(autenticarToken);

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
// ENDPOINTS DE GRUPOS (CRUD Y ASIGNACIONES)
// ==========================================

// Obtener todos los grupos con su profesor y estudiantes inscritos.
app.get('/api/grupos', async (req, res) => {
  try {
    const whereClause = {};
    if (req.query.profesorId) {
      whereClause.profesorId = req.query.profesorId;
    }

    let grupos = await Grupo.findAll({
      where: whereClause,
      include: incluirDetallesGrupo,
      order: [['id', 'ASC']]
    });

    if (req.query.estudianteId) {
      const estId = parseInt(req.query.estudianteId, 10);
      grupos = grupos.filter(g => g.estudiantes && g.estudiantes.some(e => e.id === estId));
    }

    res.json(grupos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los grupos', detalle: error.message });
  }
});

// Obtener un grupo por ID.
app.get('/api/grupos/:id', async (req, res) => {
  try {
    const grupo = await Grupo.findByPk(req.params.id, {
      include: incluirDetallesGrupo
    });
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });
    res.json(grupo);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el grupo por ID', detalle: error.message });
  }
});

// Crear un nuevo grupo (código, nombre, profesorId, estudianteIds).
app.post('/api/grupos', async (req, res) => {
  try {
    const { codigo, nombre, profesorId, estudianteIds } = req.body;
    if (!codigo) {
      return res.status(400).json({ error: 'El campo código es obligatorio.' });
    }

    if (profesorId) {
      const profesor = await Usuario.findByPk(profesorId);
      if (!profesor) {
        return res.status(400).json({ error: 'El profesor especificado no existe.' });
      }
    }

    const nuevoGrupo = await Grupo.create({
      codigo: codigo.trim(),
      nombre: nombre ? nombre.trim() : null,
      profesorId: profesorId || null
    });

    if (Array.isArray(estudianteIds) && estudianteIds.length > 0) {
      await nuevoGrupo.setEstudiantes(estudianteIds);
    }

    const grupoConDetalles = await Grupo.findByPk(nuevoGrupo.id, {
      include: incluirDetallesGrupo
    });

    res.status(201).json(grupoConDetalles);
  } catch (error) {
    res.status(400).json({ error: 'Error al crear el grupo', detalle: error.message });
  }
});

// Actualizar un grupo.
app.put('/api/grupos/:id', async (req, res) => {
  try {
    const grupo = await Grupo.findByPk(req.params.id);
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

    const { codigo, nombre, profesorId, estudianteIds } = req.body;

    if (profesorId !== undefined && profesorId !== null) {
      const profesor = await Usuario.findByPk(profesorId);
      if (!profesor) {
        return res.status(400).json({ error: 'El profesor especificado no existe.' });
      }
    }

    const cambios = {};
    if (codigo !== undefined) cambios.codigo = codigo.trim();
    if (nombre !== undefined) cambios.nombre = nombre.trim();
    if (profesorId !== undefined) cambios.profesorId = profesorId;

    await grupo.update(cambios);

    if (Array.isArray(estudianteIds)) {
      await grupo.setEstudiantes(estudianteIds);
    }

    const grupoActualizado = await Grupo.findByPk(grupo.id, {
      include: incluirDetallesGrupo
    });

    res.json({ message: 'Grupo actualizado con éxito', grupo: grupoActualizado });
  } catch (error) {
    res.status(400).json({ error: 'Error al actualizar el grupo', detalle: error.message });
  }
});

// Inscribir estudiante(s) a un grupo.
app.post('/api/grupos/:id/estudiantes', async (req, res) => {
  try {
    const grupo = await Grupo.findByPk(req.params.id);
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

    const ids = Array.isArray(req.body.estudianteIds)
      ? req.body.estudianteIds
      : req.body.estudianteId ? [req.body.estudianteId] : [];

    if (ids.length === 0) {
      return res.status(400).json({ error: 'Debe proporcionar estudianteId o estudianteIds.' });
    }

    await grupo.addEstudiantes(ids);

    const grupoActualizado = await Grupo.findByPk(grupo.id, {
      include: incluirDetallesGrupo
    });

    res.json({ message: 'Estudiante(s) inscrito(s) correctamente', grupo: grupoActualizado });
  } catch (error) {
    res.status(400).json({ error: 'Error al inscribir estudiantes en el grupo', detalle: error.message });
  }
});

// Desinscribir un estudiante de un grupo.
app.delete('/api/grupos/:id/estudiantes/:estudianteId', async (req, res) => {
  try {
    const grupo = await Grupo.findByPk(req.params.id);
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

    await grupo.removeEstudiante(req.params.estudianteId);

    const grupoActualizado = await Grupo.findByPk(grupo.id, {
      include: incluirDetallesGrupo
    });

    res.json({ message: 'Estudiante removido del grupo correctamente', grupo: grupoActualizado });
  } catch (error) {
    res.status(500).json({ error: 'Error al remover estudiante del grupo', detalle: error.message });
  }
});

// Eliminar un grupo.
app.delete('/api/grupos/:id', async (req, res) => {
  try {
    const filasBorradas = await Grupo.destroy({ where: { id: req.params.id } });
    if (filasBorradas === 0) return res.status(404).json({ error: 'Grupo no encontrado' });

    res.json({ message: 'Grupo eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el grupo', detalle: error.message });
  }
});

// ==========================================
// CONEXIÓN Y ARRANQUE DEL SISTEMA
// ==========================================
const PORT = 3000;
sequelize.sync()
  .then(() => {
    console.log('\n==================================================');
    console.log('Conectado a SQLite mediante Sequelize');
    app.listen(PORT, () => console.log(`Servidor API REST corriendo en http://localhost:${PORT}`));
    console.log('==================================================\n');
  })
  .catch(err => console.error('No se pudo conectar a la base de datos:', err));
