# Nexus Plataforma Web

Sistema integral de evaluación cognitiva basado en entornos gamificados. La plataforma registra, procesa y clasifica métricas de desempeño de operadores en cuatro dimensiones clave: Abstracción, Pensamiento Computacional, Descomposición y Reconocimiento de Patrones a lo largo de múltiples niveles de dificultad.

## Estructura del Proyecto

El repositorio está organizado bajo una arquitectura monolítica dividida en dos componentes principales:

Nexus_Plataforma_Web/
├── FrontEnd/    # Interfaz de usuario, dashboards y paneles de administración (React, Vite, TailwindCSS)
├── BackEnd/     # API REST, controladores y persistencia de datos (Node.js, Express, SQLite)
└── README.md    # Documentación general del sistema

Configuración e Instalación
Siga las siguientes instrucciones para desplegar el entorno de desarrollo local.

1. Clonar el Repositorio
git clone [https://github.com/JUANJO2345/Nexus_Plataforma_Web.git](https://github.com/JUANJO2345/Nexus_Plataforma_Web.git)
cd Nexus_Plataforma_Web

3. Configuración del Servidor (BackEnd)

# Navegar al directorio del servidor
cd BackEnd

# Instalar las dependencias necesarias
npm install

# Iniciar el servidor en modo de desarrollo
node server.js

3. Configuración de la Interfaz (FrontEnd)
El cliente está construido sobre React utilizando Vite como empaquetador para optimizar los tiempos de recarga en caliente y compilación.

Bash
# Abrir una nueva pestaña de la terminal y navegar al directorio del cliente
cd FrontEnd

# Instalar las dependencias de la interfaz
npm install

# Iniciar el servidor de desarrollo de Vite
npm run dev
