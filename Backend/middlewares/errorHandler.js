// Middleware centralizado de manejo de errores
function errorHandler(err, req, res, next) {
  console.error('[!] Error no controlado en la aplicación:', err);

  if (err.type === 'entity.parse.failed') {
    const msg = 'JSON malformado en el cuerpo de la solicitud.';
    return res.status(400).json({ error: msg, message: msg });
  }

  if (err.type === 'entity.too.large') {
    const msg = 'El cuerpo de la solicitud excede el límite permitido (1MB).';
    return res.status(413).json({ error: msg, message: msg });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    const detalle = err.errors?.[0]?.message || 'Ya existe un registro con ese valor único.';
    return res.status(409).json({ error: detalle, message: detalle });
  }

  if (err.name === 'SequelizeValidationError') {
    const detalle = err.errors?.map((e) => e.message).filter(Boolean).join(', ') || err.message || 'Error de validación en los datos enviados.';
    return res.status(400).json({ error: detalle, message: detalle });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Error interno del servidor';

  res.status(statusCode).json({
    error: message,
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}

module.exports = errorHandler;
