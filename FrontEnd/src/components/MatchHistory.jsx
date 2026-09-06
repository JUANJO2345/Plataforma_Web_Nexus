import { useState, useEffect } from 'react';

export default function MatchHistory() {
  const [partidas, setPartidas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  
  // Estado maestro: contiene la telemetría individual de los 4 niveles para las 4 zonas.
  const [formData, setFormData] = useState({
    username: '',
    // Abstracción (Niveles 1 al 4)
    abs_n1_pts: '0', abs_n1_time: '0',
    abs_n2_pts: '0', abs_n2_time: '0',
    abs_n3_pts: '0', abs_n3_time: '0',
    abs_n4_pts: '0', abs_n4_time: '0',
    // Pensamiento Computacional (Niveles 1 al 4)
    comp_n1_pts: '0', comp_n1_time: '0',
    comp_n2_pts: '0', comp_n2_time: '0',
    comp_n3_pts: '0', comp_n3_time: '0',
    comp_n4_pts: '0', comp_n4_time: '0',
    // Descomposición (Niveles 1 al 4)
    desc_n1_pts: '0', desc_n1_time: '0',
    desc_n2_pts: '0', desc_n2_time: '0',
    desc_n3_pts: '0', desc_n3_time: '0',
    desc_n4_pts: '0', desc_n4_time: '0',
    // Reconocimiento de Patrones (Niveles 1 al 4)
    patr_n1_pts: '0', patr_n1_time: '0',
    patr_n2_pts: '0', patr_n2_time: '0',
    patr_n3_pts: '0', patr_n3_time: '0',
    patr_n4_pts: '0', patr_n4_time: '0',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resPartidas, resUsuarios] = await Promise.all([
        fetch('/api/partidas'),
        fetch('/api/usuarios')
      ]);
      if (!resPartidas.ok || !resUsuarios.ok) throw new Error('Fallo en la sincronización del núcleo de datos.');
      
      setPartidas(await resPartidas.json());
      setUsuarios(await resUsuarios.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      await fetchData();
    };

    loadInitialData();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username) {
      alert('[!] Se requiere asignar un operador válido.');
      return;
    }

    // Estructuramos el payload mapeando los 4 niveles de cada zona por separado.
    const stagePayload = {
      abstraccion: {
        n1: { puntaje: parseInt(formData.abs_n1_pts), tiempo_seg: parseInt(formData.abs_n1_time) },
        n2: { puntaje: parseInt(formData.abs_n2_pts), tiempo_seg: parseInt(formData.abs_n2_time) },
        n3: { puntaje: parseInt(formData.abs_n3_pts), tiempo_seg: parseInt(formData.abs_n3_time) },
        n4: { puntaje: parseInt(formData.abs_n4_pts), tiempo_seg: parseInt(formData.abs_n4_time) }
      },
      pensamiento_computacional: {
        n1: { puntaje: parseInt(formData.comp_n1_pts), tiempo_seg: parseInt(formData.comp_n1_time) },
        n2: { puntaje: parseInt(formData.comp_n2_pts), tiempo_seg: parseInt(formData.comp_n2_time) },
        n3: { puntaje: parseInt(formData.comp_n3_pts), tiempo_seg: parseInt(formData.comp_n3_time) },
        n4: { puntaje: parseInt(formData.comp_n4_pts), tiempo_seg: parseInt(formData.comp_n4_time) }
      },
      descomposicion: {
        n1: { puntaje: parseInt(formData.desc_n1_pts), tiempo_seg: parseInt(formData.desc_n1_time) },
        n2: { puntaje: parseInt(formData.desc_n2_pts), tiempo_seg: parseInt(formData.desc_n2_time) },
        n3: { puntaje: parseInt(formData.desc_n3_pts), tiempo_seg: parseInt(formData.desc_n3_time) },
        n4: { puntaje: parseInt(formData.desc_n4_pts), tiempo_seg: parseInt(formData.desc_n4_time) }
      },
      reconocimiento_patrones: {
        n1: { puntaje: parseInt(formData.patr_n1_pts), tiempo_seg: parseInt(formData.patr_n1_time) },
        n2: { puntaje: parseInt(formData.patr_n2_pts), tiempo_seg: parseInt(formData.patr_n2_time) },
        n3: { puntaje: parseInt(formData.patr_n3_pts), tiempo_seg: parseInt(formData.patr_n3_time) },
        n4: { puntaje: parseInt(formData.patr_n4_pts), tiempo_seg: parseInt(formData.patr_n4_time) }
      }
    };

    try {
      const url = isEditing ? `/api/partidas/${selectedId}` : '/api/partidas';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username, stage: stagePayload })
      });

      if (!res.ok) throw new Error('Fallo en la inyección de la telemetría.');

      // Limpieza de estado.
      resetForm();
      fetchData();
    } catch (err) {
      alert(`[!] CRITICAL_WRITE_ERROR: ${err.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      abs_n1_pts: '0', abs_n1_time: '0', abs_n2_pts: '0', abs_n2_time: '0', abs_n3_pts: '0', abs_n3_time: '0', abs_n4_pts: '0', abs_n4_time: '0',
      comp_n1_pts: '0', comp_n1_time: '0', comp_n2_pts: '0', comp_n2_time: '0', comp_n3_pts: '0', comp_n3_time: '0', comp_n4_pts: '0', comp_n4_time: '0',
      desc_n1_pts: '0', desc_n1_time: '0', desc_n2_pts: '0', desc_n2_time: '0', desc_n3_pts: '0', desc_n3_time: '0', desc_n4_pts: '0', desc_n4_time: '0',
      patr_n1_pts: '0', patr_n1_time: '0', patr_n2_pts: '0', patr_n2_time: '0', patr_n3_pts: '0', patr_n3_time: '0', patr_n4_pts: '0', patr_n4_time: '0',
    });
    setIsEditing(false);
    setSelectedId(null);
  };

  const handleEditClick = (partida) => {
    setIsEditing(true);
    setSelectedId(partida.id);
    const s = typeof partida.stage === 'object' ? partida.stage : {};
    
    setFormData({
      username: partida.username,
      abs_n1_pts: String(s.abstraccion?.n1?.puntaje ?? 0), abs_n1_time: String(s.abstraccion?.n1?.tiempo_seg ?? 0),
      abs_n2_pts: String(s.abstraccion?.n2?.puntaje ?? 0), abs_n2_time: String(s.abstraccion?.n2?.tiempo_seg ?? 0),
      abs_n3_pts: String(s.abstraccion?.n3?.puntaje ?? 0), abs_n3_time: String(s.abstraccion?.n3?.tiempo_seg ?? 0),
      abs_n4_pts: String(s.abstraccion?.n4?.puntaje ?? 0), abs_n4_time: String(s.abstraccion?.n4?.tiempo_seg ?? 0),

      comp_n1_pts: String(s.pensamiento_computacional?.n1?.puntaje ?? 0), comp_n1_time: String(s.pensamiento_computacional?.n1?.tiempo_seg ?? 0),
      comp_n2_pts: String(s.pensamiento_computacional?.n2?.puntaje ?? 0), comp_n2_time: String(s.pensamiento_computacional?.n2?.tiempo_seg ?? 0),
      comp_n3_pts: String(s.pensamiento_computacional?.n3?.puntaje ?? 0), comp_n3_time: String(s.pensamiento_computacional?.n3?.tiempo_seg ?? 0),
      comp_n4_pts: String(s.pensamiento_computacional?.n4?.puntaje ?? 0), comp_n4_time: String(s.pensamiento_computacional?.n4?.tiempo_seg ?? 0),

      desc_n1_pts: String(s.descomposicion?.n1?.puntaje ?? 0), desc_n1_time: String(s.descomposicion?.n1?.tiempo_seg ?? 0),
      desc_n2_pts: String(s.descomposicion?.n2?.puntaje ?? 0), desc_n2_time: String(s.descomposicion?.n2?.tiempo_seg ?? 0),
      desc_n3_pts: String(s.descomposicion?.n3?.puntaje ?? 0), desc_n3_time: String(s.descomposicion?.n3?.tiempo_seg ?? 0),
      desc_n4_pts: String(s.descomposicion?.n4?.puntaje ?? 0), desc_n4_time: String(s.descomposicion?.n4?.tiempo_seg ?? 0),

      patr_n1_pts: String(s.reconocimiento_patrones?.n1?.puntaje ?? 0), patr_n1_time: String(s.reconocimiento_patrones?.n1?.tiempo_seg ?? 0),
      patr_n2_pts: String(s.reconocimiento_patrones?.n2?.puntaje ?? 0), patr_n2_time: String(s.reconocimiento_patrones?.n2?.tiempo_seg ?? 0),
      patr_n3_pts: String(s.reconocimiento_patrones?.n3?.puntaje ?? 0), patr_n3_time: String(s.reconocimiento_patrones?.n3?.tiempo_seg ?? 0),
      patr_n4_pts: String(s.reconocimiento_patrones?.n4?.puntaje ?? 0), patr_n4_time: String(s.reconocimiento_patrones?.n4?.tiempo_seg ?? 0),
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Borrar registro definitivo?')) return;
    try {
      await fetch(`/api/partidas/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) { alert(err.message); }
  };

  // Renderizador de filas de niveles completados en la tabla general.
  const renderResumenZona = (label, color, data) => {
    if (!data) return null;
    const activos = Object.entries(data).filter(([, v]) => v.puntaje > 0 || v.tiempo_seg > 0);
    if (activos.length === 0) return <div><span className={color}>{label}:</span> <span className="opacity-30 italic">No activity</span></div>;
    
    return (
      <div className="mb-1">
        <span className={color}><b className="uppercase">{label}:</b></span>
        <div className="pl-3 grid grid-cols-2 gap-x-2 text-[10px] text-on-surface-variant/80">
          {activos.map(([niv, v]) => (
            <div key={niv}>{niv.toUpperCase()}: {v.puntaje}pts / {v.tiempo_seg}s</div>
          ))}
        </div>
      </div>
    );
  };

  // Renderizador de campos del formulario para un nivel específico.
  const renderInputsNivel = (prefix, labelNivel) => (
    <div className="bg-surface-container/30 p-2 border-l-2 border-secondary/20 space-y-1">
      <div className="text-[10px] uppercase text-on-surface font-bold">{labelNivel}</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-on-surface-variant/60 block">Puntaje</label>
          <input type="number" name={`${prefix}_pts`} value={formData[`${prefix}_pts`]} onChange={handleChange} min="0" className="w-full bg-surface-container-high/40 border border-secondary/10 p-0.5 px-1 text-on-surface text-[11px]" />
        </div>
        <div>
          <label className="text-[9px] text-on-surface-variant/60 block">Tiempo (s)</label>
          <input type="number" name={`${prefix}_time`} value={formData[`${prefix}_time`]} onChange={handleChange} min="0" className="w-full bg-surface-container-high/40 border border-secondary/10 p-0.5 px-1 text-on-surface text-[11px]" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      
      {/* Sección de tabla de registros */}
      <div className="xl:col-span-2 border border-primary/30 bg-surface-container-low/40 p-6 backdrop-blur-md relative shadow-[0_0_15px_rgba(0,220,230,0.02)]">
        <h3 className="font-mono-label text-primary text-[12px] font-bold mb-4 uppercase tracking-wider">// MATRIX_TIMELINE_STREAMS</h3>
        
        {error && (
          <div className="p-3 mb-4 border border-error/30 bg-error-container/10 font-mono-label text-[11px] text-on-error">
            [!] {error}
          </div>
        )}

        {loading ? (
          <div className="font-mono-label text-on-surface-variant animate-pulse text-[12px] py-4">&gt; DECRYPTING_TELEMETRY...</div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left font-mono-label text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-primary/20 text-primary uppercase text-[11px]">
                  <th className="py-2 px-2">ID</th>
                  <th className="py-2 px-3">Operador</th>
                  <th className="py-2 px-3">Desglose por Niveles e Habilidades</th>
                  <th className="py-2 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {partidas.length === 0 ? (
                  <tr><td colSpan="4" className="py-4 text-center text-on-surface-variant/40 italic">-- Sin registros --</td></tr>
                ) : (
                  partidas.map((p) => {
                    const s = typeof p.stage === 'object' ? p.stage : {};
                    return (
                      <tr key={p.id} className="border-b border-primary/10 hover:bg-primary/5 transition-colors align-top">
                        <td className="py-3 px-2 text-on-surface-variant/60 font-mono">#{String(p.id).padStart(4, '0')}</td>
                        <td className="py-3 px-3 font-bold text-on-surface truncate max-w-[110px]">{p.username}</td>
                        <td className="py-3 px-3 text-[11px] space-y-2">
                          {renderResumenZona('Abstracción', 'text-primary', s.abstraccion)}
                          {renderResumenZona('P_Computacional', 'text-secondary', s.pensamiento_computacional)}
                          {renderResumenZona('Descomposición', 'text-orange-400', s.descomposicion)}
                          {renderResumenZona('Patrones', 'text-pink-400', s.reconocimiento_patrones)}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                          <button onClick={() => handleEditClick(p)} className="px-2 py-1 border border-primary/40 text-primary text-[10px] hover:bg-primary hover:text-black transition-all cursor-pointer">Editar</button>
                          <button onClick={() => handleDelete(p.id)} className="px-2 py-1 border border-error/40 text-error text-[10px] hover:bg-error hover:text-white transition-all cursor-pointer">Eliminar</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sección de formulario detallado */}
      <div className="border border-secondary/30 bg-surface-container-low/40 p-6 backdrop-blur-md relative h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar shadow-[0_0_15px_rgba(166,226,46,0.02)]">
        <h3 className="font-mono-label text-secondary text-[12px] font-bold mb-4 uppercase tracking-wider">
          {isEditing ? '// MULTILEVEL_OVERRIDE' : '// MULTILEVEL_INJECTION'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-5 font-mono-label text-[12px]">
          
          <div>
            <label className="block text-on-surface-variant/80 mb-1 uppercase text-[11px] font-bold">Asignar Operador</label>
            <select name="username" value={formData.username} onChange={handleChange} className="w-full bg-surface-container-high/60 border border-secondary/20 p-2 text-on-surface focus:outline-none focus:border-secondary" required>
              <option value="" disabled>-- Seleccionar Operador --</option>
              {usuarios.map((u) => <option key={u.id} value={u.correo}>{u.nombre} ({u.correo})</option>)}
            </select>
          </div>

          {/* MATRIZ 1: ABSTRACCIÓN */}
          <div className="space-y-2 border-t border-primary/20 pt-3">
            <span className="text-primary font-bold uppercase block text-[11px] tracking-wider">// 1. ABSTRACCIÓN</span>
            <div className="grid grid-cols-1 gap-2">
              {renderInputsNivel('abs_n1', 'Nivel 1 - Identificación')}
              {renderInputsNivel('abs_n2', 'Nivel 2 - Filtrado')}
              {renderInputsNivel('abs_n3', 'Nivel 3 - Modelado')}
              {renderInputsNivel('abs_n4', 'Nivel 4 - Meta-Abstracción')}
            </div>
          </div>

          {/* MATRIZ 2: PENSAMIENTO COMPUTACIONAL */}
          <div className="space-y-2 border-t border-secondary/20 pt-3">
            <span className="text-secondary font-bold uppercase block text-[11px] tracking-wider">// 2. PENSAMIENTO COMPUTACIONAL</span>
            <div className="grid grid-cols-1 gap-2">
              {renderInputsNivel('comp_n1', 'Nivel 1 - Lógica Secuencial')}
              {renderInputsNivel('comp_n2', 'Nivel 2 - Condicionales')}
              {renderInputsNivel('comp_n3', 'Nivel 3 - Bucles/Loops')}
              {renderInputsNivel('comp_n4', 'Nivel 4 - Optimización')}
            </div>
          </div>

          {/* MATRIZ 3: DESCOMPOSICIÓN */}
          <div className="space-y-2 border-t border-orange-400/20 pt-3">
            <span className="text-orange-400 font-bold uppercase block text-[11px] tracking-wider">// 3. DESCOMPOSICIÓN</span>
            <div className="grid grid-cols-1 gap-2">
              {renderInputsNivel('desc_n1', 'Nivel 1 - Fragmentación')}
              {renderInputsNivel('desc_n2', 'Nivel 2 - División')}
              {renderInputsNivel('desc_n3', 'Nivel 3 - Subproblemas')}
              {renderInputsNivel('desc_n4', 'Nivel 4 - Modularidad')}
            </div>
          </div>

          {/* MATRIZ 4: RECONOCIMIENTO DE PATRONES */}
          <div className="space-y-2 border-t border-pink-400/20 pt-3">
            <span className="text-pink-400 font-bold uppercase block text-[11px] tracking-wider">// 4. RECONOCIMIENTO DE PATRONES</span>
            <div className="grid grid-cols-1 gap-2">
              {renderInputsNivel('patr_n1', 'Nivel 1 - Similitudes')}
              {renderInputsNivel('patr_n2', 'Nivel 2 - Repeticiones')}
              {renderInputsNivel('patr_n3', 'Nivel 3 - Tendencias')}
              {renderInputsNivel('patr_n4', 'Nivel 4 - Predicción')}
            </div>
          </div>

          <div className="pt-2 flex gap-2 sticky bottom-0 bg-background/90 py-2 backdrop-blur-xs">
            <button type="submit" className="flex-1 py-3 bg-secondary text-surface font-bold uppercase tracking-wider hover:shadow-[0_0_15px_rgba(166,226,46,0.5)] transition-all cursor-pointer">
              {isEditing ? 'COMMIT_OVERRIDE' : 'INJECT_TIMELINES'}
            </button>
            {isEditing && (
              <button type="button" onClick={resetForm} className="px-3 py-3 border border-on-surface-variant/30 text-on-surface-variant uppercase hover:bg-surface-container cursor-pointer">Cancelar</button>
            )}
          </div>
        </form>
      </div>

    </div>
  );
}
