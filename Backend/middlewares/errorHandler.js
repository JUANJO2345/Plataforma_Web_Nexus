// Middleware centralizado de manejo de errores
function errorHandler(err, req, res, next) {
  console.error('[!] Error no controlado en la aplicación:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}

module.exports = errorHandler;
