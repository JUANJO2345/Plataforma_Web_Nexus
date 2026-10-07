const express = require('express');
const router = express.Router();
const partidaController = require('../controllers/partidaController');
const { requerirAutenticacion, requerirRol } = require('../middlewares/auth');

router.get('/', requerirAutenticacion, partidaController.obtenerTodas);
router.get('/catalogo', requerirAutenticacion, partidaController.obtenerCatalogo);
router.get('/:id', requerirAutenticacion, partidaController.obtenerPorId);
router.post('/', requerirAutenticacion, partidaController.crear);
router.put('/:id', requerirAutenticacion, partidaController.actualizar);
router.patch('/:id/observacion', requerirRol(['profesor', 'admin']), partidaController.guardarObservacion);
router.put('/:id/observacion', requerirRol(['profesor', 'admin']), partidaController.guardarObservacion);
router.delete('/:id', requerirRol(['admin']), partidaController.eliminar);

module.exports = router;
