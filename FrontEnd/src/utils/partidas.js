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

export function formatearFechaCorta(fechaValor) {
  if (!fechaValor) return '—';
  const fecha = new Date(fechaValor);
  if (isNaN(fecha.getTime())) return '—';
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const anio = String(fecha.getFullYear()).slice(-2);
  return `${dia}/${mes}/${anio}`;
}

