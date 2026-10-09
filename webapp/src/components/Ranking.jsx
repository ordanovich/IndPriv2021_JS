import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../state";
import { fmtInt, fmtNum } from "../i18n";
import { useColors, useViewRows } from "../hooks";
import { mapBus } from "../map/mapBus";
import { QuintileChip, Segmented } from "./ui";

const PAGE = 50;

export default function Ranking() {
  const { state, set, mode, table, t, selectedIndex } = useApp();
  const lang = state.lang;
  const colors = useColors();
  const rows = useViewRows();
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!table) return [];
    const r = rows.filter(i => Number.isFinite(table.ip[i]));
    r.sort((a, b) => (order === "desc" ? table.ip[b] - table.ip[a] : table.ip[a] - table.ip[b]));
    return r;
  }, [rows, table, order]);
  useEffect(() => setPage(0), [sorted]);

  if (!table) return null;
  if (!sorted.length) return <p className="muted pad">{t.rankEmpty}</p>;
  const pages = Math.ceil(sorted.length / PAGE);
  const slice = sorted.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="ranking">
      <div className="ranking-bar">
        <Segmented size="small" value={order} onChange={setOrder}
                   options={[{ value: "desc", label: t.rankDesc }, { value: "asc", label: t.rankAsc }]} />
        <span className="muted small">{t.inViewFiltered(fmtInt(lang, sorted.length), mode.units[lang])}</span>
        <span className="pager">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
          {t.page(page + 1, pages)}
          <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>›</button>
        </span>
      </div>
      <div className="ranking-scroll">
        <table>
          <thead>
            <tr><th>#</th><th>{mode.idLabel}</th><th>{t.municipality}</th><th>{t.province}</th><th className="num">IP</th><th>{t.quintile}</th></tr>
          </thead>
          <tbody>
            {slice.map((i, k) => (
              <tr key={i} className={i === selectedIndex ? "sel" : ""}
                  onClick={() => { set({ selected: { year: state.year, id: table.id[i] } }); mapBus.fitUnit(table, i); }}>
                <td className="muted">{page * PAGE + k + 1}</td>
                <td className="mono">{table.id[i]}</td>
                <td>{table.names.mun[table.mun[i]]}</td>
                <td>{table.names.prov[table.prov[i]]}</td>
                <td className="num">{fmtNum(lang, table.ip[i], 3)}</td>
                <td><QuintileChip q={table.q[i]} colors={colors} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
