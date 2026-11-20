const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { requerirAutenticacion, requerirRol } = require('../middlewares/auth');

// Todas las rutas de IA requieren sesión y rol de profesor o administrador
router.use(requerirAutenticacion);
router.use(requerirRol(['profesor', 'admin']));

router.get('/estado', aiController.obtenerEstadoDrive);
router.get('/original', aiController.obtenerOriginal);
router.get('/historial', aiController.obtenerHistorial);
router.post('/propuesta', aiController.obtenerPropuesta);
router.post('/aplicar', aiController.aplicarPropuesta);
router.post('/restaurar', aiController.restaurarOriginal);

module.exports = router;
