const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

module.exports = sequelize.define('Etapa', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING, allowNull: false, unique: true },
  clave: { type: DataTypes.STRING, allowNull: false, unique: true },
  orden: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  activa: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
});
