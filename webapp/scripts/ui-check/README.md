# Comprobaciones automáticas de la interfaz

Abren el visor en Microsoft Edge sin ventana (puppeteer-core), ejecutan una
secuencia de acciones, guardan capturas y listan errores de consola.

```
npm install --no-save puppeteer-core@23   # una vez (PUPPETEER_SKIP_DOWNLOAD=1)
npm run dev                                # en webapp/, deja el servidor en marcha
node scripts/ui-check/shot.mjs "http://localhost:5173/#sel=4109101040" out.png acciones.json
node scripts/ui-check/shot_mobile.mjs "http://localhost:5173/" movil.png   # emulación iPhone 13
node scripts/ui-check/sizes.mjs "http://localhost:5173/"                   # varias resoluciones
```

`acciones.json` es una lista de pasos: `{"click": "selector"}`,
`{"clickText": "texto", "sel": "selector"}`, `{"mouse": [x, y]}`, `{"move": [x, y]}`,
`{"drag": [x0, y0, x1, y1]}`, `{"type": ["selector", "texto"]}`, `{"key": "Escape"}`,
`{"eval": "expresión JS"}`, `{"shot": "captura.png"}`, `{"wait": ms}`.
En modo desarrollo el mapa está en `window.__map`. Con `DL_DIR=carpeta` se guardan las descargas.
Las rutas de captura son relativas a la carpeta desde la que se ejecuta.

## Pruebas de robustez (2026-10-11)

Con el servidor en marcha (`npm run dev`, o `npx vite preview` para la versión compilada):

```
node scripts/ui-check/stress.mjs   "http://localhost:5173/#sel=4109101040" 80 desktop 1   # escritorio
node scripts/ui-check/stress_m.mjs "http://localhost:5173/" 70 2                          # móvil
node scripts/ui-check/basemap.mjs  "http://localhost:5173/" outage [mobile]               # caída del IGN
```

- `stress*.mjs`: secuencias aleatorias (semilla fija) de año, cortina, quintiles, toques en el mapa y zoom;
  fallan ante cualquier error de página. Las semillas 2 y 4 de `stress_m` tumbaban la versión anterior
  a la corrección de la cortina. `BROWSER=firefox` o `BROWSER=chrome GPU=1` para otros navegadores.
- `basemap.mjs`: simula el servicio del IGN interceptando sus teselas. Escenarios: `normal`,
  `outage` (todo 503: cambio a OSM, botón «Volver», vuelta automática ~2 min después),
  `partial` / `partial40` (15 % / 40 % de fallos: no debe cambiar), `slow` (4 s por tesela), `notfound` (404).
