import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import {
  getCachedData, ensureDataLoaded, onDataReady, centroid,
} from "./geoDataStore";
import { useApp } from "./AppContext";
import { TR } from "./translations";

// Strip diacritics and lowercase — locale-tolerant search matching.
const norm = (s) =>
  String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function buildIndex(geo) {
  const provMap = new Map();   // NPRO → [features]
  const munMap  = new Map();   // `${NMUN} (${NPRO})` → [features]
  for (const f of geo?.features ?? []) {
    const p = f.properties || {};
    const npro = p.NPRO;
    const nmun = p.NMUN;
    if (npro) {
      if (!provMap.has(npro)) provMap.set(npro, []);
      provMap.get(npro).push(f);
    }
    if (nmun) {
      const key = `${nmun} (${npro || "—"})`;
      if (!munMap.has(key)) munMap.set(key, { features: [], nmun, npro });
      munMap.get(key).features.push(f);
    }
  }
  return {
    provinces: [...provMap.entries()].map(([name, features]) => ({
      type: "prov", key: name, label: name, features, _norm: norm(name),
    })),
    municipalities: [...munMap.entries()].map(([key, v]) => ({
      type: "mun", key, label: v.nmun, sub: v.npro,
      features: v.features, _norm: norm(v.nmun),
    })),
  };
}

function featuresBbox(features) {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  let count = 0;
  for (const f of features) {
    const c = centroid(f.geometry);
    if (!c) continue;
    if (c[0] < west)  west  = c[0];
    if (c[0] > east)  east  = c[0];
    if (c[1] < south) south = c[1];
    if (c[1] > north) north = c[1];
    count++;
  }
  if (count === 0) return null;
  if (count === 1) {
    // Pad single-point bbox so flyTo doesn't degenerate.
    const pad = 0.04;
    return { west: west - pad, east: east + pad, south: south - pad, north: north + pad };
  }
  // Pad a touch so polygons aren't flush against the viewport edge.
  const padLon = Math.max((east - west) * 0.12, 0.02);
  const padLat = Math.max((north - south) * 0.12, 0.02);
  return {
    west:  west  - padLon,
    east:  east  + padLon,
    south: south - padLat,
    north: north + padLat,
  };
}

function flyToBbox(terria, bbox) {
  if (!bbox) return;
  if (terria?.cesium?.scene?.camera) {
    // Lazy require so we don't bloat the main bundle when the user never
    // searches. Cesium's Rectangle takes radians via fromDegrees().
    import("terriajs-cesium/Source/Core/Rectangle")
      .then((mod) => {
        const Rectangle = mod.default ?? mod;
        const dest = Rectangle.fromDegrees(bbox.west, bbox.south, bbox.east, bbox.north);
        terria.cesium.scene.camera.flyTo({ destination: dest, duration: 1.4 });
      })
      .catch(() => {
        // Fallback: ask TerriaJS's currentViewer to zoom — it accepts a
        // rectangle-shaped object in degrees in some versions.
        terria.currentViewer?.zoomTo?.(bbox, 1.4);
      });
    return;
  }
  if (terria?.leaflet?.map) {
    terria.leaflet.map.fitBounds(
      [[bbox.south, bbox.west], [bbox.north, bbox.east]],
      { animate: true, duration: 1.4, padding: [20, 20] }
    );
    return;
  }
  // Last resort: TerriaJS's abstract zoomTo.
  terria.currentViewer?.zoomTo?.(bbox, 1.4);
}

export default function SearchPanel({ terria }) {
  const { lang } = useApp();
  const tr = TR[lang];

  const [query,   setQuery]   = useState("");
  const [open,    setOpen]    = useState(false);
  const [focused, setFocused] = useState(-1);
  const [index,   setIndex]   = useState(null);
  const containerRef = useRef(null);

  // Build (or rebuild) the in-memory search index when the geo cache lands.
  useEffect(() => {
    ensureDataLoaded();
    const cached = getCachedData();
    if (cached) setIndex(buildIndex(cached));
    return onDataReady((geo) => setIndex(buildIndex(geo)));
  }, []);

  // Close dropdown when clicking outside.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const results = useMemo(() => {
    if (!index || query.trim().length < 3) return { provinces: [], municipalities: [] };
    const q = norm(query.trim());
    const provs = index.provinces
      .filter((r) => r._norm.includes(q))
      .sort((a, b) => a._norm.indexOf(q) - b._norm.indexOf(q));
    const muns  = index.municipalities
      .filter((r) => r._norm.includes(q))
      .sort((a, b) => a._norm.indexOf(q) - b._norm.indexOf(q));
    // Cap at 10 across both groups, with provinces taking up to 4 slots.
    const provSlice = provs.slice(0, Math.min(provs.length, 4));
    const munSlice  = muns.slice(0, Math.max(10 - provSlice.length, 0));
    return { provinces: provSlice, municipalities: munSlice };
  }, [index, query]);

  const flat = useMemo(
    () => [...results.provinces, ...results.municipalities],
    [results]
  );

  const choose = useCallback((item) => {
    if (!item) return;
    const bbox = featuresBbox(item.features);
    flyToBbox(terria, bbox);
    setQuery("");
    setOpen(false);
    setFocused(-1);
  }, [terria]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocused((i) => Math.min(i + 1, flat.length - 1));
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocused((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focused >= 0) choose(flat[focused]);
      else if (flat.length > 0) choose(flat[0]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setFocused(-1);
    }
  };

  const hasResults = flat.length > 0;
  const showDropdown = open && query.trim().length >= 3;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 12, right: 12,
        zIndex: 950,
        width: 280,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center",
        background: "rgba(255,255,255,0.97)",
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 10,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        padding: "6px 10px",
      }}>
        <span aria-hidden="true" style={{ fontSize: 13, color: "#6b7280", marginRight: 8, lineHeight: 1 }}>🔎</span>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setFocused(-1); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={tr.searchPlaceholder}
          style={{
            flex: 1, minWidth: 0,
            border: "none", outline: "none",
            background: "transparent",
            fontSize: 12.5, color: "#111827",
            padding: 0,
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setFocused(-1); setOpen(false); }}
            title={tr.searchClearTitle}
            style={{
              background: "none", border: "none", color: "#9ca3af",
              fontSize: 13, cursor: "pointer", padding: "0 4px", lineHeight: 1,
              marginLeft: 4, flexShrink: 0,
            }}
          >
            {tr.searchClear}
          </button>
        )}
      </div>

      {showDropdown && (
        <div style={{
          marginTop: 4,
          background: "rgba(255,255,255,0.98)",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 10,
          boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
          overflow: "hidden",
          maxHeight: 360, overflowY: "auto",
        }}>
          {!hasResults && (
            <div style={{
              padding: "10px 12px",
              fontSize: 12, color: "#9ca3af",
            }}>
              {tr.searchNoResults}
            </div>
          )}

          {results.provinces.length > 0 && (
            <>
              <div style={S.groupLabel}>{tr.searchGroupProv}</div>
              {results.provinces.map((r, i) => (
                <ResultRow key={r.key} item={r} focused={focused === i}
                           onClick={() => choose(r)}
                           onHover={() => setFocused(i)} />
              ))}
            </>
          )}

          {results.municipalities.length > 0 && (
            <>
              <div style={S.groupLabel}>{tr.searchGroupMun}</div>
              {results.municipalities.map((r, i) => {
                const flatIdx = results.provinces.length + i;
                return (
                  <ResultRow key={r.key} item={r} focused={focused === flatIdx}
                             onClick={() => choose(r)}
                             onHover={() => setFocused(flatIdx)} />
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

SearchPanel.propTypes = {
  terria: PropTypes.object.isRequired,
};

function ResultRow({ item, focused, onClick, onHover }) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      style={{
        padding: "8px 12px",
        background: focused ? "#eff6ff" : "transparent",
        borderLeft: focused ? "3px solid #2563eb" : "3px solid transparent",
        cursor: "pointer",
        transition: "background 0.1s, border-color 0.1s",
      }}
    >
      <div style={{ fontSize: 12.5, color: "#111827", fontWeight: focused ? 600 : 500 }}>
        {item.label}
      </div>
      {item.sub && (
        <div style={{ fontSize: 10.5, color: "#6b7280", marginTop: 1 }}>
          {item.sub}
        </div>
      )}
    </div>
  );
}

ResultRow.propTypes = {
  item: PropTypes.object.isRequired,
  focused: PropTypes.bool,
  onClick: PropTypes.func,
  onHover: PropTypes.func,
};

const S = {
  groupLabel: {
    fontSize: 9, fontWeight: 700, color: "#6b7280",
    textTransform: "uppercase", letterSpacing: "0.6px",
    padding: "7px 12px 3px",
    background: "#f9fafb",
    borderTop: "1px solid #f3f4f6",
  },
};
