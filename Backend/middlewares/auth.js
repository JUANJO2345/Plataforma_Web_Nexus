const jwt = require('jsonwebtoken');

let JWT_SECRET = (process.env.JWT_SECRET || '').trim();
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('La variable de entorno JWT_SECRET es obligatoria en producción.');
  }
  console.warn('[Auth] ADVERTENCIA: JWT_SECRET no está definido. Usando clave de desarrollo por defecto.');
  JWT_SECRET = 'nexus_net_runner_secret_key_2024';
}

// Middleware que extrae e intenta validar el token JWT si está presente en la solicitud
function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.split(' ')[1]
    : req.headers['x-access-token'];

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
    const msg = 'Acceso no autenticado: Token de sesión ausente o inválido.';
    return res.status(401).json({ error: msg, message: msg });
  }
  next();
}

// Middleware de Control de Acceso basado en Roles (RBAC) (403 si el rol no coincide)
function requerirRol(rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      const msg = 'Acceso no autenticado: Token de sesión ausente o inválido.';
      return res.status(401).json({ error: msg, message: msg });
    }
    const rol = req.usuario.rol || 'estudiante';
    if (!rolesPermitidos.includes(rol)) {
      const msg = `Acceso restringido: Se requiere rol ${rolesPermitidos.join(' o ')}.`;
      return res.status(403).json({ error: msg, message: msg });
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
