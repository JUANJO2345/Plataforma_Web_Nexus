const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const BACKEND_DIR = path.resolve(__dirname, '..', '..');
const FRONTEND_DIR = path.resolve(BACKEND_DIR, '..', 'FrontEnd');
const REPO_ROOT = path.resolve(BACKEND_DIR, '..');

const SECRET_ENV_KEYS = [
  'GEMINI_API_KEY',
  'GOOGLE_SERVICE_ACCOUNT_KEY',
  'GOOGLE_CLIENT_EMAIL',
  'GOOGLE_PRIVATE_KEY'
];

const INHERITED_OVERRIDE_KEYS = [
  'AUTH_RATE_LIMIT_MAX',
  'AI_RATE_LIMIT_MAX'
];

function createNonexistentEnvPath() {
  return path.join(os.tmpdir(), `nexus-nonexistent-${process.pid}-${crypto.randomUUID()}.env`);
}

function createTempDbPath(prefix = 'nexus-e2e') {
  return path.join(
    os.tmpdir(),
    `${prefix}-${process.pid}-${Date.now()}-${crypto.randomUUID()}.sqlite`
  );
}

function createTestEnv(overrides = {}) {
  const dbPath = overrides.DB_STORAGE || createTempDbPath();
  const nonexistentEnv = createNonexistentEnvPath();

  const env = {
    NODE_ENV: 'test',
    DB_STORAGE: dbPath,
    JWT_SECRET: 'nexus-e2e-synthetic-jwt-secret-key-2026',
    CORS_ORIGIN: 'http://localhost:5173',
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    GOOGLE_DRIVE_FILE_ID: 'synthetic-drive-file-id-e2e',
    DOTENV_PATH: nonexistentEnv,
    DOTENV_CONFIG_PATH: nonexistentEnv,
    DOTENV_QUIET: 'true',
    DOTENV_CONFIG_QUIET: 'true',
    ...overrides
  };

  for (const key of SECRET_ENV_KEYS) {
    if (!(key in overrides)) {
      env[key] = undefined;
    }
  }

  for (const key of INHERITED_OVERRIDE_KEYS) {
    if (!(key in overrides)) {
      env[key] = undefined;
    }
  }

  return env;
}

function isInsideTmpdir(targetPath) {
  if (!targetPath) return false;
  const resolvedTmp = path.resolve(os.tmpdir());
  const resolvedTarget = path.resolve(String(targetPath));
  const rel = path.relative(resolvedTmp, resolvedTarget);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function applyProcessEnv(envMap) {
  for (const [key, value] of Object.entries(envMap)) {
    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }
}

function cleanupTempDbFiles(dbPath) {
  if (!dbPath) return;
  const resolvedDb = path.resolve(dbPath);
  if (!isInsideTmpdir(resolvedDb)) {
    throw new Error(`Refusing to delete DB path outside os.tmpdir(): ${resolvedDb}`);
  }
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true, maxRetries: 6, retryDelay: 50 });
  }
}

async function startTestServer(envOverrides = {}) {
  const env = createTestEnv(envOverrides);
  const dbPath = env.DB_STORAGE;
  applyProcessEnv(env);

  // Lazy-require Backend modules after synthetic env is applied so Sequelize,
  // JWT_SECRET, CORS_ORIGIN, and rate limiters capture isolated test settings.
  const models = require('../../models');
  const { inicializarPartidas } = require('../../database/migrarPartidas');
  const app = require('../../app');

  const actualStorage = models.sequelize.options.storage;
  assert.equal(
    actualStorage,
    dbPath,
    `DB isolation guard failed: expected sequelize.options.storage === ${dbPath}, got ${actualStorage}`
  );
  assert.ok(
    isInsideTmpdir(actualStorage) && isInsideTmpdir(dbPath),
    `DB isolation guard failed: storage ${actualStorage} must reside inside os.tmpdir() (${os.tmpdir()})`
  );

  let server;
  try {
    await models.sequelize.sync({ force: true });
    await inicializarPartidas();

    server = await new Promise((resolve, reject) => {
      const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
      srv.keepAliveTimeout = 65000;
      srv.headersTimeout = 66000;
      srv.on('error', reject);
    });
  } catch (err) {
    await models.sequelize.close().catch(() => {});
    cleanupTempDbFiles(dbPath);
    throw err;
  }

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  let stopped = false;
  async function stop() {
    if (stopped) return;
    stopped = true;
    try {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    } finally {
      await models.sequelize.close();
      cleanupTempDbFiles(dbPath);
    }
  }

  return {
    app,
    server,
    sequelize: models.sequelize,
    models,
    baseUrl,
    dbPath,
    env,
    stop
  };
}

function issueToken(usuario, jwtSecret = process.env.JWT_SECRET) {
  return jwt.sign(
    { id: usuario.id, correo: usuario.correo, rol: usuario.rol },
    jwtSecret,
    { expiresIn: '24h' }
  );
}

async function createUserFixture(models, { nombre, correo, contrasena, rol }) {
  const hashedPassword = await bcrypt.hash(contrasena, 10);
  const user = await models.Usuario.create({
    nombre,
    correo: correo.toLowerCase().trim(),
    contrasena: hashedPassword,
    rol
  });
  return {
    user,
    token: issueToken(user),
    contrasena
  };
}

async function seedBaselineFixtures(harness) {
  const { models } = harness;
  const { obtenerJsonOriginal } = require('../../utils/geminiService');

  const admin1 = await createUserFixture(models, {
    nombre: 'Admin Principal',
    correo: 'admin1@nexus.test',
    contrasena: 'Password123!',
    rol: 'admin'
  });

  const admin2 = await createUserFixture(models, {
    nombre: 'Admin Secundario',
    correo: 'admin2@nexus.test',
    contrasena: 'Password123!',
    rol: 'admin'
  });

  const profA = await createUserFixture(models, {
    nombre: 'Profesor Alfa',
    correo: 'profa@nexus.test',
    contrasena: 'Password123!',
    rol: 'profesor'
  });

  const profB = await createUserFixture(models, {
    nombre: 'Profesor Beta',
    correo: 'profb@nexus.test',
    contrasena: 'Password123!',
    rol: 'profesor'
  });

  const estA1 = await createUserFixture(models, {
    nombre: 'Estudiante A1',
    correo: 'esta1@nexus.test',
    contrasena: 'Password123!',
    rol: 'estudiante'
  });

  const estA2 = await createUserFixture(models, {
    nombre: 'Estudiante A2',
    correo: 'esta2@nexus.test',
    contrasena: 'Password123!',
    rol: 'estudiante'
  });

  const estB1 = await createUserFixture(models, {
    nombre: 'Estudiante B1',
    correo: 'estb1@nexus.test',
    contrasena: 'Password123!',
    rol: 'estudiante'
  });

  const estFree = await createUserFixture(models, {
    nombre: 'Estudiante Libre',
    correo: 'estfree@nexus.test',
    contrasena: 'Password123!',
    rol: 'estudiante'
  });

  const opLegacy = await createUserFixture(models, {
    nombre: 'Operador Legacy',
    correo: 'oplegacy@nexus.test',
    contrasena: 'Password123!',
    rol: 'user'
  });

  const grupoA = await models.Grupo.create({
    codigo: 'GRP-A',
    nombre: 'Grupo Alfa',
    profesorId: profA.user.id
  });
  await grupoA.setEstudiantes([estA1.user.id, estA2.user.id]);

  const grupoB = await models.Grupo.create({
    codigo: 'GRP-B',
    nombre: 'Grupo Beta',
    profesorId: profB.user.id
  });
  await grupoB.setEstudiantes([estB1.user.id]);

  const niveles = await models.Nivel.findAll({ order: [['id', 'ASC']] });
  const n1 = niveles[0];
  const n2 = niveles[1];
  const n3 = niveles[2];

  const partidaA1Low = await models.Partida.create({
    usuarioId: estA1.user.id,
    username: estA1.user.correo
  });
  await models.ResultadoNivel.bulkCreate([
    { partidaId: partidaA1Low.id, nivelId: n1.id, puntaje: 50, tiempoSegundos: 60 }
  ]);

  const partidaA1High = await models.Partida.create({
    usuarioId: estA1.user.id,
    username: estA1.user.correo
  });
  await models.ResultadoNivel.bulkCreate([
    { partidaId: partidaA1High.id, nivelId: n1.id, puntaje: 95, tiempoSegundos: 30 },
    { partidaId: partidaA1High.id, nivelId: n2.id, puntaje: 85, tiempoSegundos: 40 }
  ]);

  const partidaB1 = await models.Partida.create({
    usuarioId: estB1.user.id,
    username: estB1.user.correo
  });
  await models.ResultadoNivel.bulkCreate([
    { partidaId: partidaB1.id, nivelId: n1.id, puntaje: 80, tiempoSegundos: 50 },
    { partidaId: partidaB1.id, nivelId: n3.id, puntaje: 75, tiempoSegundos: 45 }
  ]);

  const partidaFree = await models.Partida.create({
    usuarioId: estFree.user.id,
    username: estFree.user.correo
  });
  await models.ResultadoNivel.bulkCreate([
    { partidaId: partidaFree.id, nivelId: n1.id, puntaje: 70, tiempoSegundos: 55 }
  ]);

  const plantillaJson = JSON.stringify(obtenerJsonOriginal());
  const auditLog1 = await models.AiAuditLog.create({
    usuarioId: profA.user.id,
    archivoId: process.env.GOOGLE_DRIVE_FILE_ID || 'synthetic-drive-file-id-e2e',
    tema: 'Movilidad Urbana',
    peticion: 'Ajustar métricas de hora pico',
    contenidoAnterior: plantillaJson,
    contenidoNuevo: plantillaJson
  });

  const auditLog2 = await models.AiAuditLog.create({
    usuarioId: admin1.user.id,
    archivoId: process.env.GOOGLE_DRIVE_FILE_ID || 'synthetic-drive-file-id-e2e',
    tema: 'Corredores Aéreos',
    peticion: 'Actualizar capacidad del sistema',
    contenidoAnterior: plantillaJson,
    contenidoNuevo: plantillaJson
  });

  return {
    users: {
      admin1,
      admin2,
      profA,
      profB,
      estA1,
      estA2,
      estB1,
      estFree,
      opLegacy
    },
    grupos: {
      grupoA,
      grupoB
    },
    niveles,
    partidas: {
      partidaA1Low,
      partidaA1High,
      partidaB1,
      partidaFree
    },
    auditLogs: [auditLog1, auditLog2]
  };
}

async function requestJson(baseUrl, reqPath, opts = {}) {
  const {
    method = 'GET',
    token = null,
    headers = {},
    body = undefined
  } = opts;

  const finalHeaders = { ...headers };
  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  let finalBody = body;
  if (body !== undefined && typeof body !== 'string' && !Buffer.isBuffer(body)) {
    if (!finalHeaders['Content-Type'] && !finalHeaders['content-type']) {
      finalHeaders['Content-Type'] = 'application/json';
    }
    finalBody = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${reqPath}`, {
    method,
    headers: finalHeaders,
    body: finalBody
  });

  const rawBody = await response.text();
  const contentType = response.headers.get('content-type') || '';
  let parsedBody = rawBody;
  if (contentType.includes('application/json')) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = rawBody;
    }
  } else if (rawBody.startsWith('{') || rawBody.startsWith('[')) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = rawBody;
    }
  }

  return {
    status: response.status,
    headers: response.headers,
    body: parsedBody,
    rawBody
  };
}

function runNpm(args, cwd = FRONTEND_DIR) {
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], {
      cwd,
      encoding: 'utf8',
      windowsHide: true
    });
  }
  return spawnSync('npm', args, { cwd, encoding: 'utf8' });
}

function runNpx(args, cwd = FRONTEND_DIR) {
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', `npx ${args.join(' ')}`], {
      cwd,
      encoding: 'utf8',
      windowsHide: true
    });
  }
  return spawnSync('npx', args, { cwd, encoding: 'utf8' });
}

module.exports = {
  BACKEND_DIR,
  FRONTEND_DIR,
  REPO_ROOT,
  createNonexistentEnvPath,
  createTempDbPath,
  createTestEnv,
  isInsideTmpdir,
  cleanupTempDbFiles,
  startTestServer,
  issueToken,
  createUserFixture,
  seedBaselineFixtures,
  requestJson,
  runNpm,
  runNpx
};
