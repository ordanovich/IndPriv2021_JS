// Shared GeoJSON cache and helpers used by ExportPanel and ExtentChart
import { DEMO_MODE } from "./buildConfig";

export const PROV_TO_CCAA = {
  "04": "Andalucía",   "11": "Andalucía",   "14": "Andalucía",
  "18": "Andalucía",   "21": "Andalucía",   "23": "Andalucía",
  "29": "Andalucía",   "41": "Andalucía",
  "22": "Aragón",      "44": "Aragón",      "50": "Aragón",
  "33": "Principado de Asturias",
  "07": "Illes Balears",
  "35": "Canarias",    "38": "Canarias",
  "39": "Cantabria",
  "02": "Castilla-La Mancha", "13": "Castilla-La Mancha",
  "16": "Castilla-La Mancha", "19": "Castilla-La Mancha",
  "45": "Castilla-La Mancha",
  "05": "Castilla y León", "09": "Castilla y León", "24": "Castilla y León",
  "34": "Castilla y León", "37": "Castilla y León", "40": "Castilla y León",
  "42": "Castilla y León", "47": "Castilla y León", "49": "Castilla y León",
  "08": "Cataluña",    "17": "Cataluña",    "25": "Cataluña",    "43": "Cataluña",
  "51": "Ceuta",
  "06": "Extremadura", "10": "Extremadura",
  "15": "Galicia",     "27": "Galicia",     "32": "Galicia",     "36": "Galicia",
  "26": "La Rioja",
  "28": "Comunidad de Madrid",
  "52": "Melilla",
  "30": "Región de Murcia",
  "31": "Comunidad Foral de Navarra",
  "01": "País Vasco",  "20": "País Vasco",  "48": "País Vasco",
  "03": "Comunitat Valenciana", "12": "Comunitat Valenciana", "46": "Comunitat Valenciana",
};

export const CCAA_LIST = [...new Set(Object.values(PROV_TO_CCAA))].sort();

// ── Delta categories (used by the atlas-delta catalog item) ───────────────────
// The DeltaLabel string is the enum value the GeoJSON styler matches on; the
// numeric prefix is purely so the five categories sort green → red.
export const DELTA_ENUMS = [
  "1. Mejora notable",
  "2. Mejora leve",
  "3. Estable",
  "4. Empeoramiento leve",
  "5. Empeoramiento notable",
];

export function deltaCategoryLabel(d) {
  if (d <= -2) return DELTA_ENUMS[0];
  if (d === -1) return DELTA_ENUMS[1];
  if (d === 0)  return DELTA_ENUMS[2];
  if (d === 1)  return DELTA_ENUMS[3];
  return DELTA_ENUMS[4]; // d >= 2
}

function parseQuintileFromLabel(label) {
  const c = String(label || "").charAt(0);
  const n = parseInt(c, 10);
  return n >= 1 && n <= 5 ? n : null;
}

// Module-level cache — shared across all components
let _cachedGeoData = null;
const _listeners = new Set();

export function getCachedData() { return _cachedGeoData; }

export function setCachedData(data) {
  _cachedGeoData = data;
  _listeners.forEach(fn => fn(data));
}

/** Subscribe to data becoming available. Returns an unsubscribe function. */
export function onDataReady(fn) {
  _listeners.add(fn);
  if (_cachedGeoData) fn(_cachedGeoData);
  return () => _listeners.delete(fn);
}

/** Load and cache the GeoJSON, enriching it with _CCAA, deltaQ and
 *  DeltaLabel. No-op if already loaded. The url is left flexible so the
 *  demo build (which serves secciones_demo.geojson) can override it via
 *  the catalog. We probe the demo file first by checking which one the
 *  page bootstrap chose; if it's not reachable, fall back to the full
 *  GeoJSON. */
export function ensureDataLoaded() {
  if (_cachedGeoData) return Promise.resolve(_cachedGeoData);
  const url = pickDataUrl();
  return fetch(url)
    .then(r => r.json())
    .then(gj => {
      gj.features.forEach(f => {
        const p = f.properties;
        const prov = provCode(p.CUSEC);
        p._CCAA = PROV_TO_CCAA[prov] || "—";

        // Derived delta classification — only added when both quintiles
        // are present and parseable. Mutating the in-memory geojson is
        // intentional and matches the existing _CCAA pattern.
        const q21 = p.Q21_num;
        const q11 = parseQuintileFromLabel(p.Q11_Label);
        if (q21 != null && q11 != null) {
          const d = q21 - q11;
          p.deltaQ = d;
          p.DeltaLabel = deltaCategoryLabel(d);
        }
      });
      setCachedData(gj);
      return gj;
    });
}

function pickDataUrl() {
  if (DEMO_MODE) return "data/secciones_demo.geojson";
  if (typeof window !== "undefined" && window.location.search.includes("demo=1"))
    return "data/secciones_demo.geojson";
  return "data/secciones_unified.geojson";
}

export function provCode(cusec) {
  return cusec ? String(cusec).padStart(9, "0").substring(0, 2) : null;
}

export function centroid(geometry) {
  let lons = [], lats = [];
  const add = ring => ring.forEach(([lon, lat]) => { lons.push(lon); lats.push(lat); });
  if (geometry.type === "Polygon")       add(geometry.coordinates[0]);
  else if (geometry.type === "MultiPolygon")
    geometry.coordinates.forEach(p => add(p[0]));
  if (!lons.length) return null;
  const n = lons.length;
  return [lons.reduce((a, b) => a + b, 0) / n, lats.reduce((a, b) => a + b, 0) / n];
}

/** rect has .west/.east/.south/.north in radians (Cesium Rectangle) */
export function inRect(rect, lonDeg, latDeg) {
  const r = Math.PI / 180;
  const lon = lonDeg * r, lat = latDeg * r;
  return lon >= rect.west && lon <= rect.east && lat >= rect.south && lat <= rect.north;
}
