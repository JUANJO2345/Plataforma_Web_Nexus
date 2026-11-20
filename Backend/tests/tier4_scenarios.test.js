const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  startTestServer,
  seedBaselineFixtures,
  requestJson
} = require('./helpers/testHarness');

describe('Tier 4 — Real-World Multi-Role Application Scenarios', () => {
  let harness;
  let fx;

  before(async () => {
    harness = await startTestServer({
      GEMINI_MODEL: 'gemini-3.5-flash-lite',
      GOOGLE_DRIVE_FILE_ID: 'scenario-drive-file-id'
    });
    fx = await seedBaselineFixtures(harness);
  });

  after(async () => {
    if (harness) {
      await harness.stop();
    }
  });

  it('Scenario 1: Full Classroom Semester Lifecycle (setup -> registration -> VR match -> ranking privacy -> grading -> review)', async () => {
    // 1. Admin creates a new course group with profA
    const createGrupo = await requestJson(harness.baseUrl, '/api/grupos', {
      method: 'POST',
      token: fx.users.admin1.token,
      body: {
        codigo: 'SEM-2026-1',
        nombre: 'Arquitectura Urbana VR',
        profesorId: fx.users.profA.user.id
      }
    });
    assert.equal(createGrupo.status, 201);
    const grupoId = createGrupo.body.id;

    // 2. Two students register (sharing email prefix 'camila')
    const regCamila1 = await requestJson(harness.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        correo: 'camila@colegio1.test',
        contrasena: 'SemesterPass1',
        nombre: 'Camila Perez'
      }
    });
    assert.equal(regCamila1.status, 201);

    const regCamila2 = await requestJson(harness.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        correo: 'camila@colegio2.test',
        contrasena: 'SemesterPass2',
        nombre: 'Camila Gomez'
      }
    });
    assert.equal(regCamila2.status, 201);

    // Admin promotes both to 'estudiante' and profA enrolls them into SEM-2026-1
    await requestJson(harness.baseUrl, `/api/usuarios/${regCamila1.body.id}`, {
      method: 'PUT',
      token: fx.users.admin1.token,
      body: { rol: 'estudiante' }
    });
    await requestJson(harness.baseUrl, `/api/usuarios/${regCamila2.body.id}`, {
      method: 'PUT',
      token: fx.users.admin1.token,
      body: { rol: 'estudiante' }
    });

    const enroll = await requestJson(harness.baseUrl, `/api/grupos/${grupoId}/estudiantes`, {
      method: 'POST',
      token: fx.users.profA.token,
      body: { estudianteIds: [regCamila1.body.id, regCamila2.body.id] }
    });
    assert.equal(enroll.status, 200);
    assert.equal(enroll.body.grupo.estudiantes.length, 2);

    // 3. Student 1 authenticates in VR and completes two matches (low then high)
    const loginCamila1 = await requestJson(harness.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { username: 'camila@colegio1.test', password: 'SemesterPass1' }
    });
    assert.equal(loginCamila1.status, 200);
    const camila1Token = loginCamila1.body.token;

    const meCamila1 = await requestJson(harness.baseUrl, '/api/auth/me', { token: camila1Token });
    assert.equal(meCamila1.status, 200);
    assert.equal(meCamila1.body.rol, 'estudiante');

    const [n1, n2] = fx.niveles;
    const match1 = await requestJson(harness.baseUrl, '/api/partidas', {
      method: 'POST',
      token: camila1Token,
      body: { resultados: [{ nivelId: n1.id, puntaje: 70, tiempoSegundos: 45 }] }
    });
    assert.equal(match1.status, 201);

    const match2 = await requestJson(harness.baseUrl, '/api/partidas', {
      method: 'POST',
      token: camila1Token,
      body: {
        resultados: [
          { nivelId: n1.id, puntaje: 100, tiempoSegundos: 20 },
          { nivelId: n2.id, puntaje: 95, tiempoSegundos: 25 }
        ]
      }
    });
    assert.equal(match2.status, 201);

    // 4. Professor grades match2 with feedback
    const gradeRes = await requestJson(
      harness.baseUrl,
      `/api/partidas/${match2.body.id}/observacion`,
      {
        method: 'PATCH',
        token: fx.users.profA.token,
        body: { observacion: 'Excelente optimización en etapa 1.' }
      }
    );
    assert.equal(gradeRes.status, 200);

    // 5. Classmate Camila 2 inspects group ranking -> sees Camila Perez scores, NOT email or observation
    const rankingRes = await requestJson(
      harness.baseUrl,
      `/api/partidas/ranking?grupoId=${grupoId}`,
      { token: regCamila2.body.token }
    );
    assert.equal(rankingRes.status, 200);
    assert.equal(rankingRes.body.length, 2);
    for (const row of rankingRes.body) {
      assert.equal(row.nombre, 'Camila Perez');
      assert.ok(Array.isArray(row.resultados) && row.resultados.length > 0);
      for (const item of row.resultados) {
        assert.equal(typeof item.puntaje, 'number');
        assert.equal(typeof item.tiempoSegundos, 'number');
        assert.equal(typeof item.nivelId, 'number');
        assert.ok(item.nivel && typeof item.nivel === 'object');
        assert.equal(typeof item.nivel.id, 'number');
        assert.equal(typeof item.nivel.nombre, 'string');
        assert.ok(item.nivel.etapa && typeof item.nivel.etapa === 'object');
        assert.equal(typeof item.nivel.etapa.id, 'number');
        assert.equal(typeof item.nivel.etapa.nombre, 'string');
      }
      assert.equal(row.correo, undefined);
      assert.equal(row.username, undefined);
      assert.equal(row.observacion, undefined);
    }

    // 6. Camila 1 reviews her own match and sees professor's observation
    const reviewRes = await requestJson(harness.baseUrl, `/api/partidas/${match2.body.id}`, {
      token: camila1Token
    });
    assert.equal(reviewRes.status, 200);
    assert.equal(reviewRes.body.observacion, 'Excelente optimización en etapa 1.');
  });

  it('Scenario 2: Multi-Professor School Isolation (GRP-A vs GRP-B strict tenant separation)', async () => {
    // Prof A queries groups (even trying ?profesorId=profB) -> sees only own groups
    const profAGroups = await requestJson(
      harness.baseUrl,
      `/api/grupos?profesorId=${fx.users.profB.user.id}`,
      { token: fx.users.profA.token }
    );
    assert.equal(profAGroups.status, 200);
    assert.ok(profAGroups.body.every((g) => g.profesorId === fx.users.profA.user.id));
    assert.ok(!profAGroups.body.some((g) => g.id === fx.grupos.grupoB.id));

    // Prof B cannot read Grupo A or its students' partidas or grade them
    const profBReadGrpA = await requestJson(
      harness.baseUrl,
      `/api/grupos/${fx.grupos.grupoA.id}`,
      { token: fx.users.profB.token }
    );
    assert.equal(profBReadGrpA.status, 403);

    const profBPartidas = await requestJson(harness.baseUrl, '/api/partidas', {
      token: fx.users.profB.token
    });
    assert.equal(profBPartidas.status, 200);
    assert.ok(profBPartidas.body.every((p) => p.usuarioId === fx.users.estB1.user.id));

    const profBGradeA = await requestJson(
      harness.baseUrl,
      `/api/partidas/${fx.partidas.partidaA1High.id}/observacion`,
      {
        method: 'PATCH',
        token: fx.users.profB.token,
        body: { observacion: 'No autorizado' }
      }
    );
    assert.equal(profBGradeA.status, 403);

    // Neither professor sees admin or other professor accounts in GET /api/usuarios
    const profAUsuarios = await requestJson(harness.baseUrl, '/api/usuarios', {
      token: fx.users.profA.token
    });
    assert.equal(profAUsuarios.status, 200);
    assert.ok(!profAUsuarios.body.some((u) => u.rol === 'admin' || u.rol === 'profesor'));

    // Filtered ranking by grupoB contains only estB1
    const rankB = await requestJson(
      harness.baseUrl,
      `/api/partidas/ranking?grupoId=${fx.grupos.grupoB.id}`,
      { token: fx.users.profB.token }
    );
    assert.equal(rankB.status, 200);
    assert.ok(rankB.body.length >= 1);
    assert.ok(rankB.body.every((r) => r.usuarioId === fx.users.estB1.user.id));
    for (const row of rankB.body) {
      assert.ok(Array.isArray(row.resultados) && row.resultados.length > 0);
      for (const item of row.resultados) {
        assert.equal(typeof item.puntaje, 'number');
        assert.equal(typeof item.tiempoSegundos, 'number');
        assert.equal(typeof item.nivelId, 'number');
        assert.ok(item.nivel && typeof item.nivel === 'object');
        assert.equal(typeof item.nivel.id, 'number');
        assert.equal(typeof item.nivel.nombre, 'string');
        assert.ok(item.nivel.etapa && typeof item.nivel.etapa === 'object');
        assert.equal(typeof item.nivel.etapa.id, 'number');
        assert.equal(typeof item.nivel.etapa.nombre, 'string');
      }
    }
  });

  it('Scenario 3: VR Client Multi-Stage Progression & Tampering Defense across 4 etapas', async () => {
    const catalogoRes = await requestJson(harness.baseUrl, '/api/partidas/catalogo', {
      token: fx.users.estA2.token
    });
    assert.equal(catalogoRes.status, 200);
    assert.equal(catalogoRes.body.length, 4);

    // Pick first level of each of the 4 etapas
    const stageOneLevels = catalogoRes.body.map((etapa) => etapa.niveles[0]);
    assert.equal(stageOneLevels.length, 4);

    // Stage 1: VR creates initial match
    const createVr = await requestJson(harness.baseUrl, '/api/partidas', {
      method: 'POST',
      token: fx.users.estA2.token,
      body: {
        resultados: [{ nivelId: stageOneLevels[0].id, puntaje: 80, tiempoSegundos: 40 }]
      }
    });
    assert.equal(createVr.status, 201);
    const partidaId = createVr.body.id;

    // Stages 2..4: VR updates incrementally via PUT /api/partidas/:id
    for (let stageCount = 2; stageCount <= 4; stageCount += 1) {
      const resultados = stageOneLevels.slice(0, stageCount).map((lvl, idx) => ({
        nivelId: lvl.id,
        puntaje: 80 + idx * 5,
        tiempoSegundos: 35 - idx * 2
      }));
      const putRes = await requestJson(harness.baseUrl, `/api/partidas/${partidaId}`, {
        method: 'PUT',
        token: fx.users.estA2.token,
        body: { resultados }
      });
      assert.equal(putRes.status, 200);
      assert.equal(putRes.body.partida.resultados.length, stageCount);
    }

    // Tampering attempts must be rejected with 403 and leave progress intact
    const hijackRes = await requestJson(harness.baseUrl, `/api/partidas/${partidaId}`, {
      method: 'PUT',
      token: fx.users.estB1.token,
      body: { resultados: [{ nivelId: stageOneLevels[0].id, puntaje: 1, tiempoSegundos: 1 }] }
    });
    assert.equal(hijackRes.status, 403);

    const ownerTamper = await requestJson(harness.baseUrl, `/api/partidas/${partidaId}`, {
      method: 'PUT',
      token: fx.users.estA2.token,
      body: {
        usuarioId: fx.users.estB1.user.id,
        resultados: [{ nivelId: stageOneLevels[0].id, puntaje: 99, tiempoSegundos: 10 }]
      }
    });
    assert.equal(ownerTamper.status, 403);

    const finalGet = await requestJson(harness.baseUrl, `/api/partidas/${partidaId}`, {
      token: fx.users.estA2.token
    });
    assert.equal(finalGet.status, 200);
    assert.equal(finalGet.body.usuarioId, fx.users.estA2.user.id);
    assert.equal(finalGet.body.resultados.length, 4);
  });

  it('Scenario 4: AI Curriculum Audit & Offline Env Configuration', async () => {
    const estado = await requestJson(harness.baseUrl, '/api/ai/estado', {
      token: fx.users.profA.token
    });
    assert.equal(estado.status, 200);
    assert.equal(estado.body.archivoId, 'scenario-drive-file-id');
    assert.equal(estado.body.modeloGemini, 'gemini-3.5-flash-lite');
    assert.equal(typeof estado.body.tieneDriveCredentials, 'boolean');

    const historial = await requestJson(harness.baseUrl, '/api/ai/historial', {
      token: fx.users.profA.token
    });
    assert.equal(historial.status, 200);
    assert.ok(historial.body.length >= 2);
    assert.ok(historial.body[0].usuario.nombre);
    assert.ok(historial.body[0].usuario.correo);
    assert.ok(historial.body[0].usuario.rol);

    const original = await requestJson(harness.baseUrl, '/api/ai/original', {
      token: fx.users.profA.token
    });
    assert.equal(original.status, 200);
    assert.equal(original.body.propuesta.botones.length, 43);

    // Malformed proposal fails 400 before touching Drive
    const badApply = await requestJson(harness.baseUrl, '/api/ai/aplicar', {
      method: 'POST',
      token: fx.users.admin1.token,
      body: { propuesta: { botones: [{ texto: 'Incompleto', ponderacion: 1 }] } }
    });
    assert.equal(badApply.status, 400);

    // Student blocked from all AI endpoints
    const studentBlock = await requestJson(harness.baseUrl, '/api/ai/historial', {
      token: fx.users.estA1.token
    });
    assert.equal(studentBlock.status, 403);
  });

  it('Scenario 5: Production Maintenance & Safe DB Reset (confirmacion, seedDemo: true, renewed JWT, no admin123 backdoor)', async () => {
    const preEstado = await requestJson(harness.baseUrl, '/api/sistema/estado', {
      token: fx.users.admin2.token
    });
    assert.equal(preEstado.status, 200);
    assert.ok(preEstado.body.totalPartidas >= 4);

    // Invalid confirmation rejected
    const badReset = await requestJson(harness.baseUrl, '/api/sistema/reiniciar-db', {
      method: 'POST',
      token: fx.users.admin2.token,
      body: { confirmacion: 'wrong', seedDemo: true }
    });
    assert.equal(badReset.status, 400);

    // Confirmed reset as non-id-1 admin2 with seedDemo: true
    const okReset = await requestJson(harness.baseUrl, '/api/sistema/reiniciar-db', {
      method: 'POST',
      token: fx.users.admin2.token,
      body: { confirmacion: 'REINICIAR', seedDemo: true }
    });
    assert.equal(okReset.status, 200);
    assert.equal(okReset.body.seedAplicado, true);
    assert.equal(okReset.body.adminConservado, fx.users.admin2.user.correo);
    assert.ok(okReset.body.token, 'Expected renewed JWT token after DB reset');

    // Renewed JWT works immediately for admin operations
    const postEstado = await requestJson(harness.baseUrl, '/api/sistema/estado', {
      token: okReset.body.token
    });
    assert.equal(postEstado.status, 200);
    assert.equal(postEstado.body.totalUsuarios, 5); // admin2 + 4 demo users
    assert.equal(postEstado.body.totalPartidas, 4);
    assert.equal(postEstado.body.totalGrupos, 1);
    assert.equal(postEstado.body.totalEtapas, 4);
    assert.equal(postEstado.body.totalNiveles, 15);

    // Silent admin@example.com / admin123 backdoor must NOT exist
    const backdoorLogin = await requestJson(harness.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { username: 'admin@example.com', password: 'admin123' }
    });
    assert.equal(backdoorLogin.status, 401);
    assert.equal(backdoorLogin.body.message, 'Credenciales inválidas.');

    // Demo professor created by seedDemo: true can log in and see GRP-101
    const demoProfLogin = await requestJson(harness.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { username: 'profesor@example.com', password: 'prof123' }
    });
    assert.equal(demoProfLogin.status, 200);
    const demoGroups = await requestJson(harness.baseUrl, '/api/grupos', {
      token: demoProfLogin.body.token
    });
    assert.equal(demoGroups.status, 200);
    assert.equal(demoGroups.body.length, 1);
    assert.equal(demoGroups.body[0].codigo, 'GRP-101');
  });
});
