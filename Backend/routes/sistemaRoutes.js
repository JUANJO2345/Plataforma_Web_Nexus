const express = require('express');
const router = express.Router();
const sistemaController = require('../controllers/sistemaController');
const { requerirRol } = require('../middlewares/auth');

router.get('/estado', requerirRol(['admin']), sistemaController.obtenerEstadoSistema);
router.post('/reiniciar-db', requerirRol(['admin']), sistemaController.reiniciarBaseDatos);

module.exports = router;
