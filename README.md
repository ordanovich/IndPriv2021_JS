# Atlas de Privación de España — Documentación técnica

Visor web interactivo para la consulta y descarga del **Índice de Privación (IP) 2021** a nivel de sección censal en España. Como funcionalidad adicional, permite comparar los resultados con los datos de **2011**.

---

## Tabla de contenidos

1. [Descripción general](#descripción-general)
2. [Datos mostrados](#datos-mostrados)
3. [Tecnología](#tecnología)
4. [Arquitectura del proyecto](#arquitectura-del-proyecto)
5. [Funcionalidades principales](#funcionalidades-principales)
6. [Ejecución local](#ejecución-local)
7. [Personalización institucional](#personalización-institucional)
8. [Despliegue en servidor institucional](#despliegue-en-servidor-institucional)

---

## Descripción general

El visor muestra la distribución del **Índice de Privación 2021** en España utilizando como unidad espacial la **sección censal** (~35 000 unidades). La clasificación se realiza en 5 quintiles (cada uno con ~20 % de la población). El objetivo principal es facilitar la consulta y la **descarga de los datos**, con herramientas de filtrado por territorio y selección espacial. Como funcionalidad añadida, se incluye la posibilidad de comparar con los datos de 2011 mediante una vista dividida (split-screen).

---

## Datos mostrados

| Elemento | Detalle |
|---|---|
| **Unidad espacial** | Sección censal (CUSEC) |
| **Número de geometrías** | 36 333 secciones censales |
| **Tamaño del GeoJSON** | ~145 MB (sin comprimir) |
| **Cobertura** | España peninsular, islas y ciudades autónomas |
| **Variables por sección** | `CUSEC`, `CCAA`, `NPRO`, `NMUN`, `IP2011`, `IP2021`, `Q11_Label`, `Q21_num`, `Q21_Label` |
| **Clasificación 2011** | Quintiles basados en rangos fijos del Atlas de Privación |
| **Clasificación 2021** | Quintiles calculados sobre la distribución actual del IP (cada quintil ≈ 20 % de secciones) |

### Escala de colores (ambos años)

| Quintil | Categoría | Color |
|---|---|---|
| Q1 | Inferior (menor privación) | `#1a9850` verde |
| Q2 | Intermedio bajo | `#91cf60` verde claro |
| Q3 | Intermedio | `#ffffbf` amarillo |
| Q4 | Intermedio alto | `#fc8d59` naranja |
| Q5 | Superior (mayor privación) | `#d73027` rojo |

---

## Tecnología

### Stack principal

| Capa | Tecnología | Versión |
|---|---|---|
| **Framework de mapas** | TerriaJS | 8.11.3 |
| **Motor 3D** | Cesium (via TerriaJS) | incluido en TerriaJS |
| **Motor 2D** | Leaflet (via TerriaJS) | incluido en TerriaJS |
| **UI framework** | React | 18.3.1 |
| **Bundler** | Webpack | 5.x |
| **Task runner** | Gulp | 5.x |
| **Servidor de desarrollo** | terriajs-server | 4.x |
| **Runtime** | Node.js | ≥ 20 |
| **Exportación Excel** | SheetJS (`xlsx`) | — |
| **Lenguaje de datos** | R (pipeline de datos) | — |
| **Paquetes R clave** | `sf`, `dplyr`, `data.table`, `rmapshaper`, `readxl` | — |

### Formatos de datos

- **GeoJSON** — formato nativo del visor, servido estáticamente
- **XLSX** — exportación del lado cliente (sin servidor)
- **JSON5** — configuración del visor (`config.json`, `simple.json`)

---

## Arquitectura del proyecto

```
IndPriv2021_terriaJS/
│
├── data_pipeline/
│   └── 01_process_and_export.R     # Script R: limpieza, fusión, cálculo de quintiles,
│                                   # generación de etiquetas y exportación a GeoJSON
│
└── terria_frontend/
    ├── entry.js                    # Punto de entrada Webpack
    ├── index.js                    # Inicialización de Terria y ViewState
    ├── plugins.ts                  # Registro de plugins (vacío por defecto)
    ├── package.json
    ├── gulpfile.js                 # Tareas de construcción (dev, build)
    │
    ├── lib/
    │   └── Views/
    │       ├── UserInterface.jsx       # UI principal: monta todos los componentes custom
    │       ├── AppContext.js           # Contexto React: idioma (ES/EN) y paleta daltónica
    │       ├── translations.js         # Textos bilingües (ES/EN) para toda la interfaz
    │       ├── ExportPanel.jsx         # Panel lateral de filtrado y exportación
    │       ├── ExtentChart.jsx         # Gráfico de distribución en vista actual (con filtro de quintil)
    │       ├── AboutPanel.jsx          # Panel de metodología: variables ACP, estructura factorial, atlas
    │       ├── ProvinceAtlasPanel.jsx  # Panel de atlas provincial (se abre al clicar una sección)
    │       └── geoDataStore.js         # Caché compartida del GeoJSON + helpers
    │
    └── wwwroot/                    # Archivos servidos estáticamente
        ├── index.html
        ├── index.ejs               # Plantilla fuente de index.html (editar este)
        ├── config.json             # Configuración global de la app
        ├── images/
        │   └── logo.png            # Logo institucional (reemplazable)
        ├── init/
        │   └── simple.json         # Catálogo: capas, estilos, cámara inicial
        ├── data/
        │   └── secciones_unified.geojson   # Datos principales (~145 MB, excluido de git)
        └── atlas/                  # Imágenes estáticas del atlas (excluidas de git, servidas localmente)
            ├── national/           # Diccionario de variables, mapa nacional, matriz de variables
            └── provinces/          # Mapas continuo + quintiles para las 52 provincias
```

### Flujo de datos

```
Datos brutos (Excel + shapefile INE)
        ↓  01_process_and_export.R
secciones_unified.geojson  (36 333 features, 9 atributos)
        ↓  servido estáticamente
Navegador → carga y renderiza el GeoJSON
        ↓  geoDataStore.js (caché en memoria)
ExportPanel  ←→  ExtentChart  (comparten la misma caché)
```

---

## Funcionalidades principales

### Vista comparativa (split-screen)
- La capa **2021** se carga activa por defecto (panel derecho)
- La capa **2011** se puede activar (panel izquierdo) mediante el icono del ojo en el panel izquierdo
- Botón **Comparar** (esquina superior derecha) activa la vista dividida con un divisor deslizable

### Popups informativos
Al hacer clic en cualquier sección censal, aparece un popup con:
- Nombre de municipio, provincia y código CUSEC
- Índice bruto de privación para 2011 y 2021 (lado a lado)
- Quintil de privación para cada año
- Escala de color de referencia

### Gráfico de distribución en vista actual (`ExtentChart`)
- Aparece en la esquina inferior derecha
- Calcula en tiempo real qué porcentaje de las secciones visibles pertenece a cada quintil
- Se actualiza al terminar cada movimiento/zoom del mapa
- Detecta automáticamente si el usuario tiene la capa 2011 o 2021 activa
- Barra apilada interactiva + filas con mini-barras y porcentajes
- Hover resalta el quintil seleccionado y muestra el recuento exacto
- **Filtro por quintil:** al hacer clic en una fila, los polígonos de ese quintil se resaltan en el mapa (los demás pasan a gris claro); se puede desactivar clicando de nuevo o con el botón «× Quitar filtro»

### Interfaz bilingüe y accesibilidad
- Botón **ES / EN** en la barra superior para cambiar el idioma de toda la interfaz en tiempo real
- Botón **◑** para activar una paleta de colores apta para personas con daltonismo (escala azul-amarillo-rojo)

### Panel de metodología (`AboutPanel`)
Accesible mediante el botón **ℹ Índice** en la barra superior. Contiene tres pestañas:
- **Variables** — lista de las 9 variables del modelo final con sus correlaciones de Spearman (ρ) con el CP1, representadas como barras de color (azul = factor de riesgo, ámbar = factor protector); imagen del diccionario de variables y panel de mapas nacionales (puntuaciones Z)
- **ACP** — estructura factorial del modelo: gráfico de loadings, estadísticos (varianza explicada, KMO, contraste de Bartlett) e imagen del proceso de selección de variables
- **Atlas** — acceso a los 5 volúmenes del atlas cartográfico estático (nacional, provincias, ciudades, conurbaciones, AUF) con enlace a DOI en Zenodo (pendiente de publicación)

Las imágenes del panel son ampliables (clic → lightbox) y enlazables en nueva pestaña.

### Panel de atlas provincial (`ProvinceAtlasPanel`)
- Se abre automáticamente al clicar sobre cualquier sección censal en el mapa
- Muestra el mapa provincial correspondiente en dos representaciones: continuo e por quintiles
- Botón para cambiar entre ambas vistas; botón × para cerrar

### Panel de exportación (`ExportPanel`)
Accesible mediante el botón azul **⬇ Exportar / Seleccionar datos**:

| Función | Detalle |
|---|---|
| **Filtro por CC.AA.** | Desplegable con las 19 comunidades y ciudades autónomas |
| **Filtro por provincia** | Se actualiza en cascada según la CC.AA. seleccionada |
| **Selección rectangular** | Dibuja un rectángulo sobre el mapa; selecciona las secciones cuyo centroide cae dentro |
| **Exportar a Excel** | Descarga `.xlsx` con columnas: CUSEC, CCAA, Provincia, Municipio, IP2011, Quintil2011, IP2021, Quintil2021 |
| **Exportar a GeoJSON** | Descarga la selección filtrada como GeoJSON válido |
| **Descarga completa** | Enlace directo al GeoJSON completo (~145 MB) |

Todos los filtros son acumulativos (CC.AA. + provincia + rectángulo espacial).

---

## Ejecución local

### Requisitos
- Node.js ≥ 20
- R ≥ 4.x (solo para regenerar los datos)

### Pasos

```bash
# 1. Instalar dependencias (solo la primera vez, puede tardar varios minutos)
cd terria_frontend
npm install --legacy-peer-deps

# 2. Arrancar el servidor de desarrollo (mantener la terminal abierta)
node_modules/.bin/gulp dev

# 3. Abrir en el navegador
# http://localhost:3001
```

El servidor sirve los archivos de `wwwroot/` en el puerto **3001** y reconstruye automáticamente el bundle cuando se modifican los ficheros fuente en `lib/`.

> **Nota:** Los cambios en `wwwroot/config.json` o `wwwroot/init/simple.json` no requieren recompilar; basta con recargar el navegador.

### Regenerar los datos

```r
# Desde R, con los ficheros originales en data_pipeline/data/
source("data_pipeline/01_process_and_export.R")
# Salida: terria_frontend/wwwroot/data/secciones_unified.geojson
```

---

## Personalización institucional

Esta sección describe todos los elementos de la interfaz que pueden modificarse para adaptar el visor a la identidad institucional deseada.

### Logo institucional

Coloca el archivo de logo en la siguiente ruta:

```
terria_frontend/wwwroot/images/logo.png
```

**Especificaciones recomendadas:**
- Formato: PNG con fondo transparente
- Alto: entre 40 y 52 px en pantalla (proporcionar imagen a doble resolución, p. ej. 200 × 80 px para una imagen que se mostrará a 100 × 40 px)
- Ancho: sin límite estricto, pero menos de 300 px para evitar que ocupe toda la barra superior
- Si tienes múltiples logos (dos instituciones), puedes concatenarlos horizontalmente en un único archivo PNG, o usar dos etiquetas `<img>` en `brandBarElements` (ver abajo)

El logo aparece en la **barra superior** de la aplicación. La referencia en `wwwroot/config.json` es:

```json
"brandBarElements": [
  "<a href='/'><img src='images/logo.png' height='48' alt='Logo institucional' /></a>",
  "<span style='...'>Atlas de Privación de España</span>",
  ""
]
```

Modifica el atributo `height` si necesitas ajustar el tamaño de visualización.

### Nombre de la aplicación

En `wwwroot/config.json`, el campo `appName` controla el nombre que aparece en algunos mensajes internos:

```json
"appName": "Atlas de Privación de España"
```

### Título de la pestaña del navegador

Edita el archivo `wwwroot/index.ejs` (y también `wwwroot/index.html` si sirves directamente sin recompilar):

```html
<title>Atlas de Privación de España</title>
<meta name="description" content="Visor interactivo del Índice de Privación 2021 a nivel de sección censal en España." />
```

### Favicon

Los iconos del navegador se encuentran en `wwwroot/favicons/`. Para reemplazarlos con los iconos institucionales:

1. Genera los distintos tamaños necesarios (herramientas online como [favicon.io](https://favicon.io) o [realfavicongenerator.net](https://realfavicongenerator.net) automatizan esto a partir de un PNG)
2. Sustituye los archivos en `wwwroot/favicons/` manteniendo los mismos nombres de archivo
3. Reemplaza también `wwwroot/favicon.ico`

---

## Despliegue en servidor institucional

La aplicación es una **SPA estática** (Single Page Application): una vez compilada, todos los archivos son estáticos y no requieren base de datos, Node.js ni ningún proceso en el servidor. Cualquier servidor web capaz de servir archivos estáticos es suficiente.

### Prerrequisitos

#### Máquina de compilación (local o CI/CD)
- Node.js ≥ 20 y npm (incluido con Node.js)
- Acceso de escritura a la carpeta del proyecto

#### Servidor institucional
- Apache 2.4+, Nginx 1.18+, IIS 10+ o equivalente
- Espacio en disco: mínimo 500 MB (build completo + GeoJSON)
- Sin requisitos de base de datos ni lenguajes de servidor

---

### Paso 1 — Personalizar antes de compilar

Antes de generar el build de producción, realiza los cambios de identidad institucional descritos en la sección [Personalización institucional](#personalización-institucional):

- Coloca el logo en `wwwroot/images/logo.png`
- Verifica `wwwroot/config.json` (`appName`, `brandBarElements`)
- Verifica `wwwroot/index.ejs` (título, meta description)

---

### Paso 2 — Compilar la aplicación

Ejecuta estos comandos en la máquina de compilación:

```bash
cd terria_frontend

# Solo la primera vez (instala ~700 MB de dependencias en node_modules/)
npm install --legacy-peer-deps

# Genera el build de producción (puede tardar 3-10 minutos)
node_modules/.bin/gulp build
```

El resultado queda en `terria_frontend/wwwroot/`. Esta carpeta contiene:

```
wwwroot/
├── index.html          ← punto de entrada (generado desde index.ejs)
├── config.json         ← configuración de la app
├── build/              ← JS/CSS compilados y minificados
│   ├── TerriaMap.js    (~5-10 MB minificado)
│   ├── TerriaMap.css
│   └── ...
├── favicons/
├── images/
│   └── logo.png
├── init/
│   └── simple.json
└── data/
    └── secciones_unified.geojson   (~145 MB)
```

---

### Paso 3 — Transferir los archivos al servidor

Transfiere todo el contenido de `wwwroot/` a la raíz del directorio web del servidor. Puedes usar `rsync`, `scp`, FTP o cualquier método disponible:

```bash
# Ejemplo con rsync (recomendado: transfiere solo los cambios)
rsync -avz --progress \
  terria_frontend/wwwroot/ \
  usuario@servidor.institucional.es:/var/www/atlas-privacion/

# Ejemplo con scp
scp -r terria_frontend/wwwroot/* \
  usuario@servidor.institucional.es:/var/www/atlas-privacion/
```

> **Nota sobre el GeoJSON:** El archivo `secciones_unified.geojson` pesa ~145 MB. La primera transferencia tardará varios minutos. En actualizaciones posteriores, si solo cambia el código (no los datos), puedes excluir el GeoJSON con `rsync --exclude='data/'` para acelerar el proceso.

---

### Paso 4 — Configuración del servidor web

#### Apache

Crea o edita el virtual host correspondiente:

```apache
<VirtualHost *:80>
    ServerName atlas.institucional.es
    DocumentRoot /var/www/atlas-privacion

    <Directory /var/www/atlas-privacion>
        Options -Indexes
        AllowOverride None
        Require all granted

        # SPA: redirige rutas desconocidas al index.html
        FallbackResource /index.html
    </Directory>

    # Compresión gzip: reduce el GeoJSON de ~145 MB a ~22 MB en tránsito
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/html text/css application/javascript
        AddOutputFilterByType DEFLATE application/json application/geo+json
    </IfModule>

    # Cabeceras de caché para assets inmutables (hash en nombre de archivo)
    <FilesMatch "\.(js|css)$">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </FilesMatch>

    # El GeoJSON puede cachearse agresivamente (solo cambia con nuevos datos)
    <FilesMatch "\.geojson$">
        Header set Cache-Control "public, max-age=604800"
    </FilesMatch>

    ErrorLog ${APACHE_LOG_DIR}/atlas-privacion-error.log
    CustomLog ${APACHE_LOG_DIR}/atlas-privacion-access.log combined
</VirtualHost>
```

Activa los módulos necesarios si no están ya activos:

```bash
sudo a2enmod deflate headers rewrite
sudo systemctl reload apache2
```

#### Nginx

```nginx
server {
    listen 80;
    server_name atlas.institucional.es;
    root /var/www/atlas-privacion;
    index index.html;

    # SPA: redirige rutas desconocidas al index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Compresión gzip
    gzip on;
    gzip_types text/html text/css application/javascript
               application/json application/geo+json;
    gzip_min_length 1024;
    gzip_comp_level 6;

    # Caché de assets compilados (el nombre incluye hash)
    location ~* \.(js|css)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Caché del GeoJSON
    location ~* \.geojson$ {
        expires 7d;
        add_header Cache-Control "public";
    }

    # Sin caché para config.json y simple.json (cambios inmediatos sin recompilar)
    location ~* (config\.json|simple\.json)$ {
        expires -1;
        add_header Cache-Control "no-cache";
    }

    # Tamaño máximo de respuesta (necesario para el GeoJSON)
    client_max_body_size 200M;
}
```

#### IIS (Windows Server)

1. Crea un nuevo sitio en IIS Manager apuntando a la carpeta `wwwroot/`
2. Instala el módulo **URL Rewrite** si no está presente
3. Crea el archivo `wwwroot/web.config` con el siguiente contenido:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="SPA fallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <mimeMap fileExtension=".geojson" mimeType="application/geo+json" />
      <mimeMap fileExtension=".json" mimeType="application/json" />
    </staticContent>
    <httpCompression>
      <dynamicTypes>
        <add mimeType="application/json" enabled="true" />
        <add mimeType="application/geo+json" enabled="true" />
      </dynamicTypes>
    </httpCompression>
  </system.webServer>
</configuration>
```

---

### Paso 5 — HTTPS (recomendado)

Para producción, configura HTTPS. Con Let's Encrypt (gratuito):

```bash
# En Debian/Ubuntu con Certbot
sudo apt install certbot python3-certbot-apache  # o python3-certbot-nginx
sudo certbot --apache -d atlas.institucional.es   # o --nginx
```

Si el servidor institucional ya dispone de certificado corporativo, el equipo de sistemas lo instalará directamente en el virtual host.

---

### Paso 6 — Verificación

Una vez desplegado, comprueba:

- [ ] La página carga en el navegador y aparece el mapa de España
- [ ] El logo institucional es visible en la barra superior
- [ ] Al hacer clic en una sección censal aparece el popup con los datos y el panel de atlas provincial
- [ ] El botón "Exportar / Seleccionar datos" abre el panel lateral
- [ ] La exportación a Excel funciona (descarga un `.xlsx`)
- [ ] El botón "Comparar" activa la vista dividida 2011/2021
- [ ] El botón **ES/EN** cambia el idioma de la interfaz
- [ ] El botón **◑** activa la paleta para daltonismo
- [ ] El botón **ℹ Índice** abre el panel de metodología con las tres pestañas
- [ ] Al hacer clic en un quintil del gráfico de distribución, los polígonos del mapa se filtran visualmente
- [ ] En las herramientas del navegador (Network), el GeoJSON se sirve comprimido (cabecera `Content-Encoding: gzip`)

---

### Opción: GeoJSON alojado en servidor externo

Si el servidor institucional tiene restricciones de espacio o el GeoJSON causa problemas de rendimiento, puede alojarse en un servidor externo (CDN, bucket S3, Zenodo, etc.) y referenciar la URL externa en `wwwroot/init/simple.json`:

```json
"url": "https://cdn.institucional.es/datos/secciones_unified.geojson"
```

En ese caso, el servidor que aloja el GeoJSON debe devolver la cabecera CORS:

```
Access-Control-Allow-Origin: *
```

---

### Actualización del visor

Para actualizar el código (sin cambiar los datos):

```bash
# En la máquina de compilación
cd terria_frontend
node_modules/.bin/gulp build

# Subir solo los archivos de build (excluye el GeoJSON para mayor rapidez)
rsync -avz --exclude='data/' \
  terria_frontend/wwwroot/ \
  usuario@servidor.institucional.es:/var/www/atlas-privacion/
```

Para actualizar solo los datos (sin recompilar):

```bash
rsync -avz \
  terria_frontend/wwwroot/data/secciones_unified.geojson \
  usuario@servidor.institucional.es:/var/www/atlas-privacion/data/
```

---

*Documentación actualizada en mayo 2026 · v0.2.*
