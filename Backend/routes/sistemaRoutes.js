const express = require('express');
const router = express.Router();
const sistemaController = require('../controllers/sistemaController');
const { requerirRol } = require('../middlewares/auth');

router.get('/estado', requerirRol(['admin']), sistemaController.obtenerEstadoSistema);
router.post('/reiniciar-db', requerirRol(['admin']), sistemaController.reiniciarBaseDatos);

// Rutas para copias de seguridad de la base de datos (.bak)
router.get('/backup/descargar', requerirRol(['admin']), sistemaController.descargarBackupDirecto);
router.post('/backup', requerirRol(['admin']), sistemaController.crearBackup);
router.get('/backups', requerirRol(['admin']), sistemaController.listarBackups);
router.get('/backups/:nombreArchivo/descargar', requerirRol(['admin']), sistemaController.descargarBackupPorNombre);
router.delete('/backups/:nombreArchivo', requerirRol(['admin']), sistemaController.eliminarBackup);

module.exports = router;
