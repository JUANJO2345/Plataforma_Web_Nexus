const ZONAS = [
  { titulo: 'Abstracción', key: 'abstraccion', color: 'text-primary', border: 'border-primary/30' },
  { titulo: 'Pensamiento Computacional', key: 'pensamiento_computacional', color: 'text-secondary', border: 'border-secondary/30' },
  { titulo: 'Descomposición', key: 'descomposicion', color: 'text-orange-400', border: 'border-orange-400/30' },
  { titulo: 'Reconocimiento de Patrones', key: 'reconocimiento_patrones', color: 'text-pink-400', border: 'border-pink-400/30' },
];

function obtenerMetricsNivel(partida, zonaKey, nivelKey) {
  const nivel = partida.stage?.[zonaKey]?.[nivelKey];
  if (!nivel || (nivel.puntaje === 0 && nivel.tiempo_seg === 0)) return null;
  return nivel;
}

function TablaZona({ titulo, zonaKey, colorTexto, colorBorde, partidas, highlightUsername }) {
  const partidasOrdenadas = partidas
    .map((p) => {
      const n1 = obtenerMetricsNivel(p, zonaKey, 'n1');
      const n2 = obtenerMetricsNivel(p, zonaKey, 'n2');
      const n3 = obtenerMetricsNivel(p, zonaKey, 'n3');
      const n4 = obtenerMetricsNivel(p, zonaKey, 'n4');
      const puntajeTotalZona = (n1?.puntaje || 0) + (n2?.puntaje || 0) + (n3?.puntaje || 0) + (n4?.puntaje || 0);
      if (!n1 && !n2 && !n3 && !n4) return null;
      return { ...p, n1, n2, n3, n4, totalZona: puntajeTotalZona };
    })
    .filter(Boolean)
    .sort((a, b) => b.totalZona - a.totalZona);

  return (
    <div className={`border ${colorBorde} bg-surface-container-low/40 p-6 backdrop-blur-md relative shadow-[0_0_15px_rgba(0,0,0,0.2)]`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className={`font-mono-label ${colorTexto} text-[13px] font-bold uppercase tracking-wider`}>
          // ZONE_RANKING: {titulo}
        </h3>
        <span className="font-mono-label text-[10px] text-on-surface-variant/60 uppercase">
          Sorted by Top_Accumulated_Score
        </span>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left font-mono-label text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-primary/20 text-on-surface-variant uppercase text-[10px]">
              <th className="py-2 px-2 w-[5%] text-center">Pos</th>
              <th className="py-2 px-2 w-[25%]">Operador</th>
              <th className="py-2 px-2 text-center">Nivel 1 (Identificación)</th>
              <th className="py-2 px-2 text-center">Nivel 2 (Filtrado / Estructura)</th>
              <th className="py-2 px-2 text-center">Nivel 3 (Modelado / Bucles)</th>
              <th className="py-2 px-2 text-center">Nivel 4 (Avanzado)</th>
              <th className="py-2 px-2 text-right w-[12%]">Total Zona</th>
            </tr>
          </thead>
          <tbody>
            {partidasOrdenadas.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-4 text-center text-on-surface-variant/40 italic">
                  -- No se registran telemetrías en este sector --
                </td>
              </tr>
            ) : (
              partidasOrdenadas.map((p, index) => {
                const esTop3 = index < 3;
                const medalColor = index === 0 ? 'text-amber-400' : index === 1 ? 'text-slate-300' : 'text-amber-600';
                const esUsuarioActual = highlightUsername && p.username === highlightUsername;

                return (
                  <tr
                    key={p.id}
                    className={`border-b border-primary/5 transition-colors ${
                      esUsuarioActual
                        ? 'bg-primary/10 ring-1 ring-inset ring-primary/40'
                        : 'hover:bg-primary/5'
                    }`}
                  >
                    <td className="py-2.5 px-2 text-center font-bold">
                      <span className={esTop3 ? medalColor : 'text-on-surface-variant/50'}>
                        #{index + 1}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-bold text-on-surface truncate max-w-[120px]">
                      {p.username.split('@')[0]}
                      {esUsuarioActual && (
                        <span className="ml-1 text-[9px] text-primary uppercase">(Tú)</span>
                      )}
                    </td>
                    {['n1', 'n2', 'n3', 'n4'].map((nKey) => (
                      <td key={nKey} className="py-2.5 px-2 text-center">
                        {p[nKey] ? (
                          <div className="inline-block bg-surface-container px-2 py-0.5 border border-primary/10">
                            <span className={`${colorTexto} font-bold`}>{p[nKey].puntaje} pts</span>
                            <span className="text-[9px] text-on-surface-variant block opacity-75">{p[nKey].tiempo_seg}s</span>
                          </div>
                        ) : (
                          <span className="text-on-surface-variant/30 font-mono">--</span>
                        )}
                      </td>
                    ))}
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-on-surface">
                      <span className="bg-surface-container-high px-2 py-1 border-r-2 border-secondary">
                        {p.totalZona} pts
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LeaderboardTables({ partidas, highlightUsername }) {
  return (
    <div className="grid grid-cols-1 gap-6">
      {ZONAS.map(({ titulo, key, color, border }) => (
        <TablaZona
          key={key}
          titulo={titulo}
          zonaKey={key}
          colorTexto={color}
          colorBorde={border}
          partidas={partidas}
          highlightUsername={highlightUsername}
        />
      ))}
    </div>
  );
}
