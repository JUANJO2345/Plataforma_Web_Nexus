const { Grupo, Usuario } = require('../models');
const {
  incluirDetallesGrupo,
  validarEstudiantes,
  puedeGestionarGrupo
} = require('../utils/helpers');

// Obtener todos los grupos con su profesor y estudiantes inscritos
async function obtenerTodos(req, res, next) {
  try {
    const whereClause = {};
    if (req.query.profesorId) {
      whereClause.profesorId = req.query.profesorId;
    }

    let grupos = await Grupo.findAll({
      where: whereClause,
      include: incluirDetallesGrupo,
      order: [['id', 'ASC']]
    });

    const rol = req.usuario.rol || 'estudiante';
    // Si el usuario es estudiante u operador, solo puede ver los grupos en los que está inscrito
    const estudianteIdFiltro = (rol === 'estudiante' || rol === 'user')
      ? Number(req.usuario.id)
      : req.query.estudianteId ? parseInt(req.query.estudianteId, 10) : null;

    if (estudianteIdFiltro) {
      grupos = grupos.filter(g => g.estudiantes && g.estudiantes.some(e => Number(e.id) === estudianteIdFiltro));
    }

    res.json(grupos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los grupos', detalle: error.message });
  }
}

// Obtener un grupo por ID
async function obtenerPorId(req, res, next) {
  try {
    const grupo = await Grupo.findByPk(req.params.id, {
      include: incluirDetallesGrupo
    });
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

    const rol = req.usuario.rol || 'estudiante';
    if (rol === 'estudiante' || rol === 'user') {
      const estaInscrito = grupo.estudiantes && grupo.estudiantes.some(e => Number(e.id) === Number(req.usuario.id));
      if (!estaInscrito) {
        return res.status(403).json({ error: 'Acceso restringido: No perteneces a este grupo.' });
      }
    }

    res.json(grupo);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el grupo por ID', detalle: error.message });
  }
}

// Crear un nuevo grupo
async function crear(req, res, next) {
  try {
    const { codigo, nombre, profesorId, estudianteIds } = req.body;
    if (!codigo) {
      return res.status(400).json({ error: 'El campo código es obligatorio.' });
    }

    if (profesorId) {
      const profesor = await Usuario.findByPk(profesorId);
      if (!profesor || profesor.rol !== 'profesor') {
        return res.status(400).json({ error: 'El usuario asignado debe tener el rol de profesor.' });
      }
    }

    const nuevoGrupo = await Grupo.create({
      codigo: codigo.trim(),
      nombre: nombre ? nombre.trim() : null,
      profesorId: profesorId || null
    });

    if (Array.isArray(estudianteIds) && estudianteIds.length > 0) {
      await validarEstudiantes(estudianteIds);
      await nuevoGrupo.setEstudiantes(estudianteIds);
    }

    const grupoConDetalles = await Grupo.findByPk(nuevoGrupo.id, {
      include: incluirDetallesGrupo
    });

    res.status(201).json(grupoConDetalles);
  } catch (error) {
    res.status(400).json({ error: 'Error al crear el grupo', detalle: error.message });
  }
}

// Actualizar un grupo
async function actualizar(req, res, next) {
  try {
    const grupo = await Grupo.findByPk(req.params.id);
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

    const { codigo, nombre, profesorId, estudianteIds } = req.body;

    if (profesorId !== undefined && profesorId !== null) {
      const profesor = await Usuario.findByPk(profesorId);
      if (!profesor || profesor.rol !== 'profesor') {
        return res.status(400).json({ error: 'El usuario asignado debe tener el rol de profesor.' });
      }
    }

    const cambios = {};
    if (codigo !== undefined) cambios.codigo = codigo.trim();
    if (nombre !== undefined) cambios.nombre = nombre.trim();
    if (profesorId !== undefined) cambios.profesorId = profesorId;

    await grupo.update(cambios);

    if (Array.isArray(estudianteIds)) {
      await validarEstudiantes(estudianteIds);
      await grupo.setEstudiantes(estudianteIds);
    }

    const grupoActualizado = await Grupo.findByPk(grupo.id, {
      include: incluirDetallesGrupo
    });

    res.json({ message: 'Grupo actualizado con éxito', grupo: grupoActualizado });
  } catch (error) {
    res.status(400).json({ error: 'Error al actualizar el grupo', detalle: error.message });
  }
}

// Inscribir estudiante(s) a un grupo
async function inscribirEstudiantes(req, res, next) {
  try {
    const grupo = await Grupo.findByPk(req.params.id);
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (!puedeGestionarGrupo(req, grupo)) {
      return res.status(403).json({ error: 'Solo el profesor asignado puede agregar estudiantes a este grupo.' });
    }

    const ids = Array.isArray(req.body.estudianteIds)
      ? req.body.estudianteIds
      : req.body.estudianteId ? [req.body.estudianteId] : [];

    if (ids.length === 0) {
      return res.status(400).json({ error: 'Debe proporcionar estudianteId o estudianteIds.' });
    }

    await validarEstudiantes(ids);
    await grupo.addEstudiantes(ids);

    const grupoActualizado = await Grupo.findByPk(grupo.id, {
      include: incluirDetallesGrupo
    });

    res.json({ message: 'Estudiante(s) inscrito(s) correctamente', grupo: grupoActualizado });
  } catch (error) {
    res.status(400).json({ error: 'Error al inscribir estudiantes en el grupo', detalle: error.message });
  }
}

// Desinscribir un estudiante de un grupo
async function removerEstudiante(req, res, next) {
  try {
    const grupo = await Grupo.findByPk(req.params.id);
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (!puedeGestionarGrupo(req, grupo)) {
      return res.status(403).json({ error: 'Acceso denegado: Solo el profesor asignado o un admin puede remover estudiantes de este grupo.' });
    }

    await grupo.removeEstudiante(req.params.estudianteId);

    const grupoActualizado = await Grupo.findByPk(grupo.id, {
      include: incluirDetallesGrupo
    });

    res.json({ message: 'Estudiante removido del grupo correctamente', grupo: grupoActualizado });
  } catch (error) {
    res.status(500).json({ error: 'Error al remover estudiante del grupo', detalle: error.message });
  }
}

// Eliminar un grupo
async function eliminar(req, res, next) {
  try {
    const filasBorradas = await Grupo.destroy({ where: { id: req.params.id } });
    if (filasBorradas === 0) return res.status(404).json({ error: 'Grupo no encontrado' });

    res.json({ message: 'Grupo eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el grupo', detalle: error.message });
  }
}

module.exports = {
  obtenerTodos,
  obtenerPorId,
  crear,
  actualizar,
  inscribirEstudiantes,
  removerEstudiante,
  eliminar
};
