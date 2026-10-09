# Atlas de Privación de España — visor v2

Visor web del Índice de Privación por sección censal (2011 y 2021), construido
con [MapLibre GL JS](https://maplibre.org/) (BSD-3) y teselas vectoriales
[PMTiles](https://protomaps.com/docs/pmtiles) (BSD-3). Sustituye al visor v1
basado en TerriaJS (etiqueta `v1.0.0`).

## Qué cambia respecto a v1

- **Geometría exacta del INE, una por año.** Cada año se dibuja sobre sus
  propias secciones; los límites de municipio, provincia y comunidad se
  obtienen disolviendo esas mismas secciones, así que coinciden exactamente.
- **Carga ligera.** El navegador descarga solo las teselas visibles: ~1 MB
  para ver toda España, frente a los 121 MB del GeoJSON de v1.
- **Comparación 2011 ↔ 2021 honesta.** El pipeline cruza las dos geometrías;
  solo se comparan directamente las secciones con el mismo código y el mismo
  trazado (≥ 95 % de coincidencia). Para el resto, la ficha muestra a qué
  secciones del otro año corresponden y en qué proporción.
- **Panel fijo**: filtros y capas a la izquierda, leyenda y exportación a la
  derecha, ficha y análisis abajo. Nada flota sobre el mapa.

## Requisitos

- Python 3 con `geopandas`, `pyogrio` (GDAL ≥ 3.8, con driver PMTiles),
  `shapely` 2 y `pandas` para generar los datos.
- Node.js ≥ 20 para el visor.

## Generar los datos

Los datos de entrada están en `data_pipeline/data/` (shapefiles del INE y
Excel del índice). Desde la raíz del repositorio:

```
python data_pipeline/02_build_web_data.py
```

Escribe en `webapp/public/data/ct/` (≈ 10 min). Para inspeccionar el tamaño de
las teselas: `python data_pipeline/tile_stats.py webapp/public/data/ct/2021.pmtiles`.

**Variables del índice (imputadas).** No se publican mientras el INE no lo
autorice. Para publicarlas basta con poner `EXPORT_VARIABLES = True` al
principio de `02_build_web_data.py` y regenerar: el visor ofrecerá entonces la
casilla «Incluir variables del índice» en Exportar.

## Desarrollo

```
cd webapp
npm install
npm run assets     # copia imágenes del atlas y logo desde terria_frontend/wwwroot
npm run dev        # http://localhost:5173
```

## Publicar

```
npm run build      # genera webapp/dist/
```

`dist/` es una carpeta estática autocontenida con rutas relativas: se puede
subir tal cual a cualquier carpeta del servidor (p. ej. `/inJS/`). El servidor
solo necesita servir ficheros estáticos y admitir peticiones por rangos
(`Accept-Ranges: bytes`), que el de la SEE ya admite.

## Dónde se configura cada cosa

Todo en `src/config.js`:

| Qué | Dónde |
|---|---|
| Unidades espaciales (secciones, malla…) y sus años | `MODES` |
| Mapas base y su respaldo automático | `BASEMAPS` |
| Capas WMS ofrecidas por defecto | `WMS_CATALOG` |
| Paletas de color | `PALETTES` |
| Cita y DOI | `CITATION` |

**Añadir la malla (grid):** generar sus datos con la misma estructura
(teselas con las propiedades `i, q, ip, p, m, s` y una tabla JSON por año),
rellenar `years` en la entrada `grid` de `MODES` y poner `available: true`.
