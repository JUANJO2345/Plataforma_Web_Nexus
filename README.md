# Nexus Plataforma Web

Sistema integral de evaluación cognitiva basado en entornos gamificados. La plataforma permite registrar, procesar y clasificar métricas de desempeño de operadores en cuatro dimensiones clave:

- Abstracción
- Pensamiento computacional
- Descomposición
- Reconocimiento de patrones

Cada dimensión se evalúa a través de múltiples niveles de dificultad, permitiendo construir rankings, consultar historial de partidas y visualizar el progreso individual de cada operador.

## Estructura del Proyecto

El repositorio está organizado como una aplicación web con dos componentes principales:

```text
Plataforma_Web_Nexus/
├── Backend/     # API REST, persistencia de datos y modelos (Node.js, Express, SQLite, Sequelize)
├── FrontEnd/    # Interfaz de usuario, dashboards y paneles de administración (React, Vite, TailwindCSS)
└── README.md    # Documentación general del sistema
```

## Características Principales

- Registro e inicio de sesión de operadores.
- Cifrado de contraseñas con bcrypt.
- Gestión de usuarios desde una vista administrativa.
- Registro de partidas asociadas a usuarios reales del sistema.
- Tablas de clasificación por dimensión cognitiva.
- Vista individual de desempeño para cada operador.
- Persistencia local mediante SQLite.

## Modelo de Datos

El sistema trabaja con dos entidades principales:

- `Usuario`: representa a un operador o administrador registrado.
- `Partida`: representa una sesión de evaluación cognitiva.

Cada partida pertenece a un usuario mediante la relación `Usuario.hasMany(Partida)` y `Partida.belongsTo(Usuario)`. Esto evita depender únicamente de correos escritos como texto y permite consultar el historial de un operador de forma más consistente.

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
cd FrontEnd/FrontEnd
npm install
npm run dev
```

Vite mostrará la URL local para acceder a la interfaz web.

## Notas de Desarrollo

- La autenticación actual está pensada para entorno académico o prototipo funcional.
- La base de datos SQLite se crea localmente en `Backend/database.sqlite`.
- El backend usa `sequelize.sync({ alter: true })` para mantener el esquema actualizado durante el desarrollo.
- Para producción, se recomienda agregar autenticación con tokens, control de permisos en backend y migraciones formales.
