const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { autenticarToken } = require('./middlewares/auth');
const errorHandler = require('./middlewares/errorHandler');
const apiRoutes = require('./routes');

const app = express();

// ==========================================
// MIDDLEWARES GLOBALES DE SEGURIDAD
// ==========================================
app.use(helmet());

const rawCorsOrigin = (process.env.CORS_ORIGIN || 'http://localhost:5173').trim();
const corsOrigins = rawCorsOrigin === '*'
  ? '*'
  : rawCorsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
const corsOriginOption = Array.isArray(corsOrigins)
  ? (corsOrigins.length === 1 ? corsOrigins[0] : (corsOrigins.length > 0 ? corsOrigins : 'http://localhost:5173'))
  : corsOrigins;

app.use(cors({ origin: corsOriginOption }));
app.use(express.json({ limit: '1mb' })); // Permite procesar cuerpos JSON con límite de 1MB
app.use(autenticarToken); // Procesa tokens JWT en todas las solicitudes

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1'),
  message: {
    error: 'Demasiados intentos de autenticación. Intenta de nuevo más tarde.',
    message: 'Demasiados intentos de autenticación. Intenta de nuevo más tarde.'
  }
});

const aiPropuestaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX) || 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (
    req.usuario?.id
      ? `user:${req.usuario.id}`
      : ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1')
  ),
  message: {
    error: 'Límite de solicitudes de generación de propuestas con IA alcanzado. Intenta de nuevo más tarde.',
    message: 'Límite de solicitudes de generación de propuestas con IA alcanzado. Intenta de nuevo más tarde.'
  }
});

app.use('/api/auth', authLimiter);
app.use('/api/ai/propuesta', aiPropuestaLimiter);

// ==========================================
// RUTAS DE LA API
// ==========================================
app.use('/api', apiRoutes);

// ==========================================
// MANEJADOR GLOBAL DE ERRORES
// ==========================================
app.use(errorHandler);

module.exports = app;
