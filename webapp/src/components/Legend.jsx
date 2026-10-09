import React, { useMemo } from "react";
import { useApp } from "../state";
import { useColors, useViewRows } from "../hooks";
import { fmtInt, fmtNum } from "../i18n";
import { NO_DATA_COLOR } from "../config";
import { Segmented } from "./ui";

export default function Legend() {
  const { state, set, setFilters, table, mode, t } = useApp();
  const lang = state.lang;
  const colors = useColors();
  const rows = useViewRows({ ignoreQuintiles: true });

  const counts = useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0];
    if (table) for (const i of rows) c[table.q[i]]++;
    return c;
  }, [rows, table]);
  const total = rows.length;
  const selected = state.filters.quintiles;

  const toggle = q => setFilters({
    quintiles: selected.includes(q) ? selected.filter(x => x !== q) : [...selected, q].sort(),
  });

  const b = table?.breaks;
  return (
    <div className="legend">
      <div className="legend-head">
        <span>{t.index} {state.year}</span>
        <Segmented size="small" value={state.classes} onChange={v => set({ classes: v })}
                   options={[{ value: "q", label: t.quintiles }, { value: "c", label: t.continuous }]} />
      </div>

      {state.classes === "c" && b && (
        <div className="ramp">
          <div className="ramp-bar" style={{ background: `linear-gradient(to right, ${colors.join(",")})` }} />
          <div className="ramp-ticks">
            <span>{fmtNum(lang, b[0])}</span>
            <span>{fmtNum(lang, (b[2] + b[3]) / 2)}</span>
            <span>{fmtNum(lang, b[5])}</span>
          </div>
        </div>
      )}

      <div className="legend-rows">
        <div className="legend-colhead">
          <span />
          <span>{t.inView} · {fmtInt(lang, total)} {mode.units[lang]}</span>
        </div>
        {[1, 2, 3, 4, 5].map(q => {
          const pct = total ? (counts[q] / total) * 100 : 0;
          const on = selected.includes(q);
          const dim = selected.length > 0 && !on;
          return (
            <button key={q} className={"legend-row" + (on ? " on" : "") + (dim ? " dim" : "")}
                    title={t.legendClick} aria-pressed={on} onClick={() => toggle(q)}>
              <i className="sw" style={{ background: colors[q - 1] }} />
              <span className="lbl">
                <b>Q{q}</b> {t.qLabels[q - 1]}
                {b && <small>{fmtNum(lang, b[q - 1])} – {fmtNum(lang, b[q])}</small>}
              </span>
              <span className="bar"><span style={{ width: pct + "%", background: colors[q - 1] }} /></span>
              <span className="pct">{pct.toFixed(1)}%</span>
            </button>
          );
        })}
        <div className="legend-row static" title={t.gapHelp}>
          <i className="sw hatch" />
          <span className="lbl">{t.gap}</span>
          <span className="bar" />
          <span className="pct" />
        </div>
        {counts[0] > 0 && (
          <div className="legend-row static">
            <i className="sw" style={{ background: NO_DATA_COLOR }} />
            <span className="lbl">{t.noData}</span>
            <span className="bar" />
            <span className="pct">{fmtInt(lang, counts[0])}</span>
          </div>
        )}
      </div>
      <p className="legend-note">{t.legendNote}</p>
    </div>
  );
}
