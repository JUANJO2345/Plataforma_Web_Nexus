const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AiAuditLog = sequelize.define('AiAuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  archivoId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tema: {
    type: DataTypes.STRING,
    allowNull: true
  },
  peticion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  contenidoAnterior: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  contenidoNuevo: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  tableName: 'ai_audit_logs',
  timestamps: true
});

module.exports = AiAuditLog;
