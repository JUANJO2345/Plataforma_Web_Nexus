# Nexus Plataforma Web

Sistema integral de evaluación cognitiva basado en entornos gamificados. La plataforma permite registrar, procesar, auditar y clasificar métricas de telemetría y desempeño de estudiantes en cuatro dimensiones cognitivas clave:

- **Abstracción**
- **Pensamiento computacional**
- **Descomposición**
- **Reconocimiento de patrones**

Cada dimensión se evalúa a través de múltiples niveles de dificultad, permitiendo construir clasificaciones en tiempo real, consultar el historial cronológico de partidas, emitir retroalimentación docente individualizada y generar configuraciones de niveles para Realidad Virtual mediante Inteligencia Artificial.

---

## Estructura del Proyecto

El repositorio está organizado como una arquitectura desacoplada en dos componentes principales:

```text
Plataforma_Web_Nexus/
├── Backend/     # API REST, persistencia de datos, controladores y servicios (Node.js, Express, SQLite, Sequelize)
├── FrontEnd/    # Interfaz de usuario, dashboards de telemetría y paneles de gestión (React 19, Vite, TailwindCSS)
└── README.md    # Documentación general de la arquitectura y despliegue
```

---

## Características Principales

### 1. Telemetría y Dashboards de Desempeño
- **Vistas Especializadas por Rol**: Dashboards personalizados para Administradores, Profesores y Estudiantes con redirección automática tras autenticarse.
- **Historial Completo de Partidas con Fechas**: Presentación unificada de la fecha de creación de cada partida en formato estricto `dd/mm/aa` en todos los paneles y tablas de clasificación.
- **Auditoría y Observaciones Docentes**: Los profesores pueden redactar y registrar retroalimentación personalizada por partida, visible de inmediato por el estudiante.
- **Inspección Integral de Alumnos**: El docente puede consultar la totalidad de partidas históricas jugadas por cada estudiante en sus grupos, no únicamente la última sesión.
- **Rankings por Dimensión y General**: Tablas de clasificación acumulada y desglosadas por cada etapa de aprendizaje (posiciones con medallas, filtros por grupo y destacados de usuario).
- **Entorno Estudiante Multigrupo**: Alternancia fluida entre métricas globales, grupos académicos específicos (con comparativas respecto al promedio de la clase) y rankings de la red.

### 2. Generación de Contenido con IA y Realidad Virtual
- **Asistente Pedagógico con Gemini Flash**: Generación automatizada de esquemas de elementos en formato JSON para escenarios en Realidad Virtual.
- **Sincronización Directa con Google Drive**: Actualización transparente del archivo `ejemplo.json` en Drive mediante Service Account corporativa (sin requerir autenticación personal de Google por parte del docente).
- **Trazabilidad y Respaldos**: Registro histórico de versiones generadas, auditoría de cambios y previsualización de diferencias (diff) antes de aplicar cambios.

### 3. Seguridad, Gestión y Mantenimiento
- **Autenticación y RBAC Robusto**: Tokens JWT, cifrado de contraseñas con bcrypt, middlewares de autorización por rol (`admin`, `profesor`, `estudiante`) y manejo de sesiones.
- **Mantenimiento del Sistema**: Pestaña independiente para administradores con diagnósticos en tiempo real de la base de datos SQLite y purgado/reseteo seguro protegido con código de confirmación.
- **Resiliencia de Interfaz**: Contención de errores mediante *ErrorBoundary* con estética cyberpunk y retroalimentación visual en fallos de red.
- **Estética Cyberpunk / Terminal**: Diseño visual de alta fidelidad con tokens cromáticos semánticos (`primary`, `secondary`, `orange`, `pink`), tipografía monoespaciada para telemetría y soporte responsivo completo.

---

## Modelo de Datos

El sistema modela las siguientes entidades relacionales (administradas por Sequelize):

- `Usuario`: Administradores, profesores y estudiantes del sistema.
- `Partida`: Sesión de evaluación cognitiva vinculada a un usuario, con marca temporal (`fecha`, `createdAt`), clave demo y campo de `observacion` docente.
- `Etapa` y `Nivel`: Catálogo dinámico de las 4 dimensiones cognitivas y sus respectivos niveles de dificultad (ordenables y extensibles sin alterar el esquema de partidas).
- `ResultadoNivel`: Almacena el puntaje y tiempo invertido en segundos por nivel jugado en cada partida.
- `Grupo`: Clase académica asociada a un profesor titular.
- `GrupoEstudiante`: Relación muchos a muchos para la inscripción de alumnos en grupos.
- `AiAuditLog`: Registro de auditoría de propuestas de contenido generadas por Gemini y cambios aplicados en Google Drive.

Para consultar los esquemas SQL, migraciones y endpoints REST en detalle, revisa [Backend/README.md](Backend/README.md).

---

## Roles, Rutas y Permisos

| Rol | Rutas Autorizadas | Responsabilidades y Capacidades |
| :--- | :--- | :--- |
| **`admin`** | `/dashboard`<br>`/historial`<br>`/usuarios`<br>`/grupos`<br>`/sistema`<br>`/profesor`<br>`/profesor/ia` | Control total del sistema: gestión de cuentas, asignación de grupos y profesores, edición de partidas, auditoría de telemetría y mantenimiento/purgado de la base de datos. |
| **`profesor`** | `/profesor`<br>`/profesor/ia` | Supervisión de sus grupos académicos asignados, búsqueda e inscripción de alumnos, visualización del historial completo de partidas por estudiante, emisión de retroalimentación docente y generación de contenido con IA para RV. |
| **`estudiante`** | `/estudiante` | Consulta de telemetría personal, desglose por etapas y niveles, historial cronológico de todas sus partidas con fecha (`dd/mm/aa`), lectura de observaciones docentes y rankings por etapa. |

---

## Instalación y Ejecución

### Prerrequisitos
- Node.js (versión 18 o superior recomendada).
- npm o gestor de paquetes compatible.

### 1. Clonar el repositorio
```bash
git clone https://github.com/JUANJO2345/Nexus_Plataforma_Web.git
cd Plataforma_Web_Nexus
```

### 2. Configurar y Ejecutar Backend

```bash
cd Backend
npm install
npm run seed   # Inicializa el catálogo de etapas/niveles, grupos y cuentas demo
npm start      # Inicia la API REST en http://localhost:3000
```

> **Configuración de IA (Opcional):** Si vas a utilizar el módulo de IA y Google Drive, copia `Backend/.env.example` a `Backend/.env` y configura las variables `GEMINI_API_KEY`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY` y `GOOGLE_DRIVE_FILE_ID` (ver guía detallada en [Backend/README.md](Backend/README.md)).

### 3. Configurar y Ejecutar Frontend

En una terminal independiente:

```bash
cd FrontEnd
npm install
npm run dev    # Inicia el servidor de desarrollo de Vite (usualmente en http://localhost:5173)
```

Para validar tipos o compilar la versión optimizada de producción:
```bash
npm run build
```

---

## Cuentas de Acceso Preconfiguradas (Seed)

El comando `npm run seed` inicializa la base de datos con las siguientes credenciales de prueba listas para usar:

| Rol | Correo Electrónico | Contraseña | Datos Asociados |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@example.com` | `admin123` | Control de administración general y mantenimiento. |
| **Profesor** | `profesor@example.com` | `prof123` | Titular del grupo `GRP-101` ("Algoritmos y Lógica"). |
| **Estudiante 1** | `estudiante1@example.com` | `est123` | Alumna Ana Gómez, inscrita en `GRP-101`, con partidas registradas y retroalimentación docente. |
| **Estudiante 2** | `estudiante2@example.com` | `est123` | Alumno Carlos Ruiz, inscrito en `GRP-101`, con partidas de telemetría registradas. |
| **Operador Demo** | `operator@example.com` | `user123` | Partida de referencia inicial en todas las etapas. |

---

## Notas Técnicas y Buenas Prácticas

1. **Persistencia Local**: La base de datos SQLite se almacena en `Backend/database.sqlite`. Las rutas absolutas se resuelven de forma determinista para evitar conflictos entre diferentes entornos de ejecución.
2. **Formato Uniforme de Fechas**: Todas las marcas de tiempo de las partidas se transforman a nivel de cliente a través de `formatearFechaCorta()` garantizando el formato `dd/mm/aa` (por ejemplo, `07/10/26`).
3. **Manejo Seguro de Transacciones**: La creación y actualización de partidas junto a sus múltiples niveles se ejecutan bajo transacciones atómicas (`sequelize.transaction()`).
4. **Despliegue a Producción**: Se recomienda definir un secreto robusto para `JWT_SECRET`, habilitar HTTPS en el servidor Express y delegar los archivos estáticos compilados de Vite mediante un proxy inverso (Nginx, Caddy o Cloudflare).
