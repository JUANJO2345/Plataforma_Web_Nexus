const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { UniqueConstraintError, ValidationError, ValidationErrorItem } = require('sequelize');
const {
  BACKEND_DIR,
  createNonexistentEnvPath,
  createTempDbPath,
  cleanupTempDbFiles,
  startTestServer,
  seedBaselineFixtures,
  requestJson
} = require('./helpers/testHarness');

describe('Tier 2 — Boundary Value Analysis, Validation & RBAC/IDOR Negative Tests', () => {
  let harness;
  let fx;

  before(async () => {
    harness = await startTestServer();
    fx = await seedBaselineFixtures(harness);
  });

  after(async () => {
    if (harness) {
      await harness.stop();
    }
  });

  describe('Auth & JWT Boundaries (F1.3, F2.1)', () => {
    it('rejects invalid email format on POST /api/auth/register with 400', async () => {
      const res = await requestJson(harness.baseUrl, '/api/auth/register', {
        method: 'POST',
        body: { correo: 'correo-invalido-sin-arroba', contrasena: 'Password123!' }
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.message || res.body.error);
    });

    it('rejects 5-character password (400) and accepts 6-character password (201) on register', async () => {
      const tooShort = await requestJson(harness.baseUrl, '/api/auth/register', {
        method: 'POST',
        body: { correo: 'bva5@nexus.test', contrasena: '12345' }
      });
      assert.equal(tooShort.status, 400);

      const exactMin = await requestJson(harness.baseUrl, '/api/auth/register', {
        method: 'POST',
        body: { correo: 'bva6@nexus.test', contrasena: '123456' }
      });
      assert.equal(exactMin.status, 201);
      assert.ok(exactMin.body.token);
    });

    it('blocks Op.like wildcard injection (%, prefix@%, _) and nombre login with unified 401 message', async () => {
      const attempts = [
        { username: '%', password: fx.users.estA1.contrasena },
        { username: 'esta1@%', password: fx.users.estA1.contrasena },
        { username: 'esta_@nexus.test', password: fx.users.estA1.contrasena },
        { username: fx.users.estA1.user.nombre, password: fx.users.estA1.contrasena },
        { username: fx.users.estA1.user.correo, password: 'WrongPassword999!' }
      ];

      for (const payload of attempts) {
        const res = await requestJson(harness.baseUrl, '/api/auth/login', {
          method: 'POST',
          body: payload
        });
        assert.equal(res.status, 401, `Expected 401 for identifier ${payload.username}`);
        assert.equal(
          res.body.message,
          'Credenciales inválidas.',
          `Expected unified 401 message for ${payload.username}`
        );
      }
    });

    it('rejects non-string payload and case-insensitive duplicate email on POST /api/auth/register', async () => {
      const nonString = await requestJson(harness.baseUrl, '/api/auth/register', {
        method: 'POST',
        body: { correo: 12345, contrasena: 123456 }
      });
      assert.equal(nonString.status, 400);

      const first = await requestJson(harness.baseUrl, '/api/auth/register', {
        method: 'POST',
        body: { correo: 'case.dup@nexus.test', contrasena: 'Password123!' }
      });
      assert.equal(first.status, 201);

      const dupUpper = await requestJson(harness.baseUrl, '/api/auth/register', {
        method: 'POST',
        body: { correo: 'CASE.DUP@NEXUS.TEST', contrasena: 'Password123!' }
      });
      assert.ok([400, 409].includes(dupUpper.status), `Expected 400 or 409, got ${dupUpper.status}`);
    });

    it('rejects ?token= query parameter authentication and unauthenticated /api/auth/me', async () => {
      const queryAuthRes = await requestJson(
        harness.baseUrl,
        `/api/partidas?token=${encodeURIComponent(fx.users.admin1.token)}`
      );
      assert.equal(queryAuthRes.status, 401);

      const unauthMe = await requestJson(harness.baseUrl, '/api/auth/me');
      assert.equal(unauthMe.status, 401);

      const badBearerMe = await requestJson(harness.baseUrl, '/api/auth/me', {
        token: 'invalid.jwt.token'
      });
      assert.equal(badBearerMe.status, 401);
    });
  });

  describe('Partidas Validation, VR Tampering & RBAC/IDOR (F2.4a)', () => {
    it('rejects invalid resultados (empty, negative, non-integer, duplicate nivelId, unknown nivelId) with 400', async () => {
      const n1 = fx.niveles[0];
      const invalidPayloads = [
        { resultados: [] },
        { resultados: [{ nivelId: n1.id, puntaje: -1, tiempoSegundos: 10 }] },
        { resultados: [{ nivelId: n1.id, puntaje: 10.5, tiempoSegundos: 10 }] },
        {
          resultados: [
            { nivelId: n1.id, puntaje: 50, tiempoSegundos: 10 },
            { nivelId: n1.id, puntaje: 80, tiempoSegundos: 15 }
          ]
        },
        { resultados: [{ nivelId: 999999, puntaje: 50, tiempoSegundos: 10 }] }
      ];

      for (const body of invalidPayloads) {
        const res = await requestJson(harness.baseUrl, '/api/partidas', {
          method: 'POST',
          token: fx.users.estA1.token,
          body
        });
        assert.equal(res.status, 400, `Expected 400 for payload ${JSON.stringify(body)}`);
      }
    });

    it('blocks cross-student PUT /api/partidas/:id with 403', async () => {
      const n1 = fx.niveles[0];
      const res = await requestJson(
        harness.baseUrl,
        `/api/partidas/${fx.partidas.partidaA1Low.id}`,
        {
          method: 'PUT',
          token: fx.users.estB1.token,
          body: { resultados: [{ nivelId: n1.id, puntaje: 999, tiempoSegundos: 1 }] }
        }
      );

      assert.equal(res.status, 403);
    });

    it('blocks non-admin owner tampering on PUT /api/partidas/:id (usuarioId, username, correo -> 403)', async () => {
      const n1 = fx.niveles[0];
      const tamperingBodies = [
        { usuarioId: fx.users.estB1.user.id, resultados: [{ nivelId: n1.id, puntaje: 77, tiempoSegundos: 20 }] },
        { username: fx.users.estB1.user.correo, resultados: [{ nivelId: n1.id, puntaje: 77, tiempoSegundos: 20 }] },
        { correo: fx.users.estB1.user.correo, resultados: [{ nivelId: n1.id, puntaje: 77, tiempoSegundos: 20 }] }
      ];

      for (const body of tamperingBodies) {
        const res = await requestJson(
          harness.baseUrl,
          `/api/partidas/${fx.partidas.partidaA1Low.id}`,
          {
            method: 'PUT',
            token: fx.users.estA1.token,
            body
          }
        );
        assert.equal(res.status, 403, `Expected 403 for owner tampering ${JSON.stringify(body)}`);
      }

      const persisted = await harness.models.Partida.findByPk(fx.partidas.partidaA1Low.id);
      assert.equal(persisted.usuarioId, fx.users.estA1.user.id);
    });

    it('blocks cross-student and cross-professor GET /api/partidas/:id with 403', async () => {
      const crossStudent = await requestJson(
        harness.baseUrl,
        `/api/partidas/${fx.partidas.partidaB1.id}`,
        { token: fx.users.estA1.token }
      );
      assert.equal(crossStudent.status, 403);

      const crossProf = await requestJson(
        harness.baseUrl,
        `/api/partidas/${fx.partidas.partidaB1.id}`,
        { token: fx.users.profA.token }
      );
      assert.equal(crossProf.status, 403);

      const ungroupedByProf = await requestJson(
        harness.baseUrl,
        `/api/partidas/${fx.partidas.partidaFree.id}`,
        { token: fx.users.profA.token }
      );
      assert.equal(ungroupedByProf.status, 403);
    });

    it('blocks cross-professor and student PATCH /api/partidas/:id/observacion with 403', async () => {
      const crossProf = await requestJson(
        harness.baseUrl,
        `/api/partidas/${fx.partidas.partidaB1.id}/observacion`,
        {
          method: 'PATCH',
          token: fx.users.profA.token,
          body: { observacion: 'Intento no autorizado' }
        }
      );
      assert.equal(crossProf.status, 403);

      const ungroupedProf = await requestJson(
        harness.baseUrl,
        `/api/partidas/${fx.partidas.partidaFree.id}/observacion`,
        {
          method: 'PATCH',
          token: fx.users.profA.token,
          body: { observacion: 'Estudiante fuera de grupo' }
        }
      );
      assert.equal(ungroupedProf.status, 403);

      const byStudent = await requestJson(
        harness.baseUrl,
        `/api/partidas/${fx.partidas.partidaA1Low.id}/observacion`,
        {
          method: 'PATCH',
          token: fx.users.estA1.token,
          body: { observacion: 'Auto calificación' }
        }
      );
      assert.equal(byStudent.status, 403);
    });
  });

  describe('Grupos Validation & RBAC/IDOR (F2.5)', () => {
    it('ignores profesorId query override for profesor on GET /api/grupos', async () => {
      const res = await requestJson(
        harness.baseUrl,
        `/api/grupos?profesorId=${fx.users.profB.user.id}`,
        { token: fx.users.profA.token }
      );

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.every((g) => g.profesorId === fx.users.profA.user.id));
      assert.ok(!res.body.some((g) => g.id === fx.grupos.grupoB.id));
    });

    it('blocks cross-professor and non-enrolled student GET /api/grupos/:id with 403', async () => {
      const profCross = await requestJson(
        harness.baseUrl,
        `/api/grupos/${fx.grupos.grupoB.id}`,
        { token: fx.users.profA.token }
      );
      assert.equal(profCross.status, 403);

      const estCross = await requestJson(
        harness.baseUrl,
        `/api/grupos/${fx.grupos.grupoB.id}`,
        { token: fx.users.estA1.token }
      );
      assert.equal(estCross.status, 403);
    });

    it('blocks cross-professor enrollment and non-admin group creation with 403', async () => {
      const crossEnroll = await requestJson(
        harness.baseUrl,
        `/api/grupos/${fx.grupos.grupoB.id}/estudiantes`,
        {
          method: 'POST',
          token: fx.users.profA.token,
          body: { estudianteId: fx.users.estFree.user.id }
        }
      );
      assert.equal(crossEnroll.status, 403);

      const profCreate = await requestJson(harness.baseUrl, '/api/grupos', {
        method: 'POST',
        token: fx.users.profA.token,
        body: { codigo: 'GRP-FORBIDDEN' }
      });
      assert.equal(profCreate.status, 403);
    });

    it('blocks profesor and estudiante from PUT /api/grupos/:id and DELETE /api/grupos/:id with 403', async () => {
      for (const actor of [fx.users.profA, fx.users.estA1]) {
        const putRes = await requestJson(harness.baseUrl, `/api/grupos/${fx.grupos.grupoA.id}`, {
          method: 'PUT',
          token: actor.token,
          body: { nombre: 'Intento no autorizado' }
        });
        assert.equal(putRes.status, 403);

        const delRes = await requestJson(harness.baseUrl, `/api/grupos/${fx.grupos.grupoA.id}`, {
          method: 'DELETE',
          token: actor.token
        });
        assert.equal(delRes.status, 403);
      }
    });

    it('blocks legacy user role (opLegacy) from non-enrolled grupos, usuarios list, and other users partidas', async () => {
      const legacyGrupo = await requestJson(harness.baseUrl, `/api/grupos/${fx.grupos.grupoA.id}`, {
        token: fx.users.opLegacy.token
      });
      assert.equal(legacyGrupo.status, 403);

      const legacyUsuarios = await requestJson(harness.baseUrl, '/api/usuarios', {
        token: fx.users.opLegacy.token
      });
      assert.equal(legacyUsuarios.status, 403);

      const legacyGetPartida = await requestJson(harness.baseUrl, `/api/partidas/${fx.partidas.partidaA1Low.id}`, {
        token: fx.users.opLegacy.token
      });
      assert.equal(legacyGetPartida.status, 403);

      const legacyPutPartida = await requestJson(harness.baseUrl, `/api/partidas/${fx.partidas.partidaA1Low.id}`, {
        method: 'PUT',
        token: fx.users.opLegacy.token,
        body: { resultados: [{ nivelId: fx.niveles[0].id, puntaje: 10, tiempoSegundos: 10 }] }
      });
      assert.equal(legacyPutPartida.status, 403);
    });

    it('rejects missing codigo, non-professor profesorId, and non-student enrollment with 400', async () => {
      const noCode = await requestJson(harness.baseUrl, '/api/grupos', {
        method: 'POST',
        token: fx.users.admin1.token,
        body: { nombre: 'Sin Código' }
      });
      assert.equal(noCode.status, 400);

      const badProf = await requestJson(harness.baseUrl, '/api/grupos', {
        method: 'POST',
        token: fx.users.admin1.token,
        body: { codigo: 'GRP-BADPROF', profesorId: fx.users.estA1.user.id }
      });
      assert.equal(badProf.status, 400);

      const badStudent = await requestJson(
        harness.baseUrl,
        `/api/grupos/${fx.grupos.grupoA.id}/estudiantes`,
        {
          method: 'POST',
          token: fx.users.admin1.token,
          body: { estudianteId: fx.users.profB.user.id }
        }
      );
      assert.equal(badStudent.status, 400);
    });
  });

  describe('Usuarios RBAC, Allowlist & Mass-Assignment Protection (F2.6)', () => {
    it('blocks student GET /api/usuarios and cross-user GET /api/usuarios/:id with 403', async () => {
      const listAsStudent = await requestJson(harness.baseUrl, '/api/usuarios', {
        token: fx.users.estA1.token
      });
      assert.equal(listAsStudent.status, 403);

      const crossGet = await requestJson(
        harness.baseUrl,
        `/api/usuarios/${fx.users.estB1.user.id}`,
        { token: fx.users.estA1.token }
      );
      assert.equal(crossGet.status, 403);
    });

    it('profesor GET /api/usuarios never exposes admin or profesor accounts', async () => {
      const res = await requestJson(harness.baseUrl, '/api/usuarios', {
        token: fx.users.profA.token
      });
      assert.equal(res.status, 200);
      assert.ok(res.body.length >= 1, 'Expected at least 1 student/user returned to profesor');
      assert.ok(res.body.every((u) => u.rol !== 'admin' && u.rol !== 'profesor'));
      assert.ok(res.body.every((u) => u.contrasena === undefined));
    });

    it('blocks self-privilege escalation / mass-assignment on PUT /api/usuarios/:id', async () => {
      const res = await requestJson(
        harness.baseUrl,
        `/api/usuarios/${fx.users.estA1.user.id}`,
        {
          method: 'PUT',
          token: fx.users.estA1.token,
          body: {
            nombre: 'Est A1 Intento Escalado',
            rol: 'admin',
            id: 9999
          }
        }
      );

      assert.ok([200, 403].includes(res.status));
      const userInDb = await harness.models.Usuario.findByPk(fx.users.estA1.user.id);
      assert.equal(userInDb.rol, 'estudiante');
      assert.equal(userInDb.id, fx.users.estA1.user.id);
    });

    it('rejects invalid rol like superadmin on admin PUT /api/usuarios/:id with 400', async () => {
      const res = await requestJson(
        harness.baseUrl,
        `/api/usuarios/${fx.users.estA1.user.id}`,
        {
          method: 'PUT',
          token: fx.users.admin1.token,
          body: { rol: 'superadmin' }
        }
      );

      assert.equal(res.status, 400);
      const userInDb = await harness.models.Usuario.findByPk(fx.users.estA1.user.id);
      assert.equal(userInDb.rol, 'estudiante');
    });

    it('blocks cross-user PUT /api/usuarios/:id (student & profesor) and non-admin DELETE /api/usuarios/:id with 403', async () => {
      const crossPut = await requestJson(
        harness.baseUrl,
        `/api/usuarios/${fx.users.estB1.user.id}`,
        {
          method: 'PUT',
          token: fx.users.estA1.token,
          body: { nombre: 'Hack' }
        }
      );
      assert.equal(crossPut.status, 403);

      const profPutEst = await requestJson(
        harness.baseUrl,
        `/api/usuarios/${fx.users.estA1.user.id}`,
        {
          method: 'PUT',
          token: fx.users.profA.token,
          body: { nombre: 'Prof Cross Est' }
        }
      );
      assert.equal(profPutEst.status, 403);

      const profPutAdmin = await requestJson(
        harness.baseUrl,
        `/api/usuarios/${fx.users.admin1.user.id}`,
        {
          method: 'PUT',
          token: fx.users.profA.token,
          body: { nombre: 'Prof Cross Admin' }
        }
      );
      assert.equal(profPutAdmin.status, 403);

      const nonAdminDelete = await requestJson(
        harness.baseUrl,
        `/api/usuarios/${fx.users.estB1.user.id}`,
        {
          method: 'DELETE',
          token: fx.users.profA.token
        }
      );
      assert.equal(nonAdminDelete.status, 403);
    });
  });

  describe('Sistema & AI Validation / RBAC Boundaries (F1.2a, F2.7a)', () => {
    it('rejects POST /api/sistema/reiniciar-db with missing or wrong confirmacion (400) without wiping DB', async () => {
      const missingConf = await requestJson(harness.baseUrl, '/api/sistema/reiniciar-db', {
        method: 'POST',
        token: fx.users.admin1.token,
        body: { seedDemo: false }
      });
      assert.equal(missingConf.status, 400);

      const wrongConf = await requestJson(harness.baseUrl, '/api/sistema/reiniciar-db', {
        method: 'POST',
        token: fx.users.admin1.token,
        body: { confirmacion: 'RESET', seedDemo: false }
      });
      assert.equal(wrongConf.status, 400);

      const countAfter = await harness.models.Usuario.count();
      assert.ok(countAfter >= 9, 'Database must remain intact when confirmacion is invalid');
    });

    it('blocks non-admin access to /api/sistema/* with 403', async () => {
      const profEstado = await requestJson(harness.baseUrl, '/api/sistema/estado', {
        token: fx.users.profA.token
      });
      assert.equal(profEstado.status, 403);

      const estReset = await requestJson(harness.baseUrl, '/api/sistema/reiniciar-db', {
        method: 'POST',
        token: fx.users.estA1.token,
        body: { confirmacion: 'REINICIAR' }
      });
      assert.equal(estReset.status, 403);
    });

    it('blocks estudiante and legacy user access to all /api/ai/* GET and POST endpoints with 403', async () => {
      for (const actor of [fx.users.estA1, fx.users.opLegacy]) {
        const estEstado = await requestJson(harness.baseUrl, '/api/ai/estado', {
          token: actor.token
        });
        assert.equal(estEstado.status, 403);

        const estHistorial = await requestJson(harness.baseUrl, '/api/ai/historial', {
          token: actor.token
        });
        assert.equal(estHistorial.status, 403);

        const estOriginal = await requestJson(harness.baseUrl, '/api/ai/original', {
          token: actor.token
        });
        assert.equal(estOriginal.status, 403);

        const postPropuesta = await requestJson(harness.baseUrl, '/api/ai/propuesta', {
          method: 'POST',
          token: actor.token,
          body: { tema: 'Test', peticion: 'Test' }
        });
        assert.equal(postPropuesta.status, 403);

        const postAplicar = await requestJson(harness.baseUrl, '/api/ai/aplicar', {
          method: 'POST',
          token: actor.token,
          body: { propuesta: { botones: [] } }
        });
        assert.equal(postAplicar.status, 403);

        const postRestaurar = await requestJson(harness.baseUrl, '/api/ai/restaurar', {
          method: 'POST',
          token: actor.token
        });
        assert.equal(postRestaurar.status, 403);
      }
    });

    it('rejects invalid /api/ai/aplicar payloads offline with 400', async () => {
      const origRes = await requestJson(harness.baseUrl, '/api/ai/original', {
        token: fx.users.profA.token
      });
      const baseBotones = origRes.body.propuesta.botones;

      const missingProp = await requestJson(harness.baseUrl, '/api/ai/aplicar', {
        method: 'POST',
        token: fx.users.profA.token,
        body: { tema: 'Test' }
      });
      assert.equal(missingProp.status, 400);

      const wrongCount = await requestJson(harness.baseUrl, '/api/ai/aplicar', {
        method: 'POST',
        token: fx.users.profA.token,
        body: { propuesta: { botones: baseBotones.slice(0, 42) } }
      });
      assert.equal(wrongCount.status, 400);

      const badPonderacion = baseBotones.map((b, i) => (i === 0 ? { ...b, ponderacion: 0.5 } : b));
      const badPondRes = await requestJson(harness.baseUrl, '/api/ai/aplicar', {
        method: 'POST',
        token: fx.users.profA.token,
        body: { propuesta: { botones: badPonderacion } }
      });
      assert.equal(badPondRes.status, 400);

      const badCategoria = baseBotones.map((b, i) => (i === 0 ? { ...b, categoria: 'Categoria Inexistente' } : b));
      const badCatRes = await requestJson(harness.baseUrl, '/api/ai/aplicar', {
        method: 'POST',
        token: fx.users.profA.token,
        body: { propuesta: { botones: badCategoria } }
      });
      assert.equal(badCatRes.status, 400);
    });
  });

  describe('ErrorHandler & Usuario afterSync Migration (F1.3)', () => {
    it('errorHandler maps SequelizeUniqueConstraintError -> 409 and SequelizeValidationError -> 400', () => {
      const errorHandler = require('../middlewares/errorHandler');
      const invoke = (err) => {
        let statusCode = null;
        let payload = null;
        const res = {
          status(code) {
            statusCode = code;
            return this;
          },
          json(body) {
            payload = body;
            return this;
          }
        };
        const prevConsoleError = console.error;
        console.error = () => {};
        try {
          errorHandler(err, {}, res, () => {});
        } finally {
          console.error = prevConsoleError;
        }
        return { statusCode, payload };
      };

      const uniqueErr = new UniqueConstraintError({
        errors: [new ValidationErrorItem('correo must be unique', 'unique violation', 'correo', 'a@b.test')]
      });
      const uniqueRes = invoke(uniqueErr);
      assert.equal(uniqueRes.statusCode, 409);
      assert.equal(uniqueRes.payload.error, 'correo must be unique');
      assert.equal(uniqueRes.payload.message, 'correo must be unique');

      const valErr = new ValidationError('Validation error', [
        new ValidationErrorItem('Validation isEmail on correo failed', 'Validation error', 'correo', 'bad')
      ]);
      const valRes = invoke(valErr);
      assert.equal(valRes.statusCode, 400);
      assert.match(valRes.payload.message, /isEmail/);
    });

    it('Usuario afterSync hook migrarIndiceUnicoNombre drops legacy nombre UNIQUE index on SQLite', () => {
      const nonexistentEnv = createNonexistentEnvPath();
      const migDb = createTempDbPath('nexus-mig-nombre');

      const script = `
        const assert = require('node:assert/strict');
        const { Sequelize, QueryTypes } = require('sequelize');
        (async () => {
          const rawSeq = new Sequelize({
            dialect: 'sqlite',
            storage: process.env.DB_STORAGE,
            logging: false
          });
          await rawSeq.query(
            'CREATE TABLE Usuarios (' +
            'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
            'nombre VARCHAR(255) NOT NULL UNIQUE, ' +
            'correo VARCHAR(255) NOT NULL UNIQUE, ' +
            "rol VARCHAR(255) NOT NULL DEFAULT 'user', " +
            'contrasena VARCHAR(255) NOT NULL, ' +
            'createdAt DATETIME NOT NULL, ' +
            'updatedAt DATETIME NOT NULL' +
            ');'
          );
          await rawSeq.close();

          const { sequelize, Usuario } = require('./models');
          await sequelize.sync();

          const indexes = await sequelize.query("PRAGMA index_list('Usuarios');", { type: QueryTypes.SELECT });
          for (const idx of indexes) {
            if (!idx.unique) continue;
            const escaped = String(idx.name).replace(/'/g, "''");
            const cols = await sequelize.query("PRAGMA index_info('" + escaped + "');", { type: QueryTypes.SELECT });
            assert.equal(
              cols.length === 1 && cols[0].name === 'nombre',
              false,
              'Legacy unique index on Usuarios.nombre must be dropped by afterSync hook'
            );
          }

          await Usuario.create({ nombre: 'Alex', correo: 'alex1@mig.test', contrasena: 'hash1', rol: 'user' });
          await Usuario.create({ nombre: 'Alex', correo: 'alex2@mig.test', contrasena: 'hash2', rol: 'user' });
          const count = await Usuario.count({ where: { nombre: 'Alex' } });
          assert.equal(count, 2);

          await sequelize.close();
        })().catch((err) => { console.error(err); process.exit(1); });
      `;

      const childEnv = {
        ...process.env,
        NODE_ENV: 'test',
        DB_STORAGE: migDb,
        JWT_SECRET: 'mig-test-secret',
        DOTENV_PATH: nonexistentEnv,
        DOTENV_CONFIG_PATH: nonexistentEnv,
        DOTENV_QUIET: 'true',
        DOTENV_CONFIG_QUIET: 'true'
      };

      try {
        const res = spawnSync(process.execPath, ['-e', script], {
          cwd: BACKEND_DIR,
          env: childEnv,
          encoding: 'utf8',
          windowsHide: true
        });
        assert.equal(res.status, 0, `Migration verification failed:\n${res.stdout}\n${res.stderr}`);
      } finally {
        cleanupTempDbFiles(migDb);
      }
    });
  });
});
