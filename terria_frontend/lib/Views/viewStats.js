// Helpers for computing statistics over the GeoJSON features currently
// inside the map viewport. Shared by ExtentChart (visualisation) and
// ExportPanel (snapshot export). The behaviour is intentionally identical
// to the inline copy that previously lived in ExtentChart.

import { getCachedData, centroid, inRect } from "./geoDataStore";

export function getViewRect(terria) {
  if (terria?.cesium) {
    return terria.cesium.scene.camera.computeViewRectangle() ?? null;
  }
  if (terria?.leaflet) {
    const b = terria.leaflet.map.getBounds();
    const r = Math.PI / 180;
    return { west: b.getWest()*r, east: b.getEast()*r,
             south: b.getSouth()*r, north: b.getNorth()*r };
  }
  return null;
}

export function getActiveYear(terria) {
  const items = terria?.workbench?.items ?? [];
  const on21 = items.find(i => i.uniqueId === "atlas-2021")?.show !== false;
  const on11 = items.find(i => i.uniqueId === "atlas-2011")?.show === true;
  if (on21 && !on11) return "2021";
  if (on11 && !on21) return "2011";
  return "2021";
}

export function computeDist(terria) {
  const gj = getCachedData();
  if (!gj) return null;
  const rect = getViewRect(terria);
  if (!rect) return null;
  const year = getActiveYear(terria);
  const counts = [0, 0, 0, 0, 0];
  let total = 0;
  gj.features.forEach(f => {
    const c = centroid(f.geometry);
    if (!c || !inRect(rect, c[0], c[1])) return;
    total++;
    let q;
    if (year === "2021") {
      q = f.properties.Q21_num;
    } else {
      const lbl = f.properties.Q11_Label;
      q = lbl ? parseInt(lbl.charAt(0), 10) : null;
    }
    if (q >= 1 && q <= 5) counts[q - 1]++;
  });
  return { counts, total, year };
}

export function computeStats(terria, quintileIndex, year) {
  const gj = getCachedData();
  if (!gj) return null;
  const rect = getViewRect(terria);
  if (!rect) return null;

  const values = [];
  gj.features.forEach(f => {
    const c = centroid(f.geometry);
    if (!c || !inRect(rect, c[0], c[1])) return;
    let q, ip;
    if (year === "2021") {
      q  = f.properties.Q21_num;
      ip = f.properties.IP2021;
    } else {
      const lbl = f.properties.Q11_Label;
      q  = lbl ? parseInt(lbl.charAt(0), 10) : null;
      ip = f.properties.IP2011;
    }
    if (q === quintileIndex + 1 && ip != null && isFinite(ip)) values.push(ip);
  });

  if (values.length < 2) return null;
  values.sort((a, b) => a - b);

  const n      = values.length;
  const min    = values[0];
  const max    = values[n - 1];
  const mean   = values.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 0
    ? (values[n / 2 - 1] + values[n / 2]) / 2
    : values[Math.floor(n / 2)];
  const std    = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);

  const BINS   = 12;
  const span   = max - min || 1;
  const bins   = Array(BINS).fill(0);
  values.forEach(v => bins[Math.min(Math.floor((v - min) / span * BINS), BINS - 1)]++);
  const maxBin = Math.max(...bins);

  return { n, min, max, mean, median, std, bins, maxBin };
}

/** Collect (IP2011, IP2021, Q21) tuples for features inside the current
 *  viewport. Used by the scatterplot view in ExtentChart. */
export function computeScatterPoints(terria) {
  const gj = getCachedData();
  if (!gj) return null;
  const rect = getViewRect(terria);
  if (!rect) return null;
  const points = [];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const f of gj.features) {
    const c = centroid(f.geometry);
    if (!c || !inRect(rect, c[0], c[1])) continue;
    const p = f.properties || {};
    const ip11 = p.IP2011;
    const ip21 = p.IP2021;
    if (ip11 == null || !isFinite(ip11) || ip21 == null || !isFinite(ip21)) continue;
    const q = p.Q21_num;
    points.push({
      x: ip11, y: ip21,
      q: q >= 1 && q <= 5 ? q : null,
      nmun: p.NMUN || "",
      cusec: p.CUSEC || "",
    });
    if (ip11 < x0) x0 = ip11;
    if (ip11 > x1) x1 = ip11;
    if (ip21 < y0) y0 = ip21;
    if (ip21 > y1) y1 = ip21;
  }
  if (points.length === 0) return null;
  return { points, xMin: x0, xMax: x1, yMin: y0, yMax: y1 };
}

/** Build a JSON-ready snapshot of the viewport: distribution + per-quintile
 *  stats (n / mean / median / σ / min / max) for the active year. */
export function computeViewSnapshot(terria) {
  const dist = computeDist(terria);
  if (!dist) return null;
  const rect = getViewRect(terria);
  const r = 180 / Math.PI;
  const viewport = rect ? {
    west:  rect.west  * r,
    east:  rect.east  * r,
    south: rect.south * r,
    north: rect.north * r,
  } : null;
  const byQuintile = [];
  for (let i = 0; i < 5; i++) {
    const s = computeStats(terria, i, dist.year);
    byQuintile.push(s
      ? { q: i + 1, n: s.n, mean: s.mean, median: s.median, std: s.std, min: s.min, max: s.max }
      : { q: i + 1, n: dist.counts[i], mean: null, median: null, std: null, min: null, max: null });
  }
  return {
    timestamp: new Date().toISOString(),
    year: dist.year,
    viewport,
    total: dist.total,
    quintile_counts: dist.counts,
    by_quintile: byQuintile,
  };
}
