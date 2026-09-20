const sequelize = require('../config/database');
const Usuario = require('./Usuario');
const Partida = require('./Partida');
const Grupo = require('./Grupo');
const GrupoEstudiante = require('./GrupoEstudiante');

// ==========================================
// RELACIONES ENTRE MODELOS
// ==========================================

// Relación Usuario <-> Partida
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

// Relación Grupo <-> Profesor (Usuario)
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

// Relación Muchos a Muchos: Grupo <-> Estudiante (Usuario)
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

module.exports = {
  sequelize,
  Usuario,
  Partida,
  Grupo,
  GrupoEstudiante
};
