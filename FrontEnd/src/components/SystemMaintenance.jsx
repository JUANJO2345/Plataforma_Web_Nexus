import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthStore';

export default function SystemMaintenance() {
  const { authFetch, actualizarToken } = useAuth();
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados del modal de reinicio de base de datos
  const [modalAbierto, setModalAbierto] = useState(false);
  const [textoConfirmacion, setTextoConfirmacion] = useState('');
  const [seedDemo, setSeedDemo] = useState(true);
  const [reiniciando, setReiniciando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState(null);
  const [mensajeError, setMensajeError] = useState(null);

  // Estados para Backup de Base de Datos (.bak)
  const [backups, setBackups] = useState([]);
  const [cargandoBackups, setCargandoBackups] = useState(true);
  const [generandoBackup, setGenerandoBackup] = useState(false);
  const [descargandoBackup, setDescargandoBackup] = useState(null);
  const [eliminandoBackup, setEliminandoBackup] = useState(null);
  const [backupExito, setBackupExito] = useState(null);
  const [backupError, setBackupError] = useState(null);

  const cargarEstado = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/sistema/estado');
      if (!res.ok) throw new Error('No se pudo establecer enlace con los servicios de mantenimiento.');
      const data = await res.json();
      setMetricas(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const cargarBackups = useCallback(async () => {
    try {
      setCargandoBackups(true);
      const res = await authFetch('/api/sistema/backups');
      if (!res.ok) throw new Error('No se pudo obtener la lista de copias de seguridad.');
      const data = await res.json();
      setBackups(data);
    } catch (err) {
      console.error('Error al cargar historial de backups:', err);
    } finally {
      setCargandoBackups(false);
    }
  }, [authFetch]);

  useEffect(() => {
    let activo = true;
    const inicializar = async () => {
      try {
        const [resEstado, resBackups] = await Promise.all([
          authFetch('/api/sistema/estado'),
          authFetch('/api/sistema/backups')
        ]);
        if (!activo) return;
        if (!resEstado.ok) {
          throw new Error('No se pudo establecer enlace con los servicios de mantenimiento.');
        }
        const dataEstado = await resEstado.json();
        if (activo) {
          setMetricas(dataEstado);
          setError(null);
        }
        if (resBackups.ok) {
          const dataBackups = await resBackups.json();
          if (activo) setBackups(dataBackups);
        }
      } catch (err) {
        if (activo) setError(err.message);
      } finally {
        if (activo) {
          setLoading(false);
          setCargandoBackups(false);
        }
      }
    };
    inicializar();
    return () => {
      activo = false;
    };
  }, [authFetch]);

  // Función utilitaria para descargar Blob en el cliente
  const descargarBlob = (blob, nombreArchivo) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const generarYDescargarBackup = async () => {
    try {
      setGenerandoBackup(true);
      setBackupError(null);
      setBackupExito(null);

      const res = await authFetch('/api/sistema/backup/descargar');
      if (!res.ok) {
        const dataError = await res.json().catch(() => ({}));
        throw new Error(dataError.error || dataError.detalle || 'Error al generar la copia de seguridad (.bak).');
      }

      // Obtener el nombre del archivo enviado en el header o generar uno seguro
      const disposition = res.headers.get('content-disposition');
      let nombreArchivo = `nexus_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) nombreArchivo = match[1];
      }

      const blob = await res.blob();
      descargarBlob(blob, nombreArchivo);

      setBackupExito(`Backup (.bak) generado y descargado exitosamente: ${nombreArchivo}`);
      await cargarBackups();
    } catch (err) {
      setBackupError(err.message);
    } finally {
      setGenerandoBackup(false);
    }
  };

  const descargarBackupExistente = async (nombreArchivo) => {
    try {
      setDescargandoBackup(nombreArchivo);
      setBackupError(null);
      const res = await authFetch(`/api/sistema/backups/${encodeURIComponent(nombreArchivo)}/descargar`);
      if (!res.ok) {
        const dataError = await res.json().catch(() => ({}));
        throw new Error(dataError.error || 'Error al descargar la copia de seguridad.');
      }
      const blob = await res.blob();
      descargarBlob(blob, nombreArchivo);
      setBackupExito(`Copia de seguridad descargada: ${nombreArchivo}`);
    } catch (err) {
      setBackupError(err.message);
    } finally {
      setDescargandoBackup(null);
    }
  };

  const eliminarBackupArchivo = async (nombreArchivo) => {
    if (!window.confirm(`¿Confirmas la eliminación del respaldo "${nombreArchivo}" en el servidor?`)) return;
    try {
      setEliminandoBackup(nombreArchivo);
      setBackupError(null);
      const res = await authFetch(`/api/sistema/backups/${encodeURIComponent(nombreArchivo)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const dataError = await res.json().catch(() => ({}));
        throw new Error(dataError.error || 'No se pudo eliminar el archivo de respaldo.');
      }
      setBackupExito(`Archivo de respaldo "${nombreArchivo}" eliminado.`);
      await cargarBackups();
    } catch (err) {
      setBackupError(err.message);
    } finally {
      setEliminandoBackup(null);
    }
  };

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return '—';
    const fecha = new Date(fechaStr);
    return fecha.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const ejecutarReinicioBaseDatos = async () => {
    if (textoConfirmacion.trim().toUpperCase() !== 'REINICIAR') {
      alert('Debes escribir la palabra "REINICIAR" para autorizar esta operación.');
      return;
    }

    try {
      setReiniciando(true);
      setMensajeError(null);
      const res = await authFetch('/api/sistema/reiniciar-db', {
        method: 'POST',
        body: JSON.stringify({
          seedDemo,
          confirmacion: textoConfirmacion.trim().toUpperCase()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || data.detalle || 'Error al ejecutar el reinicio de la base de datos.');
      }

      if (data.token) {
        actualizarToken(data.token, data.adminId ? { id: data.adminId } : {});
      }

      setMensajeExito(data.message || 'Base de datos reiniciada con éxito.');
      setModalAbierto(false);
      setTextoConfirmacion('');

      // Recargar telemetría del sistema y backups
      await cargarEstado();
      await cargarBackups();
    } catch (err) {
      setMensajeError(err.message);
    } finally {
      setReiniciando(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Banner de éxito post-reinicio */}
      {mensajeExito && (
        <div className="p-4 border-2 border-secondary bg-secondary/10 font-mono-label text-[12px] text-secondary flex items-center justify-between shadow-[0_0_15px_rgba(166,226,46,0.3)]">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            <span>[+] {mensajeExito}</span>
          </div>
          <button
            onClick={() => setMensajeExito(null)}
            className="text-secondary hover:text-white cursor-pointer px-2 py-0.5 border border-secondary/30 text-[11px]"
          >
            Cerrar
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 border border-error/30 bg-error-container/10 font-mono-label text-[12px] text-on-error flex items-center gap-2">
          <span className="material-symbols-outlined">warning</span> [!] ERROR: {error}
        </div>
      )}

      {/* 1. ESTADO DE INFRAESTRUCTURA Y BASE DE DATOS */}
      <div className="border border-primary/40 bg-surface-container-low/60 p-6 backdrop-blur-md space-y-6 shadow-[0_0_20px_rgba(0,220,230,0.08)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-primary/20 pb-4">
          <div>
            <div className="font-mono-label text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-primary animate-pulse"></span>
              // DIAGNOSTICO_DEL_SISTEMA :: SQLite_ENGINE
            </div>
            <h3 className="font-display text-[22px] text-primary font-bold mt-1">
              Telemetría y Estado de Almacenamiento
            </h3>
            <p className="font-mono-label text-[11px] text-on-surface-variant/70 mt-0.5">
              Inspección en tiempo real de registros, relaciones de usuarios y catálogos en base de datos.
            </p>
          </div>

          <button
            onClick={cargarEstado}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 font-mono-label text-[11px] uppercase border border-primary/40 text-primary hover:bg-primary/10 transition-all cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>sync</span>
            <span>Sincronizar</span>
          </button>
        </div>

        {/* Tarjetas de registros */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="border border-primary/30 bg-surface-container/50 p-3.5">
            <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Usuarios</div>
            <div className="font-display text-[22px] text-primary font-bold mt-1">
              {metricas ? metricas.totalUsuarios : '—'}
            </div>
          </div>

          <div className="border border-secondary/30 bg-surface-container/50 p-3.5">
            <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Partidas</div>
            <div className="font-display text-[22px] text-secondary font-bold mt-1">
              {metricas ? metricas.totalPartidas : '—'}
            </div>
          </div>

          <div className="border border-orange-400/30 bg-surface-container/50 p-3.5">
            <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Grupos</div>
            <div className="font-display text-[22px] text-orange-400 font-bold mt-1">
              {metricas ? metricas.totalGrupos : '—'}
            </div>
          </div>

          <div className="border border-pink-400/30 bg-surface-container/50 p-3.5">
            <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Logs IA</div>
            <div className="font-display text-[22px] text-pink-400 font-bold mt-1">
              {metricas ? metricas.totalLogs : '—'}
            </div>
          </div>

          <div className="border border-primary/30 bg-surface-container/50 p-3.5">
            <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Etapas</div>
            <div className="font-display text-[22px] text-primary font-bold mt-1">
              {metricas ? metricas.totalEtapas : '—'}
            </div>
          </div>

          <div className="border border-secondary/30 bg-surface-container/50 p-3.5">
            <div className="font-mono-label text-[10px] text-on-surface-variant uppercase">Niveles</div>
            <div className="font-display text-[22px] text-secondary font-bold mt-1">
              {metricas ? metricas.totalNiveles : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. PANEL DE COPIA DE SEGURIDAD / BACKUP (.bak) */}
      <div className="border-2 border-secondary/50 bg-surface-container-low/80 p-6 backdrop-blur-md space-y-5 shadow-[0_0_25px_rgba(166,226,46,0.12)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 bg-secondary/10 border-2 border-secondary/60 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-secondary text-[32px]">cloud_download</span>
            </div>
            <div>
              <div className="font-mono-label text-[10px] text-secondary font-bold uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-secondary animate-pulse"></span>
                // COPIA_DE_SEGURIDAD :: SNAPSHOT_CORE (.bak)
              </div>
              <h3 className="font-display text-[22px] text-on-surface font-bold">
                Copia de Seguridad de la Base de Datos (.bak)
              </h3>
              <p className="font-mono-label text-[11px] text-on-surface-variant/80 mt-1 max-w-xl">
                Genera y descarga un volcado completo de la base de datos relacional en formato <span className="text-secondary font-bold">.bak</span> (SQLite consistente) para resguardar usuarios, grupos, partidas y configuraciones.
              </p>
            </div>
          </div>

          <button
            onClick={generarYDescargarBackup}
            disabled={generandoBackup}
            className="flex items-center gap-2.5 px-5 py-3 font-mono-label text-[12px] uppercase font-bold border-2 border-secondary bg-secondary/15 text-secondary hover:bg-secondary hover:text-black transition-all cursor-pointer shadow-[0_0_15px_rgba(166,226,46,0.3)] shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generandoBackup ? (
              <>
                <span className="material-symbols-outlined text-[20px] animate-spin">sync</span>
                <span>Generando Backup (.bak)...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">download</span>
                <span>Hacer Backup (.bak)</span>
              </>
            )}
          </button>
        </div>

        {/* Banner de éxito de backup */}
        {backupExito && (
          <div className="p-3 border border-secondary bg-secondary/10 font-mono-label text-[12px] text-secondary flex items-center justify-between shadow-[0_0_15px_rgba(166,226,46,0.2)]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">verified</span>
              <span>[+] {backupExito}</span>
            </div>
            <button
              onClick={() => setBackupExito(null)}
              className="text-secondary hover:text-white px-2 py-0.5 border border-secondary/30 text-[10px] cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Banner de error de backup */}
        {backupError && (
          <div className="p-3 border border-error bg-error/10 font-mono-label text-[12px] text-error flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>[!] {backupError}</span>
            </div>
            <button
              onClick={() => setBackupError(null)}
              className="text-error hover:text-white px-2 py-0.5 border border-error/30 text-[10px] cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Metadatos técnicos del motor */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-surface-container/40 border border-secondary/20 p-3">
            <span className="font-mono-label text-[10px] text-on-surface-variant block uppercase">Formato de Salida</span>
            <span className="font-mono text-[13px] text-secondary font-bold">.BAK (Snapshot)</span>
          </div>
          <div className="bg-surface-container/40 border border-secondary/20 p-3">
            <span className="font-mono-label text-[10px] text-on-surface-variant block uppercase">Método de Captura</span>
            <span className="font-mono text-[13px] text-on-surface font-bold">VACUUM / WAL Safe</span>
          </div>
          <div className="bg-surface-container/40 border border-secondary/20 p-3">
            <span className="font-mono-label text-[10px] text-on-surface-variant block uppercase">Almacenamiento Local</span>
            <span className="font-mono text-[13px] text-on-surface font-bold">Backend/backups/</span>
          </div>
          <div className="bg-surface-container/40 border border-secondary/20 p-3">
            <span className="font-mono-label text-[10px] text-on-surface-variant block uppercase">Copias en Servidor</span>
            <span className="font-mono text-[13px] text-secondary font-bold">{backups.length} archivo(s)</span>
          </div>
        </div>

        {/* Tabla / Historial de respaldos disponibles */}
        <div className="border border-secondary/20 bg-surface-container/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-mono-label text-[11px] text-secondary uppercase font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">folder_zip</span>
              Respaldos Archivados en el Servidor
            </div>
            <button
              onClick={cargarBackups}
              disabled={cargandoBackups}
              className="text-on-surface-variant hover:text-secondary font-mono-label text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
              title="Actualizar lista de copias"
            >
              <span className={`material-symbols-outlined text-[15px] ${cargandoBackups ? 'animate-spin' : ''}`}>sync</span>
              <span>Actualizar</span>
            </button>
          </div>

          {backups.length === 0 ? (
            <div className="p-4 text-center border border-dashed border-secondary/20 bg-surface-container-lowest/30">
              <p className="font-mono-label text-[11px] text-on-surface-variant/70">
                No hay copias de seguridad archivadas en el servidor aún. Haz clic en "Hacer Backup (.bak)" para generar una copia y descargarla al instante.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-secondary/10 overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px]">
                <thead>
                  <tr className="text-on-surface-variant/70 font-mono-label text-[10px] uppercase border-b border-secondary/20">
                    <th className="py-2 px-3">Archivo (.bak)</th>
                    <th className="py-2 px-3">Tamaño</th>
                    <th className="py-2 px-3">Fecha de Creación</th>
                    <th className="py-2 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary/10">
                  {backups.map((b) => (
                    <tr key={b.nombreArchivo} className="hover:bg-secondary/5 transition-colors">
                      <td className="py-2.5 px-3 text-secondary font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">description</span>
                        <span className="truncate max-w-[240px] sm:max-w-none">{b.nombreArchivo}</span>
                      </td>
                      <td className="py-2.5 px-3 text-on-surface">{b.tamanoFormateado}</td>
                      <td className="py-2.5 px-3 text-on-surface-variant">{formatearFecha(b.fechaCreacion)}</td>
                      <td className="py-2.5 px-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => descargarBackupExistente(b.nombreArchivo)}
                          disabled={descargandoBackup === b.nombreArchivo}
                          className="px-2.5 py-1 border border-secondary/40 text-secondary hover:bg-secondary hover:text-black font-mono-label text-[10px] uppercase cursor-pointer transition-all inline-flex items-center gap-1"
                          title="Descargar este archivo .bak"
                        >
                          <span className={`material-symbols-outlined text-[13px] ${descargandoBackup === b.nombreArchivo ? 'animate-spin' : ''}`}>
                            {descargandoBackup === b.nombreArchivo ? 'sync' : 'download'}
                          </span>
                          <span>Descargar</span>
                        </button>
                        <button
                          onClick={() => eliminarBackupArchivo(b.nombreArchivo)}
                          disabled={eliminandoBackup === b.nombreArchivo}
                          className="px-2.5 py-1 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-black font-mono-label text-[10px] uppercase cursor-pointer transition-all inline-flex items-center gap-1"
                          title="Eliminar este archivo del servidor"
                        >
                          <span className="material-symbols-outlined text-[13px]">delete</span>
                          <span>Eliminar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 3. PANEL DE PURGA Y REINICIO DE LA BASE DE DATOS */}
      <div className="border-2 border-red-500/50 bg-surface-container-low/80 p-6 backdrop-blur-md space-y-5 shadow-[0_0_25px_rgba(239,68,68,0.15)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 bg-red-500/10 border-2 border-red-500/60 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-red-400 text-[32px]">database</span>
            </div>
            <div>
              <div className="font-mono-label text-[10px] text-red-400 font-bold uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 animate-pulse"></span>
                // ZONA_DE_OPERACION_CRITICA :: PURGA_GLOBAL
              </div>
              <h3 className="font-display text-[22px] text-on-surface font-bold">
                Mantenimiento y Reinicio de la Base de Datos
              </h3>
              <p className="font-mono-label text-[11px] text-on-surface-variant/80 mt-1 max-w-xl">
                Esta herramienta permite reiniciar el motor de base de datos a su estado original o cargar un nuevo set de datos de prueba para estudiantes y profesores.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setModalAbierto(true);
              setTextoConfirmacion('');
              setSeedDemo(true);
              setMensajeError(null);
            }}
            className="flex items-center gap-2.5 px-5 py-3 font-mono-label text-[12px] uppercase font-bold border-2 border-red-500 bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-black transition-all cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.3)] shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">restart_alt</span>
            <span>Reiniciar Base de Datos</span>
          </button>
        </div>

        <div className="border border-red-500/20 bg-surface-container/40 p-4 font-mono text-[11px] text-on-surface-variant space-y-1">
          <div className="text-red-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px]">info</span>
            Protocolo de seguridad:
          </div>
          <p>
            Al reiniciar la base de datos, tu sesión de administrador actual se preservará automáticamente. Podrás optar por sembrar los datos de prueba oficiales (alumnos Ana y Carlos con sus partidas y retroalimentaciones, grupos y catálogo completo).
          </p>
        </div>
      </div>

      {/* 3. MODAL DE CONFIRMACIÓN */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-lg w-full bg-surface border-2 border-red-500 p-6 space-y-5 shadow-[0_0_40px_rgba(239,68,68,0.5)]">
            <div className="flex items-start justify-between border-b border-red-500/30 pb-3">
              <div className="flex items-center gap-2.5 text-red-400">
                <span className="material-symbols-outlined text-[26px]">warning</span>
                <div>
                  <div className="font-mono-label text-[10px] uppercase tracking-wider font-bold">
                    // CONFIRMACION_DE_OPERACION_DESTRUCTIVA
                  </div>
                  <h3 className="font-display text-[19px] font-bold text-on-surface">
                    ¿Reiniciar la Base de Datos?
                  </h3>
                </div>
              </div>
              <button
                disabled={reiniciando}
                onClick={() => setModalAbierto(false)}
                className="text-on-surface-variant hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 font-mono text-[12px] text-on-surface-variant leading-relaxed">
              <div className="p-3 border border-red-500/40 bg-red-500/10 text-red-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5 uppercase text-[11px]">
                  <span className="material-symbols-outlined text-[15px]">dangerous</span>
                  Advertencia de Limpieza Total:
                </div>
                <ul className="list-disc list-inside text-[11px] space-y-0.5 opacity-90">
                  <li>Se eliminarán las partidas y resultados de niveles existentes.</li>
                  <li>Se eliminarán grupos y asignaciones de alumnos antiguos.</li>
                  <li>Se purgarán los logs de auditoría de IA.</li>
                  <li>Se conservará tu cuenta de administrador actual.</li>
                  <li>Se restablecerá el catálogo oficial de etapas y niveles.</li>
                  <li>Sugerencia: Puedes generar un backup (.bak) antes del reinicio para respaldar tus datos.</li>
                </ul>
              </div>

              {/* Opción para sembrar datos de prueba */}
              <label className="flex items-start gap-2.5 p-3 border border-primary/30 bg-surface-container/60 cursor-pointer text-[11px] text-on-surface">
                <input
                  type="checkbox"
                  checked={seedDemo}
                  onChange={(e) => setSeedDemo(e.target.checked)}
                  className="accent-primary w-4 h-4 mt-0.5"
                />
                <div>
                  <strong className="text-primary block">Cargar datos de prueba de estudiantes y profesor</strong>
                  <span className="text-on-surface-variant/80">
                    Crea los usuarios de prueba (Estudiante Ana, Estudiante Carlos, Profesor García y Operador Demo) con grupos y partidas completas de ejemplo.
                  </span>
                </div>
              </label>

              {/* Confirmación con palabra clave */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] text-on-surface-variant block uppercase font-mono-label">
                  Escribe <strong className="text-red-400">REINICIAR</strong> para autorizar:
                </label>
                <input
                  type="text"
                  value={textoConfirmacion}
                  onChange={(e) => setTextoConfirmacion(e.target.value)}
                  placeholder="Escribe REINICIAR"
                  className="w-full bg-surface-container-high border border-red-500/50 p-2.5 font-mono text-[13px] text-red-400 focus:outline-none focus:border-red-400 tracking-wider font-bold"
                />
              </div>

              {mensajeError && (
                <div className="p-2 border border-error bg-error/10 text-error text-[11px] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">error</span>
                  <span>{mensajeError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-primary/20 pt-4">
              <button
                type="button"
                disabled={reiniciando}
                onClick={() => setModalAbierto(false)}
                className="px-4 py-2 font-mono-label text-[11px] uppercase border border-on-surface-variant/40 text-on-surface-variant hover:text-white cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={reiniciando || textoConfirmacion.trim().toUpperCase() !== 'REINICIAR'}
                onClick={ejecutarReinicioBaseDatos}
                className="px-5 py-2 font-mono-label text-[11px] uppercase font-bold border-2 border-red-500 bg-red-500 text-black hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
              >
                {reiniciando ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                    <span>Procesando Reinicio...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                    <span>Confirmar Reinicio</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
