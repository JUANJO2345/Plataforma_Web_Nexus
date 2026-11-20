const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  startTestServer,
  seedBaselineFixtures,
  requestJson
} = require('./helpers/testHarness');

describe('Tier 3 — Pairwise Role × Resource Matrix & Cross-Feature Combinations', () => {
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

  describe('Pairwise Role × Resource Access Matrix', () => {
    it('enforces exact access matrix across roles (admin, profA, profB, estA1, estFree, anon) and resources', async () => {
      const roles = {
        admin: fx.users.admin1.token,
        profA: fx.users.profA.token,
        profB: fx.users.profB.token,
        estA1: fx.users.estA1.token,
        estFree: fx.users.estFree.token,
        anon: null
      };

      const matrix = [
        {
          label: 'GET /api/grupos/:grupoA',
          method: 'GET',
          path: `/api/grupos/${fx.grupos.grupoA.id}`,
          expected: { admin: 200, profA: 200, profB: 403, estA1: 200, estFree: 403, anon: 401 }
        },
        {
          label: 'GET /api/grupos/:grupoB',
          method: 'GET',
          path: `/api/grupos/${fx.grupos.grupoB.id}`,
          expected: { admin: 200, profA: 403, profB: 200, estA1: 403, estFree: 403, anon: 401 }
        },
        {
          label: 'GET /api/partidas/:partidaA1High',
          method: 'GET',
          path: `/api/partidas/${fx.partidas.partidaA1High.id}`,
          expected: { admin: 200, profA: 200, profB: 403, estA1: 200, estFree: 403, anon: 401 }
        },
        {
          label: 'GET /api/partidas/:partidaB1',
          method: 'GET',
          path: `/api/partidas/${fx.partidas.partidaB1.id}`,
          expected: { admin: 200, profA: 403, profB: 200, estA1: 403, estFree: 403, anon: 401 }
        },
        {
          label: 'PATCH /api/partidas/:partidaA1Low/observacion',
          method: 'PATCH',
          path: `/api/partidas/${fx.partidas.partidaA1Low.id}/observacion`,
          body: { observacion: 'Matrix check' },
          expected: { admin: 200, profA: 200, profB: 403, estA1: 403, estFree: 403, anon: 401 }
        },
        {
          label: 'GET /api/usuarios/:estA1',
          method: 'GET',
          path: `/api/usuarios/${fx.users.estA1.user.id}`,
          expected: { admin: 200, profA: 403, profB: 403, estA1: 200, estFree: 403, anon: 401 }
        },
        {
          label: 'GET /api/ai/estado',
          method: 'GET',
          path: '/api/ai/estado',
          expected: { admin: 200, profA: 200, profB: 200, estA1: 403, estFree: 403, anon: 401 }
        },
        {
          label: 'GET /api/sistema/estado',
          method: 'GET',
          path: '/api/sistema/estado',
          expected: { admin: 200, profA: 403, profB: 403, estA1: 403, estFree: 403, anon: 401 }
        }
      ];

      for (const row of matrix) {
        for (const [roleName, token] of Object.entries(roles)) {
          const res = await requestJson(harness.baseUrl, row.path, {
            method: row.method,
            token,
            body: row.body
          });
          assert.equal(
            res.status,
            row.expected[roleName],
            `${row.label} as ${roleName}: expected ${row.expected[roleName]}, got ${res.status}`
          );
        }
      }
    });
  });

  describe('Cross-Feature Interaction 1 — Same-Prefix Register -> VR Play -> Ranking Privacy -> Professor Observacion', () => {
    it('completes end-to-end flow across auth, VR updates, ranking scrubbing, and professor feedback', async () => {
      const reg1 = await requestJson(harness.baseUrl, '/api/auth/register', {
        method: 'POST',
        body: { correo: 'alex@uno.test', contrasena: 'Password123!', nombre: 'Alex Uno' }
      });
      assert.equal(reg1.status, 201);

      const reg2 = await requestJson(harness.baseUrl, '/api/auth/register', {
        method: 'POST',
        body: { correo: 'alex@dos.test', contrasena: 'Password123!', nombre: 'Alex Dos' }
      });
      assert.equal(reg2.status, 201);

      const login1 = await requestJson(harness.baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { correo: 'alex@uno.test', contrasena: 'Password123!' }
      });
      assert.equal(login1.status, 200);
      const alexToken = login1.body.token;

      const me = await requestJson(harness.baseUrl, '/api/auth/me', { token: alexToken });
      assert.equal(me.status, 200);
      assert.equal(me.body.id, reg1.body.id);
      assert.equal(me.body.nombre, 'Alex Uno');

      // Enroll Alex Uno in grupoA so profA can evaluate him
      const enrollRes = await requestJson(
        harness.baseUrl,
        `/api/grupos/${fx.grupos.grupoA.id}/estudiantes`,
        {
          method: 'POST',
          token: fx.users.profA.token,
          body: { estudianteId: reg1.body.id }
        }
      );
      assert.equal(enrollRes.status, 200);

      // VR creates partida and updates it with second stage result
      const n1 = fx.niveles[0];
      const n4 = fx.niveles[3];
      const created = await requestJson(harness.baseUrl, '/api/partidas', {
        method: 'POST',
        token: alexToken,
        body: { resultados: [{ nivelId: n1.id, puntaje: 60, tiempoSegundos: 50 }] }
      });
      assert.equal(created.status, 201);

      const updated = await requestJson(harness.baseUrl, `/api/partidas/${created.body.id}`, {
        method: 'PUT',
        token: alexToken,
        body: {
          resultados: [
            { nivelId: n1.id, puntaje: 98, tiempoSegundos: 25 },
            { nivelId: n4.id, puntaje: 92, tiempoSegundos: 33 }
          ]
        }
      });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.partida.resultados.length, 2);

      // Prof A adds observacion
      const obsRes = await requestJson(
        harness.baseUrl,
        `/api/partidas/${created.body.id}/observacion`,
        {
          method: 'PATCH',
          token: fx.users.profA.token,
          body: { observacion: 'Desempeño sobresaliente de Alex Uno' }
        }
      );
      assert.equal(obsRes.status, 200);

      // Student sees own observacion via GET /api/partidas/:id
      const ownPartida = await requestJson(harness.baseUrl, `/api/partidas/${created.body.id}`, {
        token: alexToken
      });
      assert.equal(ownPartida.status, 200);
      assert.equal(ownPartida.body.observacion, 'Desempeño sobresaliente de Alex Uno');

      // Ranking exposes Alex Uno's updated scores & nombre, while hiding correo & observacion
      const ranking = await requestJson(
        harness.baseUrl,
        `/api/partidas/ranking?grupoId=${fx.grupos.grupoA.id}`,
        { token: fx.users.estA1.token }
      );
      assert.equal(ranking.status, 200);
      const alexEntry = ranking.body.find((r) => r.id === created.body.id);
      assert.ok(alexEntry, 'Alex Uno partida must appear in group ranking');
      assert.equal(alexEntry.nombre, 'Alex Uno');
      assert.equal(alexEntry.usuarioId, reg1.body.id);
      assert.equal(alexEntry.resultados.length, 2);
      for (const item of alexEntry.resultados) {
        assert.equal(typeof item.puntaje, 'number');
        assert.equal(typeof item.tiempoSegundos, 'number');
        assert.equal(typeof item.nivelId, 'number');
        assert.ok(item.nivel && typeof item.nivel === 'object');
        assert.equal(typeof item.nivel.id, 'number');
        assert.equal(typeof item.nivel.nombre, 'string');
        assert.ok(item.nivel.nombre.length > 0);
        assert.ok(item.nivel.etapa && typeof item.nivel.etapa === 'object');
        assert.equal(typeof item.nivel.etapa.id, 'number');
        assert.equal(typeof item.nivel.etapa.nombre, 'string');
        assert.ok(item.nivel.etapa.nombre.length > 0);
      }
      assert.equal(alexEntry.correo, undefined);
      assert.equal(alexEntry.username, undefined);
      assert.equal(alexEntry.observacion, undefined);
    });
  });

  describe('Cross-Feature Interaction 2 — Dynamic Enrollment Scope Changes', () => {
    it('dynamically grants and revokes professor partida visibility & observation rights on enrollment/removal', async () => {
      // Initially estFree is not in grupoA
      const initialGet = await requestJson(
        harness.baseUrl,
        `/api/partidas/${fx.partidas.partidaFree.id}`,
        { token: fx.users.profA.token }
      );
      assert.equal(initialGet.status, 403);

      const initialObs = await requestJson(
        harness.baseUrl,
        `/api/partidas/${fx.partidas.partidaFree.id}/observacion`,
        {
          method: 'PATCH',
          token: fx.users.profA.token,
          body: { observacion: 'Antes de inscribir' }
        }
      );
      assert.equal(initialObs.status, 403);

      // Enroll estFree into grupoA
      const enroll = await requestJson(
        harness.baseUrl,
        `/api/grupos/${fx.grupos.grupoA.id}/estudiantes`,
        {
          method: 'POST',
          token: fx.users.profA.token,
          body: { estudianteId: fx.users.estFree.user.id }
        }
      );
      assert.equal(enroll.status, 200);

      // Now profA can see estFree's partidas and add observacion
      const listAfterEnroll = await requestJson(harness.baseUrl, '/api/partidas', {
        token: fx.users.profA.token
      });
      assert.equal(listAfterEnroll.status, 200);
      assert.ok(listAfterEnroll.body.some((p) => p.id === fx.partidas.partidaFree.id));

      const obsAfterEnroll = await requestJson(
        harness.baseUrl,
        `/api/partidas/${fx.partidas.partidaFree.id}/observacion`,
        {
          method: 'PATCH',
          token: fx.users.profA.token,
          body: { observacion: 'Inscrito y evaluado' }
        }
      );
      assert.equal(obsAfterEnroll.status, 200);
      assert.equal(obsAfterEnroll.body.partida.observacion, 'Inscrito y evaluado');

      // Remove estFree from grupoA
      const remove = await requestJson(
        harness.baseUrl,
        `/api/grupos/${fx.grupos.grupoA.id}/estudiantes/${fx.users.estFree.user.id}`,
        {
          method: 'DELETE',
          token: fx.users.profA.token
        }
      );
      assert.equal(remove.status, 200);

      // Visibility and observation access are immediately revoked
      const getAfterRemove = await requestJson(
        harness.baseUrl,
        `/api/partidas/${fx.partidas.partidaFree.id}`,
        { token: fx.users.profA.token }
      );
      assert.equal(getAfterRemove.status, 403);

      const obsAfterRemove = await requestJson(
        harness.baseUrl,
        `/api/partidas/${fx.partidas.partidaFree.id}/observacion`,
        {
          method: 'PATCH',
          token: fx.users.profA.token,
          body: { observacion: 'Ya removido' }
        }
      );
      assert.equal(obsAfterRemove.status, 403);
    });
  });

  describe('Cross-Feature Interaction 3 — Non-ID-1 Admin Reset, Renewed Token & Deleted-User Invalidation', () => {
    it('renews admin2 token across DB reset while invalidating deleted users tokens on /api/auth/me', async () => {
      assert.ok(fx.users.admin2.user.id > 1, 'admin2 fixture must have id > 1');

      const resetRes = await requestJson(harness.baseUrl, '/api/sistema/reiniciar-db', {
        method: 'POST',
        token: fx.users.admin2.token,
        body: { confirmacion: 'REINICIAR', seedDemo: false }
      });
      assert.equal(resetRes.status, 200);
      assert.ok(resetRes.body.token, 'Expected renewed JWT token');

      const silentAdmin = await harness.models.Usuario.findOne({ where: { correo: 'admin@example.com' } });
      assert.equal(silentAdmin, null);

      const renewedMe = await requestJson(harness.baseUrl, '/api/auth/me', {
        token: resetRes.body.token
      });
      assert.equal(renewedMe.status, 200);
      assert.equal(renewedMe.body.id, 1);
      assert.equal(renewedMe.body.correo, fx.users.admin2.user.correo);
      assert.equal(renewedMe.body.rol, 'admin');

      const renewedEstado = await requestJson(harness.baseUrl, '/api/sistema/estado', {
        token: resetRes.body.token
      });
      assert.equal(renewedEstado.status, 200);
      assert.equal(renewedEstado.body.totalUsuarios, 1);

      // Deleted user tokens (e.g. profA, estA1) must now be rejected with 401 by /api/auth/me
      const deletedProfMe = await requestJson(harness.baseUrl, '/api/auth/me', {
        token: fx.users.profA.token
      });
      assert.equal(deletedProfMe.status, 401);

      const deletedEstMe = await requestJson(harness.baseUrl, '/api/auth/me', {
        token: fx.users.estA1.token
      });
      assert.equal(deletedEstMe.status, 401);
    });
  });
});
