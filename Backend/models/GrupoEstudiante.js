const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GrupoEstudiante = sequelize.define('GrupoEstudiante', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  grupoId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  estudianteId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['grupoId', 'estudianteId']
    }
  ]
});

module.exports = GrupoEstudiante;
