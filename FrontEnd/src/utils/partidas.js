export function obtenerResultados(partida) {
  return (partida?.resultados || []).map((resultado) => ({
    id: resultado.id,
    nivelId: resultado.nivelId ?? resultado.nivel?.id,
    nivelClave: resultado.nivel?.clave,
    nivelNombre: resultado.nivel?.nombre || `Nivel ${resultado.nivel?.orden ?? ''}`.trim(),
    nivelOrden: resultado.nivel?.orden ?? 0,
    etapaClave: resultado.nivel?.etapa?.clave,
    etapaNombre: resultado.nivel?.etapa?.nombre || 'Etapa',
    etapaOrden: resultado.nivel?.etapa?.orden ?? 0,
    puntaje: Number(resultado.puntaje) || 0,
    tiempoSegundos: Number(resultado.tiempoSegundos) || 0,
  }));
}

export function agruparResultadosPorEtapa(partida) {
  const etapas = new Map();
  for (const resultado of obtenerResultados(partida)) {
    if (!etapas.has(resultado.etapaClave)) {
      etapas.set(resultado.etapaClave, {
        clave: resultado.etapaClave,
        nombre: resultado.etapaNombre,
        orden: resultado.etapaOrden,
        niveles: [],
      });
    }
    etapas.get(resultado.etapaClave).niveles.push(resultado);
  }
  return [...etapas.values()]
    .map((etapa) => ({
      ...etapa,
      niveles: etapa.niveles.sort((a, b) => a.nivelOrden - b.nivelOrden),
      puntajeTotal: etapa.niveles.reduce((total, nivel) => total + nivel.puntaje, 0),
    }))
    .sort((a, b) => a.orden - b.orden);
}

export function puntajeTotalPartida(partida) {
  return obtenerResultados(partida).reduce((total, resultado) => total + resultado.puntaje, 0);
}

export function tiempoTotalPartida(partida) {
  return obtenerResultados(partida).reduce((total, resultado) => total + resultado.tiempoSegundos, 0);
}

function ordenarPartidasCronologicamente(a, b) {
  const fechaA = new Date(a?.fecha || a?.createdAt || 0).getTime() || 0;
  const fechaB = new Date(b?.fecha || b?.createdAt || 0).getTime() || 0;
  if (fechaA !== fechaB) return fechaA - fechaB;
  return (Number(a?.id) || 0) - (Number(b?.id) || 0);
}

export function calcularEstadisticasGrupo(estudiantes = [], partidas = []) {
  const listaEstudiantes = Array.isArray(estudiantes) ? estudiantes : [];
  const listaPartidas = Array.isArray(partidas) ? partidas : [];

  const datosEstudiantes = listaEstudiantes.map((estudiante) => {
    const correoEst = estudiante?.correo?.toLowerCase();
    const partidasEst = listaPartidas
      .filter((p) => (
        (p?.usuarioId != null && estudiante?.id != null && Number(p.usuarioId) === Number(estudiante.id))
        || (correoEst && p?.username?.toLowerCase() === correoEst)
        || (correoEst && p?.usuario?.correo?.toLowerCase() === correoEst)
      ))
      .sort(ordenarPartidasCronologicamente);

    const ultimaPartida = partidasEst.length > 0 ? partidasEst[partidasEst.length - 1] : null;

    let mejorPartida = null;
    let mejorPuntaje = 0;
    let mejorTiempo = 0;

    for (const p of partidasEst) {
      const puntaje = puntajeTotalPartida(p);
      const tiempo = tiempoTotalPartida(p);
      if (
        !mejorPartida
        || puntaje > mejorPuntaje
        || (puntaje === mejorPuntaje && tiempo < mejorTiempo)
      ) {
        mejorPartida = p;
        mejorPuntaje = puntaje;
        mejorTiempo = tiempo;
      }
    }

    return {
      estudiante,
      partidas: partidasEst,
      totalPartidas: partidasEst.length,
      mejorPuntaje,
      mejorTiempo,
      mejorPartida,
      ultimaPartida,
    };
  });

  const partidasUnicasGrupo = new Set();
  for (const item of datosEstudiantes) {
    for (const p of item.partidas) {
      if (p?.id != null) partidasUnicasGrupo.add(p.id);
    }
  }
  const totalPartidasGrupo = partidasUnicasGrupo.size > 0
    ? partidasUnicasGrupo.size
    : datosEstudiantes.reduce((acc, item) => acc + item.totalPartidas, 0);

  const sumaMejores = datosEstudiantes.reduce((acc, item) => acc + item.mejorPuntaje, 0);
  const promedioGrupo = datosEstudiantes.length > 0
    ? Math.round(sumaMejores / datosEstudiantes.length)
    : 0;

  const rankingEstudiantes = [...datosEstudiantes]
    .sort((a, b) => {
      if (b.mejorPuntaje !== a.mejorPuntaje) return b.mejorPuntaje - a.mejorPuntaje;
      if (a.mejorPartida && b.mejorPartida && a.mejorTiempo !== b.mejorTiempo) {
        return a.mejorTiempo - b.mejorTiempo;
      }
      if (b.totalPartidas !== a.totalPartidas) return b.totalPartidas - a.totalPartidas;
      const nombreA = (a.estudiante?.nombre || a.estudiante?.correo || '').toLowerCase();
      const nombreB = (b.estudiante?.nombre || b.estudiante?.correo || '').toLowerCase();
      const cmp = nombreA.localeCompare(nombreB);
      if (cmp !== 0) return cmp;
      return (Number(a.estudiante?.id) || 0) - (Number(b.estudiante?.id) || 0);
    })
    .map((item, index) => ({
      ...item,
      posicion: index + 1,
    }));

  return {
    totalEstudiantes: listaEstudiantes.length,
    totalPartidasGrupo,
    promedioGrupo,
    datosEstudiantes,
    rankingEstudiantes,
  };
}

export function formatearFechaCorta(fechaValor) {
  if (!fechaValor) return '—';
  const fecha = new Date(fechaValor);
  if (isNaN(fecha.getTime())) return '—';
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const anio = String(fecha.getFullYear()).slice(-2);
  return `${dia}/${mes}/${anio}`;
}

