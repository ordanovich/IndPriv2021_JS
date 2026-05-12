// Shared GeoJSON cache and helpers used by ExportPanel and ExtentChart

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

/** Load and cache the GeoJSON, enriching it with _CCAA. No-op if already loaded. */
export function ensureDataLoaded() {
  if (_cachedGeoData) return Promise.resolve(_cachedGeoData);
  return fetch("data/secciones_unified.geojson")
    .then(r => r.json())
    .then(gj => {
      gj.features.forEach(f => {
        const prov = provCode(f.properties.CUSEC);
        f.properties._CCAA = PROV_TO_CCAA[prov] || "—";
      });
      setCachedData(gj);
      return gj;
    });
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
