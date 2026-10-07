import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthStore';
import LeaderboardTables from './LeaderboardTables';
import { formatearFechaCorta, puntajeTotalPartida } from '../utils/partidas';

export default function DashboardHome() {
  const { authFetch, isAdmin } = useAuth();
  const [partidas, setPartidas] = useState([]);
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const [resPartidas, resEstado] = await Promise.all([
        authFetch('/api/partidas'),
        isAdmin ? authFetch('/api/sistema/estado') : Promise.resolve(null)
      ]);

      if (!resPartidas.ok) throw new Error('No se pudo establecer enlace con la telemetría central.');
      const dataPartidas = await resPartidas.json();
      setPartidas(dataPartidas);

      if (resEstado && resEstado.ok) {
        const dataMetricas = await resEstado.json();
        setMetricas(dataMetricas);
      }

      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, isAdmin]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  if (loading && !metricas) {
    return (
      <div className="font-mono-label text-primary animate-pulse text-[12px] py-12 text-center">
        &gt;&gt; SYNCHRONIZING_CORE_SYSTEM_METRICS...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-error/30 bg-error-container/10 font-mono-label text-[12px] text-on-error flex items-center gap-2">
        <span className="material-symbols-outlined">warning</span> [!] CRITICAL_DASHBOARD_ERROR: {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. MÉTRICAS EJECUTIVAS DEL SISTEMA */}
      {metricas && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-primary/40 bg-surface-container-low/50 p-5 backdrop-blur-md shadow-[0_0_15px_rgba(0,220,230,0.08)]">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
                  Usuarios en la Red
                </div>
                <div className="font-display text-[28px] text-primary font-bold mt-1">
                  {metricas.totalUsuarios}
                </div>
              </div>
              <span className="material-symbols-outlined text-primary/60 text-[26px]">manage_accounts</span>
            </div>
            <div className="font-mono-label text-[10px] text-primary/70 mt-2 uppercase">&gt;&gt; REGISTERED_NODES</div>
          </div>

          <div className="border border-secondary/40 bg-surface-container-low/50 p-5 backdrop-blur-md shadow-[0_0_15px_rgba(166,226,46,0.08)]">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
                  Partidas Registradas
                </div>
                <div className="font-display text-[28px] text-secondary font-bold mt-1">
                  {metricas.totalPartidas}
                </div>
              </div>
              <span className="material-symbols-outlined text-secondary/60 text-[26px]">sports_esports</span>
            </div>
            <div className="font-mono-label text-[10px] text-secondary/70 mt-2 uppercase">&gt;&gt; TOTAL_MATCHES</div>
          </div>

          <div className="border border-orange-400/40 bg-surface-container-low/50 p-5 backdrop-blur-md shadow-[0_0_15px_rgba(251,146,60,0.08)]">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
                  Grupos Académicos
                </div>
                <div className="font-display text-[28px] text-orange-400 font-bold mt-1">
                  {metricas.totalGrupos}
                </div>
              </div>
              <span className="material-symbols-outlined text-orange-400/60 text-[26px]">groups</span>
            </div>
            <div className="font-mono-label text-[10px] text-orange-400/70 mt-2 uppercase">&gt;&gt; ACTIVE_CLASSES</div>
          </div>

          <div className="border border-pink-400/40 bg-surface-container-low/50 p-5 backdrop-blur-md shadow-[0_0_15px_rgba(244,114,182,0.08)]">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
                  Auditoría IA
                </div>
                <div className="font-display text-[28px] text-pink-400 font-bold mt-1">
                  {metricas.totalLogs}
                </div>
              </div>
              <span className="material-symbols-outlined text-pink-400/60 text-[26px]">smart_toy</span>
            </div>
            <div className="font-mono-label text-[10px] text-pink-400/70 mt-2 uppercase">&gt;&gt; AI_AUDIT_LOGS</div>
          </div>
        </div>
      )}

      {/* 2. REGISTRO Y AUDITORÍA DE PARTIDAS DEL SISTEMA */}
      <div className="border border-primary/30 bg-surface-container-low/50 p-5 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-primary/20 pb-3">
          <div>
            <div className="font-mono-label text-primary text-[11px] font-bold uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-primary animate-pulse"></span>
              // REGISTRO_GLOBAL_DE_PARTIDAS
            </div>
            <h3 className="font-display text-[22px] text-primary uppercase font-bold mt-0.5">
              Partidas Registradas en la Red
            </h3>
          </div>
          <span className="font-mono-label text-[11px] text-primary/80 uppercase px-2 py-0.5 border border-primary/30">
            {partidas.length} {partidas.length === 1 ? 'Partida' : 'Partidas'}
          </span>
        </div>

        {partidas.length === 0 ? (
          <div className="py-8 text-center font-mono-label text-[12px] text-on-surface-variant/50">
            No hay partidas registradas en el sistema.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left font-mono-label text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-primary/20 text-on-surface-variant uppercase text-[10px]">
                  <th className="py-2.5 px-3">Partida</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Operador / Alumno</th>
                  <th className="py-2.5 px-3">Puntaje Total</th>
                  <th className="py-2.5 px-3">Niveles</th>
                  <th className="py-2.5 px-3">Observación Docente</th>
                </tr>
              </thead>
              <tbody>
                {partidas.map((p) => {
                  const puntaje = puntajeTotalPartida(p);
                  const nombre = p.usuario?.nombre || p.username || 'Desconocido';
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-primary/5 hover:bg-primary/5 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-bold text-orange-400">
                        #{String(p.id).padStart(4, '0')}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-primary font-bold whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-primary">calendar_today</span>
                          {formatearFechaCorta(p.fecha || p.createdAt)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-on-surface">
                        <div>{nombre}</div>
                        <span className="text-[10px] text-on-surface-variant/60 font-normal">
                          {p.username}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-secondary">
                        {puntaje} pts
                      </td>
                      <td className="py-2.5 px-3 text-on-surface-variant">
                        {(p.resultados || []).length} superados
                      </td>
                      <td className="py-2.5 px-3 text-[10px]">
                        {p.observacion ? (
                          <span className="text-orange-400 flex items-center gap-1 font-bold truncate max-w-[200px]" title={p.observacion}>
                            <span className="material-symbols-outlined text-[13px] shrink-0">chat</span>
                            <span className="truncate">{p.observacion}</span>
                          </span>
                        ) : (
                          <span className="text-on-surface-variant/40 italic">Sin observación</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. CLASIFICACIÓN GENERAL Y RANKINGS POR ETAPA */}
      <div>
        <div className="mb-4">
          <div className="font-mono-label text-primary text-[12px] mb-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-primary animate-pulse"></span> GLOBAL_RANKINGS
          </div>
          <h3 className="font-display text-[24px] text-primary uppercase font-bold">
            Clasificación General y Rankings por Etapa
          </h3>
        </div>
        <LeaderboardTables partidas={partidas} mostrarFiltro={true} />
      </div>
    </div>
  );
}
