// Everything that describes WHAT the viewer shows lives here, so adding a
// spatial mode, a year, a basemap or a WMS layer is a config change.

// ── Colours ──────────────────────────────────────────────────────────────────
export const PALETTES = {
  std: ["#1a9850", "#91cf60", "#fee08b", "#fc8d59", "#d73027"],
  cb:  ["#4575b4", "#91bfdb", "#fee08b", "#fc8d59", "#d73027"],
};
export const NO_DATA_COLOR = "#cfcfcf";
export const DIM_COLOR = "#e6e6e6";

// ── Spatial modes ────────────────────────────────────────────────────────────
// A mode is a family of spatial units (census tracts, grid cells, …). Each
// year of a mode has its own geometry: units are never assumed to be the same
// territory across years unless the data says so (the "s" flag and the link
// file, built by data_pipeline/02_build_web_data.py).
//
// To add a mode: build its data with the same layout (tiles with the
// properties i, q, ip, p, m, s; boundary and gap tiles; a table JSON) and add
// an entry here.
// `filters` lists which filter groups apply (see components/Filters.jsx).
export const MODES = [
  {
    id: "ct",
    available: true,
    short: { es: "Secciones", en: "Tracts" },
    label: { es: "Secciones censales", en: "Census tracts" },
    unit: { es: "sección", en: "tract" },
    units: { es: "secciones", en: "tracts" },
    idLabel: "CUSEC",
    defaultYear: "2021",
    years: {
      "2021": {
        tiles: "data/ct/2021.pmtiles",
        bounds: "data/ct/2021_bounds.pmtiles",
        gaps: "data/ct/2021_gaps.pmtiles",
        table: "data/ct/2021.json",
        vars: "data/ct/2021_vars.json",
        geo: "data/ct/geo/2021_{cpro}.json",
        source: { es: "INE · secciones censales a 1/1/2021", en: "INE · census tracts at 1/1/2021" },
      },
      "2011": {
        tiles: "data/ct/2011.pmtiles",
        bounds: "data/ct/2011_bounds.pmtiles",
        gaps: "data/ct/2011_gaps.pmtiles",
        table: "data/ct/2011.json",
        vars: "data/ct/2011_vars.json",
        geo: "data/ct/geo/2011_{cpro}.json",
        source: { es: "INE · secciones censales del Censo 2011", en: "INE · 2011 Census tracts" },
      },
    },
    // Cross-year correspondence, only meaningful when both years exist.
    link: { file: "data/ct/link_2021_2011.json", a: "2021", b: "2011" },
    filters: ["territory", "quintile", "degurba", "stable"],
  },
  {
    id: "grid",
    available: false,
    short: { es: "Malla", en: "Grid" },
    label: { es: "Malla regular (grid)", en: "Regular grid" },
    unit: { es: "celda", en: "cell" },
    units: { es: "celdas", en: "cells" },
    idLabel: "ID",
    years: {},
    filters: ["territory", "quintile"],
  },
];

export const modeById = id => MODES.find(m => m.id === id) ?? MODES[0];

// ── Map ──────────────────────────────────────────────────────────────────────
export const VIEWS = {
  peninsula: [[-9.8, 35.7], [4.6, 44.0]],
  canarias: [[-18.3, 27.5], [-13.2, 29.5]],
};
// The map can't be panned or zoomed out beyond Spain (with some margin),
// so it never shows an empty world.
export const MAX_BOUNDS = [[-27, 20], [13, 50]];
export const TILE_MAX_ZOOM = 14;   // must match MAXZOOM in the pipeline

const IGN_WMTS = layer =>
  "https://www.ign.es/wmts/ign-base?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
  `&LAYER=${layer}&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible` +
  "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg";

// The first basemap is the default. If its tiles keep failing the map
// switches to `fallback` on its own, so the map is never left blank.
export const BASEMAPS = [
  // Vector basemap: sharp on any screen and light (55 layers, ~12 KB tiles).
  // Free, no key, no fee; data © OpenStreetMap (ODbL). Its place names are
  // drawn above the index so they stay readable (indexLayers.js).
  {
    id: "ofm-gris",
    name: { es: "OpenFreeMap · gris", en: "OpenFreeMap · grey" },
    vectorStyle: "https://tiles.openfreemap.org/styles/positron",
    attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · ' +
      '© <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · ' +
      'Datos © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    fallback: "ign-gris",
  },
  {
    id: "ign-gris",
    name: { es: "IGN · callejero gris", en: "IGN · grey street map" },
    tiles: [IGN_WMTS("IGNBase-gris")],
    attribution: '© <a href="https://www.ign.es" target="_blank" rel="noopener">IGN</a> (CC BY 4.0)',
    maxzoom: 19,
    fallback: "osm",
  },
  {
    id: "ign-base",
    name: { es: "IGN · callejero", en: "IGN · street map" },
    tiles: [IGN_WMTS("IGNBaseTodo")],
    attribution: '© <a href="https://www.ign.es" target="_blank" rel="noopener">IGN</a> (CC BY 4.0)',
    maxzoom: 19,
    fallback: "osm",
  },
  {
    id: "pnoa",
    name: { es: "IGN · ortofoto PNOA", en: "IGN · PNOA aerial imagery" },
    tiles: ["https://www.ign.es/wmts/pnoa-ma?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
            "&LAYER=OI.OrthoimageCoverage&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible" +
            "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg"],
    attribution: '© <a href="https://www.ign.es" target="_blank" rel="noopener">PNOA · IGN</a> (CC BY 4.0)',
    maxzoom: 20,
    fallback: "osm",
  },
  {
    id: "osm",
    name: { es: "OpenStreetMap", en: "OpenStreetMap" },
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    maxzoom: 19,
    fallback: "ign-gris",
  },
  {
    id: "none",
    name: { es: "Sin mapa base", en: "No basemap" },
    tiles: null,
  },
];

// ── WMS catalogue ────────────────────────────────────────────────────────────
// Offered by default in "Capas → Capas WMS". All verified to answer GetMap in
// EPSG:3857 with CORS enabled. `above: true` draws the layer over the index
// (for line-like layers); otherwise it goes under it.
export const WMS_CATALOG = [
  { id: "pnoa", group: "IGN", url: "https://www.ign.es/wms-inspire/pnoa-ma", layers: "OI.OrthoimageCoverage",
    name: { es: "Ortofoto PNOA", en: "PNOA aerial imagery" }, above: false, opacity: 1 },
  { id: "mtn", group: "IGN", url: "https://www.ign.es/wms-inspire/mapa-raster", layers: "mtn_rasterizado",
    name: { es: "Mapa topográfico (MTN)", en: "Topographic map (MTN)" }, above: false, opacity: 1 },
  { id: "limites", group: "IGN", url: "https://www.ign.es/wms-inspire/unidades-administrativas", layers: "AU.AdministrativeBoundary",
    name: { es: "Límites administrativos oficiales", en: "Official administrative boundaries" }, above: true, opacity: 1 },
  { id: "catastro", group: "Catastro", url: "https://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx", layers: "CP.CadastralParcel",
    name: { es: "Parcelas catastrales", en: "Cadastral parcels" }, above: true, opacity: 0.9, minzoom: 15 },
  { id: "edificios", group: "Catastro", url: "https://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx", layers: "BU.Building",
    name: { es: "Edificios", en: "Buildings" }, above: true, opacity: 0.9, minzoom: 15 },
  { id: "suelo", group: "IDEE", url: "https://servicios.idee.es/wms-inspire/ocupacion-suelo", layers: "LC.LandCoverSurfaces",
    name: { es: "Ocupación del suelo", en: "Land cover" }, above: false, opacity: 0.8 },
  { id: "carreteras", group: "IDEE", url: "https://servicios.idee.es/wms-inspire/transportes", layers: "TN.RoadTransportNetwork.RoadLink",
    name: { es: "Carreteras", en: "Roads" }, above: true, opacity: 1 },
  { id: "ferrocarril", group: "IDEE", url: "https://servicios.idee.es/wms-inspire/transportes", layers: "TN.RailTransportNetwork.RailwayLink",
    name: { es: "Ferrocarril", en: "Railways" }, above: true, opacity: 1 },
  { id: "rios", group: "IDEE", url: "https://servicios.idee.es/wms-inspire/hidrografia", layers: "HY.Network",
    name: { es: "Red hidrográfica", en: "Rivers" }, above: true, opacity: 1 },
];

export function wmsTileUrl({ url, layers, version = "1.3.0" }) {
  const sep = url.includes("?") ? "&" : "?";
  const crs = version === "1.1.1" ? "SRS" : "CRS";
  return `${url}${sep}SERVICE=WMS&REQUEST=GetMap&VERSION=${version}&LAYERS=${encodeURIComponent(layers)}` +
    `&STYLES=&FORMAT=image/png&TRANSPARENT=true&${crs}=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}`;
}

// ── Geocoding (address search) ───────────────────────────────────────────────
export const GEOCODER = {
  cartociudad: q => `https://www.cartociudad.es/geocoder/api/geocoder/candidates?limit=6&q=${encodeURIComponent(q)}`,
  cartociudadFind: (id, type, portal) => `https://www.cartociudad.es/geocoder/api/geocoder/find?id=${encodeURIComponent(id)}` +
    `&type=${encodeURIComponent(type)}${portal != null ? `&portal=${encodeURIComponent(portal)}` : ""}`,
  photon: q => `https://photon.komoot.io/api/?limit=6&lang=default&bbox=-18.5,27.4,4.6,44.0&q=${encodeURIComponent(q)}`,
};

// ── Static atlas (province images) ───────────────────────────────────────────
export const ATLAS_DIR = "atlas/provinces/";
export const ATLAS_NATIONAL_DIR = "atlas/national/";

// ── Citation ─────────────────────────────────────────────────────────────────
// Article accepted in Gaceta Sanitaria (in press). Same text in the atlas
// (Indicador de Privación 2021/src/R/atlas_helpers.R, .atlas_citation()).
export const CITATION = {
  doi: null,   // set to "10.xxxx/..." once the article has one
  year: 2026,
  authors: "Duque, I., Gras-García, E. M., Ordanovich, D., Marí Dell'Olmo, M., " +
    "Aguilar-Palacio, I., La Parra-Casado, D., Fernández-Villa, T. & Martín Roncero, U., " +
    "on behalf of the Social Determinants of Health working group of the Spanish Society of Epidemiology",
  // BibTeX: one entry per author, the working group as a corporate author
  bibAuthors: ["Duque, I.", "Gras-García, E. M.", "Ordanovich, D.", "Marí Dell'Olmo, M.",
    "Aguilar-Palacio, I.", "La Parra-Casado, D.", "Fernández-Villa, T.", "Martín Roncero, U.",
    "{Social Determinants of Health working group of the Spanish Society of Epidemiology}"],
  title: "Índice de privación 2021 en España por sección censal de la Sociedad Española de Epidemiología",
  journal: "Gaceta Sanitaria",
  status: "in press",
};
