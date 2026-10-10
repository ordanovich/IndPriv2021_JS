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

const inSpain = (lon, lat) => lon > -18.5 && lon < 4.6 && lat > 27.4 && lat < 44.0;
const within = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);

// Addresses and postal codes. CartoCiudad (official, IGN) and Photon
// (OpenStreetMap) are asked at once; CartoCiudad's answers go first when it
// responds in time, Photon covers the times it does not.
async function geocode(q, signal, onPartial) {
  const cc = fetch(GEOCODER.cartociudad(q), { signal }).then(r => r.json()).then(arr =>
    arr.filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lng)).map(a => ({
      kind: "addr", label: a.address, lon: a.lng, lat: a.lat,
      sub: [a.postalCode, a.muni, a.province].filter(Boolean).join(" · "),
    }))).catch(() => null);
  const ph = fetch(GEOCODER.photon(q), { signal }).then(r => r.json()).then(js =>
    (js.features || []).filter(f => inSpain(...f.geometry.coordinates)).map(f => {
      const p = f.properties;
      const [lon, lat] = f.geometry.coordinates;
      if (p.type === "other" && /^\d{5}$/.test(p.name || "")) {
        return { kind: "postcode", label: `CP ${p.name}`, sub: [p.city, p.state].filter(Boolean).join(", "), lon, lat };
      }
      const street = p.street ? [p.street, p.housenumber].filter(Boolean).join(" ") : null;
      return {
        kind: "addr", lon, lat,
        label: [street, p.name && p.name !== p.street ? p.name : null].filter(Boolean).join(" · ") || p.name,
        sub: [p.postcode, p.city, p.state].filter(Boolean).join(" · "),
      };
    })).catch(() => null);
  let a = null, b = null;
  const merged = () => {
    const seen = new Set();
    return [...(a || []), ...(b || [])].filter(r => {
      const k = `${r.label}|${r.lon.toFixed(4)}|${r.lat.toFixed(4)}`;
      return !seen.has(k) && seen.add(k);
    });
  };
  // Whichever answers first is shown at once; the other is merged in later.
  await Promise.all([
    within(cc, 8000).then(r => { a = r; onPartial(merged()); }),
    within(ph, 8000).then(r => { b = r; onPartial(merged()); }),
  ]);
  return merged();
}

let marker = null;

export default function Search() {
  const { state, set, table, mode, t } = useApp();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [searching, setSearching] = useState(false);
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
    setSearching(false);
    if (s.length < 4 || (/^\d+$/.test(s) && !/^\d{5}$/.test(s))) return;
    setSearching(true);
    const ctl = new AbortController();
    const id = setTimeout(() => {
      geocode(s, ctl.signal, r => { if (!ctl.signal.aborted) setAddresses(r.slice(0, 7)); })
        .catch(() => {}).finally(() => { if (!ctl.signal.aborted) setSearching(false); });
    }, 400);
    return () => { clearTimeout(id); ctl.abort(); };
  }, [q]);

  useEffect(() => {
    const close = e => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const results = [...local, ...addresses.filter(a => a.kind === "postcode"), ...addresses.filter(a => a.kind === "addr")];

  const choose = r => {
    setOpen(false);
    setQ(r.kind === "unit" ? r.label : r.label);
    const map = mapBus.get();
    if (marker) { marker.remove(); marker = null; }
    if (r.kind === "unit") {
      set({ selected: { year: state.year, id: table.id[r.i] } });
      mapBus.fitUnit(table, r.i);
    } else if (r.kind === "postcode") {
      map?.flyTo({ center: [r.lon, r.lat], zoom: 14, duration: 900 });
      if (map) marker = new maplibregl.Marker({ color: "#111827" }).setLngLat([r.lon, r.lat]).addTo(map);
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

  const group = { ccaa: t.searchCcaa, prov: t.searchProv, mun: t.searchMun, unit: t.searchUnits, postcode: t.searchPostcode, addr: t.searchAddress };
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
          {results.length === 0 && <li className="none">{searching ? t.searching : t.searchNone}</li>}
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
