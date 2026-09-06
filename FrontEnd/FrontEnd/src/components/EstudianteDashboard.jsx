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

export default function EstudianteDashboard() {
  const { user } = useAuth();
  const [grupos, setGrupos] = useState([]);
  const [partidas, setPartidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [resGrupos, resPartidas] = await Promise.all([
          fetch(`/api/grupos?estudianteId=${user.id}`),
          fetch('/api/partidas')
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
  }, [user]);

  if (loading) {
    return (
      <div className="font-mono-label text-primary animate-pulse text-[12px] py-8">
        &gt; LOADING_STUDENT_DATASTREAM...
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

  const misPartidas = partidas.filter(
    (p) => p.usuarioId === user.id || p.username?.toLowerCase() === user.username?.toLowerCase()
  );
  const ultimaPartida = misPartidas.length > 0 ? misPartidas[misPartidas.length - 1] : null;
  const stage = ultimaPartida && typeof ultimaPartida.stage === 'object' ? ultimaPartida.stage : {};

  const calcularTotalZona = (zonaKey) =>
    NIVELES.reduce((acc, { key }) => acc + (obtenerMetricsNivel(stage, zonaKey, key)?.puntaje || 0), 0);
  const totalGeneral = ZONAS.reduce((acc, { key }) => acc + calcularTotalZona(key), 0);

  return (
    <div className="space-y-8">
      {/* Sección de Grupos Inscritos del Estudiante */}
      <div>
        <h3 className="font-mono-label text-primary text-[12px] font-bold mb-4 uppercase tracking-wider">
          // MIS_GRUPOS_INSCRITOS
        </h3>
        {grupos.length === 0 ? (
          <div className="border border-primary/20 bg-surface-container-low/40 p-4 text-center">
            <p className="font-mono-label text-on-surface-variant text-[12px]">
              No estás inscrito en ningún grupo actualmente.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grupos.map((g) => (
              <div key={g.id} className="border border-primary/30 bg-surface-container-low/40 p-4 backdrop-blur-md space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-display text-[18px] text-primary font-bold">{g.codigo}</span>
                  <span className="font-mono-label text-[10px] text-on-surface-variant uppercase border border-primary/20 px-2 py-0.5">
                    {g.estudiantes ? g.estudiantes.length : 0} Compañeros
                  </span>
                </div>
                <div className="font-mono-label text-[12px] text-on-surface">{g.nombre || 'Grupo sin nombre'}</div>
                <div className="font-mono-label text-[11px] text-on-surface-variant/80">
                  Profesor: <span className="text-orange-400 font-bold">{g.profesor?.nombre || g.profesor?.correo || 'Sin asignar'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sección de Telemetría Personal */}
      <div>
        <h3 className="font-mono-label text-primary text-[12px] font-bold mb-4 uppercase tracking-wider">
          // TELEMETRIA_Y_RENDIMIENTO_PERSONAL
        </h3>

        {misPartidas.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="border border-primary/30 bg-surface-container-low/40 p-4 backdrop-blur-md">
                <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Estudiante</div>
                <div className="font-display text-[20px] text-primary font-bold mt-1">
                  {user.username.split('@')[0]}
                </div>
              </div>
              <div className="border border-secondary/30 bg-surface-container-low/40 p-4 backdrop-blur-md">
                <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Puntaje Total (Última Partida)</div>
                <div className="font-display text-[20px] text-secondary font-bold mt-1">{totalGeneral} pts</div>
              </div>
              <div className="border border-orange-400/30 bg-surface-container-low/40 p-4 backdrop-blur-md">
                <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Total Partidas Jugadas</div>
                <div className="font-display text-[20px] text-orange-400 font-bold mt-1">
                  {misPartidas.length}
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
          </div>
        ) : (
          <div className="border border-primary/30 bg-surface-container-low/40 p-6 backdrop-blur-md text-center">
            <span className="material-symbols-outlined text-primary text-[40px] mb-3 block opacity-60">sensors_off</span>
            <p className="font-mono-label text-on-surface-variant text-[13px]">
              Aún no registras partidas en el sistema.
            </p>
          </div>
        )}
      </div>

      {/* Clasificación General */}
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
