import React from "react";
import { useApp } from "../state";
import { useHovered } from "../map/hoverStore";
import { fmtInt, fmtNum } from "../i18n";
import { useColors } from "../hooks";
import Search from "./Search";
import { BasemapMenu, LayersMenu } from "./MapMenus";

function HoverReadout() {
  const { table, state, t } = useApp();
  const i = useHovered();
  const colors = useColors();
  if (i === "gap") return <span className="hover" title={t.gapHelp}>{t.gap}</span>;
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

// Messages such as "outside Spain" (also used by the phone top bar)
export function Notice() {
  const { state, set } = useApp();
  if (!state.notice) return null;
  return (
    <div className="notice">
      <span>{state.notice.text ?? state.notice}</span>
      {state.notice.action && (
        <button className="notice-action" onClick={() => set(state.notice.action.patch)}>
          {state.notice.action.label}
        </button>
      )}
      <button onClick={() => set({ notice: null })} aria-label="✕">✕</button>
    </div>
  );
}

export default function MetaBar() {
  const { state, mode, table, t } = useApp();
  const lang = state.lang;
  const src = mode.years[state.year]?.source?.[lang];

  return (
    <div className="metabar">
      <Search />
      <div className="meta" title={src}>
        <strong>{t.index} {state.year}</strong>
        {table && <span>{t.unitsCount(fmtInt(lang, table.n), mode.units[lang])}</span>}
      </div>
      <HoverReadout />
      <div className="menus">
        <BasemapMenu />
        <LayersMenu />
      </div>
      <Notice />
    </div>
  );
}
