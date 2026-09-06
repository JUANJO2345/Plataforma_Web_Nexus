import { useState, useEffect } from 'react';

export default function QueryLookupModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [usuarios, setUsuarios] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [partidas, setPartidas] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const loadAllData = async () => {
        try {
          setLoading(true);
          const [resU, resG, resP] = await Promise.all([
            fetch('/api/usuarios'),
            fetch('/api/grupos'),
            fetch('/api/partidas')
          ]);

          if (resU.ok) setUsuarios(await resU.json());
          if (resG.ok) setGrupos(await resG.json());
          if (resP.ok) setPartidas(await resP.json());
        } catch (err) {
          console.error('Error cargando datos de consulta:', err);
        } finally {
          setLoading(false);
        }
      };

      loadAllData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const term = query.trim().toLowerCase();

  // Coincidencias de Usuarios
  const usuariosCoincidentes = term === '' ? [] : usuarios.filter((u) =>
    u.nombre?.toLowerCase().includes(term) ||
    u.correo?.toLowerCase().includes(term) ||
    String(u.id) === term
  );

  // Coincidencias de Grupos
  const gruposCoincidentes = term === '' ? [] : grupos.filter((g) =>
    g.codigo?.toLowerCase().includes(term) ||
    g.nombre?.toLowerCase().includes(term)
  );

  // Coincidencias de Partidas
  const partidasCoincidentes = term === '' ? [] : partidas.filter((p) =>
    String(p.id) === term ||
    p.username?.toLowerCase().includes(term)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md font-mono-label">
      <div className="w-full max-w-2xl border border-primary/50 bg-surface-container-low/95 p-6 shadow-[0_0_40px_rgba(0,220,230,0.2)] relative">
        {/* Esquinas decorativas Cyberpunk */}
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary"></div>

        {/* Encabezado */}
        <div className="flex justify-between items-center mb-4 border-b border-primary/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">search</span>
            <div>
              <h3 className="font-display text-[18px] text-primary uppercase font-bold">
                CONSULTA_RAPIDA_DE_SISTEMA
              </h3>
              <p className="text-[10px] text-on-surface-variant/70 uppercase">
                Búsqueda instantánea de alumnos, códigos de grupo y registros de partida
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 border border-primary/30 text-primary hover:bg-primary hover:text-black transition-all cursor-pointer uppercase text-[11px]"
          >
            Cerrar [ESC]
          </button>
        </div>

        {/* Input de Búsqueda */}
        <div className="relative mb-6">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ingrese un correo, nombre, código de grupo (ej: GRP-101) o ID de partida..."
            className="w-full bg-surface-container border border-primary/40 px-4 py-3 text-[13px] text-on-surface focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(0,220,230,0.3)] transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-3 text-[11px] text-on-surface-variant/50 hover:text-primary uppercase"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Resultados */}
        <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-6">
          {loading ? (
            <div className="text-center py-8 text-primary animate-pulse text-[12px]">
              &gt;&gt; SCANNING_CORE_DATABASE...
            </div>
          ) : term === '' ? (
            <div className="text-center py-8 text-on-surface-variant/40 text-[12px] italic">
              Escriba en el campo superior para iniciar el escaneo de registros.
            </div>
          ) : (
            <>
              {/* Sección Usuarios */}
              {usuariosCoincidentes.length > 0 && (
                <div>
                  <h4 className="text-[11px] text-primary uppercase font-bold mb-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-primary"></span> Usuarios Encontrados ({usuariosCoincidentes.length})
                  </h4>
                  <div className="space-y-2">
                    {usuariosCoincidentes.map((u) => (
                      <div key={u.id} className="border border-primary/20 bg-surface-container/40 p-3 flex justify-between items-center text-[12px]">
                        <div>
                          <div className="font-bold text-on-surface">{u.nombre || 'Sin nombre'}</div>
                          <div className="text-[10px] text-primary">{u.correo}</div>
                        </div>
                        <span className="px-2 py-0.5 border border-primary/40 text-[10px] uppercase font-bold text-primary">
                          Rol: {u.rol || 'user'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sección Grupos */}
              {gruposCoincidentes.length > 0 && (
                <div>
                  <h4 className="text-[11px] text-orange-400 uppercase font-bold mb-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-orange-400"></span> Grupos Encontrados ({gruposCoincidentes.length})
                  </h4>
                  <div className="space-y-2">
                    {gruposCoincidentes.map((g) => (
                      <div key={g.id} className="border border-orange-400/20 bg-surface-container/40 p-3 flex justify-between items-center text-[12px]">
                        <div>
                          <div className="font-bold text-orange-400">{g.codigo}</div>
                          <div className="text-[11px] text-on-surface">{g.nombre || 'Sin nombre'}</div>
                          <div className="text-[10px] text-on-surface-variant/70">
                            Profesor: {g.profesor?.nombre || g.profesor?.correo || 'Sin asignar'}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 border border-orange-400/40 text-[10px] uppercase font-bold text-orange-400">
                          {g.estudiantes ? g.estudiantes.length : 0} Alumnos
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sección Partidas */}
              {partidasCoincidentes.length > 0 && (
                <div>
                  <h4 className="text-[11px] text-secondary uppercase font-bold mb-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-secondary"></span> Partidas Encontradas ({partidasCoincidentes.length})
                  </h4>
                  <div className="space-y-2">
                    {partidasCoincidentes.map((p) => (
                      <div key={p.id} className="border border-secondary/20 bg-surface-container/40 p-3 text-[11px] space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-secondary">Partida #{String(p.id).padStart(4, '0')}</span>
                          <span className="text-on-surface-variant">{p.username}</span>
                        </div>
                        <div className="font-mono text-[10px] text-on-surface-variant/70 truncate">
                          {typeof p.stage === 'object' ? JSON.stringify(p.stage) : p.stage}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {usuariosCoincidentes.length === 0 && gruposCoincidentes.length === 0 && partidasCoincidentes.length === 0 && (
                <div className="text-center py-6 text-on-surface-variant/50 text-[12px]">
                  No se encontraron coincidencias para &quot;{query}&quot;.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
