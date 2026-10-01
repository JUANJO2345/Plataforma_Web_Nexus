const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const usuarioRoutes = require('./usuarioRoutes');
const partidaRoutes = require('./partidaRoutes');
const grupoRoutes = require('./grupoRoutes');
const aiRoutes = require('./aiRoutes');

router.use('/auth', authRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/partidas', partidaRoutes);
router.use('/grupos', grupoRoutes);
router.use('/ai', aiRoutes);

module.exports = router;
