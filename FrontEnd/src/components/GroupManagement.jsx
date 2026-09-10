import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthStore';

export default function GroupManagement() {
  const { authFetch } = useAuth();
  const [grupos, setGrupos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    profesorId: '',
    estudianteIds: []
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resGrupos, resUsuarios] = await Promise.all([
        authFetch('/api/grupos'),
        authFetch('/api/usuarios')
      ]);

      if (!resGrupos.ok || !resUsuarios.ok) {
        throw new Error('No se pudo cargar la información de grupos o usuarios.');
      }

      const dataGrupos = await resGrupos.json();
      const dataUsuarios = await resUsuarios.json();

      setGrupos(dataGrupos);
      setUsuarios(dataUsuarios);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const profesores = usuarios.filter((u) => u.rol === 'profesor');
  const estudiantes = usuarios.filter((u) => u.rol === 'estudiante' || u.rol === 'user');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleStudentToggle = (studentId) => {
    const current = formData.estudianteIds;
    if (current.includes(studentId)) {
      setFormData({ ...formData, estudianteIds: current.filter((id) => id !== studentId) });
    } else {
      setFormData({ ...formData, estudianteIds: [...current, studentId] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.codigo) {
      alert('[!] El código de grupo es obligatorio.');
      return;
    }

    try {
      const url = isEditing ? `/api/grupos/${selectedId}` : '/api/grupos';
      const method = isEditing ? 'PUT' : 'POST';

      const payload = {
        codigo: formData.codigo,
        nombre: formData.nombre,
        profesorId: formData.profesorId ? parseInt(formData.profesorId, 10) : null,
        estudianteIds: formData.estudianteIds.map((id) => parseInt(id, 10))
      };

      const res = await authFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const dataErr = await res.json();
        throw new Error(dataErr.error || 'Error al procesar la solicitud del grupo.');
      }

      resetForm();
      fetchData();
    } catch (err) {
      alert(`[!] GROUP_MANAGEMENT_ERROR: ${err.message}`);
    }
  };

  const handleEditClick = (grupo) => {
    setIsEditing(true);
    setSelectedId(grupo.id);
    setFormData({
      codigo: grupo.codigo || '',
      nombre: grupo.nombre || '',
      profesorId: grupo.profesorId ? String(grupo.profesorId) : '',
      estudianteIds: grupo.estudiantes ? grupo.estudiantes.map((e) => e.id) : []
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar este grupo?')) return;

    try {
      const res = await authFetch(`/api/grupos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo eliminar el grupo.');
      fetchData();
    } catch (err) {
      alert(`[!] GROUP_DELETE_ERROR: ${err.message}`);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setSelectedId(null);
    setFormData({ codigo: '', nombre: '', profesorId: '', estudianteIds: [] });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      {/* Columna izquierda: Lista de Grupos */}
      <div className="xl:col-span-2 border border-primary/30 bg-surface-container-low/40 p-6 backdrop-blur-md relative overflow-hidden shadow-[0_0_15px_rgba(0,220,230,0.02)]">
        <h3 className="font-mono-label text-primary text-[12px] font-bold mb-4 uppercase tracking-wider">
          // GROUPS_REGISTRY_INDEX
        </h3>

        {error && (
          <div className="p-3 mb-4 border border-error/30 bg-error-container/10 font-mono-label text-[11px] text-on-error">
            [!] {error}
          </div>
        )}

        {loading ? (
          <div className="font-mono-label text-on-surface-variant animate-pulse text-[12px] py-4">
            &gt; LOADING_GROUPS_DATA...
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left font-mono-label text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-primary/20 text-primary uppercase text-[11px]">
                  <th className="py-2 px-3">Código</th>
                  <th className="py-2 px-3">Nombre</th>
                  <th className="py-2 px-3">Profesor Asignado</th>
                  <th className="py-2 px-3">Estudiantes Inscritos</th>
                  <th className="py-2 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {grupos.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-on-surface-variant/50">
                      No hay grupos registrados.
                    </td>
                  </tr>
                ) : (
                  grupos.map((g) => (
                    <tr key={g.id} className="border-b border-primary/10 hover:bg-primary/5 transition-colors">
                      <td className="py-3 px-3 font-bold text-primary">{g.codigo}</td>
                      <td className="py-3 px-3 text-on-surface">{g.nombre || 'Sin nombre'}</td>
                      <td className="py-3 px-3">
                        {g.profesor ? (
                          <span className="text-orange-400 font-bold">{g.profesor.nombre || g.profesor.correo}</span>
                        ) : (
                          <span className="text-on-surface-variant/40 italic">Sin Profesor</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 text-[10px] uppercase font-bold border border-primary/40 text-primary">
                          {g.estudiantes ? g.estudiantes.length : 0} Estudiantes
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleEditClick(g)}
                          className="px-2 py-1 border border-primary/40 text-primary text-[10px] uppercase hover:bg-primary hover:text-black transition-all cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(g.id)}
                          className="px-2 py-1 border border-error/40 text-error text-[10px] uppercase hover:bg-error hover:text-white transition-all cursor-pointer"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Columna derecha: Formulario de Creación / Edición de Grupo */}
      <div className="border border-secondary/30 bg-surface-container-low/40 p-6 backdrop-blur-md relative shadow-[0_0_15px_rgba(166,226,46,0.02)]">
        <h3 className="font-mono-label text-secondary text-[12px] font-bold mb-4 uppercase tracking-wider">
          {isEditing ? '// UPDATE_GROUP_DEFINITION' : '// CREATE_NEW_GROUP'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4 font-mono-label text-[12px]">
          <div>
            <label className="block text-on-surface-variant/80 mb-1 uppercase text-[11px]">
              Código del Grupo (Obligatorio)
            </label>
            <input
              type="text"
              name="codigo"
              value={formData.codigo}
              onChange={handleChange}
              placeholder="Ej: GRP-101, MAT-2024"
              className="w-full bg-surface-container-high/60 border border-secondary/20 p-2 text-on-surface focus:outline-none focus:border-secondary transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-on-surface-variant/80 mb-1 uppercase text-[11px]">
              Nombre del Grupo
            </label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ej: Programación Orientada a Objetos"
              className="w-full bg-surface-container-high/60 border border-secondary/20 p-2 text-on-surface focus:outline-none focus:border-secondary transition-colors"
            />
          </div>

          <div>
            <label className="block text-on-surface-variant/80 mb-1 uppercase text-[11px]">
              Profesor Asignado
            </label>
            <select
              name="profesorId"
              value={formData.profesorId}
              onChange={handleChange}
              className="w-full bg-surface-container-high/60 border border-secondary/20 p-2 text-on-surface focus:outline-none focus:border-secondary transition-colors"
            >
              <option value="">-- Sin Profesor Asignado --</option>
              {profesores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre ? `${p.nombre} (${p.correo})` : p.correo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-on-surface-variant/80 mb-2 uppercase text-[11px]">
              Estudiantes Inscritos ({formData.estudianteIds.length} seleccionados)
            </label>
            <div className="max-h-48 overflow-y-auto custom-scrollbar border border-secondary/20 p-2 space-y-1 bg-surface-container-high/40">
              {estudiantes.length === 0 ? (
                <div className="text-[11px] text-on-surface-variant/50 italic">
                  No hay estudiantes registrados.
                </div>
              ) : (
                estudiantes.map((e) => {
                  const isChecked = formData.estudianteIds.includes(e.id);
                  return (
                    <label
                      key={e.id}
                      className="flex items-center gap-2 p-1 hover:bg-primary/10 cursor-pointer text-[11px]"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleStudentToggle(e.id)}
                        className="accent-primary cursor-pointer"
                      />
                      <span className={isChecked ? 'text-primary font-bold' : 'text-on-surface-variant'}>
                        {e.nombre ? `${e.nombre} (${e.correo})` : e.correo}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 py-3 bg-secondary text-surface font-bold uppercase tracking-wider hover:shadow-[0_0_15px_rgba(166,226,46,0.5)] transition-all cursor-pointer"
            >
              {isEditing ? 'UPDATE_GROUP' : 'REGISTER_GROUP'}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-3 border border-on-surface-variant/30 text-on-surface-variant uppercase hover:bg-surface-container transition-all cursor-pointer"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
