import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthStore';

export default function ProfesorDashboard() {
  const { user } = useAuth();
  const [grupos, setGrupos] = useState([]);
  const [partidas, setPartidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [resGrupos, resPartidas] = await Promise.all([
          fetch(`/api/grupos?profesorId=${user.id}`),
          fetch('/api/partidas')
        ]);

        if (!resGrupos.ok || !resPartidas.ok) {
          throw new Error('Error al cargar la información del profesor.');
        }

        const dataGrupos = await resGrupos.json();
        const dataPartidas = await resPartidas.json();

        setGrupos(dataGrupos);
        setPartidas(dataPartidas);

        if (dataGrupos.length > 0) {
          setGrupoSeleccionado(dataGrupos[0]);
        }
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
        &gt; LOADING_PROFESSOR_DATASTREAM...
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

  if (grupos.length === 0) {
    return (
      <div className="border border-primary/30 bg-surface-container-low/40 p-8 backdrop-blur-md text-center">
        <span className="material-symbols-outlined text-orange-400 text-[48px] mb-3 block opacity-80">school</span>
        <h3 className="font-display text-[20px] text-primary uppercase font-bold mb-2">Sin Grupos Asignados</h3>
        <p className="font-mono-label text-on-surface-variant text-[13px]">
          Actualmente no tienes grupos asignados como profesor en el sistema.
        </p>
        <p className="font-mono-label text-on-surface-variant/50 text-[11px] mt-2">
          Contacta al Administrador para que te asigne a un grupo de clase.
        </p>
      </div>
    );
  }

  const estudiantesGrupo = grupoSeleccionado?.estudiantes || [];

  // Mapear partidas correspondientes a los estudiantes de este grupo
  const partidasDeEstudiantes = estudiantesGrupo.map((estudiante) => {
    const partidasEstudiante = partidas.filter(
      (p) => p.usuarioId === estudiante.id || p.username?.toLowerCase() === estudiante.correo?.toLowerCase()
    );
    return {
      estudiante,
      partidas: partidasEstudiante
    };
  });

  return (
    <div className="space-y-8">
      {/* Selector de Grupos Impartidos */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono-label text-[12px] text-on-surface-variant uppercase font-bold">
          Seleccionar Grupo:
        </span>
        {grupos.map((g) => (
          <button
            key={g.id}
            onClick={() => setGrupoSeleccionado(g)}
            className={`px-4 py-2 font-mono-label text-[12px] uppercase font-bold transition-all cursor-pointer border ${
              grupoSeleccionado?.id === g.id
                ? 'bg-orange-400 text-black border-orange-400 shadow-[0_0_15px_rgba(251,146,60,0.4)]'
                : 'border-orange-400/40 text-orange-400 hover:bg-orange-400/10'
            }`}
          >
            {g.codigo} - {g.nombre || 'Sin nombre'}
          </button>
        ))}
      </div>

      {grupoSeleccionado && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          {/* Tarjeta de Información del Grupo */}
          <div className="border border-orange-400/30 bg-surface-container-low/40 p-6 backdrop-blur-md space-y-4">
            <div className="font-mono-label text-[10px] text-orange-400 uppercase font-bold tracking-widest">
              // GROUP_SUMMARY
            </div>
            <div>
              <div className="font-display text-[24px] text-primary font-bold">{grupoSeleccionado.codigo}</div>
              <div className="font-mono-label text-[13px] text-on-surface-variant">{grupoSeleccionado.nombre || 'Grupo Sin Nombre'}</div>
            </div>

            <div className="border-t border-orange-400/20 pt-4 space-y-2 font-mono-label text-[12px]">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Profesor:</span>
                <span className="text-orange-400 font-bold">{user.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Estudiantes Inscritos:</span>
                <span className="text-primary font-bold">{estudiantesGrupo.length}</span>
              </div>
            </div>

            <div className="border-t border-orange-400/20 pt-4">
              <h4 className="font-mono-label text-[11px] text-on-surface-variant uppercase font-bold mb-3">
                Estudiantes Enrolados
              </h4>
              {estudiantesGrupo.length === 0 ? (
                <p className="font-mono-label text-[11px] text-on-surface-variant/40 italic">
                  No hay estudiantes inscritos en este grupo aún.
                </p>
              ) : (
                <ul className="space-y-2 font-mono-label text-[11px]">
                  {estudiantesGrupo.map((est) => (
                    <li key={est.id} className="flex items-center gap-2 p-2 border border-primary/20 bg-surface-container/50">
                      <span className="material-symbols-outlined text-primary text-[16px]">person</span>
                      <div className="truncate">
                        <div className="font-bold text-on-surface">{est.nombre || 'Sin nombre'}</div>
                        <div className="text-[10px] text-on-surface-variant/70">{est.correo}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Tabla / Lista de Partidas y Telemetría de los Estudiantes */}
          <div className="xl:col-span-2 border border-primary/30 bg-surface-container-low/40 p-6 backdrop-blur-md">
            <h3 className="font-mono-label text-primary text-[12px] font-bold mb-4 uppercase tracking-wider">
              // STUDENT_PERFORMANCE_TELEMETRY
            </h3>

            <div className="space-y-6">
              {partidasDeEstudiantes.length === 0 ? (
                <p className="font-mono-label text-[12px] text-on-surface-variant/50 py-4 text-center">
                  Sin registros de estudiantes para mostrar.
                </p>
              ) : (
                partidasDeEstudiantes.map(({ estudiante, partidas: pList }) => (
                  <div key={estudiante.id} className="border border-primary/20 bg-surface-container/30 p-4 space-y-3">
                    <div className="flex justify-between items-center border-b border-primary/20 pb-2">
                      <div className="flex items-center gap-2 font-mono-label">
                        <span className="material-symbols-outlined text-primary text-[20px]">account_box</span>
                        <div>
                          <span className="font-bold text-primary text-[13px]">{estudiante.nombre || 'Estudiante'}</span>
                          <span className="text-[11px] text-on-surface-variant ml-2">({estudiante.correo})</span>
                        </div>
                      </div>
                      <span className="font-mono-label text-[10px] uppercase border border-primary/40 px-2 py-0.5 text-primary font-bold">
                        {pList.length} Partidas Registradas
                      </span>
                    </div>

                    {pList.length === 0 ? (
                      <p className="font-mono-label text-[11px] text-on-surface-variant/40 italic py-2">
                        Este estudiante aún no ha registrado ninguna partida.
                      </p>
                    ) : (
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left font-mono-label text-[11px] border-collapse">
                          <thead>
                            <tr className="border-b border-primary/10 text-on-surface-variant uppercase text-[10px]">
                              <th className="py-2 px-2">ID Partida</th>
                              <th className="py-2 px-2">Detalles del Stage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pList.map((p) => (
                              <tr key={p.id} className="border-b border-primary/10 hover:bg-primary/5">
                                <td className="py-2 px-2 font-bold text-secondary">#{String(p.id).padStart(4, '0')}</td>
                                <td className="py-2 px-2 font-mono text-[10px] text-on-surface-variant/90">
                                  {typeof p.stage === 'object' ? JSON.stringify(p.stage) : p.stage}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
