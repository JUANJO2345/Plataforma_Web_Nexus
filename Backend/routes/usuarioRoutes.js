const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { requerirRol, requerirAutenticacion } = require('../middlewares/auth');

router.get('/', requerirRol(['admin', 'profesor']), usuarioController.obtenerTodos);
router.get('/:id', requerirAutenticacion, usuarioController.obtenerPorId);
router.post('/', requerirRol(['admin']), usuarioController.crear);
router.put('/:id', requerirAutenticacion, usuarioController.actualizar);
router.delete('/:id', requerirRol(['admin']), usuarioController.eliminar);

module.exports = router;
