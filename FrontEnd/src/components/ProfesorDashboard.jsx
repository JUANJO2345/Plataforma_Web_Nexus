import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthStore';
import { puntajeTotalPartida, agruparResultadosPorEtapa } from '../utils/partidas';

const COLORES_ETAPA = [
  { color: 'text-primary', border: 'border-primary/30', bg: 'bg-primary/10' },
  { color: 'text-secondary', border: 'border-secondary/30', bg: 'bg-secondary/10' },
  { color: 'text-orange-400', border: 'border-orange-400/30', bg: 'bg-orange-400/10' },
  { color: 'text-pink-400', border: 'border-pink-400/30', bg: 'bg-pink-400/10' },
];

export default function ProfesorDashboard() {
  const { user, authFetch } = useAuth();
  const [grupos, setGrupos] = useState([]);
  const [partidas, setPartidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);
  
  // Búsqueda e inspección de estudiante
  const [busqueda, setBusqueda] = useState('');
  const [estudianteInspeccionadoId, setEstudianteInspeccionadoId] = useState(null);
  const [partidaSeleccionadaId, setPartidaSeleccionadaId] = useState(null);

  // Gestión de inscripción de estudiantes
  const [mostrarInscripcion, setMostrarInscripcion] = useState(false);
  const [estudiantesDisponibles, setEstudiantesDisponibles] = useState([]);
  const [busquedaAgregar, setBusquedaAgregar] = useState('');
  const [agregandoId, setAgregandoId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [resGrupos, resPartidas, resUsuarios] = await Promise.all([
          authFetch(`/api/grupos?profesorId=${user.id}`),
          authFetch('/api/partidas'),
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

  // Cambiar grupo resetea selección e inspección
  const cambiarGrupo = (grupo) => {
    setGrupoSeleccionado(grupo);
    setEstudianteInspeccionadoId(null);
    setPartidaSeleccionadaId(null);
    setBusqueda('');
    setBusquedaAgregar('');
  };

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

  // Mapear cada estudiante con sus partidas y puntaje
  const datosEstudiantes = estudiantesGrupo.map((estudiante) => {
    const partidasEst = partidas.filter(
      (p) => p.usuarioId === estudiante.id || p.username?.toLowerCase() === estudiante.correo?.toLowerCase()
    );
    const ultimaPartida = partidasEst.length > 0 ? partidasEst[partidasEst.length - 1] : null;
    const totalScore = puntajeTotalPartida(ultimaPartida);

    return {
      estudiante,
      partidas: partidasEst,
      totalScore,
      ultimaPartida
    };
  });

  // Métricas del grupo actual
  const totalPartidasGrupo = datosEstudiantes.reduce((acc, curr) => acc + curr.partidas.length, 0);
  const puntajeTotalGrupo = datosEstudiantes.reduce((acc, curr) => acc + curr.totalScore, 0);
  const promedioPuntaje = datosEstudiantes.length > 0 ? Math.round(puntajeTotalGrupo / datosEstudiantes.length) : 0;

  // Filtrado por buscador
  const terminoBusqueda = busqueda.trim().toLowerCase();
  const estudiantesFiltrados = datosEstudiantes.filter(({ estudiante }) => {
    if (!terminoBusqueda) return true;
    return (
      estudiante.nombre?.toLowerCase().includes(terminoBusqueda) ||
      estudiante.correo?.toLowerCase().includes(terminoBusqueda) ||
      String(estudiante.id).includes(terminoBusqueda)
    );
  });

  // Estudiantes para inscribir
  const estudiantesNoInscritos = estudiantesDisponibles.filter((estudiante) => (
    !estudiantesGrupo.some((inscrito) => inscrito.id === estudiante.id)
  ));
  const candidatosEncontrados = busquedaAgregar.trim() === '' ? [] : estudiantesNoInscritos.filter((estudiante) => {
    const termino = busquedaAgregar.toLowerCase();
    return estudiante.nombre?.toLowerCase().includes(termino) || estudiante.correo?.toLowerCase().includes(termino);
  });

  // Estudiante actualmente inspeccionado
  const estudianteInspeccionado = estudianteInspeccionadoId
    ? datosEstudiantes.find((d) => d.estudiante.id === estudianteInspeccionadoId)
    : null;

  // Partida a mostrar del estudiante inspeccionado
  const partidaInspeccionada = estudianteInspeccionado?.partidas.length > 0
    ? (partidaSeleccionadaId
        ? estudianteInspeccionado.partidas.find((p) => p.id === partidaSeleccionadaId) || estudianteInspeccionado.ultimaPartida
        : estudianteInspeccionado.ultimaPartida)
    : null;

  const etapasPartidaInspeccionada = partidaInspeccionada ? agruparResultadosPorEtapa(partidaInspeccionada) : [];
  const totalGeneralInspeccionado = etapasPartidaInspeccionada.reduce((tot, et) => tot + et.puntajeTotal, 0);

  return (
    <div className="space-y-8">
      {/* 1. SEPARACIÓN POR GRUPOS: Barra de Pestañas de Grupos */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <span className="font-mono-label text-[11px] text-orange-400 uppercase font-bold tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-400 animate-pulse"></span>
              // GESTION_DE_GRUPOS_ASIGNADOS
            </span>
            <p className="font-mono-label text-[11px] text-on-surface-variant/70">
              Selecciona un grupo para consultar su rendimiento y registros de estudiantes.
            </p>
          </div>

          <Link
            to="/profesor/ia"
            className="flex items-center gap-2 px-3.5 py-1.5 font-mono-label text-[11px] uppercase font-bold border border-primary bg-primary/10 text-primary hover:bg-primary/20 hover:shadow-[0_0_12px_rgba(0,220,230,0.4)] transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">smart_toy</span>
            <span>Contenido con IA</span>
          </Link>
        </div>

        {/* Pestañas de Navegación entre Grupos */}
        <div className="flex flex-wrap gap-2 border-b border-orange-400/20 pb-3">
          {grupos.map((g) => {
            const esActivo = grupoSeleccionado?.id === g.id;
            const cantAlumnos = g.estudiantes ? g.estudiantes.length : 0;
            return (
              <button
                key={g.id}
                onClick={() => cambiarGrupo(g)}
                className={`flex items-center gap-2.5 px-4 py-2 font-mono-label text-[12px] uppercase font-bold transition-all cursor-pointer border ${
                  esActivo
                    ? 'bg-orange-400 text-black border-orange-400 shadow-[0_0_15px_rgba(251,146,60,0.4)]'
                    : 'border-orange-400/30 text-orange-400 hover:bg-orange-400/10 hover:border-orange-400/60'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {esActivo ? 'folder_open' : 'folder'}
                </span>
                <span>{g.codigo}</span>
                <span className="opacity-70 font-normal text-[11px]">· {g.nombre || 'Sin nombre'}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-none font-mono ${
                  esActivo ? 'bg-black/30 text-white' : 'bg-orange-400/20 text-orange-400'
                }`}>
                  {cantAlumnos} {cantAlumnos === 1 ? 'alumno' : 'alumnos'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Tarjeta Resumen del Grupo Activo */}
      <div className="bg-surface-container-low/60 border border-orange-400/40 p-5 backdrop-blur-md space-y-4 shadow-[0_0_15px_rgba(251,146,60,0.08)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-400/10 border border-orange-400/40 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-orange-400 text-[28px]">school</span>
            </div>
            <div>
              <div className="font-mono-label text-[10px] text-orange-400 font-bold uppercase tracking-widest">
                // GRUPO_ACTIVO :: {grupoSeleccionado?.codigo}
              </div>
              <h2 className="font-display text-[22px] text-primary font-bold">
                {grupoSeleccionado?.nombre || 'Clase sin nombre registrado'}
              </h2>
            </div>
          </div>

          <button
            onClick={() => setMostrarInscripcion(!mostrarInscripcion)}
            className="flex items-center gap-2 px-3 py-1.5 font-mono-label text-[11px] uppercase font-bold border border-orange-400/50 text-orange-400 hover:bg-orange-400 hover:text-black transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">
              {mostrarInscripcion ? 'close' : 'person_add'}
            </span>
            <span>{mostrarInscripcion ? 'Cerrar Registro' : 'Inscribir Estudiante'}</span>
          </button>
        </div>

        {/* Panel Desplegable de Inscripción de Estudiantes */}
        {mostrarInscripcion && (
          <div className="border border-orange-400/30 bg-surface-container/60 p-4 space-y-3">
            <div>
              <h4 className="font-mono-label text-orange-400 text-[12px] font-bold uppercase">
                // AGREGAR_ESTUDIANTES_A_ESTE_GRUPO
              </h4>
              <p className="font-mono-label text-[11px] text-on-surface-variant/70">
                Busca un estudiante registrado por nombre o correo para enrolarlo en {grupoSeleccionado?.codigo}.
              </p>
            </div>
            <div className="relative max-w-xl">
              <input
                type="search"
                value={busquedaAgregar}
                onChange={(e) => setBusquedaAgregar(e.target.value)}
                placeholder="Buscar alumno por nombre o correo..."
                className="w-full bg-surface-container-high border border-orange-400/40 px-3 py-2 pr-9 font-mono-label text-[12px] text-on-surface focus:outline-none focus:border-orange-400 transition-all"
              />
              <span className="material-symbols-outlined text-[16px] text-orange-400 absolute right-3 top-2.5">search</span>
            </div>

            {busquedaAgregar.trim() !== '' && (
              <div className="max-w-xl border border-orange-400/30 bg-surface-container-low divide-y divide-orange-400/10">
                {candidatosEncontrados.length === 0 ? (
                  <div className="p-3 font-mono-label text-[11px] text-on-surface-variant/60">
                    No hay estudiantes disponibles que coincidan con la búsqueda.
                  </div>
                ) : (
                  candidatosEncontrados.map((estudiante) => (
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
                        {agregandoId === estudiante.id ? 'Inscribiendo...' : 'Inscribir'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Métricas Ejecutivas del Grupo Seleccionado */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="border border-primary/30 bg-surface-container/50 p-4">
            <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Estudiantes Enrolados</div>
            <div className="font-display text-[26px] text-primary font-bold mt-1">
              {estudiantesGrupo.length}
            </div>
            <div className="font-mono-label text-[10px] text-primary/60 mt-1 uppercase">&gt;&gt; ACTIVE_STUDENTS</div>
          </div>

          <div className="border border-secondary/30 bg-surface-container/50 p-4">
            <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Promedio del Grupo</div>
            <div className="font-display text-[26px] text-secondary font-bold mt-1">
              {promedioPuntaje} <span className="text-[13px]">pts</span>
            </div>
            <div className="font-mono-label text-[10px] text-secondary/60 mt-1 uppercase">&gt;&gt; AVERAGE_SCORE</div>
          </div>

          <div className="border border-orange-400/30 bg-surface-container/50 p-4">
            <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Partidas del Grupo</div>
            <div className="font-display text-[26px] text-orange-400 font-bold mt-1">
              {totalPartidasGrupo}
            </div>
            <div className="font-mono-label text-[10px] text-orange-400/60 mt-1 uppercase">&gt;&gt; GROUP_MATCHES</div>
          </div>
        </div>
      </div>

      {/* 3. BUSCADOR DE REGISTROS DE UN ESTUDIANTE EN CONCRETO */}
      <div className="border border-primary/30 bg-surface-container-low/60 p-5 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-mono-label text-primary text-[13px] font-bold uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">search</span>
              // BUSCAR_REGISTROS_DE_ESTUDIANTE
            </h3>
            <p className="font-mono-label text-[11px] text-on-surface-variant/70">
              Encuentra un estudiante en específico para visualizar su telemetría y partidas en formato completo.
            </p>
          </div>

          {estudianteInspeccionado && (
            <button
              onClick={() => {
                setEstudianteInspeccionadoId(null);
                setPartidaSeleccionadaId(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1 font-mono-label text-[11px] uppercase border border-on-surface-variant/40 text-on-surface-variant hover:text-primary hover:border-primary transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">arrow_back</span>
              Ver Todos los Alumnos
            </button>
          )}
        </div>

        {/* Input de Búsqueda */}
        <div className="relative">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
            }}
            placeholder="Buscar por nombre, correo o ID del estudiante..."
            className="w-full bg-surface-container border border-primary/40 px-4 py-2.5 pr-10 font-mono-label text-[12px] text-on-surface focus:outline-none focus:border-primary focus:shadow-[0_0_12px_rgba(0,220,230,0.3)] transition-all"
          />
          <span className="material-symbols-outlined text-[18px] text-primary absolute right-3 top-3">
            search
          </span>
        </div>

        {/* Resultados rápidos de sugerencia al escribir */}
        {terminoBusqueda && (
          <div className="font-mono-label text-[11px] text-on-surface-variant/70 flex items-center justify-between">
            <span>Resultados encontrados: <strong className="text-primary">{estudiantesFiltrados.length}</strong></span>
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="text-orange-400 hover:underline cursor-pointer"
              >
                Limpiar filtro
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. EXPEDIENTE DETALLADO DEL ESTUDIANTE SELECCIONADO (ESTILO DASHBOARD ESTUDIANTE) */}
      {estudianteInspeccionado ? (
        <div className="border-2 border-primary bg-surface-container-low/80 p-6 backdrop-blur-md space-y-6 shadow-[0_0_25px_rgba(0,220,230,0.2)]">
          {/* Cabecera del Estudiante Inspeccionado */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-primary/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 border border-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[28px]">badge</span>
              </div>
              <div>
                <span className="font-mono-label text-[10px] text-primary font-bold uppercase tracking-widest block">
                  // EXPEDIENTE_DE_TELEMETRIA_ACTIVO
                </span>
                <h3 className="font-display text-[22px] text-on-surface font-bold">
                  {estudianteInspeccionado.estudiante.nombre || 'Estudiante'}
                </h3>
                <span className="font-mono-label text-[11px] text-primary">
                  {estudianteInspeccionado.estudiante.correo} · ID #{estudianteInspeccionado.estudiante.id}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEstudianteInspeccionadoId(null);
                  setPartidaSeleccionadaId(null);
                }}
                className="px-3.5 py-1.5 font-mono-label text-[11px] uppercase font-bold border border-primary/40 text-primary hover:bg-primary/10 transition-all cursor-pointer"
              >
                Cerrar Expediente
              </button>
            </div>
          </div>

          {estudianteInspeccionado.partidas.length === 0 ? (
            /* Estado vacío: Sin partidas registradas */
            <div className="border border-primary/30 bg-surface-container/40 p-8 text-center space-y-2">
              <span className="material-symbols-outlined text-primary text-[48px] opacity-60 block mx-auto">
                sensors_off
              </span>
              <p className="font-mono-label text-on-surface-variant text-[13px]">
                Este estudiante aún no registra partidas en el sistema.
              </p>
              <p className="font-mono-label text-[11px] text-on-surface-variant/60">
                Los registros se sincronizarán automáticamente cuando el alumno complete una sesión de juego.
              </p>
            </div>
          ) : (
            /* TELEMETRÍA Y REGISTROS CON EL FORMATO EXACTO DEL DASHBOARD DE ESTUDIANTE */
            <div className="space-y-6">
              {/* Selector de Partida si tiene múltiples registros */}
              {estudianteInspeccionado.partidas.length > 1 && (
                <div className="bg-surface-container/60 border border-primary/20 p-3 space-y-2">
                  <div className="font-mono-label text-[10px] text-primary uppercase font-bold tracking-wider">
                    // HISTORIAL_DE_PARTIDAS_DISPONIBLES:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {estudianteInspeccionado.partidas.map((p, idx) => {
                      const esSeleccionada = (partidaInspeccionada?.id === p.id);
                      const puntajeP = puntajeTotalPartida(p);
                      return (
                        <button
                          key={p.id}
                          onClick={() => setPartidaSeleccionadaId(p.id)}
                          className={`px-3 py-1 font-mono-label text-[11px] cursor-pointer transition-all border ${
                            esSeleccionada
                              ? 'bg-primary text-black border-primary font-bold shadow-[0_0_10px_rgba(0,220,230,0.5)]'
                              : 'bg-surface-container-high border-primary/30 text-on-surface hover:border-primary'
                          }`}
                        >
                          Partida #{String(p.id).padStart(4, '0')} · {puntajeP} pts
                          {idx === estudianteInspeccionado.partidas.length - 1 && ' (Última)'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3 Tarjetas de Resumen (Idéntico a EstudianteDashboard) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border border-primary/30 bg-surface-container/50 p-4 backdrop-blur-md">
                  <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Estudiante</div>
                  <div className="font-display text-[20px] text-primary font-bold mt-1 truncate">
                    {estudianteInspeccionado.estudiante.nombre || estudianteInspeccionado.estudiante.correo.split('@')[0]}
                  </div>
                </div>

                <div className="border border-secondary/30 bg-surface-container/50 p-4 backdrop-blur-md">
                  <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">
                    Puntaje Total {partidaInspeccionada?.id ? `(Partida #${String(partidaInspeccionada.id).padStart(4, '0')})` : ''}
                  </div>
                  <div className="font-display text-[20px] text-secondary font-bold mt-1">
                    {totalGeneralInspeccionado} pts
                  </div>
                </div>

                <div className="border border-orange-400/30 bg-surface-container/50 p-4 backdrop-blur-md">
                  <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Total Partidas Jugadas</div>
                  <div className="font-display text-[20px] text-orange-400 font-bold mt-1">
                    {estudianteInspeccionado.partidas.length}
                  </div>
                </div>
              </div>

              {/* Desglose por Etapas y Niveles con Tarjetas Cyberpunk (Idéntico a EstudianteDashboard) */}
              <div className="space-y-3">
                <div className="font-mono-label text-[11px] text-primary uppercase font-bold tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary animate-pulse"></span>
                  // DESGLOSE_DE_COMPETENCIAS_POR_ETAPA
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {etapasPartidaInspeccionada.map((etapa, index) => {
                    const { color, border } = COLORES_ETAPA[index % COLORES_ETAPA.length];
                    return (
                      <div key={etapa.clave} className={`border ${border} bg-surface-container/40 p-6 backdrop-blur-md`}>
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

              {/* Registro Histórico Completo de Partidas del Alumno */}
              <div className="border border-primary/20 bg-surface-container/40 p-4 space-y-3">
                <div className="font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
                  Historial Cronológico de Partidas del Alumno:
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left font-mono-label text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-primary/20 text-primary uppercase text-[10px]">
                        <th className="py-2 px-3">Partida</th>
                        <th className="py-2 px-3">Puntaje Total</th>
                        <th className="py-2 px-3">Detalle por Nivel</th>
                        <th className="py-2 px-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estudianteInspeccionado.partidas.map((p) => {
                        const puntajeP = puntajeTotalPartida(p);
                        const esSeleccionada = (partidaInspeccionada?.id === p.id);
                        return (
                          <tr
                            key={p.id}
                            className={`border-b border-primary/5 transition-all ${
                              esSeleccionada ? 'bg-primary/10' : 'hover:bg-primary/5'
                            }`}
                          >
                            <td className="py-2 px-3 font-bold text-orange-400">
                              #{String(p.id).padStart(4, '0')}
                            </td>
                            <td className="py-2 px-3 font-bold text-secondary">
                              {puntajeP} pts
                            </td>
                            <td className="py-2 px-3 font-mono text-[10px] text-on-surface-variant max-w-md">
                              {(p.resultados || [])
                                .map((r) => `${r.nivel?.etapa?.nombre || 'E'} · ${r.nivel?.nombre || 'N'}: ${r.puntaje}pts (${r.tiempoSegundos}s)`)
                                .join(' | ') || 'Sin niveles'}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                onClick={() => setPartidaSeleccionadaId(p.id)}
                                className={`px-2 py-0.5 text-[10px] font-mono uppercase font-bold border transition-all cursor-pointer ${
                                  esSeleccionada
                                    ? 'border-primary bg-primary text-black'
                                    : 'border-primary/30 text-primary hover:bg-primary/10'
                                }`}
                              >
                                {esSeleccionada ? 'Viendo' : 'Ver Nivel'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* 5. LISTA DE ALUMNOS DEL GRUPO (EXPEDIENTE GENERAL) */}
      <div className="border border-primary/30 bg-surface-container-low/40 p-6 backdrop-blur-md space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-primary/20 pb-4">
          <div>
            <h3 className="font-mono-label text-primary text-[13px] font-bold uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">group</span>
              // NOMINA_Y_EXPEDIENTES_DEL_GRUPO :: {grupoSeleccionado?.codigo}
            </h3>
            <p className="font-mono-label text-[11px] text-on-surface-variant/60">
              {estudiantesFiltrados.length} estudiantes registrados en esta nómina. Haz clic en "Ver Registros" para inspeccionar su telemetría.
            </p>
          </div>
        </div>

        {estudiantesFiltrados.length === 0 ? (
          <div className="text-center py-10 font-mono-label text-[12px] text-on-surface-variant/60 space-y-2">
            <span className="material-symbols-outlined text-[36px] opacity-40 block mx-auto">person_search</span>
            <div>No se encontraron estudiantes que coincidan con "{busqueda}".</div>
          </div>
        ) : (
          <div className="space-y-4">
            {estudiantesFiltrados.map(({ estudiante, partidas: pList, totalScore, ultimaPartida }) => {
              const estaInspeccionado = estudianteInspeccionadoId === estudiante.id;
              return (
                <div
                  key={estudiante.id}
                  className={`border transition-all p-4 space-y-3 ${
                    estaInspeccionado
                      ? 'border-primary bg-primary/5 shadow-[0_0_15px_rgba(0,220,230,0.15)]'
                      : 'border-primary/20 bg-surface-container/40 hover:border-primary/50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 border border-primary/40 flex items-center justify-center bg-primary/10">
                        <span className="material-symbols-outlined text-primary text-[20px]">person</span>
                      </div>
                      <div>
                        <div className="font-bold text-on-surface text-[14px]">
                          {estudiante.nombre || 'Estudiante'}
                        </div>
                        <div className="font-mono-label text-[11px] text-primary">
                          {estudiante.correo} · ID #{estudiante.id}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 font-mono-label text-[12px]">
                      <div className="text-right">
                        <div className="text-[10px] text-on-surface-variant uppercase">Puntaje Total</div>
                        <div className="font-bold text-secondary text-[16px]">{totalScore} pts</div>
                      </div>

                      <span className="px-3 py-1 bg-primary/10 border border-primary/40 text-primary text-[11px] uppercase font-bold">
                        {pList.length} {pList.length === 1 ? 'Partida' : 'Partidas'}
                      </span>

                      {/* Botón para ver registros como en el dashboard del estudiante */}
                      <button
                        onClick={() => {
                          setEstudianteInspeccionadoId(estudiante.id);
                          setPartidaSeleccionadaId(ultimaPartida?.id || null);
                          window.scrollTo({ top: 380, behavior: 'smooth' });
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 font-mono-label text-[11px] uppercase font-bold border transition-all cursor-pointer ${
                          estaInspeccionado
                            ? 'bg-primary text-black border-primary'
                            : 'border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-black shadow-[0_0_8px_rgba(251,146,60,0.2)]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">analytics</span>
                        <span>{estaInspeccionado ? 'Expediente Abierto' : 'Ver Registros'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Vista rápida de última partida */}
                  {ultimaPartida && (
                    <div className="border-t border-primary/10 pt-2 flex flex-col sm:flex-row justify-between text-[11px] font-mono-label text-on-surface-variant/80 gap-2">
                      <div>
                        Última Partida: <span className="text-orange-400 font-bold">#{String(ultimaPartida.id).padStart(4, '0')}</span>
                        {ultimaPartida.resultados && (
                          <span className="ml-2 opacity-70">
                            ({ultimaPartida.resultados.length} niveles superados)
                          </span>
                        )}
                      </div>
                      <div className="text-primary text-[10px]">
                        Haz clic en "Ver Registros" para ver el desglose por competencias y niveles
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
