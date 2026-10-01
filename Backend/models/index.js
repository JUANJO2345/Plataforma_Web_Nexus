const sequelize = require('../config/database');
const Usuario = require('./Usuario');
const Partida = require('./Partida');
const Etapa = require('./Etapa');
const Nivel = require('./Nivel');
const ResultadoNivel = require('./ResultadoNivel');
const Grupo = require('./Grupo');
const GrupoEstudiante = require('./GrupoEstudiante');
const AiAuditLog = require('./AiAuditLog');

// ==========================================
// RELACIONES ENTRE MODELOS
// ==========================================

// Relación Usuario <-> AiAuditLog
Usuario.hasMany(AiAuditLog, {
  foreignKey: 'usuarioId',
  as: 'aiAuditLogs',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

AiAuditLog.belongsTo(Usuario, {
  foreignKey: 'usuarioId',
  as: 'usuario'
});

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

Etapa.hasMany(Nivel, { foreignKey: 'etapaId', as: 'niveles', onDelete: 'CASCADE' });
Nivel.belongsTo(Etapa, { foreignKey: 'etapaId', as: 'etapa' });
Partida.hasMany(ResultadoNivel, { foreignKey: 'partidaId', as: 'resultados', onDelete: 'CASCADE' });
ResultadoNivel.belongsTo(Partida, { foreignKey: 'partidaId', as: 'partida' });
Nivel.hasMany(ResultadoNivel, { foreignKey: 'nivelId', as: 'resultados', onDelete: 'CASCADE' });
ResultadoNivel.belongsTo(Nivel, { foreignKey: 'nivelId', as: 'nivel' });

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
  Etapa,
  Nivel,
  ResultadoNivel,
  Grupo,
  GrupoEstudiante,
  AiAuditLog
};
