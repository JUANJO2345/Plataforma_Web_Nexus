import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthStore';
import { agruparResultadosPorEtapa, formatearFechaCorta } from '../utils/partidas';

const COLORES_ETAPA = ['text-primary', 'text-secondary', 'text-orange-400', 'text-pink-400'];

function crearValoresIniciales(catalogo) {
  return Object.fromEntries(catalogo.flatMap((etapa) => etapa.niveles.map((nivel) => [
    nivel.id,
    { puntaje: '0', tiempoSegundos: '0' },
  ])));
}

export default function MatchHistory() {
  const { authFetch } = useAuth();
  const [partidas, setPartidas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [resultadosForm, setResultadosForm] = useState({});
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resPartidas, resUsuarios, resCatalogo] = await Promise.all([
        authFetch('/api/partidas'),
        authFetch('/api/usuarios'),
        authFetch('/api/partidas/catalogo'),
      ]);
      if (!resPartidas.ok || !resUsuarios.ok || !resCatalogo.ok) {
        throw new Error('No se pudieron sincronizar las partidas, usuarios y niveles.');
      }
      const [partidasData, usuariosData, catalogoData] = await Promise.all([
        resPartidas.json(), resUsuarios.json(), resCatalogo.json(),
      ]);
      const etapasOrdenadas = catalogoData
        .map((etapa) => ({ ...etapa, niveles: [...etapa.niveles].sort((a, b) => a.orden - b.orden) }))
        .sort((a, b) => a.orden - b.orden);
      setPartidas(partidasData);
      setUsuarios(usuariosData);
      setCatalogo(etapasOrdenadas);
      setResultadosForm((actuales) => Object.keys(actuales).length ? actuales : crearValoresIniciales(etapasOrdenadas));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    const loadInitialData = async () => {
      await fetchData();
    };
    loadInitialData();
  }, [fetchData]);

  const resetForm = () => {
    setUsername('');
    setResultadosForm(crearValoresIniciales(catalogo));
    setIsEditing(false);
    setSelectedId(null);
  };

  const handleResultadoChange = (nivelId, campo, valor) => {
    setResultadosForm((actuales) => ({
      ...actuales,
      [nivelId]: { ...actuales[nivelId], [campo]: valor },
    }));
  };

  const handleEditClick = (partida) => {
    const valores = crearValoresIniciales(catalogo);
    for (const resultado of partida.resultados || []) {
      valores[resultado.nivelId] = {
        puntaje: String(resultado.puntaje ?? 0),
        tiempoSegundos: String(resultado.tiempoSegundos ?? 0),
      };
    }
    setUsername(partida.username || '');
    setResultadosForm(valores);
    setIsEditing(true);
    setSelectedId(partida.id);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!username) return;
    const resultados = Object.entries(resultadosForm).map(([nivelId, valores]) => ({
      nivelId: Number(nivelId),
      puntaje: Number(valores.puntaje),
      tiempoSegundos: Number(valores.tiempoSegundos),
    }));
    try {
      const response = await authFetch(isEditing ? `/api/partidas/${selectedId}` : '/api/partidas', {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify({ username, resultados }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'No se pudo guardar la partida.');
      resetForm();
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta partida?')) return;
    try {
      const response = await authFetch(`/api/partidas/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('No se pudo eliminar la partida.');
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <section className="xl:col-span-2 border border-primary/30 bg-surface-container-low/40 p-6 backdrop-blur-md">
        <h3 className="font-mono-label text-primary text-[12px] font-bold mb-4 uppercase tracking-wider">// Historial de partidas</h3>
        {error && <div className="p-3 mb-4 border border-error/30 text-on-error text-[11px]">{error}</div>}
        {loading ? <div className="py-4 text-primary animate-pulse">Cargando partidas...</div> : (
          <div className="space-y-4">
            {partidas.length === 0 && <p className="text-center py-4 text-on-surface-variant/50">Aún no hay partidas registradas.</p>}
            {partidas.map((partida) => (
              <article key={partida.id} className="border border-primary/15 p-4 space-y-3">
                <header className="flex flex-wrap justify-between gap-3">
                  <div>
                    <div className="font-bold text-on-surface">Partida #{String(partida.id).padStart(4, '0')}</div>
                    <div className="text-[11px] text-on-surface-variant font-mono">
                      {partida.username || 'Usuario sin asignar'} · Fecha: {formatearFechaCorta(partida.fecha || partida.createdAt)}
                    </div>
                  </div>
                  <div className="space-x-2">
                    <button onClick={() => handleEditClick(partida)} className="px-2 py-1 border border-primary/40 text-primary text-[10px]">Editar</button>
                    <button onClick={() => handleDelete(partida.id)} className="px-2 py-1 border border-error/40 text-error text-[10px]">Eliminar</button>
                  </div>
                </header>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {agruparResultadosPorEtapa(partida).map((etapa, index) => (
                    <div key={etapa.clave} className="border border-primary/10 p-3">
                      <div className={`${COLORES_ETAPA[index % COLORES_ETAPA.length]} text-[11px] font-bold uppercase mb-2`}>{etapa.nombre} · {etapa.puntajeTotal} pts</div>
                      {etapa.niveles.map((resultado) => (
                        <div key={resultado.nivelId} className="flex justify-between text-[10px] text-on-surface-variant">
                          <span>{resultado.nivelNombre}</span>
                          <span>{resultado.puntaje} pts · {resultado.tiempoSegundos} s</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="border border-secondary/30 bg-surface-container-low/40 p-6 max-h-[calc(100vh-140px)] overflow-y-auto">
        <h3 className="font-mono-label text-secondary text-[12px] font-bold mb-4 uppercase">{isEditing ? 'Editar partida' : 'Registrar partida'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-[11px] text-on-surface-variant uppercase">
            Usuario
            <select value={username} onChange={(event) => setUsername(event.target.value)} className="mt-1 w-full bg-surface-container-high/60 border border-secondary/20 p-2 text-on-surface" required>
              <option value="" disabled>Seleccionar usuario</option>
              {usuarios.map((usuario) => <option key={usuario.id} value={usuario.correo}>{usuario.nombre} ({usuario.correo})</option>)}
            </select>
          </label>
          {catalogo.map((etapa, index) => (
            <fieldset key={etapa.id} className="space-y-2 border-t border-primary/20 pt-3">
              <legend className={`${COLORES_ETAPA[index % COLORES_ETAPA.length]} text-[11px] font-bold uppercase`}>{etapa.nombre}</legend>
              {etapa.niveles.map((nivel) => (
                <div key={nivel.id} className="grid grid-cols-[1fr_1fr_1fr] items-end gap-2 border-l-2 border-secondary/20 p-2">
                  <span className="text-[10px] text-on-surface">{nivel.nombre}</span>
                  <label className="text-[9px] text-on-surface-variant">Puntaje
                    <input type="number" min="0" step="1" required value={resultadosForm[nivel.id]?.puntaje ?? '0'} onChange={(event) => handleResultadoChange(nivel.id, 'puntaje', event.target.value)} className="w-full bg-surface-container-high/40 border border-secondary/10 p-1 text-on-surface" />
                  </label>
                  <label className="text-[9px] text-on-surface-variant">Tiempo (s)
                    <input type="number" min="0" step="1" required value={resultadosForm[nivel.id]?.tiempoSegundos ?? '0'} onChange={(event) => handleResultadoChange(nivel.id, 'tiempoSegundos', event.target.value)} className="w-full bg-surface-container-high/40 border border-secondary/10 p-1 text-on-surface" />
                  </label>
                </div>
              ))}
            </fieldset>
          ))}
          <div className="flex gap-2 sticky bottom-0 bg-background/90 py-2">
            <button type="submit" disabled={catalogo.length === 0} className="flex-1 py-3 bg-secondary text-surface font-bold uppercase disabled:opacity-50">{isEditing ? 'Guardar cambios' : 'Registrar partida'}</button>
            {isEditing && <button type="button" onClick={resetForm} className="px-3 py-3 border border-on-surface-variant/30 text-on-surface-variant">Cancelar</button>}
          </div>
        </form>
      </section>
    </div>
  );
}
