const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middlewares/auth');
const {
  sequelize,
  Usuario,
  Partida,
  Grupo,
  Etapa,
  Nivel,
  ResultadoNivel,
  AiAuditLog
} = require('../models');
const { inicializarPartidas } = require('../database/migrarPartidas');

async function asegurarUsuario({ nombre, correo, contrasena, rol }) {
  const [usuario] = await Usuario.findOrCreate({
    where: { correo },
    defaults: { nombre, correo, contrasena: await bcrypt.hash(contrasena, 10), rol }
  });
  return usuario;
}

async function cargarDatosDemo() {
  const profesor = await asegurarUsuario({
    nombre: 'Profesor Garcia',
    correo: 'profesor@example.com',
    contrasena: 'prof123',
    rol: 'profesor'
  });
  const estudiante1 = await asegurarUsuario({
    nombre: 'Estudiante Ana',
    correo: 'estudiante1@example.com',
    contrasena: 'est123',
    rol: 'estudiante'
  });
  const estudiante2 = await asegurarUsuario({
    nombre: 'Estudiante Carlos',
    correo: 'estudiante2@example.com',
    contrasena: 'est123',
    rol: 'estudiante'
  });
  const operador = await asegurarUsuario({
    nombre: 'Operador Demo',
    correo: 'operator@example.com',
    contrasena: 'user123',
    rol: 'user'
  });

  const [grupo] = await Grupo.findOrCreate({
    where: { codigo: 'GRP-101' },
    defaults: { codigo: 'GRP-101', nombre: 'Programación Básica - Grupo 1', profesorId: profesor.id }
  });
  const inscritosActuales = await grupo.getEstudiantes({ attributes: ['id'] });
  const idsEstudiantes = new Set(inscritosActuales.map((usuario) => usuario.id));
  await grupo.addEstudiantes([estudiante1, estudiante2].filter((usuario) => !idsEstudiantes.has(usuario.id)));

  async function sembrarPartida({ usuario, claveSeed, offsetPuntaje = 0, offsetTiempo = 0, observacion = null }) {
    const [partida] = await Partida.findOrCreate({
      where: { claveSeed },
      defaults: {
        usuarioId: usuario.id,
        username: usuario.correo,
        observacion
      }
    });

    if (observacion && !partida.observacion) {
      partida.observacion = observacion;
      await partida.save();
    }

    const etapas = await Etapa.findAll({
      where: { activa: true },
      include: [{ model: Nivel, as: 'niveles' }],
      order: [['orden', 'ASC']]
    });

    for (const etapa of etapas) {
      for (const nivel of etapa.niveles.sort((a, b) => a.orden - b.orden)) {
        await ResultadoNivel.findOrCreate({
          where: { partidaId: partida.id, nivelId: nivel.id },
          defaults: {
            puntaje: Math.max(10, 60 + (etapa.orden * 10) + (nivel.orden * 5) + offsetPuntaje),
            tiempoSegundos: Math.max(15, 35 + (etapa.orden * 7) + (nivel.orden * 4) + offsetTiempo)
          }
        });
      }
    }
    return partida;
  }

  // Sembrar partida para el Operador Demo
  await sembrarPartida({
    usuario: operador,
    claveSeed: 'partida-demo-inicial',
    offsetPuntaje: 0,
    offsetTiempo: 0
  });

  // Sembrar partidas de prueba para Estudiante Ana
  await sembrarPartida({
    usuario: estudiante1,
    claveSeed: 'partida-ana-1',
    offsetPuntaje: 18,
    offsetTiempo: -6,
    observacion: 'Excelente razonamiento lógico en descomposición y patrones.'
  });

  await sembrarPartida({
    usuario: estudiante1,
    claveSeed: 'partida-ana-2',
    offsetPuntaje: 28,
    offsetTiempo: -10,
    observacion: 'Gran consistencia de respuesta y precisión en tiempos récord.'
  });

  // Sembrar partida de prueba para Estudiante Carlos
  await sembrarPartida({
    usuario: estudiante2,
    claveSeed: 'partida-carlos-1',
    offsetPuntaje: -5,
    offsetTiempo: 8,
    observacion: 'Buen avance general. Se recomienda reforzar abstracción en niveles avanzados.'
  });
}

async function obtenerEstadoSistema(req, res) {
  try {
    const [totalUsuarios, totalPartidas, totalGrupos, totalLogs, totalEtapas, totalNiveles] = await Promise.all([
      Usuario.count(),
      Partida.count(),
      Grupo.count(),
      AiAuditLog.count(),
      Etapa.count(),
      Nivel.count()
    ]);

    res.json({
      totalUsuarios,
      totalPartidas,
      totalGrupos,
      totalLogs,
      totalEtapas,
      totalNiveles
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar estado del sistema', detalle: error.message });
  }
}

async function reiniciarBaseDatos(req, res) {
  try {
    const { confirmacion, seedDemo: rawSeedDemo } = req.body || {};
    const seedDemo = Boolean(rawSeedDemo);

    if (confirmacion !== 'REINICIAR') {
      const msg = 'Confirmación inválida. Debes enviar confirmacion: "REINICIAR".';
      return res.status(400).json({ error: msg, message: msg });
    }

    // Verificar administrador solicitante en base de datos antes de reiniciar
    const adminSolicitante = await Usuario.findByPk(req.usuario.id);
    if (!adminSolicitante) {
      const msg = 'Usuario administrador no encontrado en la base de datos.';
      return res.status(401).json({ error: msg, message: msg });
    }

    // Desactivar temporalmente foreign keys en SQLite y reiniciar esquemas
    await sequelize.query('PRAGMA foreign_keys = OFF;');
    await sequelize.sync({ force: true });
    await sequelize.query('PRAGMA foreign_keys = ON;');

    // Inicializar catálogo estándar de etapas y niveles
    await inicializarPartidas();

    // Recrear usuario administrador principal
    const nuevoAdmin = await Usuario.create({
      nombre: adminSolicitante.nombre,
      correo: adminSolicitante.correo,
      contrasena: adminSolicitante.contrasena,
      rol: 'admin'
    });

    if (seedDemo) {
      await cargarDatosDemo();
    }

    const [totalUsuarios, totalPartidas, totalGrupos] = await Promise.all([
      Usuario.count(),
      Partida.count(),
      Grupo.count()
    ]);

    const respuesta = {
      message: seedDemo
        ? 'Base de datos reiniciada y cargada con datos de prueba iniciales.'
        : 'Base de datos reiniciada con éxito. El sistema ha quedado completamente limpio y operativo.',
      seedAplicado: seedDemo,
      adminConservado: nuevoAdmin.correo,
      metricas: {
        totalUsuarios,
        totalPartidas,
        totalGrupos
      }
    };

    if (Number(nuevoAdmin.id) !== Number(req.usuario.id)) {
      respuesta.token = jwt.sign(
        { id: nuevoAdmin.id, correo: nuevoAdmin.correo, rol: nuevoAdmin.rol },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      respuesta.adminId = nuevoAdmin.id;
    }

    res.json(respuesta);
  } catch (error) {
    console.error('Error al reiniciar base de datos:', error);
    res.status(500).json({ error: 'Error crítico al reiniciar base de datos', detalle: error.message });
  }
}

const BACKUPS_DIR = path.join(__dirname, '..', 'backups');

function asegurarDirectorioBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

function formatearTamano(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function crearBackupBak() {
  asegurarDirectorioBackups();
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const nombreArchivo = `nexus_backup_${timestamp}.bak`;
  const rutaArchivo = path.join(BACKUPS_DIR, nombreArchivo);

  if (fs.existsSync(rutaArchivo)) {
    fs.unlinkSync(rutaArchivo);
  }

  try {
    await sequelize.query('PRAGMA wal_checkpoint(FULL);');
  } catch (_) {
    // Si no está en modo WAL, ignorar
  }

  let creadoConVacuum = false;
  try {
    const safePath = rutaArchivo.replace(/\\/g, '/');
    await sequelize.query(`VACUUM INTO '${safePath}'`);
    creadoConVacuum = true;
  } catch (errorVacuum) {
    console.warn('Aviso: Falló VACUUM INTO, usando copia directa de archivo:', errorVacuum.message);
  }

  if (!creadoConVacuum || !fs.existsSync(rutaArchivo)) {
    const storagePath = sequelize.options.storage || path.join(__dirname, '..', 'database.sqlite');
    await fs.promises.copyFile(storagePath, rutaArchivo);
  }

  const stat = fs.statSync(rutaArchivo);
  return {
    nombreArchivo,
    rutaArchivo,
    tamanoBytes: stat.size,
    tamanoFormateado: formatearTamano(stat.size),
    fechaCreacion: stat.mtime
  };
}

async function crearBackup(req, res) {
  try {
    const backup = await crearBackupBak();
    res.json({
      message: 'Copia de seguridad (.bak) generada exitosamente.',
      backup: {
        nombreArchivo: backup.nombreArchivo,
        tamanoBytes: backup.tamanoBytes,
        tamanoFormateado: backup.tamanoFormateado,
        fechaCreacion: backup.fechaCreacion
      }
    });
  } catch (error) {
    console.error('Error al crear backup (.bak):', error);
    res.status(500).json({ error: 'Error al generar la copia de seguridad de la base de datos', detalle: error.message });
  }
}

async function descargarBackupDirecto(req, res) {
  try {
    const backup = await crearBackupBak();
    res.download(backup.rutaArchivo, backup.nombreArchivo, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Error al transferir el archivo de backup', detalle: err.message });
      }
    });
  } catch (error) {
    console.error('Error al generar backup para descarga:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al generar la copia de seguridad (.bak)', detalle: error.message });
    }
  }
}

async function listarBackups(req, res) {
  try {
    asegurarDirectorioBackups();
    const archivos = fs.readdirSync(BACKUPS_DIR);
    const backups = archivos
      .filter((nombre) => nombre.endsWith('.bak'))
      .map((nombre) => {
        const ruta = path.join(BACKUPS_DIR, nombre);
        const stat = fs.statSync(ruta);
        return {
          nombreArchivo: nombre,
          tamanoBytes: stat.size,
          tamanoFormateado: formatearTamano(stat.size),
          fechaCreacion: stat.mtime
        };
      })
      .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));

    res.json(backups);
  } catch (error) {
    console.error('Error al listar backups:', error);
    res.status(500).json({ error: 'Error al consultar lista de backups', detalle: error.message });
  }
}

async function descargarBackupPorNombre(req, res) {
  try {
    asegurarDirectorioBackups();
    const nombreArchivo = path.basename(req.params.nombreArchivo);
    const rutaArchivo = path.join(BACKUPS_DIR, nombreArchivo);

    if (!fs.existsSync(rutaArchivo) || !nombreArchivo.endsWith('.bak')) {
      return res.status(404).json({ error: 'El archivo de respaldo (.bak) solicitado no existe.' });
    }

    res.download(rutaArchivo, nombreArchivo, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Error al transferir el archivo de respaldo', detalle: err.message });
      }
    });
  } catch (error) {
    console.error('Error al descargar backup por nombre:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al procesar la descarga del respaldo', detalle: error.message });
    }
  }
}

async function eliminarBackup(req, res) {
  try {
    asegurarDirectorioBackups();
    const nombreArchivo = path.basename(req.params.nombreArchivo);
    const rutaArchivo = path.join(BACKUPS_DIR, nombreArchivo);

    if (!fs.existsSync(rutaArchivo) || !nombreArchivo.endsWith('.bak')) {
      return res.status(404).json({ error: 'El archivo de respaldo no existe.' });
    }

    fs.unlinkSync(rutaArchivo);
    res.json({ message: `Copia de seguridad ${nombreArchivo} eliminada exitosamente.` });
  } catch (error) {
    console.error('Error al eliminar backup:', error);
    res.status(500).json({ error: 'Error al eliminar el archivo de respaldo', detalle: error.message });
  }
}

module.exports = {
  obtenerEstadoSistema,
  reiniciarBaseDatos,
  crearBackup,
  descargarBackupDirecto,
  listarBackups,
  descargarBackupPorNombre,
  eliminarBackup
};
