import React, { useState, useEffect } from 'react';

export default function UserManagement() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados para el Formulario (Crear / Editar)
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [formData, setFormData] = useState({ correo: '', contrasena: '', nombre: '', rol: 'user' });

  // Cargar usuarios al montar el componente
  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/usuarios');
      if (!res.ok) throw new Error('No se pudo establecer conexión con el nodo de usuarios.');
      const data = await res.json();
      setUsuarios(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  // Manejar cambios en los inputs
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Crear o Editar Usuario
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.correo || (!isEditing && !formData.contrasena)) {
      alert('[!] Parámetros insuficientes para la operación.');
      return;
    }

    try {
      const url = isEditing ? `/api/usuarios/${selectedId}` : '/api/usuarios';
      const method = isEditing ? 'PUT' : 'POST';
      
      const payload = { ...formData };
      // Si estamos editando y dejaron la clave vacía, la eliminamos para no sobreescribir con texto vacío
      if (isEditing && !payload.contrasena) delete payload.contrasena;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Fallo en la escritura de base de datos.');

      // Limpiar formulario y recargar lista
      setFormData({ correo: '', contrasena: '', nombre: '', rol: 'user' });
      setIsEditing(false);
      setSelectedId(null);
      fetchUsuarios();
    } catch (err) {
      alert(`[!] CRITICAL_WRITE_ERROR: ${err.message}`);
    }
  };

  // Preparar la interfaz para editar
  const handleEditClick = (usuario) => {
    setIsEditing(true);
    setSelectedId(usuario.id);
    setFormData({
      correo: usuario.correo,
      nombre: usuario.nombre || '',
      rol: usuario.rol || 'user',
      contrasena: ''
    });
  };

  // Eliminar Usuario
  const handleDelete = async (id) => {
    if (!confirm('¿Seguro que deseas desvincular a este operador de la red central?')) return;

    try {
      const res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo purgar el registro.');
      fetchUsuarios();
    } catch (err) {
      alert(`[!] CRITICAL_DELETE_ERROR: ${err.message}`);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      
      {/* Columna Izquierda: Tabla de Operadores */}
      <div className="xl:col-span-2 border border-primary/30 bg-surface-container-low/40 p-6 backdrop-blur-md relative overflow-hidden shadow-[0_0_15px_rgba(0,220,230,0.02)]">
        <h3 className="font-mono-label text-primary text-[12px] font-bold mb-4 uppercase tracking-wider">// NETWORK_OPERATORS_INDEX</h3>
        
        {error && <div className="p-3 mb-4 border border-error/30 bg-error-container/10 font-mono-label text-[11px] text-on-error">[!] {error}</div>}

        {loading ? (
          <div className="font-mono-label text-on-surface-variant animate-pulse text-[12px] py-4">&gt; LOADING_OPERATOR_STREAM...</div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left font-mono-label text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-primary/20 text-primary uppercase text-[11px]">
                  <th className="py-2 px-3">ID</th>
                  <th className="py-2 px-3">Nombre</th>
                  <th className="py-2 px-3">Correo / Identificador</th>
                  <th className="py-2 px-3">Rol</th>
                  <th className="py-2 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-primary/10 hover:bg-primary/5 transition-colors">
                    <td className="py-3 px-3 text-on-surface-variant">#{String(u.id).padStart(3, '0')}</td>
                    <td className="py-3 px-3 font-bold text-on-surface">{u.nombre || 'N/A'}</td>
                    <td className="py-3 px-3 text-primary">{u.correo}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 text-[10px] uppercase font-bold border ${
                        u.rol === 'admin'
                          ? 'border-secondary text-secondary'
                          : 'border-primary/30 text-on-surface-variant'
                      }`}>
                        {u.rol || 'user'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button 
                        onClick={() => handleEditClick(u)}
                        className="px-2 py-1 border border-primary/40 text-primary text-[10px] uppercase hover:bg-primary hover:text-black transition-all cursor-pointer"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(u.id)}
                        className="px-2 py-1 border border-error/40 text-error text-[10px] uppercase hover:bg-error hover:text-white transition-all cursor-pointer"
                      >
                        Purge
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Columna Derecha: Formulario Inserción / Edición */}
      <div className="border border-secondary/30 bg-surface-container-low/40 p-6 backdrop-blur-md relative shadow-[0_0_15px_rgba(166,226,46,0.02)]">
        <h3 className="font-mono-label text-secondary text-[12px] font-bold mb-4 uppercase tracking-wider">
          {isEditing ? '// UPDATE_OPERATOR_SIGNATURE' : '// REGISTER_NEW_NODE'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4 font-mono-label text-[12px]">
          <div>
            <label className="block text-on-surface-variant/80 mb-1 uppercase text-[11px]">Nombre de Operador</label>
            <input 
              type="text" 
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ej: j_silverhand"
              className="w-full bg-surface-container-high/60 border border-secondary/20 p-2 text-on-surface focus:outline-none focus:border-secondary transition-colors"
            />
          </div>

          <div>
            <label className="block text-on-surface-variant/80 mb-1 uppercase text-[11px]">Correo Electrónico (Obligatorio)</label>
            <input 
              type="email" 
              name="correo"
              value={formData.correo}
              onChange={handleChange}
              placeholder="operador@nexus.com"
              className="w-full bg-surface-container-high/60 border border-secondary/20 p-2 text-on-surface focus:outline-none focus:border-secondary transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-on-surface-variant/80 mb-1 uppercase text-[11px]">Rol del Operador</label>
            <select
              name="rol"
              value={formData.rol}
              onChange={handleChange}
              className="w-full bg-surface-container-high/60 border border-secondary/20 p-2 text-on-surface focus:outline-none focus:border-secondary transition-colors"
            >
              <option value="user">user — Operador</option>
              <option value="admin">admin — Administrador</option>
            </select>
          </div>

          <div>
            <label className="block text-on-surface-variant/80 mb-1 uppercase text-[11px]">
              {isEditing ? 'Nueva Contraseña (Dejar vacío para mantener)' : 'Contraseña de Red'}
            </label>
            <input 
              type="password" 
              name="contrasena"
              value={formData.contrasena}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full bg-surface-container-high/60 border border-secondary/20 p-2 text-on-surface focus:outline-none focus:border-secondary transition-colors"
              required={!isEditing}
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button 
              type="submit" 
              className="flex-1 py-3 bg-secondary text-surface font-bold uppercase tracking-wider hover:shadow-[0_0_15px_rgba(166,226,46,0.5)] transition-all cursor-pointer"
            >
              {isEditing ? 'COMMIT_CHANGES' : 'INJECT_NODE'}
            </button>
            {isEditing && (
              <button 
                type="button" 
                onClick={() => {
                  setIsEditing(false);
                  setSelectedId(null);
                  setFormData({ correo: '', contrasena: '', nombre: '', rol: 'user' });
                }}
                className="px-3 py-3 border border-on-surface-variant/30 text-on-surface-variant uppercase hover:bg-surface-container transition-all cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

    </div>
  );
}