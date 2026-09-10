import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthStore';

const COMPETENCIAS = [
  { key: 'abstraccion', label: 'Abstracción', color: 'bg-primary', text: 'text-primary', border: 'border-primary/40' },
  { key: 'pensamiento_computacional', label: 'Pensamiento Computacional', color: 'bg-secondary', text: 'text-secondary', border: 'border-secondary/40' },
  { key: 'descomposicion', label: 'Descomposición', color: 'bg-orange-400', text: 'text-orange-400', border: 'border-orange-400/40' },
  { key: 'reconocimiento_patrones', label: 'Patrones', color: 'bg-pink-400', text: 'text-pink-400', border: 'border-pink-400/40' }
];

export default function ProfesorDashboard() {
  const { user, authFetch } = useAuth();
  const [grupos, setGrupos] = useState([]);
  const [partidas, setPartidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [estudiantesDisponibles, setEstudiantesDisponibles] = useState([]);
  const [busquedaAgregar, setBusquedaAgregar] = useState('');
  const [agregandoId, setAgregandoId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [resGrupos, resPartidas, resUsuarios] = await Promise.all([
          authFetch(`/api/grupos?profesorId=${user.id}`),
          fetch('/api/partidas'),
          authFetch('/api/usuarios')
        ]);

        if (!resGrupos.ok || !resPartidas.ok || !resUsuarios.ok) {
          throw new Error('No se pudo establecer enlace con los datos del profesor.');
        }

        const dataGrupos = await resGrupos.json();
        const dataPartidas = await resPartidas.json();
        const dataUsuarios = await resUsuarios.json();

        setGrupos(dataGrupos);
        setPartidas(dataPartidas);
        setEstudiantesDisponibles(dataUsuarios.filter((u) => u.rol === 'estudiante' || u.rol === 'user'));

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
  }, [user, authFetch]);

  const agregarEstudiante = async (estudianteId) => {
    if (!grupoSeleccionado) return;

    try {
      setAgregandoId(estudianteId);
      const res = await authFetch(`/api/grupos/${grupoSeleccionado.id}/estudiantes`, {
        method: 'POST',
        body: JSON.stringify({ estudianteId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo agregar el estudiante.');

      setGrupos((current) => current.map((grupo) => (
        grupo.id === data.grupo.id ? data.grupo : grupo
      )));
      setGrupoSeleccionado(data.grupo);
      setBusquedaAgregar('');
    } catch (err) {
      alert(`[!] STUDENT_ENROLLMENT_ERROR: ${err.message}`);
    } finally {
      setAgregandoId(null);
    }
  };

  if (loading) {
    return (
      <div className="font-mono-label text-primary animate-pulse text-[12px] py-12 text-center">
        &gt;&gt; CONNECTING_PROFESSOR_NEURAL_LINK...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-error/40 bg-error-container/10 font-mono-label text-[12px] text-on-error flex items-center gap-2">
        <span className="material-symbols-outlined">warning</span> [!] SYSTEM_ERROR: {error}
      </div>
    );
  }

  if (grupos.length === 0) {
    return (
      <div className="border border-orange-400/30 bg-surface-container-low/40 p-10 backdrop-blur-md text-center shadow-[0_0_20px_rgba(251,146,60,0.1)]">
        <span className="material-symbols-outlined text-orange-400 text-[56px] mb-3 block opacity-80 animate-pulse">
          school
        </span>
        <h3 className="font-display text-[24px] text-primary uppercase font-bold mb-2">
          Sin Grupos Asignados
        </h3>
        <p className="font-mono-label text-on-surface-variant text-[13px] max-w-md mx-auto">
          No tienes asignaciones de grupo registradas en la red. Contacta al Administrador del sistema para dar de alta una clase.
        </p>
      </div>
    );
  }

  const estudiantesGrupo = grupoSeleccionado?.estudiantes || [];
  const estudiantesNoInscritos = estudiantesDisponibles.filter((estudiante) => (
    !estudiantesGrupo.some((inscrito) => inscrito.id === estudiante.id)
  ));
  const candidatosEncontrados = busquedaAgregar.trim() === '' ? [] : estudiantesNoInscritos.filter((estudiante) => {
    const termino = busquedaAgregar.toLowerCase();
    return estudiante.nombre?.toLowerCase().includes(termino) || estudiante.correo?.toLowerCase().includes(termino);
  });

  // Filtrar estudiantes por búsqueda
  const estudiantesFiltrados = estudiantesGrupo.filter((e) => {
    const term = busqueda.toLowerCase();
    return (
      e.nombre?.toLowerCase().includes(term) ||
      e.correo?.toLowerCase().includes(term) ||
      String(e.id).includes(term)
    );
  });

  // Mapear métricas por estudiante
  const datosEstudiantes = estudiantesFiltrados.map((estudiante) => {
    const partidasEst = partidas.filter(
      (p) => p.usuarioId === estudiante.id || p.username?.toLowerCase() === estudiante.correo?.toLowerCase()
    );
    const ultimaPartida = partidasEst.length > 0 ? partidasEst[partidasEst.length - 1] : null;

    let totalScore = 0;
    if (ultimaPartida && typeof ultimaPartida.stage === 'object') {
      const stage = ultimaPartida.stage;
      ['abstraccion', 'pensamiento_computacional', 'descomposicion', 'reconocimiento_patrones'].forEach((zona) => {
        ['n1', 'n2', 'n3', 'n4'].forEach((nivel) => {
          totalScore += stage?.[zona]?.[nivel]?.puntaje || 0;
        });
      });
    }

    return {
      estudiante,
      partidas: partidasEst,
      totalScore,
      ultimaPartida
    };
  });

  // Cálculo de promedio general del grupo
  const puntajeTotalGrupo = datosEstudiantes.reduce((acc, curr) => acc + curr.totalScore, 0);
  const promedioPuntaje = datosEstudiantes.length > 0 ? Math.round(puntajeTotalGrupo / datosEstudiantes.length) : 0;

  return (
    <div className="space-y-8">
      {/* Barra de Selección de Grupo y Resumen */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-surface-container-low/60 border border-orange-400/30 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-orange-400 text-[28px]">cast_for_education</span>
          <div>
            <span className="font-mono-label text-[10px] text-orange-400 uppercase font-bold tracking-widest block">
              // CLASE_ACTIVA
            </span>
            <span className="font-display text-[20px] text-primary font-bold">
              {grupoSeleccionado?.codigo} - {grupoSeleccionado?.nombre || 'Sin nombre'}
            </span>
          </div>
        </div>

        {/* Botones de Selección */}
        <div className="flex flex-wrap items-center gap-2">
          {grupos.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                setGrupoSeleccionado(g);
                setBusqueda('');
                setBusquedaAgregar('');
              }}
              className={`px-3 py-1.5 font-mono-label text-[11px] uppercase font-bold transition-all cursor-pointer border ${
                grupoSeleccionado?.id === g.id
                  ? 'bg-orange-400 text-black border-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.4)]'
                  : 'border-orange-400/30 text-orange-400 hover:bg-orange-400/10'
              }`}
            >
              {g.codigo}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-orange-400/30 bg-surface-container-low/40 p-6 backdrop-blur-md space-y-4">
        <div>
          <h3 className="font-mono-label text-orange-400 text-[13px] font-bold uppercase tracking-wider">
            // AGREGAR_ESTUDIANTES_AL_GRUPO
          </h3>
          <p className="font-mono-label text-[11px] text-on-surface-variant/60 mt-1">
            Busca un estudiante y agrégalo a {grupoSeleccionado?.codigo}.
          </p>
        </div>
        <div className="relative max-w-xl">
          <input
            type="search"
            value={busquedaAgregar}
            onChange={(e) => setBusquedaAgregar(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full bg-surface-container border border-orange-400/30 px-3 py-2 pr-9 font-mono-label text-[12px] text-on-surface focus:outline-none focus:border-orange-400 transition-all"
          />
          <span className="material-symbols-outlined text-[16px] text-orange-400 absolute right-3 top-2.5">search</span>
        </div>
        {busquedaAgregar.trim() !== '' && (
          <div className="max-w-xl border border-orange-400/20 divide-y divide-orange-400/10">
            {candidatosEncontrados.length === 0 ? (
              <div className="p-3 font-mono-label text-[11px] text-on-surface-variant/60">No hay estudiantes disponibles que coincidan.</div>
            ) : candidatosEncontrados.map((estudiante) => (
              <div key={estudiante.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="text-[13px] text-on-surface font-bold truncate">{estudiante.nombre || 'Estudiante'}</div>
                  <div className="font-mono-label text-[11px] text-primary truncate">{estudiante.correo}</div>
                </div>
                <button
                  type="button"
                  onClick={() => agregarEstudiante(estudiante.id)}
                  disabled={agregandoId === estudiante.id}
                  className="shrink-0 px-3 py-1.5 border border-orange-400/50 text-orange-400 text-[10px] uppercase font-bold hover:bg-orange-400 hover:text-black disabled:opacity-50 transition-all cursor-pointer"
                >
                  {agregandoId === estudiante.id ? 'Agregando...' : 'Agregar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tarjetas de Métricas Ejecutivas del Grupo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border border-primary/30 bg-surface-container-low/40 p-4 backdrop-blur-md relative overflow-hidden">
          <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Estudiantes Enrolados</div>
          <div className="font-display text-[28px] text-primary font-bold mt-1">
            {estudiantesGrupo.length}
          </div>
          <div className="font-mono-label text-[10px] text-primary/60 mt-1 uppercase">&gt;&gt; ACTIVE_STUDENTS</div>
        </div>

        <div className="border border-secondary/30 bg-surface-container-low/40 p-4 backdrop-blur-md relative overflow-hidden">
          <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Promedio del Grupo</div>
          <div className="font-display text-[28px] text-secondary font-bold mt-1">
            {promedioPuntaje} <span className="text-[14px]">pts</span>
          </div>
          <div className="font-mono-label text-[10px] text-secondary/60 mt-1 uppercase">&gt;&gt; AVERAGE_SCORE</div>
        </div>

        <div className="border border-orange-400/30 bg-surface-container-low/40 p-4 backdrop-blur-md relative overflow-hidden">
          <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Partidas Registradas</div>
          <div className="font-display text-[28px] text-orange-400 font-bold mt-1">
            {partidas.length}
          </div>
          <div className="font-mono-label text-[10px] text-orange-400/60 mt-1 uppercase">&gt;&gt; TOTAL_MATCHES</div>
        </div>
      </div>

      {/* Competencias Evaluadas - Barras Visuales */}
      <div className="border border-primary/30 bg-surface-container-low/40 p-6 backdrop-blur-md space-y-4">
        <h3 className="font-mono-label text-primary text-[12px] font-bold uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 bg-primary animate-pulse"></span> // COMPETENCIAS_COMPUTACIONALES_EVALUADAS
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COMPETENCIAS.map(({ key, label, color, text, border }) => (
            <div key={key} className={`border ${border} bg-surface-container/40 p-4`}>
              <div className="font-mono-label text-[11px] font-bold uppercase mb-2 text-on-surface">{label}</div>
              <div className="w-full bg-surface-container-high h-2 rounded-none overflow-hidden border border-primary/20">
                <div className={`${color} h-full w-3/4 animate-pulse`}></div>
              </div>
              <div className={`font-mono-label text-[10px] ${text} mt-2 text-right uppercase`}>Nivel Optimo</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de Estudiantes y Telemetría Detallada */}
      <div className="border border-primary/30 bg-surface-container-low/40 p-6 backdrop-blur-md space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-primary/20 pb-4">
          <div>
            <h3 className="font-mono-label text-primary text-[13px] font-bold uppercase tracking-wider">
              // TELEMETRIA_Y_EXPEDIENTE_DE_ALUMNOS
            </h3>
            <p className="font-mono-label text-[11px] text-on-surface-variant/60">
              Desglose individual de rendimiento del grupo {grupoSeleccionado?.codigo}
            </p>
          </div>

          {/* Buscador Rápido de Estudiantes */}
          <div className="w-full sm:w-64 relative">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar alumno..."
              className="w-full bg-surface-container border border-primary/30 px-3 py-2 font-mono-label text-[12px] text-on-surface focus:outline-none focus:border-primary transition-all"
            />
            <span className="material-symbols-outlined text-[16px] text-primary absolute right-2 top-2.5">
              search
            </span>
          </div>
        </div>

        {datosEstudiantes.length === 0 ? (
          <div className="text-center py-8 font-mono-label text-[12px] text-on-surface-variant/50">
            No se encontraron alumnos que coincidan con la búsqueda.
          </div>
        ) : (
          <div className="space-y-4">
            {datosEstudiantes.map(({ estudiante, partidas: pList, totalScore }) => (
              <div
                key={estudiante.id}
                className="border border-primary/20 bg-surface-container/40 p-4 space-y-3 hover:border-primary/50 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 border border-primary/40 flex items-center justify-center bg-primary/10">
                      <span className="material-symbols-outlined text-primary text-[20px]">person</span>
                    </div>
                    <div>
                      <div className="font-bold text-on-surface text-[14px]">
                        {estudiante.nombre || 'Estudiante'}
                      </div>
                      <div className="font-mono-label text-[11px] text-primary">{estudiante.correo}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 font-mono-label text-[12px]">
                    <div className="text-right">
                      <div className="text-[10px] text-on-surface-variant uppercase">Puntaje Total</div>
                      <div className="font-bold text-secondary text-[16px]">{totalScore} pts</div>
                    </div>
                    <span className="px-3 py-1 bg-primary/10 border border-primary/40 text-primary text-[11px] uppercase font-bold">
                      {pList.length} Partidas
                    </span>
                  </div>
                </div>

                {/* Tabla de Partidas Recientes */}
                {pList.length > 0 && (
                  <div className="border-t border-primary/10 pt-3">
                    <div className="font-mono-label text-[10px] text-on-surface-variant uppercase mb-2">
                      Últimas Partidas Registradas:
                    </div>
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left font-mono-label text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-primary/10 text-primary uppercase text-[10px]">
                            <th className="py-1 px-2">ID Partida</th>
                            <th className="py-1 px-2">Estructura del Nivel</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pList.map((p) => (
                            <tr key={p.id} className="border-b border-primary/5 hover:bg-primary/5">
                              <td className="py-1.5 px-2 font-bold text-orange-400">
                                #{String(p.id).padStart(4, '0')}
                              </td>
                              <td className="py-1.5 px-2 font-mono text-[10px] text-on-surface-variant/90 truncate max-w-md">
                                {typeof p.stage === 'object' ? JSON.stringify(p.stage) : p.stage}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
