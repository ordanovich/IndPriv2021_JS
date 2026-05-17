import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import {
  getCachedData, ensureDataLoaded, onDataReady, centroid, inRect,
} from "./geoDataStore";
import { useApp } from "./AppContext";
import { TR } from "./translations";
import { getViewRect, getActiveYear } from "./viewStats";

const PAGE_SIZE = 25;

function flyToPoint(terria, lon, lat) {
  if (terria?.cesium?.scene?.camera) {
    import("terriajs-cesium/Source/Core/Cartesian3")
      .then((mod) => {
        const Cartesian3 = mod.default ?? mod;
        terria.cesium.scene.camera.flyTo({
          destination: Cartesian3.fromDegrees(lon, lat, 25000),
          duration: 1.2,
        });
      })
      .catch(() => {});
    return;
  }
  if (terria?.leaflet?.map) {
    terria.leaflet.map.flyTo([lat, lon], 14, { duration: 1.2 });
  }
}

export default function RankingsPanel({ terria, isOpen, onClose }) {
  const { lang } = useApp();
  const tr = TR[lang];

  const [rows,   setRows]   = useState([]);
  const [year,   setYear]   = useState("2021");
  const [sort,   setSort]   = useState("ip-desc"); // "ip-desc" | "ip-asc" | "prov"
  const [page,   setPage]   = useState(0);
  const [hasData, setHasData] = useState(false);
  const cleanupRef = useRef(null);

  const refresh = useCallback(() => {
    const gj = getCachedData();
    if (!gj) { setRows([]); return; }
    const rect = getViewRect(terria);
    if (!rect) return;
    const y = getActiveYear(terria);
    setYear(y);
    const out = [];
    for (const f of gj.features) {
      const c = centroid(f.geometry);
      if (!c || !inRect(rect, c[0], c[1])) continue;
      const p = f.properties || {};
      const ip = y === "2021" ? p.IP2021 : p.IP2011;
      const ql = y === "2021" ? p.Q21_Label : p.Q11_Label;
      out.push({
        cusec: p.CUSEC,
        nmun:  p.NMUN  || "—",
        npro:  p.NPRO  || "—",
        ip:    ip != null && isFinite(ip) ? ip : null,
        qLabel: ql || "",
        lon:   c[0],
        lat:   c[1],
      });
    }
    setRows(out);
    setPage(0);
  }, [terria]);

  // Wire data + map listeners only while the panel is visible.
  useEffect(() => {
    if (!isOpen) return undefined;
    ensureDataLoaded();
    const unsubData = onDataReady(() => { setHasData(true); refresh(); });
    setHasData(getCachedData() != null);

    const attach = () => {
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
    };
    let timer;
    if (!attach()) {
      timer = setInterval(() => { if (attach()) { clearInterval(timer); timer = null; } }, 400);
    }
    return () => {
      unsubData();
      if (timer) clearInterval(timer);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [isOpen, terria, refresh]);

  const sorted = useMemo(() => {
    const arr = rows.slice();
    if (sort === "ip-desc") {
      arr.sort((a, b) => (b.ip ?? -Infinity) - (a.ip ?? -Infinity));
    } else if (sort === "ip-asc") {
      arr.sort((a, b) => (a.ip ?? Infinity) - (b.ip ?? Infinity));
    } else if (sort === "prov") {
      arr.sort((a, b) => {
        const c = a.npro.localeCompare(b.npro, "es");
        if (c !== 0) return c;
        return (b.ip ?? -Infinity) - (a.ip ?? -Infinity);
      });
    }
    return arr;
  }, [rows, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows  = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const loc = lang === "es" ? "es-ES" : "en-GB";
  const fmt2 = v => v == null ? "—" : v.toFixed(2);

  if (!isOpen) return null;

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <div>
          <span style={{ fontSize: 10, textTransform: "uppercase",
                         letterSpacing: "0.7px", color: "#6b7280", display: "block" }}>
            {tr.rankingsTitle}
          </span>
          <span style={{ fontSize: 12, color: "#374151" }}>
            {sorted.length.toLocaleString(loc)} · {year}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#9ca3af",
                   fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 0 }}
        >
          {tr.rankingsClose}
        </button>
      </div>

      <div style={S.controls}>
        <SortBtn label={tr.rankingsSortIpDesc} active={sort === "ip-desc"} onClick={() => setSort("ip-desc")} />
        <SortBtn label={tr.rankingsSortIpAsc}  active={sort === "ip-asc"}  onClick={() => setSort("ip-asc")}  />
        <SortBtn label={tr.rankingsSortProv}   active={sort === "prov"}    onClick={() => setSort("prov")}    />
      </div>

      <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
        {!hasData && (
          <div style={{ padding: 14, color: "#6b7280", fontSize: 11 }}>
            {tr.rankingsLoadingData}
          </div>
        )}
        {hasData && sorted.length === 0 && (
          <div style={{ padding: 14, color: "#9ca3af", fontSize: 11 }}>
            {tr.rankingsEmpty}
          </div>
        )}
        {hasData && sorted.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={S.th}>{tr.rankingsColMun}</th>
                <th style={S.th}>{tr.rankingsColProv}</th>
                <th style={{ ...S.th, fontFamily: "monospace", fontSize: 10 }}>{tr.rankingsColCusec}</th>
                <th style={{ ...S.th, textAlign: "right" }}>{tr.rankingsColIp} {year}</th>
                <th style={{ ...S.th, textAlign: "right" }}>{tr.rankingsColQ}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr
                  key={r.cusec}
                  onClick={() => flyToPoint(terria, r.lon, r.lat)}
                  title={tr.rankingsRowTitle}
                  style={{
                    cursor: "pointer",
                    borderBottom: "1px solid #f3f4f6",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#eff6ff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={S.td}>{r.nmun}</td>
                  <td style={S.td}>{r.npro}</td>
                  <td style={{ ...S.td, fontFamily: "monospace", fontSize: 10, color: "#6b7280" }}>{r.cusec}</td>
                  <td style={{ ...S.td, textAlign: "right", fontWeight: 700, color: "#111827" }}>{fmt2(r.ip)}</td>
                  <td style={{ ...S.td, textAlign: "right", fontSize: 10, color: "#6b7280" }}>{r.qLabel.charAt(0) || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={S.footer}>
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          style={S.pageBtn(page === 0)}
        >
          {tr.rankingsPagePrev}
        </button>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          {tr.rankingsPageInfo(page + 1, pageCount)}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          disabled={page >= pageCount - 1}
          style={S.pageBtn(page >= pageCount - 1)}
        >
          {tr.rankingsPageNext}
        </button>
      </div>
    </div>
  );
}

RankingsPanel.propTypes = {
  terria:   PropTypes.object.isRequired,
  isOpen:   PropTypes.bool.isRequired,
  onClose:  PropTypes.func.isRequired,
};

function SortBtn({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 10px", fontSize: 11,
        fontWeight: active ? 700 : 500,
        color:      active ? "#2563eb" : "#374151",
        background: active ? "#eff6ff" : "#ffffff",
        border:     active ? "1px solid #93c5fd" : "1px solid #d1d5db",
        borderRadius: 6, cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      {label}
    </button>
  );
}
SortBtn.propTypes = { label: PropTypes.string, active: PropTypes.bool, onClick: PropTypes.func };

const S = {
  panel: {
    position: "fixed",
    bottom: 16, left: "50%", transform: "translateX(-50%)",
    width: 560, maxWidth: "calc(100vw - 360px)",
    maxHeight: 380,
    zIndex: 949,
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 12,
    boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
    display: "flex", flexDirection: "column",
    overflow: "hidden",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "9px 14px",
    background: "#f3f4f6",
    borderBottom: "1px solid #e5e7eb",
    flexShrink: 0,
  },
  controls: {
    display: "flex", gap: 6, padding: "8px 14px",
    borderBottom: "1px solid #f3f4f6", flexShrink: 0,
    flexWrap: "wrap",
  },
  th: {
    textAlign: "left", padding: "8px 10px",
    fontSize: 10, fontWeight: 700, color: "#6b7280",
    textTransform: "uppercase", letterSpacing: "0.5px",
    borderBottom: "1px solid #e5e7eb",
    position: "sticky", top: 0,
    background: "#f9fafb",
  },
  td: {
    padding: "6px 10px",
    color: "#374151",
    verticalAlign: "middle",
  },
  footer: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "7px 14px",
    background: "#f9fafb",
    borderTop: "1px solid #f3f4f6",
    flexShrink: 0,
  },
  pageBtn: (disabled) => ({
    padding: "3px 12px",
    border: "1px solid #d1d5db",
    background: disabled ? "#f3f4f6" : "#ffffff",
    color: disabled ? "#9ca3af" : "#374151",
    borderRadius: 5,
    fontSize: 13, lineHeight: 1, cursor: disabled ? "not-allowed" : "pointer",
  }),
};
