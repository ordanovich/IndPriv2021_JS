import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { BASEMAPS, MODES, modeById } from "./config";
import { STRINGS } from "./i18n";
import { loadTable } from "./data";

export const EMPTY_FILTERS = { ccaa: "", prov: "", mun: "", quintiles: [], degurba: 0, stable: false };

const DEFAULTS = {
  lang: "es",
  colorblind: false,
  mode: "ct",
  year: "2021",
  classes: "q",            // "q" quintiles | "c" continuous
  compare: false,          // swipe comparison between the two years
  opacity: 0.8,
  filters: EMPTY_FILTERS,
  boundaries: { ccaa: true, prov: true, mun: true },
  basemap: BASEMAPS[0].id,
  wms: [],                 // ids from WMS_CATALOG or customWms
  customWms: [],
  upload: null,            // { name, data }
  selected: null,          // { year, id } — id is the unit code (CUSEC)
  view: null,              // { west, south, east, north, zoom }
  initialBbox: null,
  rect: null,              // { west, south, east, north }
  drawing: false,
  scope: "filters",        // "filters" | "view" | "rect"
  panels: { left: true, right: true, bottom: true, legend: true },
  bottomTab: "dist",
  notice: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "set":
      return { ...state, ...action.patch };
    case "filters":
      return { ...state, filters: { ...state.filters, ...action.patch } };
    case "panels":
      return { ...state, panels: { ...state.panels, ...action.patch } };
    case "boundaries":
      return { ...state, boundaries: { ...state.boundaries, ...action.patch } };
    default:
      return state;
  }
}

// ── URL hash (shareable state) ───────────────────────────────────────────────
// #m=ct&v=2021&lang=es&q=4,5&f=p28&u=1&st=1&sel=2807901001&cls=c&cb=1&base=pnoa&bbox=w,s,e,n

function parseHash() {
  const out = {};
  const raw = window.location.hash.replace(/^#/, "");
  const kv = new URLSearchParams(raw);
  const mode = kv.get("m");
  if (mode && MODES.some(m => m.id === mode && m.available)) out.mode = mode;
  const cfg = modeById(out.mode ?? DEFAULTS.mode);
  const v = kv.get("v");
  if (v && cfg.years[v]) out.year = v;
  if (kv.get("lang") === "en" || kv.get("lang") === "es") out.lang = kv.get("lang");
  if (kv.get("cb") === "1") out.colorblind = true;
  if (kv.get("cls") === "c") out.classes = "c";
  if (kv.get("cmp") === "1") out.compare = true;
  const base = kv.get("base");
  if (base && BASEMAPS.some(b => b.id === base)) out.basemap = base;
  const filters = { ...EMPTY_FILTERS };
  const q = (kv.get("q") || "").split(",").map(Number).filter(n => n >= 1 && n <= 5);
  if (q.length) filters.quintiles = [...new Set(q)].sort();
  const f = kv.get("f") || "";
  if (/^c\d{2}$/.test(f)) filters.ccaa = f.slice(1);
  if (/^p\d{2}$/.test(f)) filters.prov = f.slice(1);
  if (/^m\d{5}$/.test(f)) { filters.mun = f.slice(1); filters.prov = f.slice(1, 3); }
  const u = Number(kv.get("u"));
  if (u >= 1 && u <= 3) filters.degurba = u;
  if (kv.get("st") === "1") filters.stable = true;
  out.filters = filters;
  const sel = kv.get("sel");
  if (sel && /^[\w-]{1,20}$/.test(sel)) out.selected = { year: out.year ?? cfg.defaultYear, id: sel };
  const bb = (kv.get("bbox") || "").split(",").map(Number);
  if (bb.length === 4 && bb.every(Number.isFinite) && bb[0] < bb[2] && bb[1] < bb[3]) {
    out.initialBbox = { west: bb[0], south: bb[1], east: bb[2], north: bb[3] };
  }
  return out;
}

function buildHash(s) {
  const kv = new URLSearchParams();
  kv.set("m", s.mode);
  kv.set("v", s.year);
  kv.set("lang", s.lang);
  const f = s.filters;
  if (f.quintiles.length) kv.set("q", f.quintiles.join(","));
  if (f.mun) kv.set("f", "m" + f.mun);
  else if (f.prov) kv.set("f", "p" + f.prov);
  else if (f.ccaa) kv.set("f", "c" + f.ccaa);
  if (f.degurba) kv.set("u", String(f.degurba));
  if (f.stable) kv.set("st", "1");
  if (s.selected) kv.set("sel", s.selected.id);
  if (s.classes === "c") kv.set("cls", "c");
  if (s.compare) kv.set("cmp", "1");
  if (s.colorblind) kv.set("cb", "1");
  if (s.basemap !== DEFAULTS.basemap) kv.set("base", s.basemap);
  const b = s.view ?? s.initialBbox;
  if (b) kv.set("bbox", [b.west, b.south, b.east, b.north].map(v => v.toFixed(3)).join(","));
  return "#" + kv.toString().replace(/%2C/g, ",");
}

// ── Context ──────────────────────────────────────────────────────────────────
const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, () => ({ ...DEFAULTS, ...parseHash() }));
  const [tables, setTables] = useState({});   // `${mode}:${year}` → table
  const [loadError, setLoadError] = useState(null);

  const mode = modeById(state.mode);
  const key = `${state.mode}:${state.year}`;
  const table = tables[key] ?? null;

  useEffect(() => {
    if (!mode.available || tables[key]) return;
    let live = true;
    setLoadError(null);
    loadTable(state.mode, state.year)
      .then(t => { if (live) setTables(prev => ({ ...prev, [key]: t })); })
      .catch(err => { console.error(err); if (live) setLoadError(String(err.message || err)); });
    return () => { live = false; };
  }, [key, mode.available]);

  // Keep the URL hash in step with the state (debounced, no history spam).
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const h = buildHash(state);
      if (h !== window.location.hash) history.replaceState(null, "", h);
    }, 300);
  }, [state.mode, state.year, state.lang, state.filters, state.selected, state.classes, state.compare,
      state.colorblind, state.basemap, state.view]);

  useEffect(() => { document.documentElement.lang = state.lang; }, [state.lang]);

  const api = useMemo(() => ({
    set: patch => dispatch({ type: "set", patch }),
    setFilters: patch => dispatch({ type: "filters", patch }),
    setPanels: patch => dispatch({ type: "panels", patch }),
    setBoundaries: patch => dispatch({ type: "boundaries", patch }),
  }), []);

  const value = {
    state, ...api, mode, table, loadError,
    t: STRINGS[state.lang],
    selectedIndex: table && state.selected && state.selected.year === state.year
      ? table.index.get(state.selected.id) ?? null : null,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);
