const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  startTestServer,
  seedBaselineFixtures,
  requestJson
} = require('./helpers/testHarness');

function assertRankingResultadosShape(rows, contextLabel) {
  assert.ok(rows.length > 0, `${contextLabel}: expected at least 1 ranking row`);
  assert.ok(
    rows.some((r) => Array.isArray(r.resultados) && r.resultados.length > 0),
    `${contextLabel}: expected at least 1 ranking row with resultados`
  );
  for (const row of rows) {
    assert.ok(Array.isArray(row.resultados), `${contextLabel}: resultados must be an array`);
    for (const item of row.resultados) {
      assert.equal(typeof item.puntaje, 'number', `${contextLabel}: item.puntaje must be number`);
      assert.equal(typeof item.tiempoSegundos, 'number', `${contextLabel}: item.tiempoSegundos must be number`);
      assert.equal(typeof item.nivelId, 'number', `${contextLabel}: item.nivelId must be number`);
      assert.ok(item.nivel && typeof item.nivel === 'object', `${contextLabel}: item.nivel missing`);
      assert.equal(typeof item.nivel.id, 'number', `${contextLabel}: item.nivel.id must be number`);
      assert.equal(typeof item.nivel.nombre, 'string', `${contextLabel}: item.nivel.nombre must be string`);
      assert.ok(item.nivel.nombre.length > 0, `${contextLabel}: item.nivel.nombre must be non-empty`);
      assert.ok(item.nivel.etapa && typeof item.nivel.etapa === 'object', `${contextLabel}: item.nivel.etapa missing`);
      assert.equal(typeof item.nivel.etapa.id, 'number', `${contextLabel}: item.nivel.etapa.id must be number`);
      assert.equal(typeof item.nivel.etapa.nombre, 'string', `${contextLabel}: item.nivel.etapa.nombre must be string`);
      assert.ok(item.nivel.etapa.nombre.length > 0, `${contextLabel}: item.nivel.etapa.nombre must be non-empty`);
    }
  }
}

describe('Tier 1 — Happy-Path Feature Verification (Backend R1 & R2)', () => {
  let harness;
  let fx;

  before(async () => {
    harness = await startTestServer({
      GEMINI_MODEL: 'gemini-e2e-custom-model',
      GOOGLE_DRIVE_FILE_ID: 'drive-e2e-custom-file-id'
    });
    fx = await seedBaselineFixtures(harness);
  });

  after(async () => {
    if (harness) {
      await harness.stop();
    }
  });

  describe('F1.1a & F1.2a — AI Audit Log & Env Config', () => {
    it('GET /api/ai/estado returns GOOGLE_DRIVE_FILE_ID and GEMINI_MODEL from env without Drive calls', async () => {
      const res = await requestJson(harness.baseUrl, '/api/ai/estado', {
        token: fx.users.profA.token
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.archivoId, 'drive-e2e-custom-file-id');
      assert.equal(res.body.modeloGemini, 'gemini-e2e-custom-model');
      assert.equal(res.body.tieneGeminiKey, false);
      assert.equal(typeof res.body.tieneDriveCredentials, 'boolean');
      assert.ok(res.body.driveError === null || typeof res.body.driveError === 'string');
      assert.equal(res.body.contenidoActual, null);
    });

    it('GET /api/ai/estado is accessible to admin as well', async () => {
      const res = await requestJson(harness.baseUrl, '/api/ai/estado', {
        token: fx.users.admin1.token
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.archivoId, 'drive-e2e-custom-file-id');
      assert.equal(res.body.modeloGemini, 'gemini-e2e-custom-model');
    });

    it('GET /api/ai/original returns 43-button JSON offline without API key or Drive creds', async () => {
      const res = await requestJson(harness.baseUrl, '/api/ai/original', {
        token: fx.users.profA.token
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.propuesta?.botones));
      assert.equal(res.body.propuesta.botones.length, 43);
      assert.equal(typeof res.body.propuesta.botones[0].texto, 'string');
    });

    it('GET /api/ai/historial returns audit logs with usuario { id, nombre, correo, rol } (no SQL column errors)', async () => {
      const res = await requestJson(harness.baseUrl, '/api/ai/historial', {
        token: fx.users.admin1.token
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.equal(res.body.length, 2);

      for (const log of res.body) {
        assert.ok(log.id);
        assert.equal(log.archivoId, 'drive-e2e-custom-file-id');
        assert.ok(log.tema);
        assert.ok(log.usuario, 'Expected log.usuario to be populated');
        assert.equal(typeof log.usuario.id, 'number');
        assert.equal(typeof log.usuario.nombre, 'string');
        assert.equal(typeof log.usuario.correo, 'string');
        assert.ok(['admin', 'profesor'].includes(log.usuario.rol));
        assert.equal(log.usuario.contrasena, undefined);
        assert.equal(log.usuario.username, undefined);
        assert.equal(log.usuario.email, undefined);
      }
    });

    it('GET /api/ai/historial also works for profesor role', async () => {
      const res = await requestJson(harness.baseUrl, '/api/ai/historial', {
        token: fx.users.profA.token
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.equal(res.body.length, 2);
      const correos = res.body.map((item) => item.usuario.correo);
      assert.ok(correos.includes('profa@nexus.test'));
      assert.ok(correos.includes('admin1@nexus.test'));
    });
  });

  describe('F1.3, F2.1 & F2.3 — Registration, Login, /api/auth/me, ErrorHandler & Helmet', () => {
    it('allows two registrations with identical email prefix without nombre unique collision', async () => {
      const reg1 = await requestJson(harness.baseUrl, '/api/auth/register', {
        method: 'POST',
        body: { correo: 'alex@uno.test', contrasena: 'Password123!' }
      });
      assert.equal(reg1.status, 201);
      assert.ok(reg1.body.token);
      assert.equal(reg1.body.username, 'alex@uno.test');
      assert.equal(reg1.body.nombre, 'alex');

      const reg2 = await requestJson(harness.baseUrl, '/api/auth/register', {
        method: 'POST',
        body: { correo: 'alex@dos.test', contrasena: 'Password123!' }
      });
      assert.equal(reg2.status, 201);
      assert.ok(reg2.body.token);
      assert.equal(reg2.body.username, 'alex@dos.test');
      assert.equal(reg2.body.nombre, 'alex');
      assert.notEqual(reg1.body.id, reg2.body.id);
    });

    it('accepts optional nombre during registration and reflects it in /api/auth/me', async () => {
      const reg = await requestJson(harness.baseUrl, '/api/auth/register', {
        method: 'POST',
        body: {
          correo: 'nombre.personalizado@nexus.test',
          contrasena: 'Password123!',
          nombre: 'Alex Personalizado'
        }
      });
      assert.equal(reg.status, 201);
      assert.ok(reg.body.token);

      const me = await requestJson(harness.baseUrl, '/api/auth/me', {
        token: reg.body.token
      });
      assert.equal(me.status, 200);
      assert.equal(me.body.id, reg.body.id);
      assert.equal(me.body.nombre, 'Alex Personalizado');
      assert.equal(me.body.correo, 'nombre.personalizado@nexus.test');
      assert.equal(me.body.username, 'nombre.personalizado@nexus.test');
      assert.ok(me.body.rol);
    });

    it('logs in case-insensitively via exact LOWER(correo) and returns JWT + LINK_ESTABLISHED', async () => {
      const loginRes = await requestJson(harness.baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { username: 'ALEX@UNO.TEST', password: 'Password123!' }
      });

      assert.equal(loginRes.status, 200);
      assert.equal(loginRes.body.username, 'alex@uno.test');
      assert.ok(loginRes.body.token);
      assert.equal(loginRes.body.status, 'LINK_ESTABLISHED');
    });

    it('GET /api/auth/me refreshes live role from DB after admin role change', async () => {
      const targetUser = await harness.models.Usuario.findOne({ where: { correo: 'alex@dos.test' } });
      assert.ok(targetUser);

      const loginBefore = await requestJson(harness.baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { correo: 'alex@dos.test', contrasena: 'Password123!' }
      });
      assert.equal(loginBefore.status, 200);

      await targetUser.update({ rol: 'estudiante' });

      const me = await requestJson(harness.baseUrl, '/api/auth/me', {
        token: loginBefore.body.token
      });
      assert.equal(me.status, 200);
      assert.equal(me.body.id, targetUser.id);
      assert.equal(me.body.rol, 'estudiante');
      assert.equal(me.body.correo, 'alex@dos.test');
      assert.equal(me.body.username, 'alex@dos.test');
    });

    it('duplicate registration maps to 400 or 409 (never 500) and responses include helmet headers', async () => {
      const dupRes = await requestJson(harness.baseUrl, '/api/auth/register', {
        method: 'POST',
        body: { correo: 'alex@uno.test', contrasena: 'Password123!' }
      });
      assert.ok([400, 409].includes(dupRes.status), `Expected 400 or 409, got ${dupRes.status}`);
      assert.ok(dupRes.body.message || dupRes.body.error);

      assert.equal(dupRes.headers.get('x-content-type-options'), 'nosniff');
      assert.ok(dupRes.headers.get('x-frame-options') || dupRes.headers.get('content-security-policy'));
    });
  });

  describe('F2.4a — Partidas VR Contract, Role Filtering, Ranking & Observations', () => {
    let createdVrPartidaId;

    it('GET /api/partidas/catalogo returns 4 active etapas and 15 niveles', async () => {
      const res = await requestJson(harness.baseUrl, '/api/partidas/catalogo', {
        token: fx.users.estA1.token
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.length, 4);
      const totalNiveles = res.body.reduce((acc, etapa) => acc + etapa.niveles.length, 0);
      assert.equal(totalNiveles, 15);
    });

    it('VR student creates partida via POST /api/partidas and updates own partida via PUT /api/partidas/:id', async () => {
      const n1 = fx.niveles[0];
      const n2 = fx.niveles[1];

      const createRes = await requestJson(harness.baseUrl, '/api/partidas', {
        method: 'POST',
        token: fx.users.estA1.token,
        body: {
          resultados: [{ nivelId: n1.id, puntaje: 120, tiempoSegundos: 35 }]
        }
      });

      assert.equal(createRes.status, 201);
      assert.equal(createRes.body.usuarioId, fx.users.estA1.user.id);
      assert.equal(createRes.body.claveSeed, undefined);
      assert.equal(createRes.body.resultados.length, 1);
      assert.equal(createRes.body.resultados[0].puntaje, 120);
      createdVrPartidaId = createRes.body.id;

      const updateRes = await requestJson(harness.baseUrl, `/api/partidas/${createdVrPartidaId}`, {
        method: 'PUT',
        token: fx.users.estA1.token,
        body: {
          resultados: [
            { nivelId: n1.id, puntaje: 140, tiempoSegundos: 28 },
            { nivelId: n2.id, puntaje: 110, tiempoSegundos: 42 }
          ]
        }
      });

      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.message, 'Partida actualizada con éxito');
      assert.equal(updateRes.body.partida.resultados.length, 2);
      const pN1 = updateRes.body.partida.resultados.find((r) => r.nivelId === n1.id);
      assert.equal(pN1.puntaje, 140);
    });

    it('admin can update a student partida via PUT /api/partidas/:id', async () => {
      const n1 = fx.niveles[0];
      const res = await requestJson(harness.baseUrl, `/api/partidas/${fx.partidas.partidaA1Low.id}`, {
        method: 'PUT',
        token: fx.users.admin1.token,
        body: {
          resultados: [{ nivelId: n1.id, puntaje: 65, tiempoSegundos: 52 }]
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.partida.resultados[0].puntaje, 65);
    });

    it('GET /api/partidas/ranking returns public leaderboard fields without PII or observacion and supports ?grupoId=', async () => {
      const allRes = await requestJson(harness.baseUrl, '/api/partidas/ranking', {
        token: fx.users.estA1.token
      });
      assert.equal(allRes.status, 200);
      assert.ok(Array.isArray(allRes.body));
      assert.ok(allRes.body.length >= 4);

      for (const row of allRes.body) {
        assert.ok(row.id);
        assert.ok(row.usuarioId);
        assert.equal(typeof row.nombre, 'string');
        assert.ok(row.fecha !== undefined);
        assert.ok(Array.isArray(row.resultados));
        assert.equal(row.correo, undefined);
        assert.equal(row.username, undefined);
        assert.equal(row.observacion, undefined);
        assert.equal(row.claveSeed, undefined);
        assert.equal(row.usuario, undefined);
      }

      assertRankingResultadosShape(allRes.body, 'GET /api/partidas/ranking (all)');

      const grpARes = await requestJson(harness.baseUrl, `/api/partidas/ranking?grupoId=${fx.grupos.grupoA.id}`, {
        token: fx.users.estA1.token
      });
      assert.equal(grpARes.status, 200);
      assertRankingResultadosShape(grpARes.body, 'GET /api/partidas/ranking?grupoId=grupoA');
      const userIds = new Set(grpARes.body.map((r) => r.usuarioId));
      assert.ok(userIds.has(fx.users.estA1.user.id));
      assert.ok(!userIds.has(fx.users.estB1.user.id));
      assert.ok(!userIds.has(fx.users.estFree.user.id));
    });

    it('GET /api/partidas filters by role (admin all, profesor own group students, estudiante own)', async () => {
      const adminRes = await requestJson(harness.baseUrl, '/api/partidas', {
        token: fx.users.admin1.token
      });
      assert.equal(adminRes.status, 200);
      const adminUserIds = new Set(adminRes.body.map((p) => p.usuarioId));
      assert.ok(adminUserIds.has(fx.users.estA1.user.id));
      assert.ok(adminUserIds.has(fx.users.estB1.user.id));
      assert.ok(adminUserIds.has(fx.users.estFree.user.id));

      const profARes = await requestJson(harness.baseUrl, '/api/partidas', {
        token: fx.users.profA.token
      });
      assert.equal(profARes.status, 200);
      const profAUserIds = new Set(profARes.body.map((p) => p.usuarioId));
      assert.ok(profAUserIds.has(fx.users.estA1.user.id));
      assert.ok(!profAUserIds.has(fx.users.estB1.user.id));
      assert.ok(!profAUserIds.has(fx.users.estFree.user.id));

      const estA1Res = await requestJson(harness.baseUrl, '/api/partidas', {
        token: fx.users.estA1.token
      });
      assert.equal(estA1Res.status, 200);
      assert.ok(estA1Res.body.length >= 2);
      assert.ok(estA1Res.body.every((p) => p.usuarioId === fx.users.estA1.user.id));
    });

    it('assigned profesor can save observacion via PATCH /api/partidas/:id/observacion and student sees it in GET /:id', async () => {
      const patchRes = await requestJson(
        harness.baseUrl,
        `/api/partidas/${createdVrPartidaId}/observacion`,
        {
          method: 'PATCH',
          token: fx.users.profA.token,
          body: { observacion: '   Buen dominio en etapa 1   ' }
        }
      );

      assert.equal(patchRes.status, 200);
      assert.equal(patchRes.body.partida.observacion, 'Buen dominio en etapa 1');

      const getOwn = await requestJson(harness.baseUrl, `/api/partidas/${createdVrPartidaId}`, {
        token: fx.users.estA1.token
      });
      assert.equal(getOwn.status, 200);
      assert.equal(getOwn.body.observacion, 'Buen dominio en etapa 1');
    });
  });

  describe('F2.5 — Grupos CRUD & RBAC Scoping', () => {
    let tempGrupoId;

    it('admin creates, updates, and retrieves grupos with profesor & estudiantes', async () => {
      const createRes = await requestJson(harness.baseUrl, '/api/grupos', {
        method: 'POST',
        token: fx.users.admin1.token,
        body: {
          codigo: 'GRP-T1',
          nombre: 'Grupo Temporal T1',
          profesorId: fx.users.profA.user.id,
          estudianteIds: [fx.users.estA1.user.id]
        }
      });

      assert.equal(createRes.status, 201);
      assert.equal(createRes.body.codigo, 'GRP-T1');
      assert.equal(createRes.body.profesor.id, fx.users.profA.user.id);
      assert.equal(createRes.body.estudiantes.length, 1);
      tempGrupoId = createRes.body.id;

      const updateRes = await requestJson(harness.baseUrl, `/api/grupos/${tempGrupoId}`, {
        method: 'PUT',
        token: fx.users.admin1.token,
        body: { nombre: 'Grupo Temporal Actualizado' }
      });
      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.grupo.nombre, 'Grupo Temporal Actualizado');
    });

    it('GET /api/grupos scopes correctly for admin, profesor, and estudiante', async () => {
      const adminRes = await requestJson(harness.baseUrl, '/api/grupos', {
        token: fx.users.admin1.token
      });
      assert.equal(adminRes.status, 200);
      assert.ok(adminRes.body.length >= 3);

      const profARes = await requestJson(harness.baseUrl, '/api/grupos', {
        token: fx.users.profA.token
      });
      assert.equal(profARes.status, 200);
      assert.ok(profARes.body.length >= 2);
      assert.ok(profARes.body.every((g) => g.profesorId === fx.users.profA.user.id));

      const estB1Res = await requestJson(harness.baseUrl, '/api/grupos', {
        token: fx.users.estB1.token
      });
      assert.equal(estB1Res.status, 200);
      assert.equal(estB1Res.body.length, 1);
      assert.equal(estB1Res.body[0].id, fx.grupos.grupoB.id);
    });

    it('assigned profesor can enroll and remove students in own group, and admin can delete group', async () => {
      const enrollRes = await requestJson(
        harness.baseUrl,
        `/api/grupos/${tempGrupoId}/estudiantes`,
        {
          method: 'POST',
          token: fx.users.profA.token,
          body: { estudianteId: fx.users.estFree.user.id }
        }
      );
      assert.equal(enrollRes.status, 200);
      assert.ok(enrollRes.body.grupo.estudiantes.some((e) => e.id === fx.users.estFree.user.id));

      const removeRes = await requestJson(
        harness.baseUrl,
        `/api/grupos/${tempGrupoId}/estudiantes/${fx.users.estFree.user.id}`,
        {
          method: 'DELETE',
          token: fx.users.profA.token
        }
      );
      assert.equal(removeRes.status, 200);
      assert.ok(!removeRes.body.grupo.estudiantes.some((e) => e.id === fx.users.estFree.user.id));

      const delRes = await requestJson(harness.baseUrl, `/api/grupos/${tempGrupoId}`, {
        method: 'DELETE',
        token: fx.users.admin1.token
      });
      assert.equal(delRes.status, 200);
    });
  });

  describe('F2.6 — Usuarios CRUD & RBAC Allowlist', () => {
    let createdUserId;

    it('admin creates, lists, updates (including role), and deletes usuario without exposing contrasena', async () => {
      const createRes = await requestJson(harness.baseUrl, '/api/usuarios', {
        method: 'POST',
        token: fx.users.admin1.token,
        body: {
          nombre: 'Nuevo Estudiante',
          correo: 'nuevo.t1@nexus.test',
          contrasena: 'Password123!',
          rol: 'estudiante'
        }
      });
      assert.equal(createRes.status, 201);
      assert.equal(createRes.body.contrasena, undefined);
      assert.equal(createRes.body.rol, 'estudiante');
      createdUserId = createRes.body.id;

      const listAdmin = await requestJson(harness.baseUrl, '/api/usuarios', {
        token: fx.users.admin1.token
      });
      assert.equal(listAdmin.status, 200);
      assert.ok(listAdmin.body.some((u) => u.rol === 'admin'));
      assert.ok(listAdmin.body.some((u) => u.rol === 'profesor'));

      const updateAdmin = await requestJson(harness.baseUrl, `/api/usuarios/${createdUserId}`, {
        method: 'PUT',
        token: fx.users.admin1.token,
        body: { nombre: 'Nuevo Profesor', rol: 'profesor' }
      });
      assert.equal(updateAdmin.status, 200);
      assert.equal(updateAdmin.body.usuario.nombre, 'Nuevo Profesor');
      assert.equal(updateAdmin.body.usuario.rol, 'profesor');

      const delRes = await requestJson(harness.baseUrl, `/api/usuarios/${createdUserId}`, {
        method: 'DELETE',
        token: fx.users.admin1.token
      });
      assert.equal(delRes.status, 200);
    });

    it('student can read and update own allowlisted profile (nombre)', async () => {
      const getSelf = await requestJson(harness.baseUrl, `/api/usuarios/${fx.users.estA2.user.id}`, {
        token: fx.users.estA2.token
      });
      assert.equal(getSelf.status, 200);
      assert.equal(getSelf.body.contrasena, undefined);
      assert.equal(getSelf.body.correo, fx.users.estA2.user.correo);

      const putSelf = await requestJson(harness.baseUrl, `/api/usuarios/${fx.users.estA2.user.id}`, {
        method: 'PUT',
        token: fx.users.estA2.token,
        body: { nombre: 'Estudiante A2 Renombrado' }
      });
      assert.equal(putSelf.status, 200);
      assert.equal(putSelf.body.usuario.nombre, 'Estudiante A2 Renombrado');
    });

    it('profesor GET /api/usuarios returns only estudiante/user accounts including legacy user', async () => {
      const res = await requestJson(harness.baseUrl, '/api/usuarios', {
        token: fx.users.profA.token
      });
      assert.equal(res.status, 200);
      assert.ok(res.body.length >= 1);
      assert.ok(res.body.every((u) => u.rol === 'estudiante' || u.rol === 'user'));
      assert.ok(
        res.body.some((u) => u.id === fx.users.opLegacy.user.id && u.rol === 'user'),
        'Expected profesor GET /api/usuarios to include legacy user account opLegacy'
      );
    });

    it('legacy user role (opLegacy) can view own empty partidas, empty enrolled grupos, and own profile', async () => {
      const ownPartidas = await requestJson(harness.baseUrl, '/api/partidas', {
        token: fx.users.opLegacy.token
      });
      assert.equal(ownPartidas.status, 200);
      assert.deepEqual(ownPartidas.body, []);

      const ownGrupos = await requestJson(harness.baseUrl, '/api/grupos', {
        token: fx.users.opLegacy.token
      });
      assert.equal(ownGrupos.status, 200);
      assert.deepEqual(ownGrupos.body, []);

      const ownProfile = await requestJson(harness.baseUrl, `/api/usuarios/${fx.users.opLegacy.user.id}`, {
        token: fx.users.opLegacy.token
      });
      assert.equal(ownProfile.status, 200);
      assert.equal(ownProfile.body.rol, 'user');
      assert.equal(ownProfile.body.contrasena, undefined);
    });
  });

  describe('F2.7a — Sistema Estado & Safe DB Reset', () => {
    it('GET /api/sistema/estado returns accurate model counts for admin', async () => {
      const res = await requestJson(harness.baseUrl, '/api/sistema/estado', {
        token: fx.users.admin1.token
      });
      assert.equal(res.status, 200);
      assert.ok(res.body.totalUsuarios >= 9);
      assert.ok(res.body.totalPartidas >= 4);
      assert.equal(res.body.totalGrupos, 2);
      assert.equal(res.body.totalLogs, 2);
      assert.equal(res.body.totalEtapas, 4);
      assert.equal(res.body.totalNiveles, 15);
    });

    it('POST /api/sistema/reiniciar-db with confirmacion REINICIAR resets DB cleanly, avoids silent admin@example.com, and renews JWT', async () => {
      const resetRes = await requestJson(harness.baseUrl, '/api/sistema/reiniciar-db', {
        method: 'POST',
        token: fx.users.admin2.token,
        body: { confirmacion: 'REINICIAR', seedDemo: false }
      });

      assert.equal(resetRes.status, 200);
      assert.equal(resetRes.body.seedAplicado, false);
      assert.equal(resetRes.body.adminConservado, fx.users.admin2.user.correo);
      assert.equal(resetRes.body.metricas.totalUsuarios, 1);
      assert.equal(resetRes.body.metricas.totalPartidas, 0);
      assert.equal(resetRes.body.metricas.totalGrupos, 0);
      assert.ok(resetRes.body.token, 'Expected renewed token when admin id shifted from >1 to 1');

      const silentAdmin = await harness.models.Usuario.findOne({ where: { correo: 'admin@example.com' } });
      assert.equal(silentAdmin, null, 'admin@example.com must NOT be silently created');

      const meWithNewToken = await requestJson(harness.baseUrl, '/api/auth/me', {
        token: resetRes.body.token
      });
      assert.equal(meWithNewToken.status, 200);
      assert.equal(meWithNewToken.body.id, 1);
      assert.equal(meWithNewToken.body.correo, fx.users.admin2.user.correo);
      assert.equal(meWithNewToken.body.rol, 'admin');
    });
  });
});
