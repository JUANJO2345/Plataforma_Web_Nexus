import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthStore';

const TEMAS_SUGERIDOS = [
  'Laboratorio de Química',
  'Estación Espacial',
  'Taller de Robótica',
  'Anatomía y Medicina',
  'Exploración Marina',
  'Entorno Urbano y Tráfico'
];

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
  const [propuesta, setPropuesta] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);
  const [error, setError] = useState(null);

  // Estados de Drive y Auditoría
  const [estadoSistema, setEstadoSistema] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [modalConfirmar, setModalConfirmar] = useState(false);

  // Cargar estado inicial y de Drive
  useEffect(() => {
    cargarEstado();
    cargarHistorial();
  }, []);

  const cargarEstado = async () => {
    try {
      const res = await authFetch('/api/ai/estado');
      if (res.ok) {
        const data = await res.json();
        setEstadoSistema(data);
      }
    } catch (err) {
      console.error('Error cargando estado:', err);
    }
  };

  const cargarHistorial = async () => {
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
  };

  // Manejadores de elementos sugeridos
  const agregarElemento = () => {
    const limpio = nuevoElemento.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (limpio && !elementosSugeridos.includes(limpio)) {
      setElementosSugeridos([...elementosSugeridos, limpio]);
      setNuevoElemento('');
    }
  };

  const removerElemento = (item) => {
    setElementosSugeridos(elementosSugeridos.filter((e) => e !== item));
  };

  // 1. Solicitar propuesta a Gemini
  const handleGenerarPropuesta = async (e) => {
    e.preventDefault();
    if (!tema && !peticion) {
      setError('Por favor indica un tema o escribe una petición para Gemini.');
      return;
    }

    try {
      setGenerando(true);
      setError(null);
      setMensajeExito(null);

      const res = await authFetch('/api/ai/propuesta', {
        method: 'POST',
        body: JSON.stringify({
          tema,
          peticion,
          elementosSugeridos
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al comunicarse con Gemini API.');
      }

      setPropuesta(data.propuesta);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerando(false);
    }
  };

  // Alternar valor 0 <-> 1 en la propuesta
  const toggleValor = (clave) => {
    if (!propuesta) return;
    setPropuesta({
      ...propuesta,
      [clave]: propuesta[clave] === 1 ? 0 : 1
    });
  };

  // Eliminar elemento de la propuesta
  const eliminarDePropuesta = (clave) => {
    if (!propuesta) return;
    const copia = { ...propuesta };
    delete copia[clave];
    setPropuesta(copia);
  };

  // Descartar propuesta (no toca Drive)
  const handleDescartar = () => {
    setPropuesta(null);
    setError(null);
    setMensajeExito({
      tipo: 'info',
      texto: 'Propuesta descartada. El archivo en Google Drive no ha sufrido modificaciones.'
    });
  };

  // 2. Aceptar y Guardar en Google Drive
  const handleAplicarEnDrive = async () => {
    if (!propuesta || Object.keys(propuesta).length === 0) {
      setError('No hay elementos en la propuesta para guardar.');
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
          tema,
          peticion
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
            Genera configuraciones de elementos para el entorno de Realidad Virtual. Gemini nunca modifica Drive directamente; solo tú decides si guardar la propuesta en el archivo JSON.
          </p>
        </div>

        {/* Indicadores de Estado */}
        <div className="flex flex-col gap-2 font-mono-label text-[11px]">
          <div className="flex items-center gap-2 bg-surface-container-highest/60 px-3 py-1.5 border border-primary/20">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="text-on-surface-variant">Modelo:</span>
            <span className="text-primary font-bold">{estadoSistema?.modeloGemini || 'gemini-1.5-flash'}</span>
          </div>

          <div className="flex items-center gap-2 bg-surface-container-highest/60 px-3 py-1.5 border border-orange-400/20">
            <span className={`w-2 h-2 rounded-full ${estadoSistema?.tieneDriveCredentials ? 'bg-secondary' : 'bg-orange-400'}`}></span>
            <span className="text-on-surface-variant">Drive Target:</span>
            <a
              href={`https://drive.google.com/file/d/${estadoSistema?.archivoId || '1mxonSdL8ydZQM0aOZn-0tTJZ3q4UgFK_'}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 underline font-bold hover:text-orange-300"
              title="Ver archivo en Drive"
            >
              ejemplo.json
            </a>
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
        {/* Columna Izquierda: Formulario de Petición del Profesor */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleGenerarPropuesta} className="border border-primary/30 bg-surface-container-low/40 p-6 backdrop-blur-md space-y-5">
            <div className="flex items-center justify-between border-b border-primary/20 pb-3">
              <h3 className="font-mono-label text-primary text-[13px] font-bold uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                Petición del Profesor
              </h3>
              <span className="font-mono-label text-on-surface-variant text-[10px] uppercase">PASO 1</span>
            </div>

            {/* Selector de Tema */}
            <div>
              <label className="block font-mono-label text-[11px] uppercase text-on-surface-variant mb-1 font-bold">
                1. Tema del Entorno VR
              </label>
              <input
                type="text"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Ej: Laboratorio de Química, Estación Espacial..."
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

            {/* Petición / Prompt */}
            <div>
              <label className="block font-mono-label text-[11px] uppercase text-on-surface-variant mb-1 font-bold">
                2. Instrucción o Petición para Gemini
              </label>
              <textarea
                rows={4}
                value={peticion}
                onChange={(e) => setPeticion(e.target.value)}
                placeholder="Ej: Activar los elementos de medición y seguridad personal, y desactivar reactivos inflamables o equipos pesados para esta práctica inicial."
                className="w-full bg-surface-container-highest/80 border border-primary/40 px-3 py-2 text-[13px] font-mono-label text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary focus:shadow-[0_0_10px_rgba(0,220,230,0.3)] transition-all resize-none"
              ></textarea>
            </div>

            {/* Elementos específicos opcionales */}
            <div>
              <label className="block font-mono-label text-[11px] uppercase text-on-surface-variant mb-1 font-bold">
                3. Elementos específicos a incluir (Opcional)
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
                  placeholder="Ej: microscopio, bata_proteccion"
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
                  <span>CONSULTANDO_GEMINI_FLASH...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">psychology</span>
                  <span>// GENERAR_PROPUESTA_CON_IA</span>
                </>
              )}
            </button>
          </form>

          {/* Botón para ver Historial de Auditoría */}
          <div className="border border-orange-400/30 bg-surface-container-low/40 p-4">
            <button
              type="button"
              onClick={() => setMostrarHistorial(!mostrarHistorial)}
              className="w-full flex items-center justify-between text-orange-400 font-mono-label text-[12px] uppercase font-bold hover:text-orange-300 transition-colors"
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

        {/* Columna Derecha: Vista Previa y Decisión del Profesor */}
        <div className="lg:col-span-7 space-y-6">
          <div className="border border-primary/30 bg-surface-container-low/40 p-6 backdrop-blur-md space-y-5">
            <div className="flex items-center justify-between border-b border-primary/20 pb-3">
              <h3 className="font-mono-label text-primary text-[13px] font-bold uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">tune</span>
                Propuesta Recibida (Validación y Ajuste)
              </h3>
              <span className="font-mono-label text-on-surface-variant text-[10px] uppercase">PASO 2</span>
            </div>

            {!propuesta ? (
              <div className="py-16 text-center border border-dashed border-primary/20 bg-surface-container-highest/20 p-8">
                <span className="material-symbols-outlined text-primary/40 text-[48px] mb-2 block">
                  psychology_alt
                </span>
                <p className="font-mono-label text-primary/70 text-[13px] uppercase font-bold">
                  Sin propuesta generada
                </p>
                <p className="font-mono-label text-on-surface-variant text-[11px] max-w-sm mx-auto mt-1">
                  Escribe un tema o instrucción a la izquierda y pulsa "Generar Propuesta con IA". Podrás revisar cada elemento antes de guardarlo en Drive.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-primary/5 border border-primary/30 p-3 font-mono-label text-[11px] text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">info</span>
                  <span>
                    Haz clic en los botones para alternar entre <strong>1 (Activo)</strong> y <strong>0 (Inactivo)</strong> según requieras.
                  </span>
                </div>

                {/* Lista Interactiva de Claves y Valores */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {Object.entries(propuesta).map(([clave, valor]) => (
                    <div
                      key={clave}
                      className={`flex items-center justify-between p-3 border transition-all ${
                        valor === 1
                          ? 'border-secondary/60 bg-secondary/10 shadow-[inset_2px_0_0_#a6e22e]'
                          : 'border-on-surface-variant/30 bg-surface-container-highest/40'
                      }`}
                    >
                      <div className="truncate mr-2">
                        <span className="font-mono-label text-[12px] font-bold text-on-surface block truncate">
                          {clave}
                        </span>
                        <span className="font-mono-label text-[10px] text-on-surface-variant">
                          {valor === 1 ? '1 // VERDADERO' : '0 // FALSO'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleValor(clave)}
                          className={`px-3 py-1 font-mono-label text-[11px] font-bold uppercase transition-all cursor-pointer border ${
                            valor === 1
                              ? 'bg-secondary text-black border-secondary hover:bg-secondary/90'
                              : 'border-on-surface-variant/40 text-on-surface-variant hover:text-white hover:border-white'
                          }`}
                        >
                          {valor === 1 ? '1 (ON)' : '0 (OFF)'}
                        </button>

                        <button
                          type="button"
                          onClick={() => eliminarDePropuesta(clave)}
                          className="text-on-surface-variant/50 hover:text-error transition-colors p-1"
                          title="Eliminar elemento"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vista previa JSON crudo */}
                <div>
                  <span className="block font-mono-label text-[10px] text-on-surface-variant uppercase font-bold mb-1">
                    // FORMATO_JSON_PARA_DRIVE (ejemplo.json)
                  </span>
                  <pre className="bg-black/80 border border-primary/30 p-3 font-mono-label text-[11px] text-primary overflow-x-auto max-h-48 selection:bg-primary selection:text-black">
                    {JSON.stringify(propuesta, null, 2)}
                  </pre>
                </div>

                {/* Acciones del Profesor: Aceptar y Guardar vs Descartar */}
                <div className="border-t border-primary/20 pt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setModalConfirmar(true)}
                    disabled={guardando}
                    className="flex-1 py-3 bg-secondary text-black font-mono-label font-bold uppercase tracking-wider text-[12px] hover:shadow-[0_0_20px_rgba(166,226,46,0.6)] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                    <span>Aceptar y Guardar en Drive</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDescartar}
                    disabled={guardando}
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
                        por {log.usuario?.username || 'Profesor'} ({log.usuario?.email})
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
                          setPropuesta(parsed);
                          setTema(log.tema || '');
                          setPeticion(log.peticion || '');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        } catch (e) {
                          console.error('Error al cargar versión:', e);
                        }
                      }}
                      className="px-2.5 py-1 border border-orange-400/40 text-orange-400 hover:bg-orange-400/10 uppercase text-[10px] font-bold"
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

      {/* Modal de Confirmación para Guardar en Drive */}
      {modalConfirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-lg w-full bg-surface-container border border-secondary p-6 shadow-[0_0_30px_rgba(166,226,46,0.3)] space-y-4">
            <div className="flex items-center gap-2 text-secondary font-mono-label text-[13px] font-bold uppercase">
              <span className="material-symbols-outlined text-[20px]">warning</span>
              Confirmar Guardado en Google Drive
            </div>

            <p className="font-mono-label text-on-surface-variant text-[12px]">
              Se actualizará el archivo <strong>ejemplo.json</strong> en Google Drive con la propuesta seleccionada. Se creará automáticamente un registro de respaldo con la versión previa.
            </p>

            <div className="bg-black/60 p-3 border border-secondary/30 font-mono-label text-[11px] text-secondary max-h-36 overflow-y-auto">
              {JSON.stringify(propuesta, null, 2)}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalConfirmar(false)}
                className="px-4 py-2 border border-on-surface-variant/40 font-mono-label text-[11px] text-on-surface-variant hover:text-white uppercase"
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
    </div>
  );
}
