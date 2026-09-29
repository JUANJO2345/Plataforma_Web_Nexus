require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');
const { inicializarPartidas } = require('./database/migrarPartidas');

const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
  try {
    await sequelize.sync();
    await inicializarPartidas();

    const servidor = app.listen(PORT, () => {
      console.log(`API conectada a SQLite y escuchando en http://localhost:${PORT}`);
    });

    servidor.on('error', async (error) => {
      console.error('No se pudo iniciar el servidor:', error);
      await sequelize.close();
      process.exitCode = 1;
    });
  } catch (error) {
    console.error('No se pudo preparar la base de datos:', error);
    await sequelize.close();
    process.exitCode = 1;
  }
}

iniciarServidor();
