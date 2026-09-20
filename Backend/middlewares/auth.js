const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nexus_net_runner_secret_key_2024';

// Middleware que extrae e intenta validar el token JWT si está presente en la solicitud
function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.split(' ')[1]
    : req.headers['x-access-token'] || req.query.token;

  if (!token) {
    req.usuario = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (!err && decoded) {
      req.usuario = decoded;
    } else {
      req.usuario = null;
    }
    next();
  });
}

// Middleware para requerir cualquier usuario autenticado (401 si no hay token válido)
function requerirAutenticacion(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ error: 'Acceso no autenticado: Token de sesión ausente o inválido.' });
  }
  next();
}

// Middleware de Control de Acceso basado en Roles (RBAC) (403 si el rol no coincide)
function requerirRol(rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Acceso no autenticado: Token de sesión ausente o inválido.' });
    }
    const rol = req.usuario.rol || 'estudiante';
    if (!rolesPermitidos.includes(rol)) {
      return res.status(403).json({ error: `Acceso restringido: Se requiere rol ${rolesPermitidos.join(' o ')}.` });
    }
    next();
  };
}

module.exports = {
  JWT_SECRET,
  autenticarToken,
  requerirAutenticacion,
  requerirRol
};
