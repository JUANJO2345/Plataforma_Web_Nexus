const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { FRONTEND_DIR, runNpm, runNpx } = require('./helpers/testHarness');

function collectSourceFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (/\.(js|jsx|ts|tsx|css|html)$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('FrontEnd Verification Suite (Phases 1 & 2 Acceptance Criteria)', () => {
  it('F1.6 — ESLint passes with 0 errors and 0 warnings', () => {
    const lintRes = runNpm(['run', 'lint'], FRONTEND_DIR);
    assert.equal(
      lintRes.status,
      0,
      `npm run lint failed:\n${lintRes.stdout}\n${lintRes.stderr}`
    );

    const strictRes = runNpx(['--no-install', 'eslint', '--max-warnings=0', '.'], FRONTEND_DIR);
    assert.equal(
      strictRes.status,
      0,
      `eslint --max-warnings=0 failed:\n${strictRes.stdout}\n${strictRes.stderr}`
    );

    const combined = `${strictRes.stdout}\n${strictRes.stderr}`;
    assert.equal(/\d+\s+warnings?\b/i.test(combined), false, `Unexpected ESLint warning summary:\n${combined}`);
    assert.equal(/\d+\s+problems?\b/i.test(combined), false, `Unexpected ESLint problem summary:\n${combined}`);
    assert.equal(/^\s*\d+:\d+\s+warning\b/im.test(combined), false, `Unexpected ESLint warning line:\n${combined}`);
  });

  it('Vite production build completes cleanly without errors', () => {
    const buildRes = runNpm(['run', 'build'], FRONTEND_DIR);
    assert.equal(
      buildRes.status,
      0,
      `npm run build failed:\n${buildRes.stdout}\n${buildRes.stderr}`
    );
    assert.equal(
      fs.existsSync(path.join(FRONTEND_DIR, 'dist', 'index.html')),
      true,
      'Expected FrontEnd/dist/index.html to be generated'
    );
  });

  it('F1.7 — Dead components QueryLookupModal.jsx and UserDashboard.jsx are deleted with zero references', () => {
    const deadFiles = [
      path.join(FRONTEND_DIR, 'src', 'components', 'QueryLookupModal.jsx'),
      path.join(FRONTEND_DIR, 'src', 'components', 'UserDashboard.jsx')
    ];

    for (const filePath of deadFiles) {
      assert.equal(fs.existsSync(filePath), false, `Dead component still exists: ${filePath}`);
    }

    const filesToScan = [
      ...collectSourceFiles(path.join(FRONTEND_DIR, 'src')),
      ...(fs.existsSync(path.join(FRONTEND_DIR, 'index.html'))
        ? [path.join(FRONTEND_DIR, 'index.html')]
        : [])
    ];

    for (const filePath of filesToScan) {
      const content = fs.readFileSync(filePath, 'utf8');
      assert.equal(
        /\b(QueryLookupModal|UserDashboard)\b/.test(content),
        false,
        `Found stale reference to dead component in ${filePath}`
      );
    }
  });

  it('F1.4 — FrontEnd/src/index.css defines required error & surface-container CSS tokens', () => {
    const css = fs.readFileSync(path.join(FRONTEND_DIR, 'src', 'index.css'), 'utf8');

    assert.match(css, /@theme\s*\{/);
    assert.match(css, /--color-error:\s*#ff5449\b/i);
    assert.match(css, /--color-on-error:\s*#ffb4ab\b/i);
    assert.match(css, /--color-surface-container-high:\s*#2a2a29\b/i);
    assert.match(css, /--color-surface-container-lowest:\s*#0e0e0e\b/i);
    assert.equal(/--color-on-error:\s*#690005\b/i.test(css), false);
  });

  describe('F1.5 — calcularEstadisticasGrupo ESM unit tests & dashboard usage', () => {
    it('exports calcularEstadisticasGrupo and computes best-score-per-student without username', async () => {
      const modUrl = pathToFileURL(path.join(FRONTEND_DIR, 'src', 'utils', 'partidas.js')).href;
      const mod = await import(modUrl);
      assert.equal(typeof mod.calcularEstadisticasGrupo, 'function');

      // 1. Empty inputs
      const emptyStats = mod.calcularEstadisticasGrupo([], []);
      assert.ok(emptyStats && typeof emptyStats === 'object');
      const emptyAvg = emptyStats.promedioGrupo ?? emptyStats.promedio ?? 0;
      assert.equal(emptyAvg, 0);

      // 2. Multi-match student + single-match student using /api/partidas/ranking shape (no username/correo)
      const estudiantes = [
        { id: 10, nombre: 'Ana', correo: 'ana@nexus.test' },
        { id: 20, nombre: 'Luis', correo: 'luis@nexus.test' }
      ];
      const partidasRanking = [
        {
          id: 1,
          usuarioId: 10,
          nombre: 'Ana',
          fecha: '2026-11-01T10:00:00Z',
          resultados: [{ nivelId: 1, puntaje: 100, tiempoSegundos: 40 }]
        },
        {
          id: 2,
          usuarioId: 10,
          nombre: 'Ana',
          fecha: '2026-11-02T10:00:00Z',
          resultados: [{ nivelId: 1, puntaje: 180, tiempoSegundos: 30 }, { nivelId: 2, puntaje: 120, tiempoSegundos: 25 }]
        },
        {
          id: 3,
          usuarioId: 20,
          nombre: 'Luis',
          fecha: '2026-11-02T12:00:00Z',
          resultados: [{ nivelId: 1, puntaje: 200, tiempoSegundos: 35 }]
        }
      ];

      const stats = mod.calcularEstadisticasGrupo(estudiantes, partidasRanking);
      const avg = stats.promedioGrupo ?? stats.promedio;
      assert.equal(avg, 250, 'Expected best-per-student average (300 + 200) / 2 = 250');

      const totalPartidas = stats.totalPartidasGrupo ?? stats.totalPartidas;
      assert.equal(totalPartidas, 3);

      const perStudent = stats.datosEstudiantes || stats.rankingEstudiantes || [];
      assert.equal(perStudent.length, 2);
      const anaRow = perStudent.find((d) => (d.estudiante?.id ?? d.id) === 10);
      const luisRow = perStudent.find((d) => (d.estudiante?.id ?? d.id) === 20);
      assert.ok(anaRow && luisRow);
      assert.equal(anaRow.mejorPuntaje ?? anaRow.maxScore ?? anaRow.puntaje, 300);
      assert.equal(luisRow.mejorPuntaje ?? luisRow.maxScore ?? luisRow.puntaje, 200);

      // 3. Enrolled student with 0 matches still counts in group average
      const withIdle = mod.calcularEstadisticasGrupo(
        [
          { id: 10, nombre: 'Ana', correo: 'ana@nexus.test' },
          { id: 30, nombre: 'Sin Partidas', correo: 'idle@nexus.test' }
        ],
        partidasRanking
      );
      const idleAvg = withIdle.promedioGrupo ?? withIdle.promedio;
      assert.equal(idleAvg, 150, 'Expected (300 + 0) / 2 = 150');

      // 4. Tie-breaking on equal puntaje prefers faster tiempoSegundos
      const tieStats = mod.calcularEstadisticasGrupo(
        [{ id: 40, nombre: 'Beto', correo: 'beto@nexus.test' }],
        [
          {
            id: 10,
            usuarioId: 40,
            fecha: '2026-11-01T10:00:00Z',
            resultados: [{ nivelId: 1, puntaje: 200, tiempoSegundos: 65 }]
          },
          {
            id: 11,
            usuarioId: 40,
            fecha: '2026-11-02T10:00:00Z',
            resultados: [{ nivelId: 1, puntaje: 200, tiempoSegundos: 40 }]
          }
        ]
      );
      assert.equal(tieStats.datosEstudiantes[0].mejorPartida.id, 11);
      assert.equal(tieStats.datosEstudiantes[0].mejorTiempo, 40);

      // 5. Outsider match exclusion and duplicate partida.id deduplication
      const outsiderAndDupStats = mod.calcularEstadisticasGrupo(
        estudiantes,
        [
          ...partidasRanking,
          partidasRanking[1], // duplicate partida id: 2
          {
            id: 999,
            usuarioId: 999,
            nombre: 'Outsider',
            fecha: '2026-11-03T10:00:00Z',
            resultados: [{ nivelId: 1, puntaje: 999, tiempoSegundos: 5 }]
          }
        ]
      );
      assert.equal(outsiderAndDupStats.totalPartidasGrupo, 3);
      assert.equal(outsiderAndDupStats.promedioGrupo, 250);

      // 6. null / undefined / non-array resilience
      const nullRes = mod.calcularEstadisticasGrupo(null, undefined);
      assert.deepEqual(nullRes, {
        totalEstudiantes: 0,
        totalPartidasGrupo: 0,
        promedioGrupo: 0,
        datosEstudiantes: [],
        rankingEstudiantes: []
      });
      const nonArrayRes = mod.calcularEstadisticasGrupo('invalid', 123);
      assert.deepEqual(nonArrayRes, {
        totalEstudiantes: 0,
        totalPartidasGrupo: 0,
        promedioGrupo: 0,
        datosEstudiantes: [],
        rankingEstudiantes: []
      });
    });

    it('ProfesorDashboard.jsx and EstudianteDashboard.jsx import and call calcularEstadisticasGrupo', () => {
      const profSrc = fs.readFileSync(
        path.join(FRONTEND_DIR, 'src', 'components', 'ProfesorDashboard.jsx'),
        'utf8'
      );
      const estSrc = fs.readFileSync(
        path.join(FRONTEND_DIR, 'src', 'components', 'EstudianteDashboard.jsx'),
        'utf8'
      );

      assert.match(profSrc, /import\s*\{[^}]*\bcalcularEstadisticasGrupo\b[^}]*\}\s*from\s*['"]\.\.\/utils\/partidas['"]/);
      assert.match(profSrc, /\bcalcularEstadisticasGrupo\s*\(/);

      assert.match(estSrc, /import\s*\{[^}]*\bcalcularEstadisticasGrupo\b[^}]*\}\s*from\s*['"]\.\.\/utils\/partidas['"]/);
      assert.match(estSrc, /\bcalcularEstadisticasGrupo\s*\(/);
      assert.match(estSrc, /\/api\/partidas\/ranking/);
    });
  });

  it('F1.5 & F2.4b — LeaderboardTables.jsx defaults to best-per-student, has toggle, uses /api/partidas/ranking & usuarioId/nombre', () => {
    const lbSrc = fs.readFileSync(
      path.join(FRONTEND_DIR, 'src', 'components', 'LeaderboardTables.jsx'),
      'utf8'
    );

    assert.match(
      lbSrc,
      /const\s*\[\s*soloMejorPorAlumno\s*,\s*setSoloMejorPorAlumno\s*\]\s*=\s*useState\(\s*true\s*\)/
    );
    assert.match(lbSrc, /\/api\/partidas\/ranking/);
    assert.match(lbSrc, /Mejor por alumno/i);
    assert.match(lbSrc, /Todas las partidas/i);
    assert.match(lbSrc, /usuarioId/);
    assert.match(lbSrc, /\.nombre/);
  });

  it('F1.1b & F1.2b — ContenidoIaPanel.jsx renders nombre/correo and removes hardcoded model & Drive ID', () => {
    const iaSrc = fs.readFileSync(
      path.join(FRONTEND_DIR, 'src', 'components', 'ContenidoIaPanel.jsx'),
      'utf8'
    );

    assert.match(iaSrc, /log\.usuario\?\.nombre/);
    assert.match(iaSrc, /log\.usuario\?\.correo/);
    assert.equal(/log\.usuario\?\.username/.test(iaSrc), false);
    assert.equal(/log\.usuario\?\.email/.test(iaSrc), false);

    assert.match(iaSrc, /\/api\/ai\/estado/);
    assert.match(iaSrc, /modeloGemini/);
    assert.match(iaSrc, /archivoId/);
    assert.equal(
      iaSrc.includes('gemini-3.5-flash-lite'),
      false,
      'ContenidoIaPanel.jsx must not hardcode gemini-3.5-flash-lite'
    );
    assert.equal(
      iaSrc.includes('1mxonSdL8ydZQM0aOZn-0tTJZ3q4UgFK_'),
      false,
      'ContenidoIaPanel.jsx must not hardcode Drive file ID'
    );
  });

  it('F2.2 — AuthContext.jsx validates session via /api/auth/me, memoizes callbacks, and exposes token helper', () => {
    const authSrc = fs.readFileSync(
      path.join(FRONTEND_DIR, 'src', 'context', 'AuthContext.jsx'),
      'utf8'
    );

    assert.match(authSrc, /\/api\/auth\/me/);
    assert.match(authSrc, /useCallback/);
    assert.match(authSrc, /const\s+logout\s*=\s*useCallback/);
    assert.match(authSrc, /const\s+authFetch\s*=\s*useCallback/);
    assert.match(authSrc, /const\s+actualizarToken\s*=\s*useCallback/);
    assert.match(
      authSrc,
      /contextValue\s*=\s*useMemo\s*\(\s*\(\)\s*=>\s*\(\{[^}]*\bactualizarToken\b[^}]*\}\)/
    );
    assert.match(authSrc, /<AuthContext\.Provider\s+value=\{contextValue\}>/);
  });

  it('F2.7b — SystemMaintenance.jsx sends confirmacion REINICIAR and handles renewed data.token', () => {
    const sysSrc = fs.readFileSync(
      path.join(FRONTEND_DIR, 'src', 'components', 'SystemMaintenance.jsx'),
      'utf8'
    );

    assert.match(sysSrc, /\/api\/sistema\/reiniciar-db/);
    assert.match(sysSrc, /\bconfirmacion\b\s*:/);
    assert.match(sysSrc, /['"]REINICIAR['"]/);
    assert.match(sysSrc, /data\.token|data\?\.token/);
  });
});
