const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

module.exports = sequelize.define('ResultadoNivel', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  partidaId: { type: DataTypes.INTEGER, allowNull: false },
  nivelId: { type: DataTypes.INTEGER, allowNull: false },
  puntaje: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  tiempoSegundos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, { indexes: [{ unique: true, fields: ['partidaId', 'nivelId'] }] });
