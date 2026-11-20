const {
  generarPropuestaGemini,
  validarFormatoPropuesta,
  obtenerJsonOriginal,
  formatearJsonBotones,
  getGeminiModel
} = require('../utils/geminiService');
const {
  getDriveFileId,
  hasDriveCredentials,
  obtenerContenidoDrive,
  actualizarContenidoDrive
} = require('../utils/driveService');
const { AiAuditLog, Usuario } = require('../models');

/**
 * Genera una propuesta con Gemini Flash sin modificar Google Drive.
 * POST /api/ai/propuesta
 */
async function obtenerPropuesta(req, res, next) {
  try {
    const { tema, peticion, elementosSugeridos } = req.body;

    if (!peticion && !tema) {
      return res.status(400).json({
        error: 'Debes proporcionar al menos un tema o una petición para generar la propuesta con IA.'
      });
    }

    const propuesta = await generarPropuestaGemini({
      tema: tema || 'Entorno VR',
      peticion: peticion || 'Configuración de elementos',
      elementosSugeridos: Array.isArray(elementosSugeridos) ? elementosSugeridos : []
    });

    return res.json({
      success: true,
      mensaje: 'Propuesta generada exitosamente. Revisa el contenido antes de guardarlo en Drive.',
      tema,
      peticion,
      propuesta
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Valida la propuesta aprobada por el profesor y actualiza el archivo en Google Drive.
 * POST /api/ai/aplicar
 */
async function aplicarPropuesta(req, res, next) {
  try {
    const { propuesta, tema, peticion } = req.body;
    const usuarioId = req.usuario.id;
    const archivoId = getDriveFileId();

    if (!propuesta) {
      return res.status(400).json({ error: 'No se recibió ninguna propuesta para aplicar.' });
    }

    // Regla de seguridad: El backend vuelve a validar estrictamente el formato y tipos
    let propuestaValidada;
    try {
      propuestaValidada = validarFormatoPropuesta(propuesta);
    } catch (valErr) {
      return res.status(400).json({
        error: `Validación fallida de la propuesta: ${valErr.message}`
      });
    }

    if (!archivoId) {
      return res.status(503).json({
        error: 'El ID del archivo de Google Drive (GOOGLE_DRIVE_FILE_ID) no está configurado en el backend.'
      });
    }

    // 1. Obtener contenido actual de Drive para conservar copia de respaldo (backup)
    let contenidoAnterior = null;
    try {
      contenidoAnterior = await obtenerContenidoDrive();
    } catch (driveReadErr) {
      console.warn('[AI Controller] No se pudo leer el contenido previo de Drive para backup:', driveReadErr.message);
      // Si falla la lectura pero se desea proceder o alertar, lo registramos
    }

    // 2. Actualizar el archivo en Google Drive con formato exacto ("ponderacion": 1.0 / 0)
    const jsonFormateado = formatearJsonBotones(propuestaValidada);
    await actualizarContenidoDrive(jsonFormateado);

    // 3. Registrar en auditoría quién aceptó el cambio, cuándo, sobre qué archivo y respaldo previo
    const auditRecord = await AiAuditLog.create({
      usuarioId,
      archivoId,
      tema: tema || 'No especificado',
      peticion: peticion || 'No especificada',
      contenidoAnterior,
      contenidoNuevo: jsonFormateado
    });

    return res.json({
      success: true,
      mensaje: '¡Archivo JSON actualizado exitosamente en Google Drive!',
      archivoId,
      auditId: auditRecord.id,
      actualizadoEn: auditRecord.createdAt,
      propuesta: propuestaValidada
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Devuelve el JSON original de 43 botones sin modificar Drive.
 * GET /api/ai/original
 */
function obtenerOriginal(req, res) {
  return res.json({
    success: true,
    propuesta: obtenerJsonOriginal()
  });
}

/**
 * Restaura directamente el JSON original en Google Drive y registra la operación en auditoría.
 * POST /api/ai/restaurar
 */
async function restaurarOriginal(req, res, next) {
  try {
    const usuarioId = req.usuario.id;
    const archivoId = getDriveFileId();
    if (!archivoId) {
      return res.status(503).json({
        error: 'El ID del archivo de Google Drive (GOOGLE_DRIVE_FILE_ID) no está configurado en el backend.'
      });
    }
    const original = obtenerJsonOriginal();
    const jsonFormateado = formatearJsonBotones(original);

    let contenidoAnterior = null;
    try {
      contenidoAnterior = await obtenerContenidoDrive();
    } catch (driveReadErr) {
      console.warn('[AI Controller] No se pudo leer el contenido previo de Drive para backup:', driveReadErr.message);
    }

    await actualizarContenidoDrive(jsonFormateado);

    const auditRecord = await AiAuditLog.create({
      usuarioId,
      archivoId,
      tema: 'JSON Original (Restauración)',
      peticion: 'Restauración manual del JSON original por defecto',
      contenidoAnterior,
      contenidoNuevo: jsonFormateado
    });

    return res.json({
      success: true,
      mensaje: '¡JSON original restaurado exitosamente en Google Drive!',
      archivoId,
      auditId: auditRecord.id,
      actualizadoEn: auditRecord.createdAt,
      propuesta: original
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Obtiene el historial de auditoría y versiones guardadas en Drive.
 * GET /api/ai/historial
 */
async function obtenerHistorial(req, res, next) {
  try {
    const logs = await AiAuditLog.findAll({
      limit: 20,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'correo', 'rol']
        }
      ]
    });

    return res.json(logs);
  } catch (error) {
    next(error);
  }
}

/**
 * Verifica el estado de configuración (Gemini y Drive) y lee el JSON actual de Drive.
 * GET /api/ai/estado
 */
async function obtenerEstadoDrive(req, res, next) {
  try {
    const archivoId = getDriveFileId();
    const tieneGeminiKey = Boolean((process.env.GEMINI_API_KEY || '').trim());
    const tieneDriveCredentials = hasDriveCredentials();

    let contenidoActual = null;
    let driveError = null;

    if (tieneDriveCredentials) {
      if (!archivoId) {
        driveError = 'El ID del archivo de Google Drive (GOOGLE_DRIVE_FILE_ID) no está configurado en el backend.';
      } else {
        try {
          const raw = await obtenerContenidoDrive();
          try {
            contenidoActual = JSON.parse(raw);
          } catch {
            contenidoActual = raw;
          }
        } catch (err) {
          driveError = err.message;
        }
      }
    }

    return res.json({
      archivoId,
      modeloGemini: getGeminiModel(),
      tieneGeminiKey,
      tieneDriveCredentials,
      driveError,
      contenidoActual
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  obtenerPropuesta,
  aplicarPropuesta,
  obtenerOriginal,
  restaurarOriginal,
  obtenerHistorial,
  obtenerEstadoDrive
};
