const bcrypt = require('bcrypt');
const sequelize = require('./config/database');
const Usuario = require('./models/Usuario');
const Partida = require('./models/Partida');
const Grupo = require('./models/Grupo');
const GrupoEstudiante = require('./models/GrupoEstudiante');

// Setup relations for seed execution
Grupo.belongsTo(Usuario, { foreignKey: 'profesorId', as: 'profesor' });
Usuario.hasMany(Grupo, { foreignKey: 'profesorId', as: 'gruposImpartidos' });
Grupo.belongsToMany(Usuario, { through: GrupoEstudiante, foreignKey: 'grupoId', otherKey: 'estudianteId', as: 'estudiantes' });
Usuario.belongsToMany(Grupo, { through: GrupoEstudiante, foreignKey: 'estudianteId', otherKey: 'grupoId', as: 'gruposInscritos' });

async function main() {
  try {
    // Ensure DB and models are synchronized
    await sequelize.sync();

    let profesor = await Usuario.findOne({ where: { rol: 'profesor' } });
    const saltRounds = 10;

    if (!profesor) {
      const profPass = await bcrypt.hash('prof123', saltRounds);
      profesor = await Usuario.create({
        nombre: 'Profesor Garcia',
        correo: 'profesor@example.com',
        contrasena: profPass,
        rol: 'profesor'
      });
      console.log('Seed: creado profesor ->', profesor.correo);
    }

    let estudiante1 = await Usuario.findOne({ where: { correo: 'estudiante1@example.com' } });
    if (!estudiante1) {
      const estPass = await bcrypt.hash('est123', saltRounds);
      estudiante1 = await Usuario.create({
        nombre: 'Estudiante Ana',
        correo: 'estudiante1@example.com',
        contrasena: estPass,
        rol: 'estudiante'
      });
    }

    let estudiante2 = await Usuario.findOne({ where: { correo: 'estudiante2@example.com' } });
    if (!estudiante2) {
      const estPass = await bcrypt.hash('est123', saltRounds);
      estudiante2 = await Usuario.create({
        nombre: 'Estudiante Carlos',
        correo: 'estudiante2@example.com',
        contrasena: estPass,
        rol: 'estudiante'
      });
    }

    const usuariosCount = await Usuario.count();
    if (usuariosCount <= 3) {
      const adminPass = await bcrypt.hash('admin123', saltRounds);
      const userPass = await bcrypt.hash('user123', saltRounds);

      const admin = await Usuario.findOrCreate({
        where: { correo: 'admin@example.com' },
        defaults: {
          nombre: 'admin',
          correo: 'admin@example.com',
          contrasena: adminPass,
          rol: 'admin'
        }
      });

      const operator = await Usuario.findOrCreate({
        where: { correo: 'operator@example.com' },
        defaults: {
          nombre: 'operator',
          correo: 'operator@example.com',
          contrasena: userPass,
          rol: 'user'
        }
      });

      // Create a couple of partidas for the operator
      await Partida.findOrCreate({
        where: { id: 1 },
        defaults: {
          usuarioId: operator[0].id,
          username: operator[0].correo,
          stage: { level: 1, score: 120, metrics: { abstraction: 3, decomposition: 2 } }
        }
      });
    }

    // Seed Grupo
    let grupoDemo = await Grupo.findOne({ where: { codigo: 'GRP-101' } });
    if (!grupoDemo) {
      grupoDemo = await Grupo.create({
        codigo: 'GRP-101',
        nombre: 'Programación Básica - Grupo 1',
        profesorId: profesor.id
      });
      await grupoDemo.setEstudiantes([estudiante1.id, estudiante2.id]);
      console.log('Seed: creado grupo ->', grupoDemo.codigo, 'con profesor ID:', profesor.id, 'y estudiantes inscritos:', [estudiante1.id, estudiante2.id]);
    } else {
      console.log('Seed: grupo GRP-101 ya existente.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

main();
