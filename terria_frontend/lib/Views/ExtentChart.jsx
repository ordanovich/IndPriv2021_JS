import React, { useState, useEffect, useCallback, useRef } from "react";
import { ensureDataLoaded, onDataReady } from "./geoDataStore";
import { useApp } from "./AppContext";
import { TR } from "./translations";
import { STD_COLORS, CB_COLORS } from "./UserInterface";
import { computeDist, computeStats, computeScatterPoints } from "./viewStats";

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExtentChart({ terria, selectedQuintile = null, onQuintileToggle = () => {} }) {
  const { lang, colorblind } = useApp();
  const tr = TR[lang];
  const COLORS = colorblind ? CB_COLORS : STD_COLORS;

  const [dist,    setDist]    = useState(null);
  const [hovered, setHovered] = useState(null);
  const [visible, setVisible] = useState(true);
  const [stats,   setStats]   = useState(null);
  const [copied,  setCopied]  = useState(false);
  const [viewMode, setViewMode] = useState("dist"); // "dist" | "scatter"
  const [scatter,  setScatter]  = useState(null);
  const cleanupRef = useRef(null);

  const refresh = useCallback(() => {
    const d = computeDist(terria);
    if (d) setDist(d);
    if (viewMode === "scatter") setScatter(computeScatterPoints(terria));
  }, [terria, viewMode]);

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

  // Recompute per-quintile stats whenever the view or selection changes
  useEffect(() => {
    if (selectedQuintile === null || !dist) { setStats(null); return; }
    setStats(computeStats(terria, selectedQuintile, dist.year));
  }, [dist, selectedQuintile, terria]);

  // Compute scatter on demand the first time the user switches to it.
  useEffect(() => {
    if (viewMode === "scatter") setScatter(computeScatterPoints(terria));
  }, [viewMode, dist, terria]);

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
          {/* View-mode segmented control */}
          <div style={{
            display: "inline-flex", border: "1px solid #e5e7eb",
            borderRadius: 6, overflow: "hidden",
          }}>
            <button
              type="button"
              onClick={() => setViewMode("dist")}
              title={tr.extentViewDist}
              style={{
                padding: "2px 7px", fontSize: 10, fontWeight: 600,
                border: "none", cursor: "pointer", lineHeight: 1.4,
                background: viewMode === "dist" ? "#eff6ff" : "#ffffff",
                color:      viewMode === "dist" ? "#2563eb" : "#6b7280",
              }}
            >
              ▦
            </button>
            <button
              type="button"
              onClick={() => setViewMode("scatter")}
              title={tr.extentViewScatter}
              style={{
                padding: "2px 7px", fontSize: 10, fontWeight: 600,
                border: "none", borderLeft: "1px solid #e5e7eb", cursor: "pointer", lineHeight: 1.4,
                background: viewMode === "scatter" ? "#eff6ff" : "#ffffff",
                color:      viewMode === "scatter" ? "#2563eb" : "#6b7280",
              }}
            >
              ✦
            </button>
          </div>
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

      {viewMode === "dist" && (<>
      {/* Stacked proportion bar */}
      <div style={{ display: "flex", height: 12, borderRadius: 6,
                    overflow: "hidden", marginBottom: 13, gap: 1 }}>
        {pcts.map((pct, i) => {
          const isActiveBar = selectedQuintile !== null
            ? selectedQuintile === i
            : (hovered === null || hovered === i);
          return (
            <div key={i} style={{
              flex: Math.max(pct, 0.01),
              background: COLORS[i],
              opacity: isActiveBar ? 1 : 0.2,
              transition: "flex 0.55s cubic-bezier(.4,0,.2,1), opacity 0.18s",
              minWidth: pct > 0 ? 2 : 0,
              cursor: "pointer",
            }}
              onClick={() => onQuintileToggle(i)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </div>

      {/* Quintile rows */}
      {pcts.map((pct, i) => {
        const isSelected = selectedQuintile === i;
        const isDimmed   = selectedQuintile !== null && !isSelected;
        return (
          <div key={i}
            onClick={() => onQuintileToggle(i)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            title={isSelected
              ? (lang === "es" ? "Clic para quitar filtro" : "Click to clear filter")
              : (lang === "es" ? "Clic para resaltar en el mapa" : "Click to highlight on map")}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "5px 6px", borderRadius: 6, marginBottom: 2,
              background: isSelected
                ? `${COLORS[i]}18`
                : hovered === i ? "rgba(0,0,0,0.04)" : "transparent",
              borderLeft: isSelected ? `3px solid ${COLORS[i]}` : "3px solid transparent",
              opacity: isDimmed ? 0.45 : 1,
              cursor: "pointer",
              transition: "background 0.15s, opacity 0.15s",
            }}
          >
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: COLORS[i], flexShrink: 0,
              boxShadow: (isSelected || hovered === i) ? `0 0 5px ${COLORS[i]}80` : "none",
              transition: "box-shadow 0.2s",
            }} />
            <span style={{
              fontSize: 11,
              color: (isSelected || hovered === i) ? "#111827" : "#6b7280",
              flex: 1, transition: "color 0.15s",
              fontWeight: isSelected ? 600 : 400,
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
              color: (isSelected || hovered === i) ? "#111827" : "#374151",
              width: 40, textAlign: "right", flexShrink: 0,
              transition: "color 0.15s",
            }}>
              {pct.toFixed(1)}%
            </span>
          </div>
        );
      })}

      {/* Clear filter + distribution stats */}
      {selectedQuintile !== null && (
        <>
          <button
            onClick={() => onQuintileToggle(selectedQuintile)}
            style={{
              display: "block", width: "100%", marginTop: 8,
              padding: "4px 0", borderRadius: 6,
              border: `1px solid ${COLORS[selectedQuintile]}50`,
              background: `${COLORS[selectedQuintile]}10`,
              color: COLORS[selectedQuintile],
              fontSize: 11, fontWeight: 600,
              cursor: "pointer", letterSpacing: "0.2px",
            }}
          >
            {tr.clearFilter}
          </button>

          {stats && (() => {
            const col  = COLORS[selectedQuintile];
            const loc  = lang === "es" ? "es-ES" : "en-GB";
            const fmt2 = v => v.toFixed(2);
            const BAR_W = 100 / stats.bins.length;
            const meanPct = stats.max > stats.min
              ? (stats.mean - stats.min) / (stats.max - stats.min) * 100 : 50;
            return (
              <div style={{
                marginTop: 7,
                padding: "9px 10px 7px",
                background: "#f9fafb",
                border: `1px solid ${col}28`,
                borderLeft: `3px solid ${col}`,
                borderRadius: 7,
              }}>
                {/* Key stats row */}
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 10, color: "#6b7280", marginBottom: 7,
                }}>
                  <span>
                    <strong style={{ color: "#111827", fontSize: 11 }}>
                      {stats.n.toLocaleString(loc)}
                    </strong>{" "}{tr.sectionsUnit}
                  </span>
                  <span>μ = <strong style={{ color: "#111827" }}>{fmt2(stats.mean)}</strong></span>
                  <span>med = <strong style={{ color: "#111827" }}>{fmt2(stats.median)}</strong></span>
                  <span>σ = <strong style={{ color: "#111827" }}>{fmt2(stats.std)}</strong></span>
                </div>

                {/* Histogram */}
                <svg
                  viewBox="0 0 100 32"
                  preserveAspectRatio="none"
                  style={{ display: "block", width: "100%", height: 42 }}
                >
                  {stats.bins.map((count, i) => {
                    const barH = stats.maxBin > 0 ? (count / stats.maxBin) * 28 : 0;
                    return (
                      <rect key={i}
                        x={i * BAR_W + 0.3} y={29 - barH}
                        width={BAR_W - 0.6} height={barH}
                        fill={col} fillOpacity={0.72} rx={0.4}
                      />
                    );
                  })}
                  {/* Mean marker */}
                  <line
                    x1={meanPct} y1={0} x2={meanPct} y2={29}
                    stroke="#374151" strokeWidth={0.9} strokeDasharray="2,1.5"
                  />
                </svg>

                {/* Axis labels */}
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 9, color: "#9ca3af", marginTop: 2,
                }}>
                  <span>{fmt2(stats.min)}</span>
                  <span>IP {year}</span>
                  <span>{fmt2(stats.max)}</span>
                </div>

                {/* Copy summary button */}
                <button
                  onClick={() => {
                    const lines = [
                      `Atlas de Privación — ${tr.currentView} (${year})`,
                      `${total.toLocaleString(loc)} ${tr.sectionsUnit}`,
                      ...pcts.map((pct, i) =>
                        `  ${tr.quintileLabels[i]}: ${pct.toFixed(1)}% (${counts[i].toLocaleString(loc)})`
                      ),
                      "",
                      `${tr.quintileLabels[selectedQuintile]} (n=${stats.n.toLocaleString(loc)})`,
                      `  μ=${fmt2(stats.mean)}  med=${fmt2(stats.median)}  σ=${fmt2(stats.std)}  [${fmt2(stats.min)} … ${fmt2(stats.max)}]`,
                    ];
                    const text = lines.join("\n");
                    const fallback = () => {
                      const ta = document.createElement("textarea");
                      ta.value = text;
                      ta.style.position = "fixed";
                      ta.style.opacity = "0";
                      document.body.appendChild(ta);
                      ta.focus(); ta.select();
                      try { document.execCommand("copy"); } catch (_) {}
                      document.body.removeChild(ta);
                    };
                    if (navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(text).catch(fallback);
                    } else {
                      fallback();
                    }
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  style={{
                    display:    "block", width: "100%", marginTop: 6,
                    padding:    "4px 0", borderRadius: 5,
                    border:     copied
                      ? `1px solid ${col}80`
                      : `1px solid ${col}40`,
                    background: copied ? `${col}18` : "transparent",
                    color:      col, fontSize: 10, fontWeight: 600,
                    cursor:     "pointer", letterSpacing: "0.2px",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                >
                  {copied ? `✓ ${tr.exportStatsCopied}` : tr.extentCopy}
                </button>
              </div>
            );
          })()}
        </>
      )}

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
      </>)}

      {/* Scatterplot view */}
      {viewMode === "scatter" && (
        <ScatterView
          data={scatter}
          colors={COLORS}
          lang={lang}
          tr={tr}
        />
      )}
    </div>
  );
}

// ── ScatterView ──────────────────────────────────────────────────────────────
function ScatterView({ data, colors, lang, tr }) {
  const [hover, setHover] = useState(null);
  if (!data || data.points.length === 0) {
    return (
      <div style={{
        padding: "10px 4px",
        fontSize: 11, color: "#9ca3af", textAlign: "center",
      }}>
        {tr.scatterEmpty}
      </div>
    );
  }
  const { points, xMin, xMax, yMin, yMax } = data;
  // viewBox 100 x 70 with margins for axis labels
  const W = 100, H = 70;
  const ML = 9, MR = 2, MT = 2, MB = 9;        // chart margins
  const plotW = W - ML - MR, plotH = H - MT - MB;
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const xToSvg = (v) => ML + ((v - xMin) / xRange) * plotW;
  const yToSvg = (v) => MT + plotH - ((v - yMin) / yRange) * plotH;

  // Diagonal reference line: crosses the visible square from bottom-left to
  // top-right of the plot box (relative reference, not absolute equality).
  const diagX1 = ML, diagY1 = MT + plotH;
  const diagX2 = ML + plotW, diagY2 = MT;

  const loc = lang === "es" ? "es-ES" : "en-GB";
  const fmt2 = v => v.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Render: optionally one large circle for hovered point on top.
  const hoverPoint = hover != null ? points[hover] : null;

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ display: "block", width: "100%", height: 210 }}
          onMouseLeave={() => setHover(null)}
        >
          {/* Plot frame */}
          <rect
            x={ML} y={MT} width={plotW} height={plotH}
            fill="#fafafa" stroke="#e5e7eb" strokeWidth={0.25}
          />
          {/* Diagonal reference line */}
          <line
            x1={diagX1} y1={diagY1} x2={diagX2} y2={diagY2}
            stroke="#9ca3af" strokeWidth={0.4} strokeDasharray="1.5,1.2"
          />
          {/* Points */}
          {points.map((p, idx) => {
            const cx = xToSvg(p.x);
            const cy = yToSvg(p.y);
            const c  = p.q != null ? colors[p.q - 1] : "#9ca3af";
            return (
              <circle
                key={idx}
                cx={cx} cy={cy} r={0.7}
                fill={c} fillOpacity={0.65}
                onMouseEnter={() => setHover(idx)}
              />
            );
          })}
          {/* Hovered marker */}
          {hoverPoint && (
            <circle
              cx={xToSvg(hoverPoint.x)} cy={yToSvg(hoverPoint.y)}
              r={1.4} fill="none"
              stroke="#111827" strokeWidth={0.5}
            />
          )}
          {/* Axis labels */}
          <text x={ML + plotW / 2} y={H - 1}
                fontSize={3.4} fill="#6b7280" textAnchor="middle">
            {tr.scatterXLabel}
          </text>
          <text x={2.6} y={MT + plotH / 2}
                fontSize={3.4} fill="#6b7280" textAnchor="middle"
                transform={`rotate(-90 2.6 ${MT + plotH / 2})`}>
            {tr.scatterYLabel}
          </text>
          {/* Min/max labels */}
          <text x={ML} y={H - 5} fontSize={2.6} fill="#9ca3af" textAnchor="start">
            {fmt2(xMin)}
          </text>
          <text x={ML + plotW} y={H - 5} fontSize={2.6} fill="#9ca3af" textAnchor="end">
            {fmt2(xMax)}
          </text>
          <text x={ML - 0.8} y={MT + 2.3} fontSize={2.6} fill="#9ca3af" textAnchor="end">
            {fmt2(yMax)}
          </text>
          <text x={ML - 0.8} y={MT + plotH} fontSize={2.6} fill="#9ca3af" textAnchor="end">
            {fmt2(yMin)}
          </text>
        </svg>

        {hoverPoint && (
          <div style={{
            position: "absolute", top: 4, right: 4,
            background: "rgba(255,255,255,0.97)",
            border: "1px solid #e5e7eb",
            borderRadius: 6, padding: "5px 8px",
            fontSize: 10.5, color: "#374151",
            pointerEvents: "none",
            boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            maxWidth: 180,
          }}>
            <div style={{ fontWeight: 700, color: "#111827", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {hoverPoint.nmun || "—"}
            </div>
            <div style={{ fontSize: 9.5, color: "#6b7280", fontFamily: "monospace", marginBottom: 2 }}>
              {hoverPoint.cusec}
            </div>
            <div>IP 2011: <strong style={{ color: "#111827" }}>{fmt2(hoverPoint.x)}</strong></div>
            <div>IP 2021: <strong style={{ color: "#111827" }}>{fmt2(hoverPoint.y)}</strong></div>
          </div>
        )}
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        marginTop: 5, fontSize: 9.5, color: "#9ca3af",
      }}>
        <span style={{
          display: "inline-block", width: 14, height: 0,
          borderTop: "1px dashed #9ca3af", flexShrink: 0,
        }} />
        <span>{tr.scatterRefLine}</span>
      </div>

      <p style={{
        marginTop: 6, padding: "6px 8px",
        background: "#fff7ed",
        border: "1px solid #fed7aa",
        borderRadius: 6,
        fontSize: 10, color: "#9a3412",
        lineHeight: 1.45,
      }}>
        {tr.scatterDisclaimer}
      </p>
    </div>
  );
}
