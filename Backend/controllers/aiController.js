const { generarPropuestaGemini, validarFormatoPropuesta } = require('../utils/geminiService');
const { DEFAULT_FILE_ID, obtenerContenidoDrive, actualizarContenidoDrive } = require('../utils/driveService');
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
    const archivoId = process.env.GOOGLE_DRIVE_FILE_ID || DEFAULT_FILE_ID;

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

    // 1. Obtener contenido actual de Drive para conservar copia de respaldo (backup)
    let contenidoAnterior = null;
    try {
      contenidoAnterior = await obtenerContenidoDrive();
    } catch (driveReadErr) {
      console.warn('[AI Controller] No se pudo leer el contenido previo de Drive para backup:', driveReadErr.message);
      // Si falla la lectura pero se desea proceder o alertar, lo registramos
    }

    // 2. Actualizar el archivo en Google Drive
    await actualizarContenidoDrive(propuestaValidada);

    // 3. Registrar en auditoría quién aceptó el cambio, cuándo, sobre qué archivo y respaldo previo
    const auditRecord = await AiAuditLog.create({
      usuarioId,
      archivoId,
      tema: tema || 'No especificado',
      peticion: peticion || 'No especificada',
      contenidoAnterior,
      contenidoNuevo: JSON.stringify(propuestaValidada, null, 2)
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
          attributes: ['id', 'username', 'email', 'rol']
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
    const archivoId = process.env.GOOGLE_DRIVE_FILE_ID || DEFAULT_FILE_ID;
    const tieneGeminiKey = Boolean(process.env.GEMINI_API_KEY);
    const tieneDriveCredentials = Boolean(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)
    );

    let contenidoActual = null;
    let driveError = null;

    if (tieneDriveCredentials) {
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

    return res.json({
      archivoId,
      modeloGemini: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
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
  obtenerHistorial,
  obtenerEstadoDrive
};
