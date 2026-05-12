import React, { useState, useEffect, useCallback, useRef } from "react";
import { getCachedData, ensureDataLoaded, onDataReady, centroid, inRect } from "./geoDataStore";
import { useApp } from "./AppContext";
import { TR } from "./translations";
import { STD_COLORS, CB_COLORS } from "./UserInterface";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getViewRect(terria) {
  if (terria.cesium) {
    return terria.cesium.scene.camera.computeViewRectangle() ?? null;
  }
  if (terria.leaflet) {
    const b = terria.leaflet.map.getBounds();
    const r = Math.PI / 180;
    return { west: b.getWest()*r, east: b.getEast()*r,
             south: b.getSouth()*r, north: b.getNorth()*r };
  }
  return null;
}

function getActiveYear(terria) {
  const items = terria.workbench?.items ?? [];
  const on21 = items.find(i => i.uniqueId === "atlas-2021")?.show !== false;
  const on11 = items.find(i => i.uniqueId === "atlas-2011")?.show === true;
  if (on21 && !on11) return "2021";
  if (on11 && !on21) return "2011";
  return "2021";
}

function computeDist(terria) {
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExtentChart({ terria }) {
  const { lang, colorblind } = useApp();
  const tr = TR[lang];
  const COLORS = colorblind ? CB_COLORS : STD_COLORS;

  const [dist,    setDist]    = useState(null);
  const [hovered, setHovered] = useState(null);
  const [visible, setVisible] = useState(true);
  const cleanupRef = useRef(null);

  const refresh = useCallback(() => {
    const d = computeDist(terria);
    if (d) setDist(d);
  }, [terria]);

  useEffect(() => {
    ensureDataLoaded();
    const unsubData = onDataReady(() => refresh());

    function attach() {
      if (terria.cesium) {
        const { moveEnd } = terria.cesium.scene.camera;
        moveEnd.addEventListener(refresh);
        cleanupRef.current = () => moveEnd.removeEventListener(refresh);
        refresh();
        return true;
      }
      if (terria.leaflet) {
        terria.leaflet.map.on("moveend", refresh);
        cleanupRef.current = () => terria.leaflet?.map.off("moveend", refresh);
        refresh();
        return true;
      }
      return false;
    }

    if (!attach()) {
      const timer = setInterval(() => { if (attach()) clearInterval(timer); }, 400);
      cleanupRef.current = () => clearInterval(timer);
    }

    const poll = setInterval(refresh, 1500);
    return () => { unsubData(); cleanupRef.current?.(); clearInterval(poll); };
  }, [terria, refresh]);

  if (!dist || dist.total === 0) return null;

  const { counts, total, year } = dist;
  const pcts = counts.map(c => total > 0 ? (c / total) * 100 : 0);

  const panel = {
    width: "100%",
    background: "rgba(255,255,255,0.97)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 14,
    padding: "14px 17px 13px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
    color: "#111827",
    transition: "opacity 0.3s",
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "auto" : "none",
    boxSizing: "border-box",
  };

  return (
    <div style={panel}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 10, textTransform: "uppercase",
                       letterSpacing: "0.8px", color: "#6b7280" }}>
          {tr.currentView} · {total.toLocaleString(lang === "es" ? "es-ES" : "en-GB")} {tr.sectionsUnit}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: year === "2021" ? "rgba(37,99,235,0.1)"  : "rgba(22,163,74,0.1)",
            color:      year === "2021" ? "#2563eb"              : "#16a34a",
            padding: "2px 8px", borderRadius: 20,
          }}>
            {year}
          </span>
          <button
            onClick={() => setVisible(v => !v)}
            title={visible ? tr.hideChart : tr.showChart}
            style={{ background: "none", border: "none", color: "#9ca3af",
                     cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}
          >
            {visible ? tr.hideChart : tr.showChart}
          </button>
        </div>
      </div>

      {/* Stacked proportion bar */}
      <div style={{ display: "flex", height: 12, borderRadius: 6,
                    overflow: "hidden", marginBottom: 13, gap: 1 }}>
        {pcts.map((pct, i) => (
          <div key={i} style={{
            flex: Math.max(pct, 0.01),
            background: COLORS[i],
            opacity: hovered === null || hovered === i ? 1 : 0.25,
            transition: "flex 0.55s cubic-bezier(.4,0,.2,1), opacity 0.18s",
            minWidth: pct > 0 ? 2 : 0,
            cursor: "default",
          }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </div>

      {/* Quintile rows */}
      {pcts.map((pct, i) => (
        <div key={i}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "5px 6px", borderRadius: 6, marginBottom: 2,
            background: hovered === i ? "rgba(0,0,0,0.04)" : "transparent",
            transition: "background 0.15s", cursor: "default",
          }}
        >
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: COLORS[i], flexShrink: 0,
            boxShadow: hovered === i ? `0 0 5px ${COLORS[i]}80` : "none",
            transition: "box-shadow 0.2s",
          }} />
          <span style={{
            fontSize: 11,
            color: hovered === i ? "#111827" : "#6b7280",
            flex: 1, transition: "color 0.15s",
          }}>
            {tr.quintileLabels[i]}
          </span>
          <div style={{ width: 68, height: 5, borderRadius: 3, flexShrink: 0,
                        background: "rgba(0,0,0,0.07)" }}>
            <div style={{
              height: "100%", borderRadius: 3,
              width: `${pct}%`,
              background: COLORS[i],
              transition: "width 0.55s cubic-bezier(.4,0,.2,1)",
            }} />
          </div>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: hovered === i ? "#111827" : "#374151",
            width: 40, textAlign: "right", flexShrink: 0,
            transition: "color 0.15s",
          }}>
            {pct.toFixed(1)}%
          </span>
        </div>
      ))}

      {/* Hover tooltip */}
      {hovered !== null && (
        <div style={{
          marginTop: 8, padding: "5px 10px",
          background: "#f9fafb",
          border: `1px solid ${COLORS[hovered]}40`,
          borderLeft: `3px solid ${COLORS[hovered]}`,
          borderRadius: 7, fontSize: 11, color: "#374151",
        }}>
          {tr.sectionCount(counts[hovered])} ·{" "}
          <strong style={{ color: "#111827" }}>{tr.quintileLabels[hovered]}</strong>
        </div>
      )}
    </div>
  );
}
