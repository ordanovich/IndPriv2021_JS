import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../state";
import { fmtInt, fmtNum } from "../i18n";
import { useColors, useTable, useViewRows } from "../hooks";
import { mapBus } from "../map/mapBus";

function ranks(v) {
  const idx = v.map((x, i) => i).sort((a, b) => v[a] - v[b]);
  const r = new Array(v.length);
  for (let k = 0; k < idx.length;) {
    let j = k;
    while (j + 1 < idx.length && v[idx[j + 1]] === v[idx[k]]) j++;
    for (let m = k; m <= j; m++) r[idx[m]] = (k + j) / 2;
    k = j + 1;
  }
  return r;
}
function spearman(x, y) {
  if (x.length < 3) return null;
  const rx = ranks(x), ry = ranks(y);
  const n = x.length, mx = (n - 1) / 2;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const a = rx[i] - mx, b = ry[i] - mx;
    sxy += a * b; sxx += a * a; syy += b * b;
  }
  return sxy / Math.sqrt(sxx * syy);
}

// Comparable units only (same code AND same boundaries in both years):
// x = 2011 index, y = 2021 index.
export default function Scatter() {
  const { state, set, mode, table, selectedIndex, t } = useApp();
  const lang = state.lang;
  const colors = useColors();
  const rows = useViewRows();
  const linkCfg = mode.link;
  const tA = useTable(mode.id, linkCfg?.a);   // 2021
  const tB = useTable(mode.id, linkCfg?.b);   // 2011
  const canvas = useRef(null);
  const wrap = useRef(null);
  const [size, setSize] = useState({ w: 300, h: 200 });
  const [hover, setHover] = useState(null);

  const pts = useMemo(() => {
    if (!table || !tA || !tB) return null;
    const out = [];
    for (const i of rows) {
      if (table.s[i] !== 1) continue;
      const id = table.id[i];
      const a = tA.index.get(id), b = tB.index.get(id);
      if (a == null || b == null) continue;
      const x = tB.ip[b], y = tA.ip[a];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      out.push({ i, x, y, q: table.q[i] });
    }
    return out;
  }, [rows, table, tA, tB]);

  // The section selected on the map: highlighted (even if outside the view
  // or the filters), or flagged when its boundaries changed between years.
  const sel = useMemo(() => {
    if (!table || !tA || !tB || selectedIndex == null) return null;
    const i = selectedIndex;
    if (table.s[i] !== 1) return { i, comparable: false };
    const a = tA.index.get(table.id[i]), b = tB.index.get(table.id[i]);
    const x = b == null ? NaN : tB.ip[b], y = a == null ? NaN : tA.ip[a];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { i, comparable: false };
    return { i, comparable: true, x, y, q: table.q[i] };
  }, [table, tA, tB, selectedIndex]);

  const rho = useMemo(() => (pts ? spearman(pts.map(p => p.x), pts.map(p => p.y)) : null), [pts]);
  // Axes fit the points in view (padded), so zooming in spreads them out.
  const ext = useMemo(() => {
    const all = sel?.comparable ? [...(pts || []), sel] : pts;
    if (!all || !all.length) return null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of all) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    const px = Math.max((x1 - x0) * 0.06, 0.05), py = Math.max((y1 - y0) * 0.06, 0.05);
    return { x0: x0 - px, x1: x1 + px, y0: y0 - py, y1: y1 + py };
  }, [pts, sel]);

  // The plot box only exists once data is ready, so observe it from then on.
  const hasPlot = !!(pts && ext);
  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [hasPlot]);

  const M = { l: 34, r: 8, t: 8, b: 24 };
  const sx = v => M.l + ((v - ext.x0) / (ext.x1 - ext.x0)) * (size.w - M.l - M.r);
  const sy = v => size.h - M.b - ((v - ext.y0) / (ext.y1 - ext.y0)) * (size.h - M.t - M.b);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !pts || !ext) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size.w * dpr; c.height = size.h * dpr;
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);
    g.fillStyle = "#fafafa";
    g.fillRect(M.l, M.t, size.w - M.l - M.r, size.h - M.t - M.b);
    g.strokeStyle = "#e5e7eb";
    g.strokeRect(M.l, M.t, size.w - M.l - M.r, size.h - M.t - M.b);
    const r = pts.length > 5000 ? 1.2 : pts.length > 1000 ? 1.8 : 2.6;
    g.globalAlpha = pts.length > 5000 ? 0.5 : 0.75;
    for (const p of pts) {
      g.fillStyle = p.q > 0 ? colors[p.q - 1] : "#9ca3af";
      g.beginPath(); g.arc(sx(p.x), sy(p.y), r, 0, 6.2832); g.fill();
    }
    g.globalAlpha = 1;
    if (sel?.comparable) {
      const x = sx(sel.x), y = sy(sel.y);
      g.strokeStyle = "#111827"; g.lineWidth = 1; g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(M.l, y); g.lineTo(x, y); g.moveTo(x, y); g.lineTo(x, size.h - M.b); g.stroke();
      g.setLineDash([]);
      g.fillStyle = sel.q > 0 ? colors[sel.q - 1] : "#9ca3af";
      g.beginPath(); g.arc(x, y, 7, 0, 6.2832); g.fill();
      g.lineWidth = 2.5; g.stroke();
      g.fillStyle = "#111827"; g.font = "bold 11px system-ui, sans-serif";
      g.textAlign = x > size.w * 0.7 ? "right" : "left";
      g.fillText(table.id[sel.i], x + (x > size.w * 0.7 ? -11 : 11), y - 9);
    }
    if (hover) {
      const p = hover;
      g.strokeStyle = "#111827"; g.lineWidth = 2;
      g.beginPath(); g.arc(sx(p.x), sy(p.y), r + 3, 0, 6.2832); g.stroke();
    }
    g.fillStyle = "#6b7280"; g.font = "10px system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText(t.scatterAxisX, M.l + (size.w - M.l - M.r) / 2, size.h - 6);
    g.textAlign = "left";
    g.fillText(fmtNum(lang, ext.x0, 1), M.l, size.h - 6);
    g.textAlign = "right";
    g.fillText(fmtNum(lang, ext.x1, 1), size.w - M.r, size.h - 6);
    g.textAlign = "right";
    g.fillText(fmtNum(lang, ext.y1, 1), M.l - 3, M.t + 9);
    g.fillText(fmtNum(lang, ext.y0, 1), M.l - 3, size.h - M.b);
    g.save(); g.translate(10, M.t + (size.h - M.t - M.b) / 2); g.rotate(-Math.PI / 2);
    g.textAlign = "center"; g.fillText(t.scatterAxisY, 0, 0); g.restore();
  }, [pts, ext, size, colors, hover, lang, sel]);

  if (!linkCfg) return null;
  if (!pts) return <p className="muted pad">{t.loading}</p>;
  if (!ext) return <p className="muted pad">{sel && !sel.comparable ? t.scatterSelNotComparable : t.scatterEmpty}</p>;

  const nearest = e => {
    const rect = canvas.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best = null, bd = 64;
    for (const p of pts) {
      const d = (sx(p.x) - mx) ** 2 + (sy(p.y) - my) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };

  return (
    <div className="scatter">
      <div className="scatter-plot" ref={wrap}>
        <canvas ref={canvas} style={{ width: size.w, height: size.h }}
                onMouseMove={e => setHover(nearest(e))} onMouseLeave={() => setHover(null)}
                onClick={e => {
                  const p = nearest(e);
                  if (p) { set({ selected: { year: state.year, id: table.id[p.i] } }); mapBus.fitUnit(table, p.i); }
                }} />
      </div>
      <div className="scatter-side">
        {sel && (
          <div className={"scatter-sel" + (sel.comparable ? "" : " muted")}>
            <div className="field-label">{t.scatterSelected}</div>
            <b>{table.id[sel.i]}</b> · {table.names.mun[table.mun[sel.i]]}
            {sel.comparable
              ? <div>IP 2011 <b>{fmtNum(lang, sel.x)}</b> · IP 2021 <b>{fmtNum(lang, sel.y)}</b></div>
              : <div>{t.scatterSelNotComparable}</div>}
          </div>
        )}
        {hover ? (
          <div className="scatter-hover">
            <b>{table.id[hover.i]}</b>
            <div>{table.names.mun[table.mun[hover.i]]}</div>
            <div>IP 2011 <b>{fmtNum(lang, hover.x)}</b></div>
            <div>IP 2021 <b>{fmtNum(lang, hover.y)}</b></div>
          </div>
        ) : (
          <div className="scatter-hover muted">
            {pts.length ? t.scatterCount(fmtInt(lang, pts.length), fmtInt(lang, rows.length)) : t.scatterEmpty}
            {rho != null && <div>ρ Spearman = <b>{fmtNum(lang, rho)}</b></div>}
          </div>
        )}
        <p className="note">{t.scatterNote}</p>
      </div>
    </div>
  );
}

