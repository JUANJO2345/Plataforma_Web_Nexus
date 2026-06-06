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
  stage: {
    type: DataTypes.JSON, // Soporte nativo para la estructura anidada de niveles y habilidades.
    allowNull: false
  }
});

module.exports = Partida;
