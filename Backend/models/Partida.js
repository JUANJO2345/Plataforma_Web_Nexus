const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Partida = sequelize.define('Partida', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true // Campo heredado para conservar compatibilidad con registros antiguos.
  },
  fecha: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  claveSeed: { type: DataTypes.STRING, allowNull: true }
});

module.exports = Partida;
