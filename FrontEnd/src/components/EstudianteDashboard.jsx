import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthStore';
import LeaderboardTables from './LeaderboardTables';
import { agruparResultadosPorEtapa, puntajeTotalPartida } from '../utils/partidas';

const COLORES_ETAPA = [
  { color: 'text-primary', border: 'border-primary/30', bg: 'bg-primary/10' },
  { color: 'text-secondary', border: 'border-secondary/30', bg: 'bg-secondary/10' },
  { color: 'text-orange-400', border: 'border-orange-400/30', bg: 'bg-orange-400/10' },
  { color: 'text-pink-400', border: 'border-pink-400/30', bg: 'bg-pink-400/10' },
];

export default function EstudianteDashboard() {
  const { user, authFetch } = useAuth();
  const [grupos, setGrupos] = useState([]);
  const [partidas, setPartidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pestaña activa: 'global' (principal) o el ID numérico/string de un grupo
  const [tabActiva, setTabActiva] = useState('global');
  const [partidaSeleccionadaId, setPartidaSeleccionadaId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [resGrupos, resPartidas] = await Promise.all([
          authFetch(`/api/grupos?estudianteId=${user.id}`),
          authFetch('/api/partidas')
        ]);

        if (!resGrupos.ok || !resPartidas.ok) {
          throw new Error('Error al obtener datos del estudiante.');
        }

        const dataGrupos = await resGrupos.json();
        const dataPartidas = await resPartidas.json();

        setGrupos(dataGrupos);
        setPartidas(dataPartidas);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchData();
    }
  }, [user, authFetch]);

  if (loading) {
    return (
      <div className="font-mono-label text-primary animate-pulse text-[12px] py-12 text-center">
        &gt;&gt; LOADING_STUDENT_DATASTREAM...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-error/30 bg-error-container/10 font-mono-label text-[12px] text-on-error flex items-center gap-2">
        <span className="material-symbols-outlined">warning</span> [!] ERROR: {error}
      </div>
    );
  }

  // Partidas del usuario autenticado
  const misPartidas = partidas.filter(
    (p) => p.usuarioId === user.id || p.username?.toLowerCase() === user.username?.toLowerCase()
  );

  const partidaActiva = misPartidas.length > 0
    ? (partidaSeleccionadaId
        ? misPartidas.find((p) => p.id === partidaSeleccionadaId) || misPartidas[misPartidas.length - 1]
        : misPartidas[misPartidas.length - 1])
    : null;

  const etapasPartida = partidaActiva ? agruparResultadosPorEtapa(partidaActiva) : [];
  const totalGeneral = etapasPartida.reduce((total, etapa) => total + etapa.puntajeTotal, 0);

  // Información del grupo si la pestaña activa es un grupo específico
  const grupoSeleccionado = tabActiva !== 'global'
    ? grupos.find((g) => String(g.id) === String(tabActiva))
    : null;

  // Cálculos específicos para el grupo seleccionado
  let estadisticasGrupo = null;
  if (grupoSeleccionado) {
    const compañeros = grupoSeleccionado.estudiantes || [];
    const idsCompañeros = compañeros.map((c) => c.id);
    const correosCompañeros = compañeros.map((c) => c.correo?.toLowerCase());

    const partidasCompañeros = partidas.filter((p) =>
      idsCompañeros.includes(p.usuarioId) || correosCompañeros.includes(p.username?.toLowerCase())
    );

    // Puntajes por estudiante en el grupo para calcular posición y promedio
    const puntajesEstudiantes = compañeros.map((est) => {
      const pEst = partidas.filter((p) => p.usuarioId === est.id || p.username?.toLowerCase() === est.correo?.toLowerCase());
      const maxScore = pEst.reduce((max, cur) => Math.max(max, puntajeTotalPartida(cur)), 0);
      return { id: est.id, correo: est.correo, maxScore };
    }).sort((a, b) => b.maxScore - a.maxScore);

    const sumaPuntajes = puntajesEstudiantes.reduce((acc, curr) => acc + curr.maxScore, 0);
    const promedioGrupo = puntajesEstudiantes.length > 0 ? Math.round(sumaPuntajes / puntajesEstudiantes.length) : 0;

    const indicePosicion = puntajesEstudiantes.findIndex(
      (item) => item.id === user.id || item.correo?.toLowerCase() === user.username?.toLowerCase()
    );
    const miPosicion = indicePosicion !== -1 ? indicePosicion + 1 : '—';

    estadisticasGrupo = {
      totalCompañeros: compañeros.length,
      promedioGrupo,
      miPosicion,
      totalPartidasGrupo: partidasCompañeros.length,
      compañeros
    };
  }

  return (
    <div className="space-y-8">
      {/* 1. SEPARACIÓN POR GRUPOS: Barra de Navegación con Dashboard Global Principal */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <span className="font-mono-label text-[11px] text-primary uppercase font-bold tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-primary animate-pulse"></span>
              // PANEL_ESTUDIANTE :: SELECCION_DE_ESPACIO
            </span>
            <p className="font-mono-label text-[11px] text-on-surface-variant/70">
              Navega entre tu Dashboard Global unificado o el espacio específico de cada uno de tus grupos.
            </p>
          </div>
        </div>

        {/* Pestañas: Dashboard Global (Principal) + Grupos */}
        <div className="flex flex-wrap gap-2 border-b border-primary/20 pb-3">
          {/* Pestaña Principal: Dashboard Global */}
          <button
            onClick={() => setTabActiva('global')}
            className={`flex items-center gap-2 px-4 py-2 font-mono-label text-[12px] uppercase font-bold transition-all cursor-pointer border ${
              tabActiva === 'global'
                ? 'bg-primary text-black border-primary shadow-[0_0_15px_rgba(0,220,230,0.4)]'
                : 'border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/60'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">public</span>
            <span>Dashboard Global</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-black/20 font-mono">Principal</span>
          </button>

          {/* Pestañas para cada grupo inscrito */}
          {grupos.map((g) => {
            const esActivo = String(tabActiva) === String(g.id);
            return (
              <button
                key={g.id}
                onClick={() => setTabActiva(g.id)}
                className={`flex items-center gap-2 px-4 py-2 font-mono-label text-[12px] uppercase font-bold transition-all cursor-pointer border ${
                  esActivo
                    ? 'bg-orange-400 text-black border-orange-400 shadow-[0_0_15px_rgba(251,146,60,0.4)]'
                    : 'border-orange-400/30 text-orange-400 hover:bg-orange-400/10 hover:border-orange-400/60'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {esActivo ? 'folder_open' : 'folder'}
                </span>
                <span>{g.codigo}</span>
                <span className="opacity-70 font-normal text-[11px] hidden sm:inline">
                  · {g.nombre || 'Clase'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. CONTENIDO PRINCIPAL: DASHBOARD GLOBAL */}
      {tabActiva === 'global' ? (
        <div className="space-y-8">
          {/* Telemetría y Rendimiento Personal Consolidado */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-mono-label text-primary text-[13px] font-bold uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">analytics</span>
                  // TELEMETRIA_Y_RENDIMIENTO_PERSONAL_GLOBAL
                </h3>
                <p className="font-mono-label text-[11px] text-on-surface-variant/70">
                  Estadísticas consolidadas de todas tus partidas y actividades en la plataforma.
                </p>
              </div>

              {/* Selector de Partida si tiene más de 1 */}
              {misPartidas.length > 1 && (
                <div className="flex items-center gap-2 font-mono-label text-[11px]">
                  <span className="text-on-surface-variant">Partida:</span>
                  <select
                    value={partidaActiva?.id || ''}
                    onChange={(e) => setPartidaSeleccionadaId(Number(e.target.value))}
                    className="bg-surface-container border border-primary/40 px-3 py-1.5 text-primary text-[11px] focus:outline-none"
                  >
                    {misPartidas.map((p, idx) => (
                      <option key={p.id} value={p.id}>
                        #{String(p.id).padStart(4, '0')} · {puntajeTotalPartida(p)} pts {idx === misPartidas.length - 1 ? '(Última)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {misPartidas.length > 0 ? (
              <div className="space-y-6">
                {/* Tarjetas de Resumen Global */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="border border-primary/30 bg-surface-container-low/40 p-4 backdrop-blur-md">
                    <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Estudiante</div>
                    <div className="font-display text-[18px] text-primary font-bold mt-1 truncate">
                      {user.username.split('@')[0]}
                    </div>
                    <div className="font-mono-label text-[10px] text-primary/60 mt-1 uppercase">&gt;&gt; OPERATOR</div>
                  </div>

                  <div className="border border-secondary/30 bg-surface-container-low/40 p-4 backdrop-blur-md">
                    <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Puntaje Partida Actual</div>
                    <div className="font-display text-[20px] text-secondary font-bold mt-1">
                      {totalGeneral} <span className="text-[13px]">pts</span>
                    </div>
                    <div className="font-mono-label text-[10px] text-secondary/60 mt-1 uppercase">
                      {partidaActiva ? `Partida #${String(partidaActiva.id).padStart(4, '0')}` : '&gt;&gt; SCORE'}
                    </div>
                  </div>

                  <div className="border border-orange-400/30 bg-surface-container-low/40 p-4 backdrop-blur-md">
                    <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Total Partidas Jugadas</div>
                    <div className="font-display text-[20px] text-orange-400 font-bold mt-1">
                      {misPartidas.length}
                    </div>
                    <div className="font-mono-label text-[10px] text-orange-400/60 mt-1 uppercase">&gt;&gt; TOTAL_RUNS</div>
                  </div>

                  <div className="border border-pink-400/30 bg-surface-container-low/40 p-4 backdrop-blur-md">
                    <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Grupos Asignados</div>
                    <div className="font-display text-[20px] text-pink-400 font-bold mt-1">
                      {grupos.length}
                    </div>
                    <div className="font-mono-label text-[10px] text-pink-400/60 mt-1 uppercase">&gt;&gt; ENROLLED_CLASSES</div>
                  </div>
                </div>

                {/* Desglose por Etapas y Niveles con Colores Cyberpunk */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {etapasPartida.map((etapa, index) => {
                    const { color, border } = COLORES_ETAPA[index % COLORES_ETAPA.length];
                    return (
                      <div key={etapa.clave} className={`border ${border} bg-surface-container-low/40 p-6 backdrop-blur-md`}>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className={`font-mono-label ${color} text-[13px] font-bold uppercase`}>
                            {etapa.nombre}
                          </h3>
                          <span className="font-mono-label text-[11px] text-on-surface-variant font-bold">
                            {etapa.puntajeTotal} pts
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {etapa.niveles.map((nivel) => (
                            <div key={nivel.nivelId} className="bg-surface-container/50 border border-primary/10 p-3">
                              <div className="font-mono-label text-[10px] text-on-surface-variant uppercase mb-1">
                                {nivel.nivelNombre}
                              </div>
                              <div className={`font-bold text-[14px] ${color}`}>
                                {nivel.puntaje} pts
                              </div>
                              <div className="font-mono-label text-[10px] text-on-surface-variant/70">
                                {nivel.tiempoSegundos}s
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="border border-primary/30 bg-surface-container-low/40 p-8 backdrop-blur-md text-center">
                <span className="material-symbols-outlined text-primary text-[44px] mb-3 block opacity-60 mx-auto">
                  sensors_off
                </span>
                <p className="font-mono-label text-on-surface-variant text-[13px]">
                  Aún no registras partidas en el sistema.
                </p>
                <p className="font-mono-label text-[11px] text-on-surface-variant/60 mt-1">
                  Completa un módulo o partida para empezar a recopilar telemetría de rendimiento.
                </p>
              </div>
            )}
          </div>

          {/* Tarjetas de Acceso a Mis Grupos */}
          <div className="space-y-4">
            <h3 className="font-mono-label text-primary text-[12px] font-bold uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">groups</span>
              // MIS_GRUPOS_INSCRITOS
            </h3>

            {grupos.length === 0 ? (
              <div className="border border-primary/20 bg-surface-container-low/40 p-6 text-center">
                <p className="font-mono-label text-on-surface-variant text-[12px]">
                  No estás inscrito en ningún grupo actualmente. Contacta a tu profesor o administrador.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {grupos.map((g) => (
                  <div
                    key={g.id}
                    className="border border-primary/30 bg-surface-container-low/40 p-5 backdrop-blur-md space-y-3 hover:border-primary/60 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-display text-[18px] text-primary font-bold">{g.codigo}</span>
                        <span className="font-mono-label text-[10px] text-on-surface-variant uppercase border border-primary/20 px-2 py-0.5">
                          {g.estudiantes ? g.estudiantes.length : 0} Compañeros
                        </span>
                      </div>
                      <div className="font-mono-label text-[13px] text-on-surface font-semibold">
                        {g.nombre || 'Grupo sin nombre'}
                      </div>
                      <div className="font-mono-label text-[11px] text-on-surface-variant/80">
                        Profesor: <span className="text-orange-400 font-bold">{g.profesor?.nombre || g.profesor?.correo || 'Sin asignar'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setTabActiva(g.id)}
                      className="w-full flex items-center justify-center gap-2 py-2 border border-orange-400/40 text-orange-400 hover:bg-orange-400 hover:text-black font-mono-label text-[11px] uppercase font-bold transition-all cursor-pointer mt-2"
                    >
                      <span>Ver Dashboard del Grupo</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clasificación General Global */}
          <div>
            <div className="mb-4">
              <div className="font-mono-label text-primary text-[12px] mb-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary animate-pulse"></span> GLOBAL_RANKINGS
              </div>
              <h3 className="font-display text-[24px] text-primary uppercase font-bold">
                Clasificación General
              </h3>
            </div>
            <LeaderboardTables partidas={partidas} highlightUsername={user.username} grupoId="global" mostrarFiltro={true} />
          </div>
        </div>
      ) : null}

      {/* 3. CONTENIDO DE PESTAÑA: GRUPO ESPECÍFICO */}
      {grupoSeleccionado && (
        <div className="space-y-8">
          {/* Cabecera del Grupo Seleccionado */}
          <div className="bg-surface-container-low/60 border border-orange-400/40 p-6 backdrop-blur-md space-y-4 shadow-[0_0_15px_rgba(251,146,60,0.1)]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-400/10 border border-orange-400/40 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-orange-400 text-[28px]">school</span>
                </div>
                <div>
                  <div className="font-mono-label text-[10px] text-orange-400 font-bold uppercase tracking-widest">
                    // DASHBOARD_DE_GRUPO :: {grupoSeleccionado.codigo}
                  </div>
                  <h2 className="font-display text-[24px] text-primary font-bold">
                    {grupoSeleccionado.nombre || 'Clase'}
                  </h2>
                  <div className="font-mono-label text-[11px] text-on-surface-variant">
                    Profesor a cargo: <strong className="text-orange-400">{grupoSeleccionado.profesor?.nombre || grupoSeleccionado.profesor?.correo || 'Sin profesor'}</strong>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setTabActiva('global')}
                className="flex items-center gap-2 px-3 py-1.5 font-mono-label text-[11px] uppercase font-bold border border-primary/40 text-primary hover:bg-primary/10 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Volver al Dashboard Global</span>
              </button>
            </div>

            {/* Tarjetas de Métricas Comparativas en el Grupo */}
            {estadisticasGrupo && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
                <div className="border border-primary/30 bg-surface-container/50 p-4">
                  <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Mi Puntaje en el Grupo</div>
                  <div className="font-display text-[22px] text-primary font-bold mt-1">
                    {totalGeneral} <span className="text-[12px]">pts</span>
                  </div>
                  <div className="font-mono-label text-[10px] text-primary/60 mt-1 uppercase">&gt;&gt; MY_PERFORMANCE</div>
                </div>

                <div className="border border-secondary/30 bg-surface-container/50 p-4">
                  <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Promedio del Grupo</div>
                  <div className="font-display text-[22px] text-secondary font-bold mt-1">
                    {estadisticasGrupo.promedioGrupo} <span className="text-[12px]">pts</span>
                  </div>
                  <div className="font-mono-label text-[10px] text-secondary/60 mt-1 uppercase">&gt;&gt; GROUP_AVERAGE</div>
                </div>

                <div className="border border-orange-400/30 bg-surface-container/50 p-4">
                  <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Mi Posición en el Grupo</div>
                  <div className="font-display text-[22px] text-orange-400 font-bold mt-1">
                    #{estadisticasGrupo.miPosicion}
                  </div>
                  <div className="font-mono-label text-[10px] text-orange-400/60 mt-1 uppercase">
                    de {estadisticasGrupo.totalCompañeros} compañeros
                  </div>
                </div>

                <div className="border border-pink-400/30 bg-surface-container/50 p-4">
                  <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Total Compañeros</div>
                  <div className="font-display text-[22px] text-pink-400 font-bold mt-1">
                    {estadisticasGrupo.totalCompañeros}
                  </div>
                  <div className="font-mono-label text-[10px] text-pink-400/60 mt-1 uppercase">&gt;&gt; CLASSMATES</div>
                </div>
              </div>
            )}
          </div>

          {/* Desglose de Telemetría Personal en este Grupo */}
          {misPartidas.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-mono-label text-primary text-[12px] font-bold uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary animate-pulse"></span>
                  // MI_TELEMETRIA_DE_COMPETENCIAS
                </h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {etapasPartida.map((etapa, index) => {
                  const { color, border } = COLORES_ETAPA[index % COLORES_ETAPA.length];
                  return (
                    <div key={etapa.clave} className={`border ${border} bg-surface-container-low/40 p-6 backdrop-blur-md`}>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className={`font-mono-label ${color} text-[13px] font-bold uppercase`}>
                          {etapa.nombre}
                        </h3>
                        <span className="font-mono-label text-[11px] text-on-surface-variant font-bold">
                          {etapa.puntajeTotal} pts
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {etapa.niveles.map((nivel) => (
                          <div key={nivel.nivelId} className="bg-surface-container/50 border border-primary/10 p-3">
                            <div className="font-mono-label text-[10px] text-on-surface-variant uppercase mb-1">
                              {nivel.nivelNombre}
                            </div>
                            <div className={`font-bold text-[14px] ${color}`}>
                              {nivel.puntaje} pts
                            </div>
                            <div className="font-mono-label text-[10px] text-on-surface-variant/70">
                              {nivel.tiempoSegundos}s
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Clasificación Exclusiva del Grupo */}
          <div className="space-y-4">
            <div>
              <div className="font-mono-label text-orange-400 text-[12px] mb-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-400 animate-pulse"></span>
                // CLASIFICACION_EXCLUSIVA_DEL_GRUPO :: {grupoSeleccionado.codigo}
              </div>
              <h3 className="font-display text-[22px] text-primary uppercase font-bold">
                Tabla de Posiciones del Grupo
              </h3>
            </div>
            <LeaderboardTables
              partidas={partidas}
              highlightUsername={user.username}
              grupoId={grupoSeleccionado.id}
              mostrarFiltro={false}
            />
          </div>

          {/* Nómina de Compañeros de Clase */}
          {estadisticasGrupo && estadisticasGrupo.compañeros.length > 0 && (
            <div className="border border-primary/20 bg-surface-container-low/40 p-5 backdrop-blur-md space-y-4">
              <h4 className="font-mono-label text-primary text-[12px] font-bold uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">badge</span>
                // COMPAÑEROS_INSCRITOS_EN_ESTE_GRUPO ({estadisticasGrupo.compañeros.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {estadisticasGrupo.compañeros.map((comp) => {
                  const esYo = comp.id === user.id || comp.correo?.toLowerCase() === user.username?.toLowerCase();
                  return (
                    <div
                      key={comp.id}
                      className={`p-3 border font-mono-label text-[11px] flex items-center gap-2.5 ${
                        esYo
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-primary/10 bg-surface-container/30 text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {esYo ? 'stars' : 'account_circle'}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold truncate text-on-surface">
                          {comp.nombre || 'Compañero'} {esYo && '(Tú)'}
                        </div>
                        <div className="text-[10px] opacity-70 truncate">{comp.correo}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
