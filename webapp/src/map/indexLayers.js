// The index layers (units, coverage gaps, boundaries) and their styling,
// shared by the main map and the comparison (swipe) map.
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { BASEMAPS, DIM_COLOR, NO_DATA_COLOR } from "../config";

let protocolReady = false;
export function ensureProtocol() {
  if (protocolReady) return;
  maplibregl.addProtocol("pmtiles", new Protocol().tile);
  protocolReady = true;
}

const abs = rel => new URL(rel, document.baseURI).href;
export const pmtiles = rel => "pmtiles://" + abs(rel);

const DATA_ATTRIBUTION = {
  es: "Índice: Grupo de Determinantes Sociales de la Salud (SEE) · Secciones: © INE",
  en: "Index: Social Determinants of Health Group (SEE) · Tracts: © INE",
};

// ── Style expressions ────────────────────────────────────────────────────────

function colorExpression(classes, colors, breaks) {
  if (classes === "c" && breaks) {
    const stops = [];
    for (let k = 0; k < 5; k++) stops.push((breaks[k] + breaks[k + 1]) / 2, colors[k]);
    return ["case", ["<=", ["get", "q"], 0], NO_DATA_COLOR,
      ["interpolate", ["linear"], ["get", "ip"], ...stops]];
  }
  return ["match", ["get", "q"], 1, colors[0], 2, colors[1], 3, colors[2], 4, colors[3], 5, colors[4], NO_DATA_COLOR];
}

function filterExpression(filters, table) {
  const c = [];
  if (filters.mun) c.push(["==", ["get", "m"], Number(filters.mun)]);
  else if (filters.prov) c.push(["==", ["get", "p"], Number(filters.prov)]);
  else if (filters.ccaa && table) {
    const provs = Object.entries(table.names.prov_ccaa)
      .filter(([, cc]) => cc === filters.ccaa).map(([p]) => Number(p));
    c.push(["in", ["get", "p"], ["literal", provs]]);
  }
  if (filters.quintiles.length) c.push(["in", ["get", "q"], ["literal", filters.quintiles]]);
  if (filters.degurba && table?.u) c.push(["==", ["get", "u"], filters.degurba]);
  if (filters.stable) c.push(["==", ["get", "s"], 1]);
  return c.length ? ["all", ...c] : true;
}

// Diagonal hatch for the coverage gaps (drawn at 2x for sharp screens).
function hatchImage() {
  const s = 16;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  g.fillStyle = "#f3f4f6";
  g.fillRect(0, 0, s, s);
  g.strokeStyle = "#9ca3af";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-2, s + 2); g.lineTo(s + 2, -2);
  g.moveTo(-2, 2); g.lineTo(2, -2);
  g.moveTo(s - 2, s + 2); g.lineTo(s + 2, s - 2);
  g.stroke();
  return g.getImageData(0, 0, s, s);
}

// ── Layers ───────────────────────────────────────────────────────────────────

export function addBasemap(map, id, beforeId) {
  if (map.getLayer("basemap")) map.removeLayer("basemap");
  if (map.getSource("basemap")) map.removeSource("basemap");
  const b = BASEMAPS.find(x => x.id === id);
  if (!b?.tiles) return;
  map.addSource("basemap", {
    type: "raster", tiles: b.tiles, tileSize: 256, maxzoom: b.maxzoom ?? 19, attribution: b.attribution,
  });
  map.addLayer({ id: "basemap", type: "raster", source: "basemap" }, beforeId);
}

export function addIndexSources(map, yearCfg, lang) {
  map.addSource("units", {
    type: "vector", url: pmtiles(yearCfg.tiles), promoteId: { units: "i" },
    attribution: DATA_ATTRIBUTION[lang],
  });
  map.addSource("bounds", { type: "vector", url: pmtiles(yearCfg.bounds) });
  map.addSource("gaps", { type: "vector", url: pmtiles(yearCfg.gaps) });
  map.addImage("hatch", hatchImage(), { pixelRatio: 2 });
}

export function setIndexYear(map, yearCfg) {
  map.getSource("units").setUrl(pmtiles(yearCfg.tiles));
  map.getSource("bounds").setUrl(pmtiles(yearCfg.bounds));
  map.getSource("gaps").setUrl(pmtiles(yearCfg.gaps));
}

// Section fills and outlines, and the hatched areas with no sections.
export function addUnitLayers(map) {
  map.addLayer({
    id: "units-fill", type: "fill", source: "units", "source-layer": "units",
    paint: { "fill-color": NO_DATA_COLOR, "fill-opacity": 0.8 },
  });
  map.addLayer({
    id: "units-line", type: "line", source: "units", "source-layer": "units", minzoom: 10,
    paint: {
      "line-color": "#ffffff",
      "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.2, 12, 0.5, 14, 1, 16, 1.5],
      "line-opacity": 0.85,
    },
  });
  // Territorios comunes: hatched, so they read as "no unit here" rather
  // than as missing data.
  map.addLayer({
    id: "gaps-fill", type: "fill", source: "gaps", "source-layer": "gaps",
    paint: { "fill-pattern": "hatch", "fill-opacity": 0.9 },
  });
}

export function addBoundaryLayers(map) {
  map.addLayer({
    id: "bounds-mun", type: "line", source: "bounds", "source-layer": "bounds", minzoom: 8,
    filter: ["==", ["get", "l"], 2],
    paint: { "line-color": "#4b5563", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 13, 1.1], "line-opacity": 0.7 },
  });
  map.addLayer({
    id: "bounds-prov", type: "line", source: "bounds", "source-layer": "bounds",
    filter: ["==", ["get", "l"], 1],
    paint: { "line-color": "#374151", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.35, 8, 0.9, 11, 1.6], "line-opacity": 0.8 },
  });
  map.addLayer({
    id: "bounds-ccaa", type: "line", source: "bounds", "source-layer": "bounds",
    filter: ["==", ["get", "l"], 0],
    paint: { "line-color": "#111827", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 8, 1.4, 11, 2.4] },
  });
}

// Colours, classes, filters and opacity of the section fill.
export function styleUnits(map, { classes, colors, filters, opacity, table }) {
  const color = colorExpression(classes, colors, table?.breaks);
  const f = filterExpression(filters, table);
  map.setPaintProperty("units-fill", "fill-color", f === true ? color : ["case", f, color, DIM_COLOR]);
  map.setPaintProperty("units-fill", "fill-opacity", opacity);
}

export function showBoundaries(map, b) {
  const vis = on => (on ? "visible" : "none");
  map.setLayoutProperty("bounds-ccaa", "visibility", vis(b.ccaa));
  map.setLayoutProperty("bounds-prov", "visibility", vis(b.prov));
  map.setLayoutProperty("bounds-mun", "visibility", vis(b.mun));
}
