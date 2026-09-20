const express = require('express');
const cors = require('cors');
const { autenticarToken } = require('./middlewares/auth');
const errorHandler = require('./middlewares/errorHandler');
const apiRoutes = require('./routes');

const app = express();

// ==========================================
// MIDDLEWARES GLOBALES
// ==========================================
app.use(cors());
app.use(express.json()); // Permite procesar cuerpos JSON
app.use(autenticarToken); // Procesa tokens JWT en todas las solicitudes

// ==========================================
// RUTAS DE LA API
// ==========================================
app.use('/api', apiRoutes);

// ==========================================
// MANEJADOR GLOBAL DE ERRORES
// ==========================================
app.use(errorHandler);

module.exports = app;
