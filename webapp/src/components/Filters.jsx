import React, { useMemo } from "react";
import { useApp } from "../state";
import { useColors } from "../hooks";
import { mapBus } from "../map/mapBus";
import { Check, Field, Segmented } from "./ui";

const byName = lang => (a, b) => a[1].localeCompare(b[1], lang);

// Frame all units whose code starts with `prefix` (a province or municipality).
function frameTerritory(table, test) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (let i = 0; i < table.n; i++) {
    if (!test(i)) continue;
    const r = table.r[i];
    w = Math.min(w, table.x[i] - r); e = Math.max(e, table.x[i] + r);
    s = Math.min(s, table.y[i] - r); n = Math.max(n, table.y[i] + r);
  }
  if (w < e) mapBus.fitBox({ west: w, south: s, east: e, north: n });
}

export default function Filters() {
  const { state, setFilters, mode, table, t } = useApp();
  const { filters, lang } = { filters: state.filters, lang: state.lang };
  const colors = useColors();
  const has = g => mode.filters.includes(g);

  const ccaaList = useMemo(() => table ? Object.entries(table.names.ccaa).sort(byName(lang)) : [], [table, lang]);
  const provList = useMemo(() => {
    if (!table) return [];
    return Object.entries(table.names.prov)
      .filter(([p]) => !filters.ccaa || table.names.prov_ccaa[p] === filters.ccaa)
      .sort(byName(lang));
  }, [table, filters.ccaa, lang]);
  const munList = useMemo(() => {
    if (!table || !filters.prov) return [];
    return Object.entries(table.names.mun).filter(([m]) => m.startsWith(filters.prov)).sort(byName(lang));
  }, [table, filters.prov, lang]);

  if (!table) return <p className="muted">{t.loading}</p>;

  const setCcaa = ccaa => {
    setFilters({ ccaa, prov: "", mun: "" });
    if (ccaa) frameTerritory(table, i => table.ccaa[i] === ccaa);
  };
  const setProv = prov => {
    setFilters({ prov, mun: "", ccaa: prov ? table.names.prov_ccaa[prov] : filters.ccaa });
    if (prov) frameTerritory(table, i => table.prov[i] === prov);
  };
  const setMun = mun => {
    setFilters({ mun });
    if (mun) frameTerritory(table, i => table.mun[i] === mun);
  };
  const toggleQ = q => {
    const qs = filters.quintiles.includes(q) ? filters.quintiles.filter(x => x !== q) : [...filters.quintiles, q].sort();
    setFilters({ quintiles: qs });
  };

  return (
    <div className="filters">
      {has("territory") && (
        <Field label={t.territory}>
          <select value={filters.ccaa} onChange={e => setCcaa(e.target.value)}>
            <option value="">{t.allCcaa}</option>
            {ccaaList.map(([c, name]) => <option key={c} value={c}>{name}</option>)}
          </select>
          <select value={filters.prov} onChange={e => setProv(e.target.value)}>
            <option value="">{t.allProv}</option>
            {provList.map(([p, name]) => <option key={p} value={p}>{name}</option>)}
          </select>
          <select value={filters.mun} disabled={!filters.prov} onChange={e => setMun(e.target.value)}>
            <option value="">{t.allMun}</option>
            {munList.map(([m, name]) => <option key={m} value={m}>{name}</option>)}
          </select>
        </Field>
      )}

      {has("quintile") && (
        <Field label={t.quintile}>
          <div className="qfilter">
            {[1, 2, 3, 4, 5].map(q => {
              const on = filters.quintiles.includes(q);
              return (
                <button key={q} className={on ? "on" : ""} aria-pressed={on} title={t.qLabels[q - 1]}
                        onClick={() => toggleQ(q)} style={{ "--qc": colors[q - 1] }}>
                  <i />Q{q}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {has("degurba") && table.u && (
        <Field label={t.urbanisation}>
          <Segmented size="small" value={filters.degurba} onChange={v => setFilters({ degurba: v })}
                     options={[0, 1, 2, 3].map(v => ({ value: v, label: t.degurba[v] }))} />
        </Field>
      )}

      {has("stable") && mode.link && (
        <Field hint={t.stableHelp}>
          <Check checked={filters.stable} onChange={v => setFilters({ stable: v })}>{t.stableOnly}</Check>
        </Field>
      )}

    </div>
  );
}
