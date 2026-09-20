const { Usuario } = require('../models');

const incluirUsuarioEnPartida = {
  model: Usuario,
  as: 'usuario',
  attributes: ['id', 'nombre', 'correo', 'rol']
};

const incluirDetallesGrupo = [
  {
    model: Usuario,
    as: 'profesor',
    attributes: ['id', 'nombre', 'correo', 'rol']
  },
  {
    model: Usuario,
    as: 'estudiantes',
    attributes: ['id', 'nombre', 'correo', 'rol'],
    through: { attributes: [] }
  }
];

async function validarEstudiantes(ids) {
  const estudiantes = await Usuario.findAll({
    where: { id: ids },
    attributes: ['id', 'rol']
  });
  const idsNormalizados = ids.map((id) => Number(id));
  const sonEstudiantes = estudiantes.length === idsNormalizados.length
    && estudiantes.every((usuario) => usuario.rol === 'estudiante' || usuario.rol === 'user');

  if (!sonEstudiantes) {
    throw new Error('Solo se pueden inscribir usuarios con rol de estudiante.');
  }
}

function puedeGestionarGrupo(req, grupo) {
  return req.usuario?.rol === 'admin'
    || (req.usuario?.rol === 'profesor' && Number(grupo.profesorId) === Number(req.usuario.id));
}

function serializarPartida(partida) {
  const data = partida.toJSON();
  return {
    ...data,
    username: data.usuario?.correo || data.username || null
  };
}

async function buscarUsuarioParaPartida(body) {
  if (body.usuarioId) {
    return Usuario.findByPk(body.usuarioId);
  }

  const identificador = body.username || body.correo;
  if (!identificador) return null;

  return Usuario.findOne({
    where: { correo: identificador.toLowerCase().trim() }
  });
}

module.exports = {
  incluirUsuarioEnPartida,
  incluirDetallesGrupo,
  validarEstudiantes,
  puedeGestionarGrupo,
  serializarPartida,
  buscarUsuarioParaPartida
};
