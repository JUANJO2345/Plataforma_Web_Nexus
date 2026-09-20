const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const usuarioRoutes = require('./usuarioRoutes');
const partidaRoutes = require('./partidaRoutes');
const grupoRoutes = require('./grupoRoutes');

router.use('/auth', authRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/partidas', partidaRoutes);
router.use('/grupos', grupoRoutes);

module.exports = router;
