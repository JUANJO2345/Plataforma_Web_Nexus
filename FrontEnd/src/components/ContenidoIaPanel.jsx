import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthStore';

const TEMAS_SUGERIDOS = [
  'Sistema Hospitalario y Urgencias',
  'Red Eléctrica Inteligente',
  'Logística Portuaria y Aduanas',
  'Gestión Hídrica y Acueductos',
  'Aeropuerto Internacional',
  'Ciberseguridad y Banca Digital'
];

/**
 * Extrae las categorías únicas presentes en un arreglo de botones,
 * deduplicando sin distinguir mayúsculas ni tildes y preservando el primer nombre visto.
 */
function extraerCategorias(botones = []) {
  if (!Array.isArray(botones)) return [];
  const vistas = new Map();
  for (const btn of botones) {
    if (typeof btn?.categoria !== 'string') continue;
    const limpia = btn.categoria.replace(/\s+/g, ' ').trim();
    if (!limpia) continue;
    const clave = limpia
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (!vistas.has(clave)) {
      vistas.set(clave, limpia);
    }
  }
  return Array.from(vistas.values());
}

/**
 * Formatea el JSON para vista previa conservando "ponderacion": 1.0 y "ponderacion": 0.
 */
function formatearJsonVista(data) {
  if (!data) return '';
  return JSON.stringify(data, null, 2).replace(/"ponderacion":\s*1(?![.\d])/g, '"ponderacion": 1.0');
}

export default function ContenidoIaPanel() {
  const { authFetch } = useAuth();

  // Estados del formulario
  const [tema, setTema] = useState('');
  const [peticion, setPeticion] = useState('');
  const [nuevoElemento, setNuevoElemento] = useState('');
  const [elementosSugeridos, setElementosSugeridos] = useState([]);

  // Estados de proceso
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargandoOriginal, setCargandoOriginal] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [propuesta, setPropuesta] = useState(null);
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('TODOS');
  const [mensajeExito, setMensajeExito] = useState(null);
  const [error, setError] = useState(null);

  // Estados de Drive y Auditoría
  const [estadoSistema, setEstadoSistema] = useState(null);
  const [cargandoEstado, setCargandoEstado] = useState(true);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [modalConfirmar, setModalConfirmar] = useState(false);
  const [modalRestaurar, setModalRestaurar] = useState(false);

  const cargarEstado = useCallback(async () => {
    try {
      const res = await authFetch('/api/ai/estado');
      if (res.ok) {
        const data = await res.json();
        setEstadoSistema(data);
      }
    } catch (err) {
      console.error('Error cargando estado:', err);
    } finally {
      setCargandoEstado(false);
    }
  }, [authFetch]);

  const cargarHistorial = useCallback(async () => {
    try {
      setCargandoHistorial(true);
      const res = await authFetch('/api/ai/historial');
      if (res.ok) {
        const data = await res.json();
        setHistorial(data);
      }
    } catch (err) {
      console.error('Error cargando historial:', err);
    } finally {
      setCargandoHistorial(false);
    }
  }, [authFetch]);

  // Cargar estado inicial y de Drive
  useEffect(() => {
    const inicializar = async () => {
      await Promise.all([cargarEstado(), cargarHistorial()]);
    };
    inicializar();
  }, [cargarEstado, cargarHistorial]);

  // Manejadores de conceptos/elementos sugeridos
  const agregarElemento = () => {
    const limpio = nuevoElemento.trim();
    if (limpio && !elementosSugeridos.includes(limpio)) {
      setElementosSugeridos([...elementosSugeridos, limpio]);
      setNuevoElemento('');
    }
  };

  const removerElemento = (item) => {
    setElementosSugeridos(elementosSugeridos.filter((e) => e !== item));
  };

  // 1. Solicitar propuesta a Gemini conservando estructura {"botones": [...]}
  const handleGenerarPropuesta = async (e) => {
    e.preventDefault();
    if (!tema.trim() && !peticion.trim()) {
      setError('Por favor indica un tema principal para generar la propuesta de botones con IA.');
      return;
    }

    try {
      setGenerando(true);
      setError(null);
      setMensajeExito(null);

      const res = await authFetch('/api/ai/propuesta', {
        method: 'POST',
        body: JSON.stringify({
          tema: tema.trim(),
          peticion: peticion.trim(),
          elementosSugeridos
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al comunicarse con Gemini API.');
      }

      setPropuesta(data.propuesta);
      setCategoriasDisponibles(extraerCategorias(data.propuesta?.botones));
      setFiltroCategoria('TODOS');
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerando(false);
    }
  };

  // Cargar el JSON original en el editor sin tocar Drive
  const handleCargarOriginal = async () => {
    try {
      setCargandoOriginal(true);
      setError(null);
      setMensajeExito(null);

      const res = await authFetch('/api/ai/original');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo obtener el JSON original.');
      }

      setPropuesta(data.propuesta);
      setCategoriasDisponibles(extraerCategorias(data.propuesta?.botones));
      setFiltroCategoria('TODOS');
      setMensajeExito({
        tipo: 'info',
        texto: 'JSON original de 43 botones cargado en el editor.',
        detalles: 'Puedes revisarlo, ajustarlo o guardarlo en Drive cuando lo desees.'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoOriginal(false);
    }
  };

  // Restaurar directamente el JSON original en Google Drive
  const handleRestaurarOriginalEnDrive = async () => {
    try {
      setRestaurando(true);
      setError(null);
      setMensajeExito(null);
      setModalRestaurar(false);

      const res = await authFetch('/api/ai/restaurar', {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo restaurar el JSON original en Google Drive.');
      }

      setPropuesta(data.propuesta);
      setCategoriasDisponibles(extraerCategorias(data.propuesta?.botones));
      setFiltroCategoria('TODOS');
      setMensajeExito({
        tipo: 'exito',
        texto: data.mensaje || '¡JSON original restaurado exitosamente en Google Drive!',
        detalles: `Versión restaurada a las ${new Date(data.actualizadoEn).toLocaleTimeString()} (Audit ID: #${data.auditId})`
      });

      cargarHistorial();
      cargarEstado();
    } catch (err) {
      setError(err.message);
    } finally {
      setRestaurando(false);
    }
  };

  // Actualizar texto de un botón específico por su índice
  const actualizarTextoBoton = (indice, nuevoTexto) => {
    if (!propuesta?.botones) return;
    const botonesActualizados = propuesta.botones.map((btn, idx) =>
      idx === indice ? { ...btn, texto: nuevoTexto } : btn
    );
    setPropuesta({ ...propuesta, botones: botonesActualizados });
  };

  // Alternar ponderación 0 <-> 1.0 en un botón específico sin alterar estructura ni borrar slots
  const togglePonderacionBoton = (indice) => {
    if (!propuesta?.botones) return;
    const botonesActualizados = propuesta.botones.map((btn, idx) =>
      idx === indice ? { ...btn, ponderacion: btn.ponderacion === 1 ? 0 : 1.0 } : btn
    );
    setPropuesta({ ...propuesta, botones: botonesActualizados });
  };

  // Actualizar o quitar la categoría de un botón específico
  const actualizarCategoriaBoton = (indice, nuevaCategoria) => {
    if (!propuesta?.botones) return;
    const botonesActualizados = propuesta.botones.map((btn, idx) => {
      if (idx !== indice) return btn;
      if (!nuevaCategoria) {
        const copia = { ...btn };
        delete copia.categoria;
        return copia;
      }
      return { ...btn, categoria: nuevaCategoria };
    });
    setPropuesta({ ...propuesta, botones: botonesActualizados });
  };

  // Descartar propuesta (no toca Drive)
  const handleDescartar = () => {
    setPropuesta(null);
    setCategoriasDisponibles([]);
    setFiltroCategoria('TODOS');
    setError(null);
    setMensajeExito({
      tipo: 'info',
      texto: 'Propuesta descartada. El archivo en Google Drive no ha sufrido modificaciones.'
    });
  };

  // 2. Aceptar y Guardar en Google Drive
  const handleAplicarEnDrive = async () => {
    if (!propuesta || !Array.isArray(propuesta.botones) || propuesta.botones.length === 0) {
      setError('No hay botones válidos en la propuesta para guardar.');
      return;
    }

    try {
      setGuardando(true);
      setError(null);
      setMensajeExito(null);
      setModalConfirmar(false);

      const res = await authFetch('/api/ai/aplicar', {
        method: 'POST',
        body: JSON.stringify({
          propuesta,
          tema: tema.trim() || 'Adaptación personalizada',
          peticion: peticion.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo guardar la propuesta en Google Drive.');
      }

      setMensajeExito({
        tipo: 'exito',
        texto: data.mensaje || '¡Archivo JSON actualizado exitosamente en Google Drive!',
        detalles: `Versión guardada a las ${new Date(data.actualizadoEn).toLocaleTimeString()} (Audit ID: #${data.auditId})`
      });

      // Recargar historial y estado de Drive
      cargarHistorial();
      cargarEstado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const botones = Array.isArray(propuesta?.botones) ? propuesta.botones : [];
  const totalBotones = botones.length;
  const totalCorrectos = botones.filter((b) => b.ponderacion === 1).length;
  const totalIncorrectos = totalBotones - totalCorrectos;
  const porcentajeIncorrectos = totalBotones > 0 ? Math.round((totalIncorrectos / totalBotones) * 100) : 0;
  const categoriasActivas = extraerCategorias(botones);

  const filtrosCategoria = [
    { id: 'TODOS', label: 'Todos' },
    ...categoriasDisponibles.map((cat) => ({ id: cat, label: cat })),
    { id: 'SIN_CATEGORIA', label: 'Sin categoría' }
  ];

  const botonesFiltrados = botones
    .map((boton, indice) => ({ boton, indice }))
    .filter(({ boton }) => {
      if (filtroCategoria === 'TODOS') return true;
      if (filtroCategoria === 'SIN_CATEGORIA') return !boton.categoria;
      return boton.categoria === filtroCategoria;
    });

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Encabezado del Módulo */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container-low/60 border border-primary/40 p-6 backdrop-blur-md shadow-[0_0_20px_rgba(0,220,230,0.1)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-[24px]">smart_toy</span>
            <span className="font-mono-label text-[11px] text-primary uppercase font-bold tracking-widest">
              // MODULO_IA_VR // GENERADOR_DE_CONTENIDO
            </span>
          </div>
          <h2 className="font-display text-[26px] text-primary font-bold tracking-tight">
            Contenido con Inteligencia Artificial (Gemini Flash)
          </h2>
          <p className="font-mono-label text-on-surface-variant text-[12px] mt-1 max-w-2xl">
            Indica un tema para que Gemini genere dinámicamente entre 40 y 60 botones, de 3 a 5 categorías temáticas y alrededor de un 40% de botones incorrectos (ponderación 0). También puedes recuperar o restaurar el JSON original en cualquier momento.
          </p>
        </div>

        {/* Indicadores de Estado */}
        <div className="flex flex-col gap-2 font-mono-label text-[11px]">
          <div className="flex items-center gap-2 bg-surface-container-highest/60 px-3 py-1.5 border border-primary/20">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="text-on-surface-variant">Modelo:</span>
            <span className="text-primary font-bold">
              {estadoSistema?.modeloGemini || (cargandoEstado ? 'Cargando...' : 'No configurado')}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-surface-container-highest/60 px-3 py-1.5 border border-orange-400/20">
            <span className={`w-2 h-2 rounded-full ${estadoSistema?.tieneDriveCredentials ? 'bg-secondary' : 'bg-orange-400'}`}></span>
            <span className="text-on-surface-variant">Drive Target:</span>
            {estadoSistema?.archivoId ? (
              <a
                href={`https://drive.google.com/file/d/${estadoSistema.archivoId}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 underline font-bold hover:text-orange-300"
                title={`Ver archivo en Drive (${estadoSistema.archivoId})`}
              >
                {estadoSistema.archivoId}
              </a>
            ) : (
              <span className="text-orange-400 font-bold">
                {cargandoEstado ? 'Cargando...' : 'No configurado'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Alertas y Mensajes de Estado */}
      {error && (
        <div className="p-4 border border-error/50 bg-error-container/20 font-mono-label text-[12px] text-on-error flex items-start gap-3 shadow-[0_0_15px_rgba(255,84,73,0.2)]">
          <span className="material-symbols-outlined text-error text-[20px]">error</span>
          <div className="flex-1">
            <div className="font-bold uppercase tracking-wider mb-0.5">[!] ERROR_EN_OPERACION:</div>
            <div>{error}</div>
          </div>
          <button onClick={() => setError(null)} className="text-on-error hover:opacity-70">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {mensajeExito && (
        <div className={`p-4 border font-mono-label text-[12px] flex items-start gap-3 ${
          mensajeExito.tipo === 'info'
            ? 'border-primary/50 bg-primary/10 text-primary shadow-[0_0_15px_rgba(0,220,230,0.2)]'
            : 'border-secondary/50 bg-secondary/10 text-secondary shadow-[0_0_15px_rgba(166,226,46,0.2)]'
        }`}>
          <span className="material-symbols-outlined text-[20px]">
            {mensajeExito.tipo === 'info' ? 'info' : 'check_circle'}
          </span>
          <div className="flex-1">
            <div className="font-bold uppercase tracking-wider mb-0.5">
              {mensajeExito.tipo === 'info' ? '// NOTIFICACION' : '// ACTUALIZACION_COMPLETA'}
            </div>
            <div>{mensajeExito.texto}</div>
            {mensajeExito.detalles && (
              <div className="text-[11px] opacity-80 mt-1">{mensajeExito.detalles}</div>
            )}
          </div>
          <button onClick={() => setMensajeExito(null)} className="hover:opacity-70">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna Izquierda: Formulario y Recuperación del Original */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleGenerarPropuesta} className="border border-primary/30 bg-surface-container-low/40 p-6 backdrop-blur-md space-y-5">
            <div className="flex items-center justify-between border-b border-primary/20 pb-3">
              <h3 className="font-mono-label text-primary text-[13px] font-bold uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                Tema y Configuración IA
              </h3>
              <span className="font-mono-label text-on-surface-variant text-[10px] uppercase">PASO 1</span>
            </div>

            {/* Selector de Tema (Campo Principal) */}
            <div>
              <label className="block font-mono-label text-[11px] uppercase text-primary mb-1 font-bold">
                1. Tema Principal del Escenario *
              </label>
              <input
                type="text"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Ej: Sistema Hospitalario y Urgencias, Red Eléctrica..."
                className="w-full bg-surface-container-highest/80 border border-primary/40 px-3 py-2 text-[13px] font-mono-label text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary focus:shadow-[0_0_10px_rgba(0,220,230,0.3)] transition-all"
              />

              {/* Chips de Temas Rápidos */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {TEMAS_SUGERIDOS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTema(t)}
                    className="font-mono-label text-[10px] uppercase px-2 py-0.5 border border-primary/30 bg-primary/5 text-primary hover:bg-primary/20 transition-all cursor-pointer"
                  >
                    + {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Petición / Instrucciones adicionales (Opcional) */}
            <div>
              <label className="block font-mono-label text-[11px] uppercase text-on-surface-variant mb-1 font-bold">
                2. Instrucciones adicionales para Gemini (Opcional)
              </label>
              <textarea
                rows={3}
                value={peticion}
                onChange={(e) => setPeticion(e.target.value)}
                placeholder="Ej: Enfocar los puntos críticos en saturación de quirófanos y tiempos de respuesta de ambulancias."
                className="w-full bg-surface-container-highest/80 border border-primary/40 px-3 py-2 text-[13px] font-mono-label text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary focus:shadow-[0_0_10px_rgba(0,220,230,0.3)] transition-all resize-none"
              ></textarea>
            </div>

            {/* Elementos específicos opcionales */}
            <div>
              <label className="block font-mono-label text-[11px] uppercase text-on-surface-variant mb-1 font-bold">
                3. Conceptos o elementos clave a incluir (Opcional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevoElemento}
                  onChange={(e) => setNuevoElemento(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregarElemento();
                    }
                  }}
                  placeholder="Ej: UCI Pediátrica, Subestación Norte"
                  className="flex-1 bg-surface-container-highest/80 border border-primary/40 px-3 py-1.5 text-[12px] font-mono-label text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={agregarElemento}
                  className="px-3 py-1.5 bg-primary/20 border border-primary text-primary font-mono-label text-[11px] uppercase font-bold hover:bg-primary/30 cursor-pointer"
                >
                  Agregar
                </button>
              </div>

              {elementosSugeridos.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {elementosSugeridos.map((elem) => (
                    <span
                      key={elem}
                      className="inline-flex items-center gap-1 font-mono-label text-[10px] px-2 py-0.5 border border-primary bg-primary/10 text-primary"
                    >
                      {elem}
                      <button
                        type="button"
                        onClick={() => removerElemento(elem)}
                        className="hover:text-error ml-1 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Botón de Enviar a Gemini */}
            <button
              type="submit"
              disabled={generando}
              className="w-full py-3 bg-primary text-on-primary font-mono-label font-bold uppercase tracking-widest text-[12px] hover:shadow-[0_0_20px_rgba(0,220,230,0.6)] transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generando ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  <span>GENERANDO_PROPUESTA...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">psychology</span>
                  <span>// GENERAR_PROPUESTA_CON_IA</span>
                </>
              )}
            </button>
          </form>

          {/* Tarjeta de Recuperación del JSON Original */}
          <div className="border border-secondary/40 bg-surface-container-low/40 p-5 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-secondary/20 pb-2">
              <h3 className="font-mono-label text-secondary text-[12px] font-bold uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">settings_backup_restore</span>
                Recuperar JSON Original
              </h3>
              <span className="font-mono-label text-on-surface-variant text-[10px] uppercase">43 BOTONES</span>
            </div>

            <p className="font-mono-label text-on-surface-variant text-[11px]">
              Carga el JSON original en el editor para revisarlo, o restáuralo directamente en Google Drive dejando respaldo en el historial.
            </p>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleCargarOriginal}
                disabled={cargandoOriginal || restaurando}
                className="w-full py-2.5 px-4 border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 font-mono-label font-bold uppercase tracking-wider text-[11px] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[17px]">download</span>
                <span>{cargandoOriginal ? 'Cargando...' : 'Cargar JSON Original en Editor'}</span>
              </button>

              <button
                type="button"
                onClick={() => setModalRestaurar(true)}
                disabled={restaurando || guardando}
                className="w-full py-2.5 px-4 border border-secondary/60 bg-secondary/15 text-secondary hover:bg-secondary/25 font-mono-label font-bold uppercase tracking-wider text-[11px] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[17px]">restore</span>
                <span>{restaurando ? 'Restaurando en Drive...' : 'Restaurar JSON Original en Drive'}</span>
              </button>
            </div>
          </div>

          {/* Botón para ver Historial de Auditoría */}
          <div className="border border-orange-400/30 bg-surface-container-low/40 p-4">
            <button
              type="button"
              onClick={() => setMostrarHistorial(!mostrarHistorial)}
              className="w-full flex items-center justify-between text-orange-400 font-mono-label text-[12px] uppercase font-bold hover:text-orange-300 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">history</span>
                Historial de Cambios en Drive ({historial.length})
              </span>
              <span className="material-symbols-outlined text-[18px]">
                {mostrarHistorial ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          </div>
        </div>

        {/* Columna Derecha: Vista Previa y Edición Segura de los Botones */}
        <div className="lg:col-span-7 space-y-6">
          <div className="border border-primary/30 bg-surface-container-low/40 p-6 backdrop-blur-md space-y-5">
            <div className="flex items-center justify-between border-b border-primary/20 pb-3">
              <h3 className="font-mono-label text-primary text-[13px] font-bold uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">tune</span>
                Propuesta Recibida ({botones.length} Botones)
              </h3>
              <span className="font-mono-label text-on-surface-variant text-[10px] uppercase">PASO 2</span>
            </div>

            {!propuesta || botones.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-primary/20 bg-surface-container-highest/20 p-8">
                <span className="material-symbols-outlined text-primary/40 text-[48px] mb-2 block">
                  psychology_alt
                </span>
                <p className="font-mono-label text-primary/70 text-[13px] uppercase font-bold">
                  Sin propuesta generada
                </p>
                <p className="font-mono-label text-on-surface-variant text-[11px] max-w-md mx-auto mt-1">
                  Escribe un tema a la izquierda y pulsa "Generar Propuesta con IA", o carga el JSON original para inspeccionar y editar los botones antes de guardar en Drive.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="bg-primary/5 border border-primary/30 p-3 font-mono-label text-[11px] text-primary flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] mt-0.5">info</span>
                  <div className="space-y-1">
                    <div>
                      Edita el <strong>texto</strong>, cambia la <strong>categoría</strong> o alterna la ponderación entre <strong>1.0</strong> y <strong>0</strong> en cualquiera de los <strong>{botones.length} botones</strong>.
                    </div>
                    <div className="text-[10px] text-on-surface-variant">
                      Correctos (1.0): <strong className="text-secondary">{totalCorrectos}</strong> · Incorrectos (0): <strong className="text-orange-300">{totalIncorrectos} ({porcentajeIncorrectos}%)</strong> · Categorías: <strong className="text-primary">{categoriasActivas.length}</strong>
                    </div>
                  </div>
                </div>

                {/* Filtros rápidos por Categoría */}
                <div className="flex flex-wrap gap-1.5">
                  {filtrosCategoria.map((f) => {
                    const count = f.id === 'TODOS'
                      ? botones.length
                      : f.id === 'SIN_CATEGORIA'
                        ? botones.filter((b) => !b.categoria).length
                        : botones.filter((b) => b.categoria === f.id).length;
                    const activo = filtroCategoria === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFiltroCategoria(f.id)}
                        className={`font-mono-label text-[10px] uppercase px-2.5 py-1 border transition-all cursor-pointer ${
                          activo
                            ? 'border-primary bg-primary text-black font-bold'
                            : 'border-primary/30 bg-surface-container-highest/40 text-on-surface-variant hover:text-primary hover:border-primary/60'
                        }`}
                      >
                        {f.label} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Lista Interactiva de Botones */}
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {botonesFiltrados.map(({ boton, indice }) => {
                    const esActivo = boton.ponderacion === 1;
                    const lineas = typeof boton.texto === 'string' ? boton.texto.split('\n').length : 1;
                    const rows = boton.texto?.includes('\n') ? Math.min(8, Math.max(3, lineas)) : 2;

                    return (
                      <div
                        key={indice}
                        className={`p-3.5 border transition-all space-y-2.5 ${
                          esActivo
                            ? 'border-secondary/60 bg-secondary/10 shadow-[inset_3px_0_0_#a6e22e]'
                            : 'border-on-surface-variant/30 bg-surface-container-highest/40'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-mono-label text-[10px]">
                            <span className="px-2 py-0.5 bg-primary/15 border border-primary/40 text-primary font-bold">
                              #{indice + 1}
                            </span>
                            <select
                              value={boton.categoria || ''}
                              onChange={(e) => actualizarCategoriaBoton(indice, e.target.value)}
                              aria-label={`Categoría del botón ${indice + 1}`}
                              className={`px-2 py-0.5 font-mono-label text-[10px] font-bold border bg-surface-container-highest/80 focus:outline-none focus:border-primary cursor-pointer ${
                                boton.categoria
                                  ? 'border-orange-400/40 text-orange-300'
                                  : 'border-on-surface-variant/30 text-on-surface-variant'
                              }`}
                            >
                              <option value="">Sin categoría</option>
                              {categoriasDisponibles.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => togglePonderacionBoton(indice)}
                            className={`px-3 py-1 font-mono-label text-[10px] font-bold uppercase transition-all cursor-pointer border ${
                              esActivo
                                ? 'bg-secondary text-black border-secondary hover:bg-secondary/90'
                                : 'border-on-surface-variant/40 text-on-surface-variant hover:text-white hover:border-white'
                            }`}
                          >
                            ponderacion: {esActivo ? '1.0' : '0'}
                          </button>
                        </div>

                        <textarea
                          rows={rows}
                          value={boton.texto}
                          onChange={(e) => actualizarTextoBoton(indice, e.target.value)}
                          className="w-full bg-black/50 border border-primary/25 px-3 py-2 text-[12px] font-mono-label text-on-surface focus:outline-none focus:border-primary resize-y"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Vista previa JSON crudo */}
                <div>
                  <span className="block font-mono-label text-[10px] text-on-surface-variant uppercase font-bold mb-1">
                    // FORMATO_JSON_PARA_DRIVE (ejemplo.json — {botones.length} botones)
                  </span>
                  <pre className="bg-black/80 border border-primary/30 p-3 font-mono-label text-[11px] text-primary overflow-x-auto max-h-56 selection:bg-primary selection:text-black">
                    {formatearJsonVista(propuesta)}
                  </pre>
                </div>

                {/* Acciones del Profesor: Aceptar y Guardar vs Descartar */}
                <div className="border-t border-primary/20 pt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setModalConfirmar(true)}
                    disabled={guardando || restaurando}
                    className="flex-1 py-3 bg-secondary text-black font-mono-label font-bold uppercase tracking-wider text-[12px] hover:shadow-[0_0_20px_rgba(166,226,46,0.6)] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                    <span>Aceptar y Guardar en Drive</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDescartar}
                    disabled={guardando || restaurando}
                    className="py-3 px-6 border border-error/50 text-error hover:bg-error/10 font-mono-label font-bold uppercase tracking-wider text-[12px] transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                    <span>Descartar</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historial de Auditoría Desplegable */}
      {mostrarHistorial && (
        <div className="border border-orange-400/40 bg-surface-container-low/60 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between border-b border-orange-400/20 pb-3">
            <h3 className="font-mono-label text-orange-400 text-[13px] font-bold uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">history</span>
              Auditoría y Registro de Versiones Guardadas
            </h3>
            <button
              onClick={cargarHistorial}
              disabled={cargandoHistorial}
              className="font-mono-label text-[11px] text-orange-400 hover:underline flex items-center gap-1"
            >
              <span className={`material-symbols-outlined text-[16px] ${cargandoHistorial ? 'animate-spin' : ''}`}>
                refresh
              </span>
              Actualizar
            </button>
          </div>

          {historial.length === 0 ? (
            <p className="font-mono-label text-on-surface-variant text-[12px] py-4 text-center">
              No hay registros de actualizaciones previas.
            </p>
          ) : (
            <div className="divide-y divide-orange-400/20 max-h-96 overflow-y-auto">
              {historial.map((log) => (
                <div key={log.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono-label text-[11px]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-orange-400 font-bold">#{log.id}</span>
                      <span className="text-on-surface font-bold">Tema: {log.tema}</span>
                      <span className="text-on-surface-variant text-[10px]">
                        por {log.usuario?.nombre || 'Profesor'}
                        {log.usuario?.correo ? ` (${log.usuario.correo})` : ''}
                      </span>
                    </div>
                    <div className="text-on-surface-variant text-[10px] mt-0.5 truncate max-w-xl">
                      Petición: "{log.peticion}"
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-on-surface-variant text-[10px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const parsed = JSON.parse(log.contenidoNuevo);
                          if (!parsed || !Array.isArray(parsed.botones)) {
                            setError('Esta versión histórica usa un formato anterior sin el arreglo "botones" válido.');
                            return;
                          }
                          setError(null);
                          setPropuesta(parsed);
                          setCategoriasDisponibles(extraerCategorias(parsed.botones));
                          setFiltroCategoria('TODOS');
                          setTema(log.tema || '');
                          setPeticion(log.peticion || '');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        } catch (e) {
                          console.error('Error al cargar versión:', e);
                          setError('No se pudo leer el contenido JSON de esta versión histórica.');
                        }
                      }}
                      className="px-2.5 py-1 border border-orange-400/40 text-orange-400 hover:bg-orange-400/10 uppercase text-[10px] font-bold cursor-pointer"
                    >
                      Cargar en Editor
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Confirmación para Guardar Propuesta en Drive */}
      {modalConfirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-lg w-full bg-surface-container border border-secondary p-6 shadow-[0_0_30px_rgba(166,226,46,0.3)] space-y-4">
            <div className="flex items-center gap-2 text-secondary font-mono-label text-[13px] font-bold uppercase">
              <span className="material-symbols-outlined text-[20px]">warning</span>
              Confirmar Guardado en Google Drive
            </div>

            <p className="font-mono-label text-on-surface-variant text-[12px]">
              Se actualizará el archivo <strong>ejemplo.json</strong> en Google Drive con los <strong>{botones.length} botones</strong> configurados. Se creará automáticamente un registro de respaldo con la versión previa.
            </p>

            <pre className="bg-black/60 p-3 border border-secondary/30 font-mono-label text-[11px] text-secondary max-h-48 overflow-y-auto">
              {formatearJsonVista(propuesta)}
            </pre>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalConfirmar(false)}
                className="px-4 py-2 border border-on-surface-variant/40 font-mono-label text-[11px] text-on-surface-variant hover:text-white uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAplicarEnDrive}
                disabled={guardando}
                className="px-5 py-2 bg-secondary text-black font-mono-label text-[11px] font-bold uppercase hover:bg-secondary/90 flex items-center gap-2 cursor-pointer"
              >
                {guardando ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                    Guardando...
                  </>
                ) : (
                  'Confirmar y Actualizar Drive'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Restaurar JSON Original en Drive */}
      {modalRestaurar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-lg w-full bg-surface-container border border-secondary p-6 shadow-[0_0_30px_rgba(166,226,46,0.3)] space-y-4">
            <div className="flex items-center gap-2 text-secondary font-mono-label text-[13px] font-bold uppercase">
              <span className="material-symbols-outlined text-[20px]">settings_backup_restore</span>
              Confirmar Restauración del JSON Original
            </div>

            <p className="font-mono-label text-on-surface-variant text-[12px]">
              Esta acción sobrescribirá el archivo <strong>ejemplo.json</strong> en Google Drive con el <strong>JSON original de 43 botones</strong>. Se guardará un respaldo previo en el historial de auditoría.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalRestaurar(false)}
                className="px-4 py-2 border border-on-surface-variant/40 font-mono-label text-[11px] text-on-surface-variant hover:text-white uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRestaurarOriginalEnDrive}
                disabled={restaurando}
                className="px-5 py-2 bg-secondary text-black font-mono-label text-[11px] font-bold uppercase hover:bg-secondary/90 flex items-center gap-2 cursor-pointer"
              >
                {restaurando ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                    Restaurando...
                  </>
                ) : (
                  'Confirmar y Restaurar en Drive'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
