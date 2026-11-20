const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const {
  BACKEND_DIR,
  createNonexistentEnvPath,
  createTempDbPath,
  cleanupTempDbFiles,
  startTestServer,
  seedBaselineFixtures,
  requestJson
} = require('./helpers/testHarness');

describe('Security, Environment Isolation, Payload Limit, CORS & Rate Limiters', () => {
  let harness;
  let fx;

  before(async () => {
    harness = await startTestServer({
      CORS_ORIGIN: 'https://allowed.nexus.test',
      GOOGLE_DRIVE_FILE_ID: undefined,
      GEMINI_MODEL: undefined
    });
    fx = await seedBaselineFixtures(harness);
  });

  after(async () => {
    if (harness) {
      await harness.stop();
    }
  });

  it('fails startup of app.js in NODE_ENV=production when JWT_SECRET is missing or whitespace (dotenv bypassed)', () => {
    const nonexistentEnv = createNonexistentEnvPath();
    for (const caseSpec of [
      { label: 'missing JWT_SECRET', secret: undefined },
      { label: 'whitespace JWT_SECRET', secret: '   ' }
    ]) {
      const childDb = createTempDbPath('nexus-prod-nojwt');
      const childEnv = {
        ...process.env,
        NODE_ENV: 'production',
        DB_STORAGE: childDb,
        DOTENV_PATH: nonexistentEnv,
        DOTENV_CONFIG_PATH: nonexistentEnv,
        DOTENV_QUIET: 'true',
        DOTENV_CONFIG_QUIET: 'true'
      };
      if (caseSpec.secret === undefined) {
        delete childEnv.JWT_SECRET;
      } else {
        childEnv.JWT_SECRET = caseSpec.secret;
      }
      delete childEnv.GEMINI_API_KEY;
      delete childEnv.GOOGLE_SERVICE_ACCOUNT_KEY;
      delete childEnv.GOOGLE_CLIENT_EMAIL;
      delete childEnv.GOOGLE_PRIVATE_KEY;

      try {
        const res = spawnSync(
          process.execPath,
          ['-e', "require('./app');"],
          {
            cwd: BACKEND_DIR,
            env: childEnv,
            encoding: 'utf8',
            windowsHide: true
          }
        );

        assert.notEqual(
          res.status,
          0,
          `Process must exit non-zero for ${caseSpec.label} in production`
        );
        const combinedOutput = `${res.stdout}\n${res.stderr}`;
        assert.match(combinedOutput, /JWT_SECRET/i);
      } finally {
        cleanupTempDbFiles(childDb);
      }
    }
  });

  it('returns archivoId: null, defaults GEMINI_MODEL, and returns 503 on POST /api/ai/aplicar & /restaurar when GOOGLE_DRIVE_FILE_ID is unset', async () => {
    const res = await requestJson(harness.baseUrl, '/api/ai/estado', {
      token: fx.users.admin1.token
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.archivoId, null);
    assert.equal(res.body.modeloGemini, 'gemini-3.5-flash-lite');
    assert.equal(typeof res.body.tieneDriveCredentials, 'boolean');
    assert.equal(res.body.tieneGeminiKey, false);

    // Both aplicarPropuesta and restaurarOriginal check if (!archivoId) -> 503
    // BEFORE calling obtenerContenidoDrive() / getDriveClient() / service-account.json.
    const origRes = await requestJson(harness.baseUrl, '/api/ai/original', {
      token: fx.users.admin1.token
    });
    assert.equal(origRes.status, 200);

    const aplicarRes = await requestJson(harness.baseUrl, '/api/ai/aplicar', {
      method: 'POST',
      token: fx.users.admin1.token,
      body: {
        tema: 'Offline Test',
        peticion: 'Verify 503 without Drive ID',
        propuesta: origRes.body.propuesta
      }
    });
    assert.equal(aplicarRes.status, 503);
    assert.match(aplicarRes.body.error || '', /GOOGLE_DRIVE_FILE_ID/i);

    const restaurarRes = await requestJson(harness.baseUrl, '/api/ai/restaurar', {
      method: 'POST',
      token: fx.users.admin1.token
    });
    assert.equal(restaurarRes.status, 503);
    assert.match(restaurarRes.body.error || '', /GOOGLE_DRIVE_FILE_ID/i);
  });

  it('never logs plaintext passwords or req.body on /api/auth/register or /api/auth/login (201, 200, 400, 409, 401)', () => {
    const nonexistentEnv = createNonexistentEnvPath();
    const childDb = createTempDbPath('nexus-nolog');
    const secretSentinel = 'Sup3rS3cr3tPl4inT3xt!987';

    const script = `
      const { sequelize } = require('./models');
      const { inicializarPartidas } = require('./database/migrarPartidas');
      const app = require('./app');
      (async () => {
        await sequelize.sync({ force: true });
        await inicializarPartidas();
        const server = await new Promise((res) => {
          const s = app.listen(0, '127.0.0.1', () => res(s));
        });
        const base = 'http://127.0.0.1:' + server.address().port;
        const reg = await fetch(base + '/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correo: 'nolog@nexus.test', contrasena: ${JSON.stringify(secretSentinel)} })
        });
        if (reg.status !== 201) throw new Error('Expected 201 register, got ' + reg.status);

        const regBadEmail = await fetch(base + '/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correo: 'invalid-email', contrasena: ${JSON.stringify(secretSentinel)} })
        });
        if (regBadEmail.status !== 400) throw new Error('Expected 400 invalid email register, got ' + regBadEmail.status);

        const regDup = await fetch(base + '/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correo: 'nolog@nexus.test', contrasena: ${JSON.stringify(secretSentinel)} })
        });
        if (regDup.status !== 409) throw new Error('Expected 409 duplicate register, got ' + regDup.status);

        const log = await fetch(base + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'nolog@nexus.test', password: ${JSON.stringify(secretSentinel)} })
        });
        if (log.status !== 200) throw new Error('Expected 200 login, got ' + log.status);

        const logBadPass = await fetch(base + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'nolog@nexus.test', password: ${JSON.stringify(secretSentinel + '_wrong')} })
        });
        if (logBadPass.status !== 401) throw new Error('Expected 401 bad login password, got ' + logBadPass.status);

        server.closeAllConnections?.();
        await new Promise((res) => server.close(res));
        await sequelize.close();
      })().catch((err) => { console.error(err); process.exit(1); });
    `;

    const childEnv = {
      ...process.env,
      NODE_ENV: 'test',
      DB_STORAGE: childDb,
      JWT_SECRET: 'child-nolog-secret',
      CORS_ORIGIN: 'http://localhost:5173',
      DOTENV_PATH: nonexistentEnv,
      DOTENV_CONFIG_PATH: nonexistentEnv,
      DOTENV_QUIET: 'true',
      DOTENV_CONFIG_QUIET: 'true'
    };
    delete childEnv.GEMINI_API_KEY;
    delete childEnv.GOOGLE_SERVICE_ACCOUNT_KEY;
    delete childEnv.GOOGLE_CLIENT_EMAIL;
    delete childEnv.GOOGLE_PRIVATE_KEY;

    try {
      const res = spawnSync(process.execPath, ['-e', script], {
        cwd: BACKEND_DIR,
        env: childEnv,
        encoding: 'utf8',
        windowsHide: true
      });

      assert.equal(res.status, 0, `Child script failed: ${res.stderr}`);
      const output = `${res.stdout}\n${res.stderr}`;
      assert.equal(
        output.includes(secretSentinel),
        false,
        'Plaintext password must NEVER be logged to stdout or stderr'
      );
      assert.equal(
        output.includes('Body recibido'),
        false,
        'Raw req.body log must be removed from authController'
      );
    } finally {
      cleanupTempDbFiles(childDb);
    }
  });

  it('rejects JSON payloads larger than 1mb with HTTP 413', async () => {
    const oversized = JSON.stringify({ payload: 'A'.repeat(1024 * 1024 + 2048) });
    const res = await requestJson(harness.baseUrl, '/api/partidas', {
      method: 'POST',
      token: fx.users.estA1.token,
      headers: { 'Content-Type': 'application/json' },
      body: oversized
    });

    assert.equal(res.status, 413);
  });

  it('honors configured CORS_ORIGIN and does not reflect disallowed origins', async () => {
    const allowedRes = await requestJson(harness.baseUrl, '/api/partidas/catalogo', {
      token: fx.users.estA1.token,
      headers: { Origin: 'https://allowed.nexus.test' }
    });
    assert.equal(allowedRes.status, 200);
    assert.equal(
      allowedRes.headers.get('access-control-allow-origin'),
      'https://allowed.nexus.test'
    );

    const disallowedRes = await requestJson(harness.baseUrl, '/api/partidas/catalogo', {
      token: fx.users.estA1.token,
      headers: { Origin: 'https://evil.attacker.test' }
    });
    const allowOrigin = disallowedRes.headers.get('access-control-allow-origin');
    assert.notEqual(allowOrigin, 'https://evil.attacker.test');
    assert.notEqual(allowOrigin, '*');
  });

  it('defaults CORS_ORIGIN to http://localhost:5173 when unset and rejects disallowed origins', () => {
    const nonexistentEnv = createNonexistentEnvPath();
    const childDb = createTempDbPath('nexus-cors-default');
    const script = `
      const assert = require('node:assert/strict');
      const { sequelize } = require('./models');
      const app = require('./app');
      (async () => {
        await sequelize.sync({ force: true });
        const server = await new Promise((res) => {
          const s = app.listen(0, '127.0.0.1', () => res(s));
        });
        const base = 'http://127.0.0.1:' + server.address().port;
        const okRes = await fetch(base + '/api/partidas/catalogo', {
          headers: { Origin: 'http://localhost:5173' }
        });
        assert.equal(okRes.headers.get('access-control-allow-origin'), 'http://localhost:5173');

        const badRes = await fetch(base + '/api/partidas/catalogo', {
          headers: { Origin: 'https://evil.attacker.test' }
        });
        const badOrigin = badRes.headers.get('access-control-allow-origin');
        assert.notEqual(badOrigin, 'https://evil.attacker.test');
        assert.notEqual(badOrigin, '*');

        server.closeAllConnections?.();
        await new Promise((res) => server.close(res));
        await sequelize.close();
      })().catch((err) => { console.error(err); process.exit(1); });
    `;

    const childEnv = {
      ...process.env,
      NODE_ENV: 'test',
      DB_STORAGE: childDb,
      JWT_SECRET: 'child-cors-default-secret',
      DOTENV_PATH: nonexistentEnv,
      DOTENV_CONFIG_PATH: nonexistentEnv,
      DOTENV_QUIET: 'true',
      DOTENV_CONFIG_QUIET: 'true'
    };
    delete childEnv.CORS_ORIGIN;
    delete childEnv.GEMINI_API_KEY;
    delete childEnv.GOOGLE_SERVICE_ACCOUNT_KEY;
    delete childEnv.GOOGLE_CLIENT_EMAIL;
    delete childEnv.GOOGLE_PRIVATE_KEY;

    try {
      const res = spawnSync(process.execPath, ['-e', script], {
        cwd: BACKEND_DIR,
        env: childEnv,
        encoding: 'utf8',
        windowsHide: true
      });
      assert.equal(res.status, 0, `Default CORS test failed:\n${res.stdout}\n${res.stderr}`);
    } finally {
      cleanupTempDbFiles(childDb);
    }
  });

  it('enforces shared authLimiter on /api/auth/login & /api/auth/register without blocking /api/ai/propuesta or /api/partidas/catalogo', async () => {
    const statuses = [];
    for (let i = 0; i < 65; i += 1) {
      const res = await requestJson(harness.baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { username: 'ratelimit@nexus.test', password: 'WrongPassword!' }
      });
      statuses.push(res.status);
      if (res.status === 429) break;
    }

    assert.ok(
      statuses.includes(429),
      `Expected /api/auth/login rate limiter to return 429; observed statuses: ${[...new Set(statuses)].join(', ')}`
    );

    const registerAfterExhaust = await requestJson(harness.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { correo: 'blocked.by.authlimiter@nexus.test', contrasena: 'Password123!' }
    });
    assert.equal(registerAfterExhaust.status, 429, '/api/auth/register must share authLimiter');

    const aiAfterAuthExhaust = await requestJson(harness.baseUrl, '/api/ai/propuesta', {
      method: 'POST',
      token: fx.users.admin1.token,
      body: {}
    });
    assert.equal(aiAfterAuthExhaust.status, 400, 'Exhausting /api/auth/* must not block /api/ai/propuesta');

    const catalogoAfterAuthExhaust = await requestJson(harness.baseUrl, '/api/partidas/catalogo', {
      token: fx.users.estA1.token
    });
    assert.equal(catalogoAfterAuthExhaust.status, 200, 'Exhausting /api/auth/* must not block /api/partidas/catalogo');
  });

  it('enforces per-user aiPropuestaLimiter (429) on /api/ai/propuesta without blocking a second profesor user', async () => {
    const statuses = [];
    for (let i = 0; i < 65; i += 1) {
      const res = await requestJson(harness.baseUrl, '/api/ai/propuesta', {
        method: 'POST',
        token: fx.users.admin1.token,
        body: {}
      });
      statuses.push(res.status);
      if (res.status === 429) break;
    }

    assert.ok(
      statuses.includes(429),
      `Expected /api/ai/propuesta rate limiter to return 429; observed statuses: ${[...new Set(statuses)].join(', ')}`
    );
    const non429Count = statuses.filter((s) => s !== 429).length;
    assert.ok(non429Count <= 15, `Expected aiPropuestaLimiter max <= 15, got ${non429Count}`);

    const secondProfRes = await requestJson(harness.baseUrl, '/api/ai/propuesta', {
      method: 'POST',
      token: fx.users.profA.token,
      body: {}
    });
    assert.equal(
      secondProfRes.status,
      400,
      'aiPropuestaLimiter for admin1 must not block a second profesor user'
    );
  });
});
