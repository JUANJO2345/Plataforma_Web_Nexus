import React, { useState, useEffect } from 'react';

export default function DashboardHome() {
  const [partidas, setPartidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar las partidas desde el backend de SQLite
  useEffect(() => {
    const fetchPartidas = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/partidas');
        if (!res.ok) throw new Error('No se pudo establecer enlace con la telemetría central.');
        const data = await res.json();
        setPartidas(data);
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
        &gt; RENDERIZING_MATRIX_LEADERBOARDS...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-error/30 bg-error-container/10 font-mono-label text-[12px] text-on-error">
        [!] CRITICAL_DASHBOARD_ERROR: {error}
      </div>
    );
  }

  // Helper para extraer los datos de un operador en una zona y nivel específicos
  const obtenerMetricsNivel = (partida, zonaKey, nivelKey) => {
    const zona = partida.stage?.[zonaKey];
    const nivel = zona?.[nivelKey];
    
    // Si no tiene puntaje ni tiempo, asumimos que no ha iniciado
    if (!nivel || (nivel.puntaje === 0 && nivel.tiempo_seg === 0)) {
      return null;
    }
    return nivel;
  };

  // Función interna para generar la tabla HUD de cada Dimensión Cognitiva ordenada de mayor a menor
  const renderTablaZona = (titulo, zonaKey, colorTexto, colorBorde) => {
    
    // PROCESAR Y ORDENAR PARTIDAS DE MAYOR A MENOR SEGÚN EL TOTAL DE LA ZONA
    const partidasOrdenadas = partidas
      .map(p => {
        const n1 = obtenerMetricsNivel(p, zonaKey, 'n1');
        const n2 = obtenerMetricsNivel(p, zonaKey, 'n2');
        const n3 = obtenerMetricsNivel(p, zonaKey, 'n3');
        const n4 = obtenerMetricsNivel(p, zonaKey, 'n4');

        // Calcular el puntaje total acumulado en esta zona específica
        const puntajeTotalZona = 
          (n1?.puntaje || 0) + 
          (n2?.puntaje || 0) + 
          (n3?.puntaje || 0) + 
          (n4?.puntaje || 0);

        // Si no tiene registros en ningún nivel de esta zona, devolvemos null para filtrarlo
        if (!n1 && !n2 && !n3 && !n4) return null;

        return { ...p, n1, n2, n3, n4, totalZona: puntajeTotalZona };
      })
      .filter(Boolean) // Eliminar los operadores que no han jugado en esta zona
      // Ordenar de mayor a menor por el puntaje acumulado
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
                  // Resaltar los 3 primeros puestos con un estilo cyberpunk
                  const esTop3 = index < 3;
                  const medalColor = index === 0 ? 'text-amber-400' : index === 1 ? 'text-slate-300' : 'text-amber-600';

                  return (
                    <tr key={p.id} className="border-b border-primary/5 hover:bg-primary/5 transition-colors">
                      {/* Posición en el Ranking */}
                      <td className="py-2.5 px-2 text-center font-bold">
                        <span className={esTop3 ? medalColor : 'text-on-surface-variant/50'}>
                          #{index + 1}
                        </span>
                      </td>

                      {/* Nombre Operador */}
                      <td className="py-2.5 px-2 font-bold text-on-surface truncate max-w-[120px]">
                        {p.username.split('@')[0]}
                      </td>
                      
                      {/* Nivel 1 */}
                      <td className="py-2.5 px-2 text-center">
                        {p.n1 ? (
                          <div className="inline-block bg-surface-container px-2 py-0.5 border border-primary/10">
                            <span className={`${colorTexto} font-bold`}>{p.n1.puntaje} pts</span>
                            <span className="text-[9px] text-on-surface-variant block opacity-75">{p.n1.tiempo_seg}s</span>
                          </div>
                        ) : (
                          <span className="text-on-surface-variant/30 font-mono">--</span>
                        )}
                      </td>

                      {/* Nivel 2 */}
                      <td className="py-2.5 px-2 text-center">
                        {p.n2 ? (
                          <div className="inline-block bg-surface-container px-2 py-0.5 border border-primary/10">
                            <span className={`${colorTexto} font-bold`}>{p.n2.puntaje} pts</span>
                            <span className="text-[9px] text-on-surface-variant block opacity-75">{p.n2.tiempo_seg}s</span>
                          </div>
                        ) : (
                          <span className="text-on-surface-variant/30 font-mono">--</span>
                        )}
                      </td>

                      {/* Nivel 3 */}
                      <td className="py-2.5 px-2 text-center">
                        {p.n3 ? (
                          <div className="inline-block bg-surface-container px-2 py-0.5 border border-primary/10">
                            <span className={`${colorTexto} font-bold`}>{p.n3.puntaje} pts</span>
                            <span className="text-[9px] text-on-surface-variant block opacity-75">{p.n3.tiempo_seg}s</span>
                          </div>
                        ) : (
                          <span className="text-on-surface-variant/30 font-mono">--</span>
                        )}
                      </td>

                      {/* Nivel 4 */}
                      <td className="py-2.5 px-2 text-center">
                        {p.n4 ? (
                          <div className="inline-block bg-surface-container px-2 py-0.5 border border-primary/10">
                            <span className={`${colorTexto} font-bold`}>{p.n4.puntaje} pts</span>
                            <span className="text-[9px] text-on-surface-variant block opacity-75">{p.n4.tiempo_seg}s</span>
                          </div>
                        ) : (
                          <span className="text-on-surface-variant/30 font-mono">--</span>
                        )}
                      </td>

                      {/* Puntaje Total Acumulado */}
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
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {/* TABLA 1: ABSTRACCIÓN */}
        {renderTablaZona('Abstracción', 'abstraccion', 'text-primary', 'border-primary/30')}

        {/* TABLA 2: PENSAMIENTO COMPUTACIONAL */}
        {renderTablaZona('Pensamiento Computacional', 'pensamiento_computacional', 'text-secondary', 'border-secondary/30')}

        {/* TABLA 3: DESCOMPOSICIÓN */}
        {renderTablaZona('Descomposición', 'descomposicion', 'text-orange-400', 'border-orange-400/30')}

        {/* TABLA 4: RECONOCIMIENTO DE PATRONES */}
        {renderTablaZona('Reconocimiento de Patrones', 'reconocimiento_patrones', 'text-pink-400', 'border-pink-400/30')}
      </div>
    </div>
  );
}