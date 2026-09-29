const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

module.exports = sequelize.define('Nivel', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  etapaId: { type: DataTypes.INTEGER, allowNull: false },
  clave: { type: DataTypes.STRING, allowNull: false },
  nombre: { type: DataTypes.STRING, allowNull: false },
  orden: { type: DataTypes.INTEGER, allowNull: false },
  puntajeMaximo: { type: DataTypes.INTEGER, allowNull: true }
}, { indexes: [{ unique: true, fields: ['etapaId', 'clave'] }, { unique: true, fields: ['etapaId', 'orden'] }] });
