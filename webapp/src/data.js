// Attribute tables and cross-year links. Geometry never comes through here:
// the map draws it from vector tiles; tables carry one row per unit, in the
// same order as the tiles' "i" property.

import { modeById } from "./config";

const cache = new Map();

function once(key, fn) {
  if (!cache.has(key)) {
    const p = fn().catch(err => { cache.delete(key); throw err; });
    cache.set(key, p);
  }
  return cache.get(key);
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

export function loadTable(modeId, year) {
  const cfg = modeById(modeId).years[year];
  return once(`table:${modeId}:${year}`, async () => buildTable(await getJson(cfg.table), modeId));
}

function buildTable(raw, modeId) {
  const f = raw.fields;
  const n = raw.n;
  const ip = new Float64Array(n);
  const q = new Int8Array(n);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const r = new Float64Array(n);
  const s = new Int8Array(n);
  const u = f.u ? new Int8Array(n) : null;
  const prov = new Array(n);
  const mun = new Array(n);
  const ccaa = new Array(n);
  const index = new Map();
  for (let i = 0; i < n; i++) {
    const id = f.id[i];
    ip[i] = f.ip[i] == null ? NaN : f.ip[i];
    q[i] = f.q[i];
    x[i] = f.x[i];
    y[i] = f.y[i];
    r[i] = f.r[i];
    s[i] = f.s ? f.s[i] : 0;
    if (u) u[i] = f.u[i] ?? 0;
    prov[i] = id.slice(0, 2);
    mun[i] = id.slice(0, 5);
    ccaa[i] = raw.names.prov_ccaa[prov[i]];
    index.set(id, i);
  }
  // Sorted copy of valid values, for percentiles.
  const sorted = Array.from(ip).filter(Number.isFinite).sort((a, b) => a - b);
  return {
    mode: modeId, year: raw.year, n, breaks: raw.breaks, names: raw.names,
    hasVariables: raw.variables === true,
    id: f.id, ip, q, x, y, r, s, u, prov, mun, ccaa, index, sorted,
  };
}

// Build information for a mode (counts, which optional files are deployed).
export function loadMeta(modeId) {
  return once(`meta:${modeId}`, () => getJson(`data/${modeId}/meta.json`));
}

export function loadVariables(modeId, year) {
  const cfg = modeById(modeId).years[year];
  return once(`vars:${modeId}:${year}`, () => getJson(cfg.vars));
}

// For each row of year A, the overlapping rows of year B (and vice versa).
export function loadLink(modeId) {
  const cfg = modeById(modeId).link;
  return once(`link:${modeId}`, async () => {
    const raw = await getJson(cfg.file);
    const fromA = new Map();
    const fromB = new Map();
    for (let k = 0; k < raw.a.length; k++) {
      const a = raw.a[k], b = raw.b[k], pa = raw.pa[k], pb = raw.pb[k];
      if (!fromA.has(a)) fromA.set(a, []);
      if (!fromB.has(b)) fromB.set(b, []);
      fromA.get(a).push({ i: b, pThis: pa, pOther: pb });
      fromB.get(b).push({ i: a, pThis: pb, pOther: pa });
    }
    for (const list of [...fromA.values(), ...fromB.values()]) list.sort((u, v) => v.pThis - u.pThis);
    return {
      stats: raw.stats,
      // matches(year, i) → rows in the other year overlapping row i
      matches: (year, i) => (year === cfg.a ? fromA : fromB).get(i) ?? [],
      other: year => (year === cfg.a ? cfg.b : cfg.a),
    };
  });
}

// GeoJSON with exact geometry for one province (used only by the export).
export function loadProvinceGeometry(modeId, year, cpro) {
  const tpl = modeById(modeId).years[year].geo;
  return once(`geo:${modeId}:${year}:${cpro}`, () => getJson(tpl.replace("{cpro}", cpro)));
}

// ── Filtering ────────────────────────────────────────────────────────────────

export function activeFilterCount(filters) {
  let n = 0;
  if (filters.ccaa || filters.prov || filters.mun) n++;
  if (filters.quintiles.length) n++;
  if (filters.degurba) n++;
  if (filters.stable) n++;
  return n;
}

// Returns a predicate i → boolean for the current filters.
export function filterPredicate(t, filters) {
  const qs = filters.quintiles.length ? new Set(filters.quintiles) : null;
  const { ccaa, prov, mun, degurba, stable } = filters;
  return i => {
    if (mun) { if (t.mun[i] !== mun) return false; }
    else if (prov) { if (t.prov[i] !== prov) return false; }
    else if (ccaa && t.ccaa[i] !== ccaa) return false;
    if (qs && !qs.has(t.q[i])) return false;
    if (degurba && t.u && t.u[i] !== degurba) return false;
    if (stable && t.s[i] !== 1) return false;
    return true;
  };
}

export const inBounds = (b, x, y) => x >= b.west && x <= b.east && y >= b.south && y <= b.north;

// Rows matching the filters (and, optionally, inside a lon/lat box).
export function selectRows(t, filters, box = null) {
  const ok = filterPredicate(t, filters);
  const out = [];
  for (let i = 0; i < t.n; i++) {
    if (box && !inBounds(box, t.x[i], t.y[i])) continue;
    if (ok(i)) out.push(i);
  }
  return out;
}

export function percentile(t, v) {
  if (!Number.isFinite(v)) return null;
  const a = t.sorted;
  let lo = 0, hi = a.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid] < v) lo = mid + 1; else hi = mid; }
  return Math.round((lo / a.length) * 100);
}

export function describe(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  const n = v.length;
  if (!n) return null;
  const mean = v.reduce((s, x) => s + x, 0) / n;
  const median = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  return { n, mean, median, sd, min: v[0], max: v[n - 1] };
}
