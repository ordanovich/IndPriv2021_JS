import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { useApp } from "../state";
import { GEOCODER } from "../config";
import { mapBus } from "../map/mapBus";

const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function boxOf(table, test) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (let i = 0; i < table.n; i++) {
    if (!test(i)) continue;
    const r = table.r[i];
    w = Math.min(w, table.x[i] - r); e = Math.max(e, table.x[i] + r);
    s = Math.min(s, table.y[i] - r); n = Math.max(n, table.y[i] + r);
  }
  return w < e ? { west: w, south: s, east: e, north: n } : null;
}

async function geocode(q, signal) {
  try {
    const res = await fetch(GEOCODER.cartociudad(q), { signal });
    const arr = await res.json();
    return arr.filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lng))
      .map(a => ({ label: a.address, sub: [a.muni, a.province].filter(Boolean).join(", "), lon: a.lng, lat: a.lat }));
  } catch (err) {
    if (err.name === "AbortError") throw err;
    const res = await fetch(GEOCODER.photon(q), { signal });
    const js = await res.json();
    return (js.features || []).map(f => {
      const p = f.properties;
      return {
        label: [p.name, p.street && p.housenumber ? `${p.street} ${p.housenumber}` : p.street].filter(Boolean).join(", "),
        sub: [p.city, p.state].filter(Boolean).join(", "),
        lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
      };
    });
  }
}

let marker = null;

export default function Search() {
  const { state, set, table, mode, t } = useApp();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const lang = state.lang;

  // Index of place names, rebuilt when the table changes.
  const places = useMemo(() => {
    if (!table) return [];
    const out = [];
    for (const [c, name] of Object.entries(table.names.ccaa)) out.push({ kind: "ccaa", code: c, label: name, n: norm(name) });
    for (const [p, name] of Object.entries(table.names.prov)) out.push({ kind: "prov", code: p, label: name, n: norm(name) });
    for (const [m, name] of Object.entries(table.names.mun)) {
      out.push({ kind: "mun", code: m, label: name, sub: table.names.prov[m.slice(0, 2)], n: norm(name) });
    }
    return out;
  }, [table]);

  const local = useMemo(() => {
    const s = norm(q.trim());
    if (!table || s.length < 2) return [];
    if (/^\d{2,}$/.test(s)) {
      const hits = [];
      for (let i = 0; i < table.n && hits.length < 8; i++) {
        if (table.id[i].startsWith(s)) hits.push({ kind: "unit", i, label: table.id[i], sub: table.names.mun[table.mun[i]] });
      }
      return hits;
    }
    const starts = [], contains = [];
    for (const p of places) {
      if (p.n.startsWith(s)) starts.push(p);
      else if (p.n.includes(s)) contains.push(p);
    }
    const rank = { ccaa: 0, prov: 1, mun: 2 };
    starts.sort((a, b) => rank[a.kind] - rank[b.kind] || a.label.length - b.label.length);
    return [...starts, ...contains].slice(0, 10);
  }, [q, places, table]);

  // Addresses: only for text queries, debounced.
  useEffect(() => {
    const s = q.trim();
    setAddresses([]);
    if (s.length < 4 || /^\d+$/.test(s)) return;
    const ctl = new AbortController();
    const id = setTimeout(() => {
      geocode(s, ctl.signal).then(r => setAddresses(r.slice(0, 5))).catch(() => {});
    }, 400);
    return () => { clearTimeout(id); ctl.abort(); };
  }, [q]);

  useEffect(() => {
    const close = e => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const results = [...local, ...addresses.map(a => ({ kind: "addr", ...a }))];

  const choose = r => {
    setOpen(false);
    setQ(r.kind === "unit" ? r.label : r.label);
    const map = mapBus.get();
    if (marker) { marker.remove(); marker = null; }
    if (r.kind === "unit") {
      set({ selected: { year: state.year, id: table.id[r.i] } });
      mapBus.fitUnit(table, r.i);
    } else if (r.kind === "addr") {
      if (!map) return;
      marker = new maplibregl.Marker({ color: "#111827" }).setLngLat([r.lon, r.lat]).addTo(map);
      map.flyTo({ center: [r.lon, r.lat], zoom: 16, duration: 900 });
      // Select the unit under the address once the map has settled there.
      map.once("idle", () => {
        const hit = map.queryRenderedFeatures(map.project([r.lon, r.lat]), { layers: ["units-fill"] })[0];
        const i = hit?.properties?.i;
        if (i != null && table) set({ selected: { year: state.year, id: table.id[i] } });
      });
    } else {
      const test = r.kind === "ccaa" ? i => table.ccaa[i] === r.code
        : r.kind === "prov" ? i => table.prov[i] === r.code : i => table.mun[i] === r.code;
      mapBus.fitBox(boxOf(table, test));
    }
  };

  const onKey = e => {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); choose(results[active]); }
    if (e.key === "Escape") setOpen(false);
  };

  const group = { ccaa: t.searchCcaa, prov: t.searchProv, mun: t.searchMun, unit: t.searchUnits, addr: t.searchAddress };
  let lastKind = null;

  return (
    <div className="search" ref={boxRef}>
      <span className="search-icon">⌕</span>
      <input value={q} placeholder={t.search} aria-label={t.search}
             onChange={e => { setQ(e.target.value); setOpen(true); setActive(0); }}
             onFocus={() => setOpen(true)} onKeyDown={onKey} />
      {q && <button className="search-clear" onClick={() => { setQ(""); setAddresses([]); marker?.remove(); marker = null; }}>✕</button>}
      {open && q.trim().length >= 2 && (
        <ul className="search-results" role="listbox">
          {results.length === 0 && <li className="none">{t.searchNone}</li>}
          {results.map((r, k) => {
            const head = r.kind !== lastKind ? <li className="group" key={"g" + k}>{group[r.kind]}</li> : null;
            lastKind = r.kind;
            return (
              <React.Fragment key={k}>
                {head}
                <li role="option" aria-selected={k === active} className={k === active ? "active" : ""}
                    onMouseEnter={() => setActive(k)} onMouseDown={e => { e.preventDefault(); choose(r); }}>
                  <span>{r.label}</span>
                  {r.sub && <small>{r.sub}</small>}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
}
