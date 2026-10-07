const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const usuarioRoutes = require('./usuarioRoutes');
const partidaRoutes = require('./partidaRoutes');
const grupoRoutes = require('./grupoRoutes');
const aiRoutes = require('./aiRoutes');
const sistemaRoutes = require('./sistemaRoutes');

router.use('/auth', authRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/partidas', partidaRoutes);
router.use('/grupos', grupoRoutes);
router.use('/ai', aiRoutes);
router.use('/sistema', sistemaRoutes);

module.exports = router;
