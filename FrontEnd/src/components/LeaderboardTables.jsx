import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthStore';

const COLORES_ETAPA = [
  { texto: 'text-primary', borde: 'border-primary/30' },
  { texto: 'text-secondary', borde: 'border-secondary/30' },
  { texto: 'text-orange-400', borde: 'border-orange-400/30' },
  { texto: 'text-pink-400', borde: 'border-pink-400/30' },
];

function TablaEtapa({ etapa, partidas, highlightUsername, color }) {
  const filas = partidas.map((partida) => {
    const resultados = etapa.niveles.map((nivel) => (
      partida.resultados?.find((resultado) => resultado.nivelId === nivel.id) || null
    ));
    return {
      partida,
      resultados,
      total: resultados.reduce((suma, resultado) => suma + (resultado?.puntaje || 0), 0),
    };
  }).filter((fila) => fila.resultados.some(Boolean)).sort((a, b) => b.total - a.total);

  return (
    <section className={`border ${color.borde} bg-surface-container-low/40 p-5`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className={`font-mono-label ${color.texto} text-[13px] font-bold uppercase`}>{etapa.nombre}</h3>
        <span className="font-mono-label text-[10px] text-on-surface-variant/60">Puntaje acumulado por etapa</span>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left font-mono-label text-[11px] border-collapse">
          <thead><tr className="border-b border-primary/20 text-on-surface-variant uppercase text-[10px]">
            <th className="py-2 px-2 text-center">Pos</th><th className="py-2 px-2">Operador</th>
            {etapa.niveles.map((nivel) => <th key={nivel.id} className="py-2 px-2 text-center">{nivel.nombre}</th>)}
            <th className="py-2 px-2 text-right">Total</th>
          </tr></thead>
          <tbody>
            {filas.length === 0 ? <tr><td colSpan={etapa.niveles.length + 3} className="py-4 text-center text-on-surface-variant/40">Sin resultados en esta etapa.</td></tr> : filas.map(({ partida, resultados, total }, index) => {
              const esUsuario = highlightUsername && partida.username?.toLowerCase() === highlightUsername.toLowerCase();
              return <tr key={partida.id} className={`border-b border-primary/5 ${esUsuario ? 'bg-primary/10' : 'hover:bg-primary/5'}`}>
                <td className="py-2 px-2 text-center">#{index + 1}</td>
                <td className="py-2 px-2 font-bold text-on-surface">{partida.username?.split('@')[0] || 'Usuario'}</td>
                {resultados.map((resultado, resultadoIndex) => <td key={etapa.niveles[resultadoIndex].id} className="py-2 px-2 text-center">
                  {resultado ? <><span className={`${color.texto} font-bold`}>{resultado.puntaje} pts</span><span className="block text-[9px] text-on-surface-variant">{resultado.tiempoSegundos}s</span></> : <span className="text-on-surface-variant/30">—</span>}
                </td>)}
                <td className="py-2 px-2 text-right font-bold">{total} pts</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function LeaderboardTables({ partidas, highlightUsername, grupoId = null, mostrarFiltro = true }) {
  const { authFetch } = useAuth();
  const [grupos, setGrupos] = useState([]);
  const [etapas, setEtapas] = useState([]);
  const [grupoIdSeleccionado, setGrupoIdSeleccionado] = useState(grupoId || 'global');

  useEffect(() => {
    if (grupoId !== null && grupoId !== undefined) {
      setGrupoIdSeleccionado(grupoId);
    }
  }, [grupoId]);

  useEffect(() => {
    Promise.all([authFetch('/api/grupos'), authFetch('/api/partidas/catalogo')])
      .then(async ([resGrupos, resCatalogo]) => {
        if (resGrupos.ok) setGrupos(await resGrupos.json());
        if (resCatalogo.ok) {
          const data = await resCatalogo.json();
          setEtapas(data.map((etapa) => ({ ...etapa, niveles: [...etapa.niveles].sort((a, b) => a.orden - b.orden) })).sort((a, b) => a.orden - b.orden));
        }
      })
      .catch((error) => console.error('Error al cargar catálogos de clasificación:', error));
  }, [authFetch]);

  const partidasFiltradas = grupoIdSeleccionado === 'global' ? partidas : (() => {
    const grupo = grupos.find((item) => String(item.id) === String(grupoIdSeleccionado));
    if (!grupo?.estudiantes) return [];
    const ids = grupo.estudiantes.map((estudiante) => estudiante.id);
    const correos = grupo.estudiantes.map((estudiante) => estudiante.correo?.toLowerCase());
    return partidas.filter((partida) => ids.includes(partida.usuarioId) || correos.includes(partida.username?.toLowerCase()));
  })();

  return (
    <div className="space-y-6">
      {mostrarFiltro && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-low/60 border border-primary/30 p-4 font-mono-label">
          <span className="text-primary font-bold text-[12px] uppercase">Filtro de clasificación</span>
          <label className="flex items-center gap-3 text-[11px] text-on-surface-variant uppercase">Grupo
            <select value={grupoIdSeleccionado} onChange={(event) => setGrupoIdSeleccionado(event.target.value)} className="bg-surface-container border border-primary/30 px-3 py-1.5 text-primary">
              <option value="global">Clasificación global</option>
              {grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.codigo} · {grupo.nombre || 'Sin nombre'}</option>)}
            </select>
          </label>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6">
        {etapas.map((etapa, index) => <TablaEtapa key={etapa.id} etapa={etapa} partidas={partidasFiltradas} highlightUsername={highlightUsername} color={COLORES_ETAPA[index % COLORES_ETAPA.length]} />)}
        {etapas.length === 0 && <div className="text-on-surface-variant text-sm">Cargando etapas...</div>}
      </div>
    </div>
  );
}
