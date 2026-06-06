const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite', // El archivo se creará aquí automáticamente.
  logging: false                // Para mantener la consola limpia.
});

module.exports = sequelize;
