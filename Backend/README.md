# Backend de Nexus

API REST con Express, Sequelize y SQLite. El servidor usa `Backend/database.sqlite` y se ejecuta desde esta carpeta.

## Partidas, etapas y niveles

Los resultados se almacenan en tablas relacionadas. No se guarda un objeto de resultados en la fila de la partida.

```text
Usuario 1 ── N Partida 1 ── N ResultadoNivel N ── 1 Nivel N ── 1 Etapa
```

| Tabla | Responsabilidad |
| --- | --- |
| `Partidas` | Sesión jugada, fecha, usuario asociado y clave interna de la partida demo. |
| `Etapas` | Catálogo ordenado de las etapas disponibles. |
| `Nivels` | Niveles pertenecientes a una etapa, con nombre, clave y orden. |
| `ResultadoNivels` | Puntaje y tiempo en segundos de un nivel en una partida. |

Una partida puede registrar uno o varios niveles. La combinación partida-nivel es única. Puntaje y tiempo son enteros no negativos. La configuración inicial crea cuatro etapas: Abstracción (3 niveles) y Pensamiento computacional, Descomposición y Reconocimiento de patrones (4 niveles cada una). El catálogo se consulta desde la base de datos y puede crecer sin cambiar la estructura de `Partidas`.

## API de partidas

Todas las rutas requieren una sesión JWT, excepto las reglas de autorización específicas indicadas abajo. La API usa los nombres de campos en camelCase.

| Método y ruta | Uso |
| --- | --- |
| `GET /api/partidas/catalogo` | Lista etapas activas y niveles ordenados. |
| `GET /api/partidas` | Lista las partidas con usuario y resultados relacionados. |
| `GET /api/partidas/:id` | Consulta una partida con sus resultados. |
| `POST /api/partidas` | Crea una partida y sus resultados en una transacción. |
| `PUT /api/partidas/:id` | Reemplaza los resultados enviados y permite reasignar el usuario a un administrador. |
| `DELETE /api/partidas/:id` | Elimina una partida; solo administradores. |

Para crear o actualizar resultados, cada elemento requiere `nivelId`, `puntaje` y `tiempoSegundos`. En la creación, administradores pueden indicar `usuarioId`, `username` o `correo`; los demás usuarios quedan asociados a su cuenta autenticada. Al actualizar, un usuario solo puede modificar su propia partida; un administrador puede modificar cualquiera.

Las respuestas incluyen `resultados`. Cada resultado contiene `partidaId`, `nivelId`, `puntaje`, `tiempoSegundos` y la relación `nivel`, que incluye la etapa. El frontend obtiene el catálogo desde el endpoint anterior y construye el formulario y las vistas a partir de esos datos.

## Inicialización y seed

Desde `Backend/`:

```bash
npm install
npm run seed
npm start
```

`npm start` sincroniza los modelos y ejecuta `database/migrarPartidas.js` antes de abrir el puerto 3000. La migración inicializa el catálogo y, si detecta la columna antigua `stage`, traslada sus resultados a `ResultadoNivels` y elimina la columna. Si encuentra un formato heredado que no reconoce, aborta el arranque y conserva esa columna para evitar borrar datos que no pudo convertir. El catálogo y la migración se pueden ejecutar de nuevo; los resultados ya convertidos no se duplican.

`npm run seed` crea las cuentas demo que falten, registra el grupo `GRP-101`, inscribe a sus estudiantes y asegura una partida demo con un resultado para cada nivel disponible. No borra partidas ni usuarios existentes.

Credenciales demo que se crean si las cuentas todavía no existen:

| Cuenta | Correo | Contraseña inicial |
| --- | --- | --- |
| Administrador | `admin@example.com` | `admin123` |
| Profesor | `profesor@example.com` | `prof123` |
| Estudiantes | `estudiante1@example.com`, `estudiante2@example.com` | `est123` |
| Operador demo | `operator@example.com` | `user123` |

Las contraseñas solo se asignan al crear la cuenta. El seed no reemplaza contraseñas ya existentes.

## Estructura relevante

- `models/`: modelos Sequelize y relaciones.
- `database/migrarPartidas.js`: catálogo inicial y migración de datos heredados.
- `controllers/partidaController.js`: validación y operaciones transaccionales de partidas.
- `routes/partidaRoutes.js`: rutas y protección por autenticación/rol.
- `seed.js`: datos de desarrollo idempotentes.

La sincronización automática está pensada para desarrollo. Para producción, conviene convertir los cambios de esquema en migraciones versionadas y revisar las credenciales de desarrollo.
