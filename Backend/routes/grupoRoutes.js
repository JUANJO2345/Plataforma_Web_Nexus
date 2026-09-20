const express = require('express');
const router = express.Router();
const grupoController = require('../controllers/grupoController');
const { requerirAutenticacion, requerirRol } = require('../middlewares/auth');

router.get('/', requerirAutenticacion, grupoController.obtenerTodos);
router.get('/:id', requerirAutenticacion, grupoController.obtenerPorId);
router.post('/', requerirRol(['admin']), grupoController.crear);
router.put('/:id', requerirRol(['admin']), grupoController.actualizar);
router.post('/:id/estudiantes', requerirRol(['admin', 'profesor']), grupoController.inscribirEstudiantes);
router.delete('/:id/estudiantes/:estudianteId', requerirRol(['admin', 'profesor']), grupoController.removerEstudiante);
router.delete('/:id', requerirRol(['admin']), grupoController.eliminar);

module.exports = router;
