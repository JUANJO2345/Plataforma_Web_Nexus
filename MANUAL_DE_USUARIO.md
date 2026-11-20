# Manual de Usuario — Nexus Plataforma Web

**Sistema de evaluación cognitiva gamificada**
Versión del documento: 1.0 · Octubre 2026

---

## Índice

1. [Introducción](#1-introducción)
2. [Conceptos clave](#2-conceptos-clave)
3. [Requisitos e instalación](#3-requisitos-e-instalación)
4. [Acceso a la plataforma](#4-acceso-a-la-plataforma)
5. [Interfaz general](#5-interfaz-general)
6. [Manual del Estudiante](#6-manual-del-estudiante)
7. [Manual del Profesor](#7-manual-del-profesor)
8. [Manual del Administrador](#8-manual-del-administrador)
9. [Rankings y clasificaciones](#9-rankings-y-clasificaciones)
10. [Glosario de la interfaz](#10-glosario-de-la-interfaz)
11. [Preguntas frecuentes y solución de problemas](#11-preguntas-frecuentes-y-solución-de-problemas)
12. [Buenas prácticas de seguridad](#12-buenas-prácticas-de-seguridad)

---

## 1. Introducción

**Nexus** es una plataforma web que registra y analiza el desempeño de estudiantes en un entorno gamificado (incluido un juego de Realidad Virtual). Cada sesión de juego —llamada **partida**— mide el rendimiento del estudiante en cuatro **dimensiones cognitivas**:

| Etapa | Niveles |
| :--- | :---: |
| Abstracción | 3 |
| Pensamiento computacional | 4 |
| Descomposición | 4 |
| Reconocimiento de patrones | 4 |

Con estos datos, la plataforma permite:

- Consultar el historial de partidas y el desglose de puntajes por etapa y nivel.
- Comparar el desempeño mediante **rankings** generales y por etapa.
- Que los profesores **supervisen sus grupos** y dejen **observaciones** (retroalimentación) en cada partida.
- Generar configuraciones del entorno de Realidad Virtual con **Inteligencia Artificial (Gemini)** y guardarlas en **Google Drive**.
- Que los administradores gestionen usuarios, grupos, partidas, respaldos y mantenimiento de la base de datos.

### Roles del sistema

| Rol | ¿Qué puede hacer? |
| :--- | :--- |
| **Estudiante** | Ver su propio desempeño, su historial de partidas, las observaciones del profesor, sus grupos y los rankings. |
| **Profesor** | Ver sus grupos asignados, inscribir estudiantes, auditar el historial de cada alumno, dejar observaciones y generar contenido con IA. |
| **Administrador** | Control total: usuarios, grupos, partidas, panel general, contenido con IA, respaldos y reinicio de la base de datos. |

---

## 2. Conceptos clave

| Término | Significado |
| :--- | :--- |
| **Partida** | Una sesión de juego de un estudiante. Tiene número (p. ej. `#0007`), fecha y resultados por nivel. |
| **Etapa** | Una de las cuatro dimensiones cognitivas evaluadas. |
| **Nivel** | Subdivisión de una etapa (Nivel 1, Nivel 2…). |
| **Resultado** | Puntaje (pts) y tiempo (segundos) obtenidos en un nivel dentro de una partida. |
| **Puntaje total** | Suma de los puntajes de todos los niveles de una partida. |
| **Grupo** | Una clase académica (p. ej. `GRP-101`) con un profesor titular y estudiantes inscritos. |
| **Observación docente** | Comentario que un profesor deja sobre una partida concreta; el estudiante lo ve en su panel. |
| **Fecha** | Todas las fechas de partidas se muestran en formato `dd/mm/aa` (ej. `07/10/26`). |

---

## 3. Requisitos e instalación

> Esta sección está dirigida a la persona encargada de poner en marcha la plataforma. Si solo vas a usarla, pasa a la [sección 4](#4-acceso-a-la-plataforma).

### 3.1 Requisitos

- **Node.js** 18 o superior y **npm**.
- Un navegador moderno (Chrome, Edge, Firefox).
- *(Opcional, para el módulo de IA)* Clave de API de **Google Gemini** y una **cuenta de servicio de Google Cloud** con acceso al archivo de Drive.

### 3.2 Puesta en marcha

**1. Backend (API) — en una terminal:**

```bash
cd Backend
npm install
npm run seed    # Crea el catálogo de etapas/niveles, el grupo GRP-101 y las cuentas de prueba
npm start       # Inicia la API en http://localhost:3000
```

**2. Frontend (interfaz web) — en otra terminal:**

```bash
cd FrontEnd
npm install
npm run dev     # Inicia la interfaz en http://localhost:5173
```

**3.** Abre en el navegador: **http://localhost:5173**

> [!NOTE]
> El frontend redirige automáticamente todas las peticiones `/api` al backend en el puerto 3000. Ambos deben estar en ejecución al mismo tiempo.

### 3.3 Configuración opcional del módulo de IA

1. Copia `Backend/.env.example` como `Backend/.env`.
2. Completa las variables:

| Variable | Descripción |
| :--- | :--- |
| `PORT` | Puerto del backend (por defecto `3000`). |
| `JWT_SECRET` | Secreto para firmar sesiones. **Cámbialo en producción.** |
| `GEMINI_API_KEY` | Clave de API de Google AI Studio. |
| `GEMINI_MODEL` | Modelo a usar (por defecto `gemini-1.5-flash`). |
| `GOOGLE_DRIVE_FILE_ID` | ID del archivo `ejemplo.json` en Google Drive. |
| `GOOGLE_CLIENT_EMAIL` | Correo de la cuenta de servicio. |
| `GOOGLE_PRIVATE_KEY` | Clave privada de la cuenta de servicio. |

   Alternativamente, coloca el JSON de la cuenta de servicio en `Backend/config/service-account.json`.
3. **Comparte el archivo de Drive** con el correo de la cuenta de servicio dándole permiso de **Editor**.
4. Reinicia el backend.

### 3.4 Cuentas de prueba

Tras ejecutar `npm run seed` existen estas cuentas:

| Rol | Correo | Contraseña |
| :--- | :--- | :--- |
| Administrador | `admin@example.com` | `admin123` |
| Profesor | `profesor@example.com` | `prof123` |
| Estudiante (Ana Gómez) | `estudiante1@example.com` | `est123` |
| Estudiante (Carlos Ruiz) | `estudiante2@example.com` | `est123` |
| Operador demo | `operator@example.com` | `user123` |

> [!WARNING]
> Estas credenciales son solo para pruebas. Cámbialas o elimínalas antes de usar la plataforma con datos reales.

---

## 4. Acceso a la plataforma

### 4.1 Iniciar sesión

1. Abre la dirección de la plataforma. Verás la pantalla **INITIALIZE_AUTH**.
2. En **User_Name** escribe cualquiera de estas opciones:
   - Tu correo completo (`estudiante1@example.com`),
   - tu nombre de usuario, o
   - la parte de tu correo antes de la `@` (`estudiante1`).
3. En **Access_Key** escribe tu contraseña.
4. Pulsa **CONNECT_TO_NET**.

Al entrar, el sistema te lleva automáticamente a tu panel según tu rol:

| Rol | Pantalla inicial |
| :--- | :--- |
| Administrador | Overview Dashboard (`/dashboard`) |
| Profesor | Grupos & Estudiantes (`/profesor`) |
| Estudiante | Mis Grupos y Partidas (`/estudiante`) |

### 4.2 Crear una cuenta nueva (auto-registro)

1. En la pantalla de acceso pulsa **>> Solicitar credenciales de Operador**.
2. Verás **CREATE_NEW_OPERATOR**.
3. En **User_Name** escribe un **correo electrónico válido** (ej. `maria@escuela.edu`).
4. En **Access_Key** escribe una contraseña.
5. Pulsa **REGISTER_NODE**.

La cuenta se crea con rol **Estudiante** y su nombre de usuario será la parte del correo antes de la `@`. Entrarás directamente al panel de estudiante.

> [!IMPORTANT]
> Las cuentas de **Profesor** y **Administrador** solo puede crearlas (o promoverlas) un administrador desde *User Management*.

Para volver a la pantalla de inicio de sesión pulsa **>> Ya tengo un nodo de acceso asignado**.

### 4.3 Cerrar sesión

Pulsa **Logout** en la esquina superior derecha.

> [!NOTE]
> Por seguridad, la sesión caduca a las **24 horas**. Si caduca, el sistema te devolverá a la pantalla de acceso y deberás iniciar sesión otra vez.

---

## 5. Interfaz general

Todas las pantallas (excepto el acceso) comparten la misma estructura:

```text
┌──────────────┬──────────────────────────────────────────────┐
│   NEXUS      │  NEXUS_MS                          [Logout]  │  ← Barra superior
│              ├──────────────────────────────────────────────┤
│  [Avatar]    │  SYSTEM_CORE_ACCESS :: ROL                   │
│  usuario     │  TÍTULO DE LA SECCIÓN                        │
│  Rol: ...    │                                              │
│              │                                              │
│  Menú según  │          Contenido de la sección             │
│  el rol      │                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
   Barra lateral
```

- **Barra lateral izquierda:** logotipo, tu usuario, tu rol (etiqueta de color) y el menú de navegación.
- **Barra superior:** botón **Logout**.
- **Área central:** título de la sección actual y su contenido.

**Código de colores de rol:**

| Color | Rol |
| :--- | :--- |
| Verde | Administrador |
| Naranja | Profesor |
| Cian | Estudiante |

**Colores de las etapas** (se repiten en tarjetas y rankings): cian = Abstracción, verde = Pensamiento computacional, naranja = Descomposición, rosa = Reconocimiento de patrones.

> [!TIP]
> Si una sección falla al cargar, verás un mensaje de error dentro de esa sección sin que se caiga toda la aplicación. Cambia de sección o recarga la página para reintentar.

---

## 6. Manual del Estudiante

Menú disponible: **Mis Grupos y Partidas**.

La pantalla tiene dos pestañas principales en la parte superior:

- **Mi Dashboard Personal** — tu desempeño (muestra cuántas partidas tienes).
- **Rankings por Etapa y General** — las tablas de clasificación.

### 6.1 Mi Dashboard Personal

#### Ámbito de telemetría

Debajo de las pestañas hay una barra **Ámbito de telemetría** con:

- **Dashboard Global** — todas tus partidas, sin filtrar por grupo.
- Un botón por cada **grupo** en el que estés inscrito (ej. `GRP-101`).

#### Tarjetas de resumen

| Tarjeta | Qué muestra |
| :--- | :--- |
| Estudiante | Tu nombre de usuario. |
| Puntaje Partida Actual | Puntaje total de la partida que estás viendo, con su fecha. |
| Total Partidas Jugadas | Número de partidas registradas a tu nombre. |
| Grupos Asignados | En cuántos grupos estás inscrito. |

#### Cambiar la partida que estás viendo

Por defecto se muestra tu **última** partida. Para ver otra:

- Usa el desplegable **Cambiar:** junto a *Fecha Partida* (aparece si tienes más de una partida), **o**
- Pulsa **Ver Detalle** en la fila deseada de la tabla *Mis Partidas Registradas*.

La partida en pantalla se marca con la etiqueta **En pantalla** / botón **Seleccionada**.

#### Observación del profesor

Si tu profesor dejó una observación sobre la partida que estás viendo, aparecerá un recuadro naranja **OBSERVACION_DOCENTE :: PARTIDA #XXXX** con el comentario y la fecha.

En la tabla de historial, la columna **Observación Docente** muestra un icono de chat y el inicio del comentario, o *"Sin observación"*.

#### Desglose por etapa

La sección **COMPETENCIAS_Y_DESGLOSE_POR_ETAPA** muestra una tarjeta por etapa con:

- Puntaje total de la etapa.
- Por cada nivel: puntaje (pts) y tiempo (s).

#### Historial cronológico

La tabla **Mis Partidas Registradas** lista todas tus partidas con: número, fecha, puntaje total, niveles completados, observación docente y el botón de acción.

### 6.2 Vista de un grupo

Pulsa el botón del grupo en *Ámbito de telemetría* o **Ver Dashboard del Grupo** en la tarjeta del grupo (sección *MIS_GRUPOS_INSCRITOS*, visible en el ámbito global).

Verás:

| Tarjeta | Qué muestra |
| :--- | :--- |
| Mi Puntaje en el Grupo | Puntaje de la partida que estás viendo. |
| Promedio del Grupo | Promedio de los **mejores** puntajes de cada compañero. |
| Mi Posición en el Grupo | Tu puesto según tu mejor puntaje, de *N* compañeros. |
| Total Compañeros | Número de estudiantes inscritos. |

Además se muestra el **profesor a cargo** y la lista de **compañeros inscritos** (tú apareces resaltado con la marca *(Tú)*).

Pulsa **Ver Ámbito Global** para volver.

> [!NOTE]
> Si no estás inscrito en ningún grupo, verás el mensaje *"No estás inscrito en ningún grupo actualmente"*. Pide a tu profesor o al administrador que te inscriba.

### 6.3 Rankings

Consulta la [sección 9](#9-rankings-y-clasificaciones). En la vista del estudiante, tus filas aparecen resaltadas.

### 6.4 ¿Cómo se registran mis partidas?

Las partidas se registran automáticamente al jugar en el entorno gamificado/VR, o las registra un administrador manualmente. Si aún no tienes partidas, verás *"Aún no registras partidas en el sistema"*.

---

## 7. Manual del Profesor

Menú disponible:

- **Grupos & Estudiantes**
- **Contenido con IA**

### 7.1 Grupos & Estudiantes

> [!NOTE]
> Si no tienes grupos asignados verás *"Sin Grupos Asignados"*. Los grupos los crea el administrador y te asigna como profesor titular.

#### Seleccionar un grupo

En la parte superior hay una pestaña por cada grupo asignado, con su código, nombre y número de alumnos. Haz clic en una para activarla. El grupo activo se resalta en naranja.

#### Resumen del grupo activo

| Tarjeta | Qué muestra |
| :--- | :--- |
| Estudiantes Enrolados | Alumnos inscritos en el grupo. |
| Promedio del Grupo | Promedio del puntaje de la última partida de cada alumno. |
| Partidas del Grupo | Total de partidas jugadas por los alumnos del grupo. |

#### Inscribir un estudiante en el grupo

1. Pulsa **Inscribir Estudiante** en la tarjeta del grupo activo.
2. En el buscador escribe el nombre o correo del estudiante.
3. En la lista de resultados, pulsa **Inscribir** junto al alumno.
4. El alumno se añade al grupo de inmediato.
5. Pulsa **Cerrar Registro** para ocultar el panel.

> [!TIP]
> Solo aparecen estudiantes ya registrados en la plataforma y que todavía no están en ese grupo. Si un alumno no aparece, debe registrarse primero (ver [4.2](#42-crear-una-cuenta-nueva-auto-registro)) o pedir al administrador que lo dé de alta.

#### Buscar a un estudiante

En **BUSCAR_REGISTROS_DE_ESTUDIANTE**, escribe nombre, correo o ID. La nómina inferior se filtra en tiempo real y se muestra el número de resultados. Pulsa **Limpiar filtro** para quitar la búsqueda.

#### Nómina del grupo

Cada estudiante aparece en una tarjeta con:

- Nombre, correo e ID.
- **Mejor Puntaje** y **Total Partidas**.
- Todas sus partidas en mini-tarjetas (número, fecha, puntaje, niveles, observación). La más reciente lleva la etiqueta **Última**.
- Botón **Auditar Alumno**.

#### Auditar a un alumno (expediente)

1. Pulsa **Auditar Alumno** o haz clic directamente en una de sus partidas.
2. Se abre el **EXPEDIENTE_DE_TELEMETRIA_ACTIVO** con:
   - Selector de partidas (*HISTORIAL_DE_PARTIDAS_DISPONIBLES*) si el alumno tiene más de una. Las partidas con observación tienen un icono de comentario.
   - Tarjetas: estudiante, puntaje total de la partida seleccionada y total de partidas.
   - Panel de **observación docente**.
   - Desglose por etapa y nivel (igual al que ve el estudiante).
   - Tabla **Historial Cronológico de Partidas del Alumno**, con detalle por nivel y botón **Ver / Dejar Nota**.
3. Pulsa **Cerrar Expediente** o **Ver Todos los Alumnos** para salir.

#### Dejar una observación en una partida

1. Abre el expediente del alumno y selecciona la partida (botón **Ver / Dejar Nota** o selector de partidas).
2. En el recuadro naranja **OBSERVACION_DOCENTE_PARA_ESTE_REGISTRO**, escribe tu comentario.
3. Pulsa **Guardar Observación**.
4. Verás el mensaje *"Observación registrada con éxito para la partida #XXXX"* y la etiqueta **Observación Registrada**.

- Para **editar**, modifica el texto y vuelve a guardar.
- Para **borrar**, pulsa **Limpiar** y luego **Guardar Observación** con el campo vacío.

> [!NOTE]
> Cada observación pertenece a **una partida concreta**. El estudiante la verá inmediatamente al consultar esa partida.

### 7.2 Contenido con IA

Este módulo genera configuraciones de elementos para el entorno de Realidad Virtual usando **Gemini**, y las guarda en el archivo `ejemplo.json` de Google Drive. **Gemini nunca modifica Drive por sí solo**: tú revisas y decides.

En la cabecera verás:
- **Modelo:** el modelo de Gemini en uso.
- **Drive Target:** enlace al archivo `ejemplo.json` (punto verde = credenciales de Drive configuradas; naranja = sin configurar).

#### Paso 1 — Petición del profesor

1. **Tema del Entorno VR:** escríbelo o pulsa un tema sugerido (*Laboratorio de Química, Estación Espacial, Taller de Robótica, Anatomía y Medicina, Exploración Marina, Entorno Urbano y Tráfico*).
2. **Instrucción o Petición para Gemini:** describe qué quieres activar/desactivar. Ejemplo: *"Activar los elementos de medición y seguridad personal, y desactivar reactivos inflamables."*
3. **Elementos específicos (opcional):** escribe un elemento (ej. `microscopio`) y pulsa **Agregar** o Enter. Se normaliza automáticamente (minúsculas y guiones bajos). Pulsa **×** para quitarlo.
4. Pulsa **GENERAR_PROPUESTA_CON_IA**.

> Debes indicar al menos un tema **o** una petición.

#### Paso 2 — Revisión y ajuste

La propuesta aparece como una lista de elementos, cada uno con valor:
- **1 (ON)** = activo / verdadero
- **0 (OFF)** = inactivo / falso

Puedes:
- Hacer clic en el botón **1 (ON) / 0 (OFF)** para alternar el valor.
- Pulsar el icono de **papelera** para eliminar un elemento.
- Revisar la vista previa del JSON final (*FORMATO_JSON_PARA_DRIVE*).

#### Paso 3 — Decidir

- **Aceptar y Guardar en Drive:** abre una confirmación con el contenido final. Pulsa **Confirmar y Actualizar Drive**. Se guarda una copia de la versión anterior y queda registrada la auditoría (quién, cuándo, tema y petición).
- **Descartar:** elimina la propuesta sin tocar Drive.

#### Historial de cambios en Drive

Pulsa **Historial de Cambios en Drive (N)** para desplegar las últimas 20 versiones guardadas, con tema, petición y fecha.

- **Actualizar:** recarga la lista.
- **Cargar en Editor:** carga esa versión en el editor (con su tema y petición) para reutilizarla, ajustarla o volver a aplicarla — útil para **revertir** a una versión anterior.

---

## 8. Manual del Administrador

Menú disponible:

| Opción | Ruta | Función |
| :--- | :--- | :--- |
| Contenido con IA | `/profesor/ia` | Igual que el profesor ([7.2](#72-contenido-con-ia)). |
| Overview Dashboard | `/dashboard` | Métricas globales, todas las partidas y rankings. |
| Match History | `/historial` | Registrar, editar y eliminar partidas. |
| User Management | `/usuarios` | Crear, editar y eliminar usuarios. |
| Gestión de Grupos | `/grupos` | Crear, editar y eliminar grupos. |
| Administración del Sistema | `/sistema` | Diagnóstico, respaldos y reinicio de la base de datos. |

El botón **NEW_MATCH** al pie de la barra lateral lleva directamente a *Match History* para registrar una partida.

### 8.1 Overview Dashboard

1. **Métricas del sistema:** Usuarios en la Red, Partidas Registradas, Grupos Académicos y Auditoría IA (cambios guardados en Drive).
2. **Partidas Registradas en la Red:** tabla con número de partida, fecha, alumno, puntaje total, niveles superados y observación docente.
3. **Clasificación General y Rankings por Etapa:** ver [sección 9](#9-rankings-y-clasificaciones).

### 8.2 Match History (gestión de partidas)

La pantalla se divide en el **historial** (izquierda) y el **formulario** (derecha).

#### Registrar una partida

1. En **Usuario**, selecciona el alumno.
2. Para cada etapa y nivel, introduce **Puntaje** y **Tiempo (s)** (números enteros ≥ 0; por defecto 0).
3. Pulsa **Registrar partida**.

#### Editar una partida

1. Pulsa **Editar** en la partida.
2. El formulario cambia a *Editar partida* con los valores cargados.
3. Modifica lo necesario (también puedes reasignar el usuario).
4. Pulsa **Guardar cambios** (o **Cancelar**).

#### Eliminar una partida

Pulsa **Eliminar** y confirma. La acción es **irreversible** y borra también sus resultados.

### 8.3 User Management (gestión de usuarios)

#### Crear un usuario

En el formulario **REGISTER_NEW_NODE**:
1. **Nombre de Usuario** (único).
2. **Correo Electrónico** (obligatorio y único).
3. **Rol del Usuario:** Estudiante, Profesor o Administrador.
4. **Contraseña de Red** (obligatoria).
5. Pulsa **INJECT_NODE**.

#### Editar un usuario

1. Pulsa **Editar** en la fila del usuario. El formulario pasa a **UPDATE_OPERATOR_SIGNATURE**.
2. Cambia nombre, correo o rol.
3. Para cambiar la contraseña, escribe una nueva; **déjala vacía para mantener la actual**.
4. Pulsa **COMMIT_CHANGES** (o **Cancelar**).

> [!TIP]
> Para convertir a un usuario auto-registrado en profesor, edítalo y cambia su rol a **Profesor**.

#### Eliminar un usuario

Pulsa **Eliminar** y confirma.

### 8.4 Gestión de Grupos

#### Crear un grupo

En **CREATE_NEW_GROUP**:
1. **Código del Grupo** (obligatorio, ej. `MAT-2024`).
2. **Nombre del Grupo** (ej. *Programación Orientada a Objetos*).
3. **Profesor Asignado:** elige un usuario con rol Profesor (o *Sin Profesor Asignado*).
4. **Estudiantes Inscritos:** marca las casillas de los alumnos (se muestra el número seleccionado).
5. Pulsa **REGISTER_GROUP**.

#### Editar o eliminar

- **Editar** → cambia los datos o la lista de alumnos → **UPDATE_GROUP**.
- **Eliminar** → confirma.

### 8.5 Administración del Sistema

#### Telemetría y estado de almacenamiento

Muestra el número de Usuarios, Partidas, Grupos, Logs IA, Etapas y Niveles. Pulsa **Sincronizar** para actualizar.

#### Copia de seguridad (.bak)

- **Hacer Backup (.bak):** genera una copia completa de la base de datos, la descarga en tu equipo y la archiva en el servidor (`Backend/backups/`).
- **Respaldos Archivados en el Servidor:** lista de copias con nombre, tamaño y fecha.
  - **Descargar:** baja esa copia.
  - **Eliminar:** la borra del servidor (pide confirmación).
  - **Actualizar:** recarga la lista.

> [!TIP]
> Para restaurar un respaldo, detén el backend y reemplaza `Backend/database.sqlite` por el archivo `.bak` descargado (renombrándolo a `database.sqlite`). Después vuelve a iniciar el backend.

#### Reiniciar la base de datos

> [!CAUTION]
> Esta operación es **destructiva e irreversible**. Genera un backup antes de ejecutarla.

1. Pulsa **Reiniciar Base de Datos**.
2. Lee la advertencia. Se eliminarán:
   - Todas las partidas y sus resultados.
   - Grupos e inscripciones.
   - Logs de auditoría de IA.
3. Se conservará **tu cuenta de administrador** y se restablecerá el catálogo oficial de etapas y niveles.
4. *(Opcional)* Mantén marcada **Cargar datos de prueba de estudiantes y profesor** para recrear las cuentas y datos de ejemplo.
5. Escribe **REINICIAR** en el campo de confirmación.
6. Pulsa **Confirmar Reinicio**.

---

## 9. Rankings y clasificaciones

Los rankings aparecen en el **Overview Dashboard** (administrador) y en la pestaña **Rankings por Etapa y General** (estudiante).

### Controles

- **Grupo:** filtra por un grupo concreto o muestra la **Clasificación Global**.
- Pestañas:
  - **Ranking General** — puntaje total por partida, con desglose por etapa y columna **Total Global**.
  - **Una pestaña por etapa** — ranking de esa etapa con detalle de cada nivel y **Puntaje Etapa**.
  - **Todas las Etapas** — muestra las tablas de todas las etapas a la vez.

### Cómo se ordena

| Ranking | Criterio |
| :--- | :--- |
| General | Mayor puntaje total de la partida. |
| Por etapa | Mayor puntaje en la etapa; en caso de empate, **menor tiempo**. Solo aparecen partidas que jugaron esa etapa. |

Las tres primeras posiciones se destacan con **medallas** (oro, plata y bronce). Cada fila corresponde a **una partida**, por lo que un mismo estudiante puede aparecer varias veces.

---

## 10. Glosario de la interfaz

La interfaz usa un estilo "terminal / cyberpunk". Equivalencias de los textos más comunes:

| Texto en pantalla | Significado |
| :--- | :--- |
| `INITIALIZE_AUTH` | Iniciar sesión |
| `CREATE_NEW_OPERATOR` | Crear cuenta |
| `User_Name` / `Access_Key` | Usuario / Contraseña |
| `CONNECT_TO_NET` | Entrar |
| `REGISTER_NODE` | Registrarse |
| `EXECUTING...` | Procesando |
| `SYNCHRONIZING_CORE_SYSTEMS...` | Cargando |
| `Operador` / `Nodo` | Usuario |
| `INJECT_NODE` | Crear usuario |
| `COMMIT_CHANGES` | Guardar cambios |
| `REGISTER_GROUP` / `UPDATE_GROUP` | Crear / actualizar grupo |
| `NEW_MATCH` | Nueva partida |
| `Match History` | Historial de partidas |
| `Telemetría` | Datos de desempeño |
| `[!] ...ERROR` | Mensaje de error |
| `[+] ...` | Mensaje de éxito |

---

## 11. Preguntas frecuentes y solución de problemas

**No puedo iniciar sesión: "Credenciales inválidas".**
El usuario/correo no existe. Revisa que esté bien escrito o regístrate.

**"Fallo en la verificación de seguridad".**
La contraseña es incorrecta. Si la olvidaste, pide a un administrador que te asigne una nueva desde *User Management*.

**Al registrarme aparece un error.**
- *"El nombre de operador ya está registrado"*: ese correo ya tiene cuenta.
- Otro error de validación: asegúrate de escribir un **correo válido** en *User_Name*, y de que la parte antes de la `@` no coincida con el nombre de otro usuario.

**Me registré pero no veo ningún grupo.**
Los estudiantes se inscriben en grupos por medio del profesor o del administrador.

**Soy profesor y veo "Sin Grupos Asignados".**
Pide al administrador que te asigne como *Profesor Asignado* de un grupo.

**Un alumno no aparece al intentar inscribirlo.**
Debe tener una cuenta con rol Estudiante y no estar ya en ese grupo.

**La página me devolvió al inicio de sesión.**
La sesión caducó (24 h) o fue invalidada. Inicia sesión otra vez.

**Aparece "No se pudo establecer enlace…" o errores de carga.**
El backend no está en ejecución o no es accesible. Verifica que `npm start` esté corriendo en `Backend/` (puerto 3000).

**El módulo de IA da error al generar la propuesta.**
Falta o es inválida `GEMINI_API_KEY` en `Backend/.env`, o se superó la cuota de la API.

**No se puede guardar en Google Drive.**
- Verifica las credenciales de la cuenta de servicio (`GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY` o `service-account.json`).
- Confirma que el archivo de Drive está **compartido como Editor** con la cuenta de servicio.
- Revisa que `GOOGLE_DRIVE_FILE_ID` sea correcto.

**Quiero volver a una configuración de VR anterior.**
En *Contenido con IA* → *Historial de Cambios en Drive* → **Cargar en Editor** → **Aceptar y Guardar en Drive**.

---

## 12. Buenas prácticas de seguridad

- Cambia las contraseñas de las cuentas de prueba o elimínalas en entornos reales.
- Define un `JWT_SECRET` largo y único en producción.
- No compartas ni subas a repositorios públicos `Backend/.env` ni `Backend/config/service-account.json`.
- Genera un **backup (.bak)** con regularidad y siempre antes de reiniciar la base de datos.
- Concede el rol **Administrador** solo a las personas necesarias.
- En producción, sirve la plataforma con **HTTPS** y detrás de un proxy inverso (Nginx, Caddy, etc.).
