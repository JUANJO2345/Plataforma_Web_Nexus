import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthStore';
import LeaderboardTables from './LeaderboardTables';

const ZONAS = [
  { key: 'abstraccion', label: 'Abstracción', color: 'text-primary', border: 'border-primary/30' },
  { key: 'pensamiento_computacional', label: 'Pensamiento Computacional', color: 'text-secondary', border: 'border-secondary/30' },
  { key: 'descomposicion', label: 'Descomposición', color: 'text-orange-400', border: 'border-orange-400/30' },
  { key: 'reconocimiento_patrones', label: 'Reconocimiento de Patrones', color: 'text-pink-400', border: 'border-pink-400/30' },
];

const NIVELES = [
  { key: 'n1', label: 'Nivel 1' },
  { key: 'n2', label: 'Nivel 2' },
  { key: 'n3', label: 'Nivel 3' },
  { key: 'n4', label: 'Nivel 4' },
];

function obtenerMetricsNivel(stage, zonaKey, nivelKey) {
  const nivel = stage?.[zonaKey]?.[nivelKey];
  if (!nivel || (nivel.puntaje === 0 && nivel.tiempo_seg === 0)) return null;
  return nivel;
}

export default function UserDashboard() {
  const { user } = useAuth();
  const [partidas, setPartidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const partida = partidas.find((p) => p.username === user?.username) ?? null;

  useEffect(() => {
    const fetchPartidas = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/partidas');
        if (!res.ok) throw new Error('No se pudo cargar la telemetría.');
        setPartidas(await res.json());
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPartidas();
  }, []);

  if (loading) {
    return (
      <div className="font-mono-label text-primary animate-pulse text-[12px] py-8">
        &gt; LOADING_OPERATOR_TELEMETRY...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-error/30 bg-error-container/10 font-mono-label text-[12px] text-on-error">
        [!] ERROR: {error}
      </div>
    );
  }

  const stage = partida && typeof partida.stage === 'object' ? partida.stage : {};
  const calcularTotalZona = (zonaKey) =>
    NIVELES.reduce((acc, { key }) => acc + (obtenerMetricsNivel(stage, zonaKey, key)?.puntaje || 0), 0);
  const totalGeneral = ZONAS.reduce((acc, { key }) => acc + calcularTotalZona(key), 0);

  return (
    <div className="space-y-8">
      {partida ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-primary/30 bg-surface-container-low/40 p-4 backdrop-blur-md">
              <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Operador</div>
              <div className="font-display text-[20px] text-primary font-bold mt-1">
                {user.username.split('@')[0]}
              </div>
            </div>
            <div className="border border-secondary/30 bg-surface-container-low/40 p-4 backdrop-blur-md">
              <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Puntaje Total</div>
              <div className="font-display text-[20px] text-secondary font-bold mt-1">{totalGeneral} pts</div>
            </div>
            <div className="border border-orange-400/30 bg-surface-container-low/40 p-4 backdrop-blur-md">
              <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Registro</div>
              <div className="font-display text-[20px] text-orange-400 font-bold mt-1">
                #{String(partida.id).padStart(4, '0')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {ZONAS.map(({ key, label, color, border }) => {
              const totalZona = calcularTotalZona(key);
              return (
                <div key={key} className={`border ${border} bg-surface-container-low/40 p-6 backdrop-blur-md`}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className={`font-mono-label ${color} text-[13px] font-bold uppercase`}>{label}</h3>
                    <span className="font-mono-label text-[11px] text-on-surface-variant">{totalZona} pts</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {NIVELES.map(({ key: nKey, label: nLabel }) => {
                      const metrics = obtenerMetricsNivel(stage, key, nKey);
                      return (
                        <div key={nKey} className="bg-surface-container/50 border border-primary/10 p-3">
                          <div className="font-mono-label text-[10px] text-on-surface-variant uppercase mb-1">{nLabel}</div>
                          {metrics ? (
                            <>
                              <div className={`font-bold text-[14px] ${color}`}>{metrics.puntaje} pts</div>
                              <div className="font-mono-label text-[10px] text-on-surface-variant/70">{metrics.tiempo_seg}s</div>
                            </>
                          ) : (
                            <div className="font-mono-label text-[11px] text-on-surface-variant/30">--</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="border border-primary/30 bg-surface-container-low/40 p-6 backdrop-blur-md text-center">
          <span className="material-symbols-outlined text-primary text-[40px] mb-3 block opacity-60">sensors_off</span>
          <p className="font-mono-label text-on-surface-variant text-[13px]">
            Aún no hay registros de partida asociados a tu operador.
          </p>
          <p className="font-mono-label text-on-surface-variant/50 text-[11px] mt-2">
            Puedes consultar la clasificación general mientras un administrador registra tu sesión.
          </p>
        </div>
      )}

      <div>
        <div className="mb-4">
          <div className="font-mono-label text-primary text-[12px] mb-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-primary animate-pulse"></span> GLOBAL_RANKINGS
          </div>
          <h3 className="font-display text-[24px] text-primary uppercase font-bold">Clasificación General</h3>
        </div>
        <LeaderboardTables partidas={partidas} highlightUsername={user.username} />
      </div>
    </div>
  );
}
