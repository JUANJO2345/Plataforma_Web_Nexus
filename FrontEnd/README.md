# Frontend de Nexus

Aplicación React con Vite. Las partidas, el catálogo de etapas y los niveles se cargan desde la API del backend; el frontend no fija cantidades de niveles.

## Desarrollo

Desde `FrontEnd/`:

```bash
npm install
npm run dev
```

Otros comandos:

```bash
npm run lint
npm run build
```

## Integración con partidas

- `GET /api/partidas/catalogo` proporciona las etapas y sus niveles ordenados.
- `GET /api/partidas` devuelve partidas con resultados relacionales. Cada resultado incluye puntaje, tiempo, nivel y etapa.
- El formulario envía `nivelId`, `puntaje` y `tiempoSegundos`; el backend guarda cada nivel como un resultado asociado a la partida.
- `src/utils/partidas.js` agrupa resultados por etapa y calcula los puntajes que se muestran en los paneles.

La URL de la API y la sesión se administran desde el contexto de autenticación. Para el modelo completo y las rutas, consulta [la documentación del backend](../Backend/README.md).
