require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 3000;

sequelize.sync()
  .then(() => {
    console.log('\n==================================================');
    console.log('Conectado a SQLite mediante Sequelize');
    app.listen(PORT, () => console.log(`Servidor API REST corriendo en http://localhost:${PORT}`));
    console.log('==================================================\n');
  })
  .catch(err => console.error('No se pudo conectar a la base de datos:', err));
