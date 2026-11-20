const { DataTypes, QueryTypes } = require('sequelize');
const sequelize = require('../config/database');

const Usuario = sequelize.define('Usuario', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  correo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true // Valida que tenga formato de correo válido.
    }
  },
  rol: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'user' // Por defecto serán operadores ('user'); el admin se cambia manualmente.
  },
  contrasena: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

let migrandoNombre = null;

async function migrarIndiceUnicoNombre() {
  if (sequelize.getDialect() !== 'sqlite') return;

  const indexes = await sequelize.query("PRAGMA index_list('Usuarios');", { type: QueryTypes.SELECT });
  let tieneNombreUnico = false;

  for (const idx of indexes) {
    if (!idx.unique) continue;
    const escapedName = String(idx.name).replace(/'/g, "''");
    const cols = await sequelize.query(`PRAGMA index_info('${escapedName}');`, { type: QueryTypes.SELECT });
    if (cols.length === 1 && cols[0].name === 'nombre') {
      tieneNombreUnico = true;
      break;
    }
  }

  if (!tieneNombreUnico) return;

  const fkRows = await sequelize.query('PRAGMA foreign_keys;', { type: QueryTypes.SELECT });
  const fkPrev = fkRows?.[0]?.foreign_keys ? 'ON' : 'OFF';

  await sequelize.query('PRAGMA foreign_keys = OFF;');
  try {
    const t = await sequelize.transaction();
    try {
      await sequelize.query('DROP TABLE IF EXISTS `Usuarios_mig_tmp`;', { transaction: t });
      await sequelize.query(
        'CREATE TABLE `Usuarios_mig_tmp` (' +
        '`id` INTEGER PRIMARY KEY AUTOINCREMENT, ' +
        '`nombre` VARCHAR(255) NOT NULL, ' +
        '`correo` VARCHAR(255) NOT NULL UNIQUE, ' +
        "`rol` VARCHAR(255) NOT NULL DEFAULT 'user', " +
        '`contrasena` VARCHAR(255) NOT NULL, ' +
        '`createdAt` DATETIME NOT NULL, ' +
        '`updatedAt` DATETIME NOT NULL' +
        ');',
        { transaction: t }
      );
      await sequelize.query(
        'INSERT INTO `Usuarios_mig_tmp` (`id`, `nombre`, `correo`, `rol`, `contrasena`, `createdAt`, `updatedAt`) ' +
        'SELECT `id`, `nombre`, `correo`, `rol`, `contrasena`, `createdAt`, `updatedAt` FROM `Usuarios`;',
        { transaction: t }
      );
      await sequelize.query('DROP TABLE `Usuarios`;', { transaction: t });
      await sequelize.query('ALTER TABLE `Usuarios_mig_tmp` RENAME TO `Usuarios`;', { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } finally {
    await sequelize.query(`PRAGMA foreign_keys = ${fkPrev};`);
  }
}

Usuario.addHook('afterSync', async () => {
  if (!migrandoNombre) {
    migrandoNombre = migrarIndiceUnicoNombre().finally(() => {
      migrandoNombre = null;
    });
  }
  await migrandoNombre;
});

module.exports = Usuario;
