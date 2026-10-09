import React, { useMemo, useState } from "react";
import { useApp } from "../state";
import { describe } from "../data";
import { fmtInt, fmtNum } from "../i18n";
import { useColors, useViewRows } from "../hooks";
import { copyText } from "./ui";

const BINS = 40;

export default function Distribution() {
  const { state, table, mode, t } = useApp();
  const lang = state.lang;
  const colors = useColors();
  const rows = useViewRows();
  const [copied, setCopied] = useState(false);

  const data = useMemo(() => {
    if (!table) return null;
    const vals = rows.map(i => table.ip[i]).filter(Number.isFinite);
    const d = describe(vals);
    if (!d) return null;
    // Fixed national range so histograms are comparable while panning.
    const lo = table.breaks[0], hi = table.breaks[5];
    const w = (hi - lo) / BINS;
    const bins = new Array(BINS).fill(0);
    for (const v of vals) bins[Math.min(BINS - 1, Math.max(0, Math.floor((v - lo) / w)))]++;
    const qCounts = [0, 0, 0, 0, 0];
    for (const i of rows) if (table.q[i] > 0) qCounts[table.q[i] - 1]++;
    return { d, bins, lo, hi, w, max: Math.max(...bins), qCounts };
  }, [rows, table]);

  if (!table) return null;
  if (!data) return <p className="muted pad">{t.rankEmpty}</p>;

  const { d, bins, lo, w, max, qCounts } = data;
  const quintileOf = v => { let q = 1; while (q < 5 && v > table.breaks[q]) q++; return q; };
  const H = 100, W = 400;
  const meanX = ((d.mean - lo) / (w * BINS)) * W;

  const copy = () => {
    const lines = [
      `${t.appTitle} — ${t.index} ${state.year}`,
      t.inViewFiltered(fmtInt(lang, d.n), mode.units[lang]),
      `${t.mean} ${fmtNum(lang, d.mean)} · ${t.median} ${fmtNum(lang, d.median)} · ${t.sd} ${fmtNum(lang, d.sd)} · [${fmtNum(lang, d.min)} … ${fmtNum(lang, d.max)}]`,
      ...qCounts.map((c, k) => `Q${k + 1} ${t.qLabels[k]}: ${fmtInt(lang, c)} (${((c / d.n) * 100).toFixed(1)} %)`),
    ];
    copyText(lines.join("\n")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  return (
    <div className="dist">
      <div className="dist-stats">
        <span>{t.inViewFiltered(fmtInt(lang, d.n), mode.units[lang])}</span>
        <span>{t.mean} <b>{fmtNum(lang, d.mean)}</b></span>
        <span>{t.median} <b>{fmtNum(lang, d.median)}</b></span>
        <span>{t.sd} <b>{fmtNum(lang, d.sd)}</b></span>
        <button className="link" onClick={copy}>{copied ? "✓ " + t.copied : "⧉ " + t.copySummary}</button>
      </div>
      <svg className="hist" viewBox={`0 0 ${W} ${H + 6}`} preserveAspectRatio="none">
        {bins.map((c, k) => {
          const h = max ? (c / max) * H : 0;
          const mid = lo + (k + 0.5) * w;
          return <rect key={k} x={(k * W) / BINS + 0.5} y={H - h} width={W / BINS - 1} height={h}
                       fill={colors[quintileOf(mid) - 1]} />;
        })}
        <line x1={meanX} x2={meanX} y1={0} y2={H} stroke="#111827" strokeDasharray="3 2" strokeWidth="1" />
        {table.breaks.slice(1, 5).map((b, k) => {
          const x = ((b - lo) / (w * BINS)) * W;
          return <line key={k} x1={x} x2={x} y1={H} y2={H + 5} stroke="#6b7280" />;
        })}
      </svg>
      <div className="hist-axis">
        <span>{fmtNum(lang, lo, 1)}</span>
        <span>IP {state.year}</span>
        <span>{fmtNum(lang, table.breaks[5], 1)}</span>
      </div>
      <div className="qbar">
        {qCounts.map((c, k) => (
          <span key={k} style={{ flex: Math.max(c, 0.0001), background: colors[k] }}
                title={`Q${k + 1} · ${fmtInt(lang, c)}`} />
        ))}
      </div>
    </div>
  );
}
