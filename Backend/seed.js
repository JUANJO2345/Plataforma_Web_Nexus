const bcrypt = require('bcrypt');
const { sequelize, Usuario, Partida, Grupo, Etapa, Nivel, ResultadoNivel } = require('./models');
const { inicializarPartidas } = require('./database/migrarPartidas');

async function asegurarUsuario({ nombre, correo, contrasena, rol }) {
  const [usuario] = await Usuario.findOrCreate({
    where: { correo },
    defaults: { nombre, correo, contrasena: await bcrypt.hash(contrasena, 10), rol }
  });
  return usuario;
}

async function main() {
  try {
    await sequelize.sync();
    await inicializarPartidas();

    const profesor = await asegurarUsuario({ nombre: 'Profesor Garcia', correo: 'profesor@example.com', contrasena: 'prof123', rol: 'profesor' });
    const estudiante1 = await asegurarUsuario({ nombre: 'Estudiante Ana', correo: 'estudiante1@example.com', contrasena: 'est123', rol: 'estudiante' });
    const estudiante2 = await asegurarUsuario({ nombre: 'Estudiante Carlos', correo: 'estudiante2@example.com', contrasena: 'est123', rol: 'estudiante' });
    await asegurarUsuario({ nombre: 'Administrador', correo: 'admin@example.com', contrasena: 'admin123', rol: 'admin' });
    const operador = await asegurarUsuario({ nombre: 'Operador Demo', correo: 'operator@example.com', contrasena: 'user123', rol: 'user' });

    const [grupo] = await Grupo.findOrCreate({
      where: { codigo: 'GRP-101' },
      defaults: { codigo: 'GRP-101', nombre: 'Programación Básica - Grupo 1', profesorId: profesor.id }
    });
    const inscritosActuales = await grupo.getEstudiantes({ attributes: ['id'] });
    const idsEstudiantes = new Set(inscritosActuales.map((usuario) => usuario.id));
    await grupo.addEstudiantes([estudiante1, estudiante2].filter((usuario) => !idsEstudiantes.has(usuario.id)));

    const [partidaDemo] = await Partida.findOrCreate({
      where: { claveSeed: 'partida-demo-inicial' },
      defaults: { usuarioId: operador.id, username: operador.correo }
    });

    const etapas = await Etapa.findAll({
      where: { activa: true },
      include: [{ model: Nivel, as: 'niveles' }],
      order: [['orden', 'ASC']]
    });
    for (const etapa of etapas) {
      for (const nivel of etapa.niveles.sort((a, b) => a.orden - b.orden)) {
        await ResultadoNivel.findOrCreate({
          where: { partidaId: partidaDemo.id, nivelId: nivel.id },
          defaults: {
            puntaje: 60 + (etapa.orden * 10) + (nivel.orden * 5),
            tiempoSegundos: 35 + (etapa.orden * 8) + (nivel.orden * 4)
          }
        });
      }
    }

    console.log(`Seed listo: usuarios ${await Usuario.count()}, etapas ${etapas.length}, niveles ${await Nivel.count()}, partida demo #${partidaDemo.id} con ${await ResultadoNivel.count({ where: { partidaId: partidaDemo.id } })} resultados.`);
    await sequelize.close();
  } catch (error) {
    console.error('Seed error:', error);
    await sequelize.close();
    process.exitCode = 1;
  }
}

main();
