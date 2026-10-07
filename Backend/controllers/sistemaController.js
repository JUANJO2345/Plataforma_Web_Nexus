const bcrypt = require('bcrypt');
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
    const seedDemo = Boolean(req.body.seedDemo);

    // Obtener información del administrador actual para conservar sus credenciales de acceso
    const adminSolicitante = await Usuario.findByPk(req.usuario.id);
    const adminNombre = adminSolicitante?.nombre || req.usuario.nombre || 'Administrador';
    const adminCorreo = adminSolicitante?.correo || req.usuario.correo || 'admin@example.com';
    const adminContrasenaHash = adminSolicitante?.contrasena || await bcrypt.hash('admin123', 10);

    // Desactivar temporalmente foreign keys en SQLite y reiniciar esquemas
    await sequelize.query('PRAGMA foreign_keys = OFF;');
    await sequelize.sync({ force: true });
    await sequelize.query('PRAGMA foreign_keys = ON;');

    // Inicializar catálogo estándar de etapas y niveles
    await inicializarPartidas();

    // Recrear usuario administrador principal
    await Usuario.create({
      nombre: adminNombre,
      correo: adminCorreo,
      contrasena: adminContrasenaHash,
      rol: 'admin'
    });

    // Si el correo del admin solicitante no es admin@example.com, asegurar que admin@example.com exista
    if (adminCorreo.toLowerCase() !== 'admin@example.com') {
      await Usuario.findOrCreate({
        where: { correo: 'admin@example.com' },
        defaults: {
          nombre: 'Administrador',
          correo: 'admin@example.com',
          contrasena: await bcrypt.hash('admin123', 10),
          rol: 'admin'
        }
      });
    }

    if (seedDemo) {
      await cargarDatosDemo();
    }

    const [totalUsuarios, totalPartidas, totalGrupos] = await Promise.all([
      Usuario.count(),
      Partida.count(),
      Grupo.count()
    ]);

    res.json({
      message: seedDemo
        ? 'Base de datos reiniciada y cargada con datos de prueba iniciales.'
        : 'Base de datos reiniciada con éxito. El sistema ha quedado completamente limpio y operativo.',
      seedAplicado: seedDemo,
      adminConservado: adminCorreo,
      metricas: {
        totalUsuarios,
        totalPartidas,
        totalGrupos
      }
    });
  } catch (error) {
    console.error('Error al reiniciar base de datos:', error);
    res.status(500).json({ error: 'Error crítico al reiniciar base de datos', detalle: error.message });
  }
}

module.exports = {
  obtenerEstadoSistema,
  reiniciarBaseDatos
};
