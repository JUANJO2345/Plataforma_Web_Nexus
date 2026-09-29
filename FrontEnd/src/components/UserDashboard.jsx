import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthStore';
import LeaderboardTables from './LeaderboardTables';
import { agruparResultadosPorEtapa } from '../utils/partidas';

const COLORES_ETAPA = [
  { color: 'text-primary', border: 'border-primary/30' },
  { color: 'text-secondary', border: 'border-secondary/30' },
  { color: 'text-orange-400', border: 'border-orange-400/30' },
  { color: 'text-pink-400', border: 'border-pink-400/30' },
];

export default function UserDashboard() {
  const { user, authFetch } = useAuth();
  const [partidas, setPartidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const partida = partidas.find((p) => p.username === user?.username) ?? null;

  useEffect(() => {
    const fetchPartidas = async () => {
      try {
        setLoading(true);
        const res = await authFetch('/api/partidas');
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
  }, [authFetch]);

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

  const etapasPartida = agruparResultadosPorEtapa(partida);
  const totalGeneral = etapasPartida.reduce((total, etapa) => total + etapa.puntajeTotal, 0);

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
            {etapasPartida.map((etapa, index) => {
              const { color, border } = COLORES_ETAPA[index % COLORES_ETAPA.length];
              return (
                <div key={etapa.clave} className={`border ${border} bg-surface-container-low/40 p-6 backdrop-blur-md`}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className={`font-mono-label ${color} text-[13px] font-bold uppercase`}>{etapa.nombre}</h3>
                    <span className="font-mono-label text-[11px] text-on-surface-variant">{etapa.puntajeTotal} pts</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {etapa.niveles.map((nivel) => <div key={nivel.nivelId} className="bg-surface-container/50 border border-primary/10 p-3">
                      <div className="font-mono-label text-[10px] text-on-surface-variant uppercase mb-1">{nivel.nivelNombre}</div>
                      <div className={`font-bold text-[14px] ${color}`}>{nivel.puntaje} pts</div>
                      <div className="font-mono-label text-[10px] text-on-surface-variant/70">{nivel.tiempoSegundos}s</div>
                    </div>)}
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
