# Nexus Plataforma Web

Sistema integral de evaluación cognitiva basado en entornos gamificados. La plataforma permite registrar, procesar y clasificar métricas de desempeño de estudiantes en cuatro dimensiones clave:

- Abstracción
- Pensamiento computacional
- Descomposición
- Reconocimiento de patrones

Cada dimensión se evalúa a través de múltiples niveles de dificultad, permitiendo construir rankings, consultar historial de partidas y visualizar el progreso individual de cada estudiante.

## Estructura del Proyecto

El repositorio está organizado como una aplicación web con dos componentes principales:

```text
Plataforma_Web_Nexus/
├── Backend/     # API REST, persistencia de datos y modelos (Node.js, Express, SQLite, Sequelize)
├── FrontEnd/    # Interfaz de usuario, dashboards y paneles de administración (React, Vite, TailwindCSS)
└── README.md    # Documentación general del sistema
```

## Características Principales

- Registro e inicio de sesión de usuarios.
- Autenticación mediante tokens JWT y cifrado de contraseñas con bcrypt.
- Gestión de usuarios desde una vista administrativa.
- Creación, edición y eliminación de grupos.
- Asignación de profesores y estudiantes a los grupos.
- Búsqueda e inscripción de estudiantes por parte del profesor en sus grupos asignados.
- Registro de partidas asociadas a usuarios reales del sistema.
- Tablas de clasificación por dimensión cognitiva.
- Consulta de desempeño por grupo para profesores.
- Vista individual de grupos y partidas para estudiantes.
- Persistencia local mediante SQLite.

## Modelo de Datos

El sistema trabaja con cuatro entidades principales:

- `Usuario`: representa a un administrador, profesor o estudiante registrado.
- `Partida`: representa una sesión de evaluación cognitiva.
- `Grupo`: representa una clase o grupo de estudiantes.
- `GrupoEstudiante`: relaciona los estudiantes inscritos con sus grupos.

Cada partida pertenece a un usuario mediante la relación `Usuario.hasMany(Partida)` y `Partida.belongsTo(Usuario)`. Esto permite consultar el historial de cada estudiante de forma más consistente.

Cada grupo puede tener un profesor asignado y varios estudiantes inscritos. La relación entre grupos y estudiantes se administra mediante la entidad `GrupoEstudiante`.

## Roles y Permisos

La plataforma cuenta con tres roles principales:

- `admin`: administra usuarios y grupos; puede crear, editar y eliminar grupos, asignar profesores e inscribir estudiantes directamente.
- `profesor`: consulta los grupos que tiene asignados, visualiza el desempeño de sus estudiantes y puede buscar e inscribir estudiantes en sus propios grupos.
- `estudiante`: consulta los grupos en los que está inscrito y su historial de partidas.

Las operaciones de administración de grupos están protegidas en el backend. Un profesor solo puede agregar estudiantes al grupo que tiene asignado.

## Instalación y Ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/JUANJO2345/Nexus_Plataforma_Web.git
cd Nexus_Plataforma_Web
```

### 2. Configurar el Backend

```bash
cd Backend
npm install
npm start
```

El servidor API se ejecuta por defecto en:

```text
http://localhost:3000
```

### 3. Configurar el Frontend

En una segunda terminal:

```bash
cd FrontEnd
npm install
npm run dev
```

Vite mostrará la URL local para acceder a la interfaz web.

## Notas de Desarrollo

- La autenticación utiliza tokens JWT para las operaciones protegidas.
- La base de datos SQLite se crea localmente en `Backend/database.sqlite`.
- El backend usa `sequelize.sync()` para sincronizar el esquema durante el desarrollo.
- Para producción, se recomienda configurar un secreto JWT seguro, usar migraciones formales y revisar los permisos de todos los endpoints.