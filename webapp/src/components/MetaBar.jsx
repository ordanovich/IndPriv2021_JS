import React from "react";
import { useApp } from "../state";
import { useHovered } from "../map/hoverStore";
import { fmtInt, fmtNum } from "../i18n";
import { useColors } from "../hooks";
import Search from "./Search";

function HoverReadout() {
  const { table, state, t } = useApp();
  const i = useHovered();
  const colors = useColors();
  if (i == null || !table || i >= table.n) return null;
  const q = table.q[i];
  return (
    <span className="hover">
      <b>{table.id[i]}</b> · {table.names.mun[table.mun[i]]}
      {" · IP "}<b>{fmtNum(state.lang, table.ip[i])}</b>
      {q > 0 && <span className="qdot" style={{ background: colors[q - 1] }}>Q{q}</span>}
    </span>
  );
}

export default function MetaBar() {
  const { state, set, mode, table, t } = useApp();
  const lang = state.lang;
  const src = mode.years[state.year]?.source?.[lang];

  return (
    <div className="metabar">
      <Search />
      <div className="meta" title={src}>
        <strong>{t.index} {state.year}</strong>
        {table && <span>{t.unitsCount(fmtInt(lang, table.n), mode.units[lang])}</span>}
        <span>{state.classes === "q" ? t.nationalQuintiles : t.continuousScale}</span>
        {src && <span className="src">{src}</span>}
      </div>
      <HoverReadout />
      {state.notice && (
        <div className="notice">
          {state.notice}
          <button onClick={() => set({ notice: null })}>✕</button>
        </div>
      )}
    </div>
  );
}
