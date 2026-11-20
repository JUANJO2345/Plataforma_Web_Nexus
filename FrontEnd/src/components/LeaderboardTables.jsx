import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthStore';
import { formatearFechaCorta } from '../utils/partidas';

const COLORES_ETAPA = [
  { texto: 'text-primary', borde: 'border-primary/40', bg: 'bg-primary/10', badge: 'border-primary text-primary' },
  { texto: 'text-secondary', borde: 'border-secondary/40', bg: 'bg-secondary/10', badge: 'border-secondary text-secondary' },
  { texto: 'text-orange-400', borde: 'border-orange-400/40', bg: 'bg-orange-400/10', badge: 'border-orange-400 text-orange-400' },
  { texto: 'text-pink-400', borde: 'border-pink-400/40', bg: 'bg-pink-400/10', badge: 'border-pink-400 text-pink-400' },
];

function MedallaPosicion({ posicion }) {
  if (posicion === 1) return <span className="text-yellow-400 font-bold">#1 🥇</span>;
  if (posicion === 2) return <span className="text-slate-300 font-bold">#2 🥈</span>;
  if (posicion === 3) return <span className="text-amber-600 font-bold">#3 🥉</span>;
  return <span className="text-on-surface-variant/80 font-mono">#{posicion}</span>;
}

function obtenerClaveEstudiante(partida) {
  if (partida?.usuarioId != null) return `uid:${partida.usuarioId}`;
  if (partida?.username) return `user:${partida.username.toLowerCase()}`;
  if (partida?.usuario?.correo) return `user:${partida.usuario.correo.toLowerCase()}`;
  if (partida?.nombre) return `name:${partida.nombre.toLowerCase()}`;
  return `partida:${partida?.id}`;
}

function esPartidaDeUsuario(partida, highlightUserId, highlightUsername) {
  if (highlightUserId != null && partida?.usuarioId != null) {
    if (Number(partida.usuarioId) === Number(highlightUserId)) return true;
  }
  if (highlightUsername) {
    const target = highlightUsername.toLowerCase();
    if (partida?.username?.toLowerCase() === target) return true;
    if (partida?.usuario?.correo?.toLowerCase() === target) return true;
  }
  return false;
}

function obtenerNombreMostrar(partida) {
  return partida?.nombre || partida?.usuario?.nombre || partida?.username?.split('@')[0] || 'Operador';
}

function obtenerCorreoMostrar(partida) {
  return partida?.username || partida?.usuario?.correo || null;
}

function filtrarMejorPorAlumno(filasOrdenadas) {
  const vistos = new Set();
  const resultado = [];
  for (const fila of filasOrdenadas) {
    const clave = obtenerClaveEstudiante(fila.partida);
    if (!vistos.has(clave)) {
      vistos.add(clave);
      resultado.push(fila);
    }
  }
  return resultado;
}

function TablaGeneral({
  etapas,
  partidas,
  highlightUserId = null,
  highlightUsername,
  soloMejorPorAlumno = true
}) {
  const filasOrdenadas = partidas.map((partida) => {
    const etapasPuntajes = etapas.map((etapa) => {
      const resultados = etapa.niveles.map((nivel) => (
        partida.resultados?.find((resultado) => resultado.nivelId === nivel.id) || null
      ));
      const puntajeEtapa = resultados.reduce((suma, r) => suma + (r?.puntaje || 0), 0);
      const tiempoEtapa = resultados.reduce((suma, r) => suma + (r?.tiempoSegundos || 0), 0);
      return { etapa, puntajeEtapa, tiempoEtapa };
    });
    const totalPuntaje = etapasPuntajes.reduce((acc, curr) => acc + curr.puntajeEtapa, 0);
    const totalTiempo = etapasPuntajes.reduce((acc, curr) => acc + curr.tiempoEtapa, 0);
    return {
      partida,
      etapasPuntajes,
      totalPuntaje,
      totalTiempo
    };
  }).sort((a, b) => b.totalPuntaje - a.totalPuntaje || a.totalTiempo - b.totalTiempo);

  const filas = soloMejorPorAlumno ? filtrarMejorPorAlumno(filasOrdenadas) : filasOrdenadas;

  return (
    <section className="border border-primary/40 bg-surface-container-low/50 p-5 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 border-b border-primary/20 pb-3">
        <div>
          <h3 className="font-mono-label text-primary text-[14px] font-bold uppercase flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">military_tech</span>
            // RANKING_GENERAL_ACUMULADO
          </h3>
          <p className="font-mono-label text-[11px] text-on-surface-variant/70">
            Clasificación unificada computando el puntaje global de todas las etapas del juego.
          </p>
        </div>
        <span className="font-mono-label text-[11px] text-primary/80 uppercase px-2 py-0.5 border border-primary/30">
          {filas.length} {filas.length === 1 ? 'Registro' : 'Registros'}
        </span>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left font-mono-label text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-primary/20 text-on-surface-variant uppercase text-[10px]">
              <th className="py-2.5 px-3 text-center w-16">Pos</th>
              <th className="py-2.5 px-3">Estudiante / Operador</th>
              <th className="py-2.5 px-3">Partida</th>
              <th className="py-2.5 px-3">Fecha</th>
              {etapas.map((etapa, idx) => {
                const color = COLORES_ETAPA[idx % COLORES_ETAPA.length];
                return (
                  <th key={etapa.id} className={`py-2.5 px-2 text-center ${color.texto}`}>
                    {etapa.nombre}
                  </th>
                );
              })}
              <th className="py-2.5 px-3 text-right text-secondary">Total Global</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={etapas.length + 5} className="py-8 text-center text-on-surface-variant/40">
                  Sin registros disponibles en esta clasificación.
                </td>
              </tr>
            ) : (
              filas.map(({ partida, etapasPuntajes, totalPuntaje, totalTiempo }, index) => {
                const esUsuario = esPartidaDeUsuario(partida, highlightUserId, highlightUsername);
                const nombreMostrar = obtenerNombreMostrar(partida);
                const correoMostrar = obtenerCorreoMostrar(partida);
                return (
                  <tr
                    key={partida.id}
                    className={`border-b border-primary/5 transition-colors ${
                      esUsuario
                        ? 'bg-primary/15 border-primary/30 shadow-[inset_2px_0_0_rgba(0,220,230,0.8)]'
                        : 'hover:bg-primary/5'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center">
                      <MedallaPosicion posicion={index + 1} />
                    </td>
                    <td className="py-2.5 px-3 font-bold text-on-surface">
                      <div className="flex items-center gap-1.5">
                        <span>{nombreMostrar}</span>
                        {esUsuario && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-primary text-black font-bold uppercase">
                            Tú
                          </span>
                        )}
                      </div>
                      {correoMostrar && (
                        <div className="text-[10px] text-on-surface-variant/60 font-normal">
                          {correoMostrar}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-orange-400 font-mono font-bold">
                      #{String(partida.id).padStart(4, '0')}
                    </td>
                    <td className="py-2.5 px-3 text-on-surface-variant font-mono whitespace-nowrap">
                      {formatearFechaCorta(partida.fecha || partida.createdAt)}
                    </td>
                    {etapasPuntajes.map(({ etapa, puntajeEtapa, tiempoEtapa }, idx) => {
                      const color = COLORES_ETAPA[idx % COLORES_ETAPA.length];
                      return (
                        <td key={etapa.id} className="py-2.5 px-2 text-center">
                          <span className={`font-bold ${color.texto}`}>{puntajeEtapa} pts</span>
                          <span className="block text-[9px] text-on-surface-variant/70">{tiempoEtapa}s</span>
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-bold text-secondary text-[13px]">{totalPuntaje} pts</span>
                      <span className="block text-[10px] text-on-surface-variant/60">{totalTiempo}s total</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TablaEtapa({
  etapa,
  partidas,
  highlightUserId = null,
  highlightUsername,
  color,
  soloMejorPorAlumno = true
}) {
  const filasOrdenadas = partidas.map((partida) => {
    const resultados = etapa.niveles.map((nivel) => (
      partida.resultados?.find((resultado) => resultado.nivelId === nivel.id) || null
    ));
    const total = resultados.reduce((suma, resultado) => suma + (resultado?.puntaje || 0), 0);
    const tiempoTotal = resultados.reduce((suma, resultado) => suma + (resultado?.tiempoSegundos || 0), 0);
    return {
      partida,
      resultados,
      total,
      tiempoTotal
    };
  }).filter((fila) => fila.resultados.some(Boolean)).sort((a, b) => b.total - a.total || a.tiempoTotal - b.tiempoTotal);

  const filas = soloMejorPorAlumno ? filtrarMejorPorAlumno(filasOrdenadas) : filasOrdenadas;

  return (
    <section className={`border ${color.borde} bg-surface-container-low/40 p-5 backdrop-blur-md`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 border-b border-primary/20 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`font-mono-label text-[10px] px-2 py-0.5 border ${color.badge} font-bold uppercase`}>
              ETAPA
            </span>
            <h3 className={`font-mono-label ${color.texto} text-[14px] font-bold uppercase`}>
              {etapa.nombre}
            </h3>
          </div>
          <p className="font-mono-label text-[11px] text-on-surface-variant/70 mt-1">
            Ranking individual para los niveles de la etapa de {etapa.nombre}.
          </p>
        </div>
        <span className="font-mono-label text-[11px] text-on-surface-variant/80">
          {filas.length} {filas.length === 1 ? 'Participante' : 'Participantes'}
        </span>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left font-mono-label text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-primary/20 text-on-surface-variant uppercase text-[10px]">
              <th className="py-2 px-3 text-center w-16">Pos</th>
              <th className="py-2 px-3">Operador</th>
              <th className="py-2 px-3">Partida</th>
              <th className="py-2 px-3">Fecha</th>
              {etapa.niveles.map((nivel) => (
                <th key={nivel.id} className="py-2 px-2 text-center">
                  {nivel.nombre}
                </th>
              ))}
              <th className="py-2 px-3 text-right">Puntaje Etapa</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={etapa.niveles.length + 5} className="py-6 text-center text-on-surface-variant/40">
                  Sin resultados registrados en esta etapa.
                </td>
              </tr>
            ) : (
              filas.map(({ partida, resultados, total, tiempoTotal }, index) => {
                const esUsuario = esPartidaDeUsuario(partida, highlightUserId, highlightUsername);
                const nombreMostrar = obtenerNombreMostrar(partida);
                const correoMostrar = obtenerCorreoMostrar(partida);
                return (
                  <tr
                    key={partida.id}
                    className={`border-b border-primary/5 transition-colors ${
                      esUsuario
                        ? 'bg-primary/15 border-primary/30 shadow-[inset_2px_0_0_rgba(0,220,230,0.8)]'
                        : 'hover:bg-primary/5'
                    }`}
                  >
                    <td className="py-2 px-3 text-center">
                      <MedallaPosicion posicion={index + 1} />
                    </td>
                    <td className="py-2 px-3 font-bold text-on-surface">
                      <div className="flex items-center gap-1.5">
                        <span>{nombreMostrar}</span>
                        {esUsuario && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-primary text-black font-bold uppercase">
                            Tú
                          </span>
                        )}
                      </div>
                      {correoMostrar && (
                        <div className="text-[10px] text-on-surface-variant/60 font-normal">
                          {correoMostrar}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-orange-400 font-mono font-bold">
                      #{String(partida.id).padStart(4, '0')}
                    </td>
                    <td className="py-2 px-3 text-on-surface-variant font-mono whitespace-nowrap">
                      {formatearFechaCorta(partida.fecha || partida.createdAt)}
                    </td>
                    {resultados.map((resultado, resultadoIndex) => (
                      <td key={etapa.niveles[resultadoIndex].id} className="py-2 px-2 text-center">
                        {resultado ? (
                          <>
                            <span className={`${color.texto} font-bold`}>{resultado.puntaje} pts</span>
                            <span className="block text-[9px] text-on-surface-variant/70">{resultado.tiempoSegundos}s</span>
                          </>
                        ) : (
                          <span className="text-on-surface-variant/30">—</span>
                        )}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-right">
                      <span className={`font-bold text-[13px] ${color.texto}`}>{total} pts</span>
                      <span className="block text-[10px] text-on-surface-variant/60">{tiempoTotal}s</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function LeaderboardTables({
  partidas,
  highlightUserId = null,
  highlightUsername = null,
  grupoId = null,
  mostrarFiltro = true,
  etapaInicial = 'general'
}) {
  const { authFetch } = useAuth();
  const [grupos, setGrupos] = useState([]);
  const [etapas, setEtapas] = useState([]);
  const [grupoOverride, setGrupoOverride] = useState(null);
  const grupoActivo = (grupoOverride && grupoOverride.base === grupoId)
    ? grupoOverride.value
    : (grupoId || 'global');
  const [soloMejorPorAlumno, setSoloMejorPorAlumno] = useState(true);
  const [rankingPartidas, setRankingPartidas] = useState([]);
  const [pestañaEtapa, setPestañaEtapa] = useState(etapaInicial); // 'general', id/clave de etapa, o 'todas'
  const hasPartidasProp = partidas !== undefined;

  useEffect(() => {
    let cancelled = false;
    Promise.all([authFetch('/api/grupos'), authFetch('/api/partidas/catalogo')])
      .then(async ([resGrupos, resCatalogo]) => {
        if (cancelled) return;
        if (resGrupos.ok) setGrupos(await resGrupos.json());
        if (resCatalogo.ok) {
          const data = await resCatalogo.json();
          if (cancelled) return;
          setEtapas(
            data
              .map((etapa) => ({
                ...etapa,
                niveles: [...etapa.niveles].sort((a, b) => a.orden - b.orden)
              }))
              .sort((a, b) => a.orden - b.orden)
          );
        }
      })
      .catch((error) => console.error('Error al cargar catálogos de clasificación:', error));
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  useEffect(() => {
    if (hasPartidasProp) return undefined;
    let cancelled = false;
    const cargarRanking = async () => {
      try {
        const query = grupoActivo !== 'global' ? `?grupoId=${encodeURIComponent(grupoActivo)}` : '';
        const res = await authFetch(`/api/partidas/ranking${query}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setRankingPartidas(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error al cargar ranking de partidas:', error);
      }
    };
    cargarRanking();
    return () => {
      cancelled = true;
    };
  }, [authFetch, hasPartidasProp, grupoActivo]);

  const partidasFiltradas = !hasPartidasProp
    ? rankingPartidas
    : (grupoActivo === 'global' ? partidas : (() => {
        const grupo = grupos.find((item) => String(item.id) === String(grupoActivo));
        if (!grupo?.estudiantes) return [];
        const ids = grupo.estudiantes.map((estudiante) => Number(estudiante.id));
        const correos = grupo.estudiantes.map((estudiante) => estudiante.correo?.toLowerCase()).filter(Boolean);
        return partidas.filter((partida) => (
          (partida.usuarioId != null && ids.includes(Number(partida.usuarioId)))
          || (partida.username && correos.includes(partida.username.toLowerCase()))
          || (partida.usuario?.correo && correos.includes(partida.usuario.correo.toLowerCase()))
        ));
      })());

  const etapaSeleccionada = etapas.find((e) => String(e.id) === String(pestañaEtapa) || e.clave === pestañaEtapa);

  return (
    <div className="space-y-6">
      {/* Barra de Filtro de Grupo y Selector de Etapas */}
      <div className="space-y-3 bg-surface-container-low/60 border border-primary/30 p-4 font-mono-label">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div>
            <span className="text-primary font-bold text-[12px] uppercase flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">filter_alt</span>
              // VISTA_DE_CLASIFICACION_Y_RANKINGS
            </span>
            <p className="text-[11px] text-on-surface-variant/70">
              Selecciona el alcance del grupo y navega entre el ranking general y el ranking individual de cada etapa.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center border border-primary/40 bg-surface-container text-[10px] uppercase font-bold">
              <button
                type="button"
                onClick={() => setSoloMejorPorAlumno(true)}
                className={`px-2.5 py-1.5 transition-all cursor-pointer ${
                  soloMejorPorAlumno
                    ? 'bg-primary text-black'
                    : 'text-primary hover:bg-primary/10'
                }`}
              >
                Mejor por alumno
              </button>
              <button
                type="button"
                onClick={() => setSoloMejorPorAlumno(false)}
                className={`px-2.5 py-1.5 transition-all cursor-pointer border-l border-primary/30 ${
                  !soloMejorPorAlumno
                    ? 'bg-primary text-black'
                    : 'text-primary hover:bg-primary/10'
                }`}
              >
                Todas las partidas
              </button>
            </div>

            {mostrarFiltro && (
              <label className="flex items-center gap-2 text-[11px] text-on-surface-variant uppercase shrink-0">
                <span>Grupo:</span>
                <select
                  value={grupoActivo}
                  onChange={(event) => setGrupoOverride({ base: grupoId, value: event.target.value })}
                  className="bg-surface-container border border-primary/40 px-3 py-1.5 text-primary text-[11px] focus:outline-none"
                >
                  <option value="global">Clasificación Global</option>
                  {grupos.map((grupo) => (
                    <option key={grupo.id} value={grupo.id}>
                      {grupo.codigo} · {grupo.nombre || 'Sin nombre'}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        {/* Pestañas de Navegación por Etapa */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-primary/10">
          <button
            type="button"
            onClick={() => setPestañaEtapa('general')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase font-bold border transition-all cursor-pointer ${
              pestañaEtapa === 'general'
                ? 'bg-primary text-black border-primary shadow-[0_0_12px_rgba(0,220,230,0.4)]'
                : 'border-primary/30 text-primary hover:bg-primary/10'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">military_tech</span>
            <span>Ranking General</span>
          </button>

          {etapas.map((etapa, idx) => {
            const esActivo = String(pestañaEtapa) === String(etapa.id) || pestañaEtapa === etapa.clave;
            const color = COLORES_ETAPA[idx % COLORES_ETAPA.length];
            return (
              <button
                key={etapa.id}
                type="button"
                onClick={() => setPestañaEtapa(etapa.clave)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase font-bold border transition-all cursor-pointer ${
                  esActivo
                    ? 'bg-secondary text-black border-secondary shadow-[0_0_12px_rgba(166,226,46,0.4)]'
                    : `${color.borde} ${color.texto} hover:bg-surface-container`
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">trophy</span>
                <span>Ranking {etapa.nombre}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setPestañaEtapa('todas')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase font-bold border transition-all cursor-pointer ${
              pestañaEtapa === 'todas'
                ? 'bg-orange-400 text-black border-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.4)]'
                : 'border-orange-400/30 text-orange-400 hover:bg-orange-400/10'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">list_alt</span>
            <span>Todas las Etapas</span>
          </button>
        </div>
      </div>

      {/* Renderizado según la pestaña de etapa seleccionada */}
      {pestañaEtapa === 'general' && (
        <TablaGeneral
          etapas={etapas}
          partidas={partidasFiltradas}
          highlightUserId={highlightUserId}
          highlightUsername={highlightUsername}
          soloMejorPorAlumno={soloMejorPorAlumno}
        />
      )}

      {pestañaEtapa === 'todas' && (
        <div className="grid grid-cols-1 gap-6">
          <TablaGeneral
            etapas={etapas}
            partidas={partidasFiltradas}
            highlightUserId={highlightUserId}
            highlightUsername={highlightUsername}
            soloMejorPorAlumno={soloMejorPorAlumno}
          />
          {etapas.map((etapa, index) => (
            <TablaEtapa
              key={etapa.id}
              etapa={etapa}
              partidas={partidasFiltradas}
              highlightUserId={highlightUserId}
              highlightUsername={highlightUsername}
              soloMejorPorAlumno={soloMejorPorAlumno}
              color={COLORES_ETAPA[index % COLORES_ETAPA.length]}
            />
          ))}
        </div>
      )}

      {etapaSeleccionada && (
        <TablaEtapa
          etapa={etapaSeleccionada}
          partidas={partidasFiltradas}
          highlightUserId={highlightUserId}
          highlightUsername={highlightUsername}
          soloMejorPorAlumno={soloMejorPorAlumno}
          color={COLORES_ETAPA[etapas.findIndex((e) => e.id === etapaSeleccionada.id) % COLORES_ETAPA.length]}
        />
      )}

      {etapas.length === 0 && (
        <div className="text-on-surface-variant font-mono text-[12px] p-6 text-center">
          &gt;&gt; SINCRONIZANDO_CATALOGO_DE_CLASIFICACION...
        </div>
      )}
    </div>
  );
}
