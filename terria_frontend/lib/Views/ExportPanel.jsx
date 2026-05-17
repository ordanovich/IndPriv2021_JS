import React, { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import UserDrawing from "terriajs/lib/Models/UserDrawing";
import {
  PROV_TO_CCAA, CCAA_LIST,
  getCachedData, ensureDataLoaded,
  provCode, centroid, inRect,
} from "./geoDataStore";
import { useApp } from "./AppContext";
import { TR } from "./translations";
import { computeViewSnapshot } from "./viewStats";

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Light-theme style tokens ───────────────────────────────────────────────────
const S = {
  panel: {
    position: "fixed", top: 58, right: 0, width: 300, zIndex: 9999,
    background: "#ffffff", color: "#111827",
    borderRadius: "8px 0 0 8px",
    boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
    border: "1px solid #e5e7eb",
    display: "flex", flexDirection: "column",
    maxHeight: "calc(100vh - 80px)", overflow: "hidden",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    background: "#f3f4f6", padding: "12px 16px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    flexShrink: 0,
    borderBottom: "1px solid #e5e7eb",
  },
  body: { padding: 16, overflowY: "auto", flex: 1 },
  sectionLabel: {
    fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px",
    color: "#6b7280", marginBottom: 6, display: "block",
  },
  section: { marginBottom: 18 },
  stat: {
    background: "#f9fafb", borderRadius: 6, padding: "10px 14px", marginBottom: 16,
    display: "flex", justifyContent: "space-between", alignItems: "center",
    border: "1px solid #e5e7eb",
  },
  select: {
    width: "100%", background: "#ffffff", color: "#111827",
    border: "1px solid #d1d5db", borderRadius: 4,
    padding: "7px 10px", fontSize: 13, marginBottom: 8, cursor: "pointer",
  },
  btnPrimary: {
    width: "100%", padding: "9px 0", borderRadius: 4, border: "none",
    background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 600,
    cursor: "pointer", marginBottom: 8,
  },
  btnSecondary: {
    width: "100%", padding: "9px 0", borderRadius: 4,
    border: "1px solid #d1d5db", background: "transparent",
    color: "#374151", fontSize: 13, cursor: "pointer", marginBottom: 8,
  },
  btnDraw: {
    width: "100%", padding: "9px 0", borderRadius: 4,
    border: "1px solid #16a34a", background: "transparent",
    color: "#16a34a", fontSize: 13, cursor: "pointer", marginBottom: 8,
  },
  btnClear: {
    width: "100%", padding: "5px 0", borderRadius: 4,
    border: "1px solid #e5e7eb", background: "transparent",
    color: "#9ca3af", fontSize: 11, cursor: "pointer", marginBottom: 0,
  },
  divider: { borderTop: "1px solid #e5e7eb", marginTop: 4, paddingTop: 16 },
  link: {
    display: "block", width: "100%", padding: "9px 0", borderRadius: 4,
    border: "1px solid #d1d5db", background: "transparent",
    color: "#374151", fontSize: 13, textAlign: "center",
    textDecoration: "none", boxSizing: "border-box", marginBottom: 8,
  },
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function ExportPanel({ terria, isOpen, onClose, onReopen }) {
  const { lang } = useApp();
  const tr = TR[lang];

  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [ccaa,         setCcaa]         = useState("");
  const [province,     setProvince]     = useState("");
  const [rectFeatures, setRectFeatures] = useState(null);
  const drawingRef = useRef(null);

  // Load GeoJSON once (shared cache)
  useEffect(() => {
    if (!isOpen) return;
    const cached = getCachedData();
    if (cached) { setData(cached); return; }
    setLoading(true);
    ensureDataLoaded()
      .then(gj => setData(gj))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Reset spatial selection when admin filters change
  useEffect(() => { setRectFeatures(null); }, [ccaa, province]);

  const filtered = useCallback(() => {
    if (!data) return [];
    let feats = rectFeatures ?? data.features;
    if (ccaa)     feats = feats.filter(f => f.properties._CCAA === ccaa);
    if (province) feats = feats.filter(f => f.properties.NPRO  === province);
    return feats;
  }, [data, ccaa, province, rectFeatures]);

  const provinces = useCallback(() => {
    if (!data) return [];
    const set = new Set(
      data.features
        .filter(f => !ccaa || f.properties._CCAA === ccaa)
        .map(f => f.properties.NPRO)
    );
    return [...set].filter(Boolean).sort();
  }, [data, ccaa]);

  const startDrawing = useCallback(() => {
    if (drawingRef.current) {
      drawingRef.current.endDrawing?.();
      drawingRef.current = null;
    }
    setRectFeatures(null);
    onClose();

    const ud = new UserDrawing({
      terria,
      drawRectangle: true,
      messageHeader: tr.drawMsg,
      buttonText: tr.cancel,
      onDrawingComplete: ({ rectangle }) => {
        drawingRef.current = null;
        const gj = getCachedData();
        if (rectangle && gj) {
          const sel = gj.features.filter(f => {
            const c = centroid(f.geometry);
            return c && inRect(rectangle, c[0], c[1]);
          });
          setRectFeatures(sel);
        }
        onReopen();
      },
      onCleanUp: () => {
        drawingRef.current = null;
        onReopen();
      },
    });
    drawingRef.current = ud;
    ud.enterDrawMode();
  }, [terria, onClose, onReopen, tr]);

  const exportGeoJSON = () => {
    const features = filtered();
    const clean = features.map(f => ({
      ...f,
      properties: Object.fromEntries(
        Object.entries(f.properties).filter(([k]) => !k.startsWith("_"))
      ),
    }));
    downloadBlob(
      new Blob([JSON.stringify({ type: "FeatureCollection", features: clean })],
               { type: "application/geo+json" }),
      "privacion_seleccion.geojson"
    );
  };

  const exportXLSX = () => {
    const rows = filtered().map(f => ({
      "CUSEC":        f.properties.CUSEC,
      "CCAA":         f.properties._CCAA,
      "Provincia":    f.properties.NPRO,
      "Municipio":    f.properties.NMUN,
      "IP 2011":      f.properties.IP2011,
      "Quintil 2011": f.properties.Q11_Label,
      "IP 2021":      f.properties.IP2021,
      "Quintil 2021": f.properties.Q21_Label,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 12 }, { wch: 26 }, { wch: 22 }, { wch: 28 },
      { wch: 10 }, { wch: 38 }, { wch: 10 }, { wch: 38 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Privación");
    XLSX.writeFile(wb, "privacion_secciones.xlsx");
  };

  const exportCSV = () => {
    const features = filtered();
    const includeDelta = features.some(f => f.properties.deltaQ != null);
    const headers = ["CUSEC", "NMUN", "NPRO", "IP2011", "IP2021", "Q11_Label", "Q21_Label"];
    if (includeDelta) headers.push("DeltaQ");

    const escape = v => {
      if (v == null) return "";
      const s = String(v);
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines = [headers.join(",")];
    for (const f of features) {
      const p = f.properties;
      const row = [p.CUSEC, p.NMUN, p.NPRO, p.IP2011, p.IP2021, p.Q11_Label, p.Q21_Label];
      if (includeDelta) row.push(p.deltaQ);
      lines.push(row.map(escape).join(","));
    }
    const csv = "﻿" + lines.join("\r\n");
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      "privacion_secciones.csv"
    );
  };

  const exportStatsSnapshot = () => {
    const snap = computeViewSnapshot(terria);
    if (!snap) return;
    downloadBlob(
      new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" }),
      `privacion_estadisticas_${snap.year}.json`
    );
  };

  if (!isOpen) return null;

  const feats    = filtered();
  const provList = provinces();
  const hasFilters = ccaa || province || rectFeatures;

  return (
    <div style={S.panel}>
      {/* Header */}
      <div style={S.header}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
          {tr.exportTitle}
        </span>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#9ca3af",
                   fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0 }}
        >×</button>
      </div>

      <div style={S.body}>
        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", color: "#6b7280", padding: 24 }}>
            {tr.loading}
          </div>
        )}

        {/* Stats counter */}
        {data && (
          <div style={S.stat}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              {rectFeatures ? tr.inSelectedArea : tr.totalSections}
              {(ccaa || province) ? tr.filtered : ""}
            </div>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#2563eb" }}>
              {feats.length.toLocaleString(lang === "es" ? "es-ES" : "en-GB")}
            </span>
          </div>
        )}

        {/* Territory filters */}
        <div style={S.section}>
          <span style={S.sectionLabel}>{tr.filterTitle}</span>
          <select style={S.select} value={ccaa}
                  onChange={e => { setCcaa(e.target.value); setProvince(""); }}>
            <option value="">{tr.allCCAA}</option>
            {CCAA_LIST.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select style={S.select} value={province}
                  onChange={e => setProvince(e.target.value)} disabled={!data}>
            <option value="">{tr.allProvinces}</option>
            {provList.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {(ccaa || province) && (
            <button style={S.btnClear}
                    onClick={() => { setCcaa(""); setProvince(""); }}>
              {tr.clearTerritoryFilters}
            </button>
          )}
        </div>

        {/* Spatial selection */}
        <div style={S.section}>
          <span style={S.sectionLabel}>{tr.spatialTitle}</span>
          <button style={S.btnDraw} onClick={startDrawing} disabled={!data}>
            {tr.drawRect}
          </button>
          {rectFeatures && (
            <button style={S.btnClear} onClick={() => setRectFeatures(null)}>
              {tr.clearRect}
            </button>
          )}
        </div>

        {/* Clear all */}
        {hasFilters && (
          <div style={{ marginBottom: 18 }}>
            <button
              style={{ ...S.btnClear, borderColor: "#fca5a5", color: "#ef4444" }}
              onClick={() => { setCcaa(""); setProvince(""); setRectFeatures(null); }}
            >
              {tr.clearAllFilters}
            </button>
          </div>
        )}

        {/* Export */}
        <div style={{ ...S.section, ...S.divider }}>
          <span style={S.sectionLabel}>
            {tr.exportCount(feats.length)}
          </span>
          <button style={S.btnPrimary} onClick={exportXLSX}
                  disabled={!data || feats.length === 0}>
            {tr.exportXlsx}
          </button>
          <button style={S.btnSecondary} onClick={exportCSV}
                  disabled={!data || feats.length === 0}>
            {tr.exportCsv}
          </button>
          <button style={S.btnSecondary} onClick={exportGeoJSON}
                  disabled={!data || feats.length === 0}>
            {tr.exportGeoJSON}
          </button>
        </div>

        {/* Stats snapshot */}
        <div style={{ ...S.section, ...S.divider }}>
          <span style={S.sectionLabel}>{tr.exportStatsTitle}</span>
          <button style={S.btnSecondary} onClick={exportStatsSnapshot}
                  disabled={!data}>
            {tr.exportStatsSnapshot}
          </button>
          {!data && (
            <p style={{ fontSize: 10, color: "#9ca3af", margin: "2px 0 0",
                        lineHeight: 1.45 }}>
              {tr.exportStatsNoView}
            </p>
          )}
        </div>

        {/* Full download */}
        <div style={S.divider}>
          <span style={S.sectionLabel}>{tr.downloadTitle}</span>
          <a href="data/secciones_unified.geojson"
             download="secciones_privacion_espana.geojson"
             style={S.link}>
            {tr.downloadAll}
          </a>
        </div>
      </div>
    </div>
  );
}
