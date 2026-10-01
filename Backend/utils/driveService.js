const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DEFAULT_FILE_ID = '1mxonSdL8ydZQM0aOZn-0tTJZ3q4UgFK_';

/**
 * Obtiene el cliente autenticado de Google Drive usando Service Account.
 */
function getDriveClient() {
  const fileId = process.env.GOOGLE_DRIVE_FILE_ID || DEFAULT_FILE_ID;

  let clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  // Si existe variable GOOGLE_SERVICE_ACCOUNT_KEY (puede ser ruta o string JSON)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      if (fs.existsSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)) {
        const fileContent = fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'utf-8');
        const parsed = JSON.parse(fileContent);
        clientEmail = parsed.client_email;
        privateKey = parsed.private_key;
      } else {
        const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        clientEmail = parsed.client_email;
        privateKey = parsed.private_key;
      }
    } catch (err) {
      console.error('[DriveService] Error al parsear GOOGLE_SERVICE_ACCOUNT_KEY:', err.message);
    }
  }

  // Comprobar archivo local alternativo Backend/config/service-account.json
  if (!clientEmail || !privateKey) {
    const localSaPath = path.join(__dirname, '..', 'config', 'service-account.json');
    if (fs.existsSync(localSaPath)) {
      try {
        const saData = JSON.parse(fs.readFileSync(localSaPath, 'utf-8'));
        clientEmail = saData.client_email;
        privateKey = saData.private_key;
      } catch (err) {
        console.error('[DriveService] Error al leer config/service-account.json:', err.message);
      }
    }
  }

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Credenciales de Google Drive no configuradas en el backend. ' +
      'Por favor configura GOOGLE_CLIENT_EMAIL y GOOGLE_PRIVATE_KEY en Backend/.env ' +
      'y comparte el archivo de Drive con dicho correo con rol de Editor.'
    );
  }

  // Corregir saltos de línea en la clave privada si viene con \n escapados
  const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: formattedPrivateKey,
    scopes: ['https://www.googleapis.com/auth/drive']
  });

  const drive = google.drive({ version: 'v3', auth });
  return { drive, fileId, clientEmail };
}

/**
 * Lee el contenido actual del archivo JSON en Google Drive.
 */
async function obtenerContenidoDrive() {
  const { drive, fileId } = getDriveClient();

  try {
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'text' }
    );
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
  } catch (err) {
    if (err.status === 404) {
      throw new Error(`El archivo de Drive (${fileId}) no fue encontrado o la cuenta de servicio no tiene acceso.`);
    }
    if (err.status === 403) {
      throw new Error(`Permisos insuficientes en Drive. Asegúrate de compartir el archivo con la cuenta de servicio.`);
    }
    throw new Error(`Error al leer archivo de Google Drive: ${err.message}`);
  }
}

/**
 * Actualiza el archivo JSON en Google Drive con la nueva propuesta aprobada.
 */
async function actualizarContenidoDrive(nuevoContenidoJson) {
  const { drive, fileId } = getDriveClient();
  const contenidoTexto = typeof nuevoContenidoJson === 'string'
    ? nuevoContenidoJson
    : JSON.stringify(nuevoContenidoJson, null, 2);

  try {
    const res = await drive.files.update({
      fileId,
      media: {
        mimeType: 'application/json',
        body: contenidoTexto
      }
    });

    return {
      success: true,
      fileId,
      updatedAt: new Date().toISOString(),
      data: res.data
    };
  } catch (err) {
    if (err.status === 403) {
      throw new Error(`No se pudo escribir en el archivo de Drive (${fileId}). Verifica que la cuenta de servicio tenga permiso de "Editor".`);
    }
    throw new Error(`Error al actualizar archivo en Google Drive: ${err.message}`);
  }
}

module.exports = {
  DEFAULT_FILE_ID,
  getDriveClient,
  obtenerContenidoDrive,
  actualizarContenidoDrive
};
