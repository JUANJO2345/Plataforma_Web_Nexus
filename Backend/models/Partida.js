const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Partida = sequelize.define('Partida', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  stage: {
    type: DataTypes.JSON, // <-- Soporte nativo para tu estructura anidada
    allowNull: false
  }
});

module.exports = Partida;