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
