import React, { useRef } from "react";
import { useApp } from "../state";
import { mapBus } from "../map/mapBus";
import { fmtNum } from "../i18n";
import { useColors, useIsMobile } from "../hooks";
import { QuintileChip } from "./ui";
import Details from "./Details";
import Distribution from "./Distribution";
import Scatter from "./Scatter";
import Ranking from "./Ranking";
import AtlasTab from "./AtlasTab";

const TABS = [
  { id: "dist", label: t => t.tabDist, C: Distribution },
  { id: "scatter", label: t => t.tabScatter, C: Scatter, needs: m => !!m.link },
  { id: "rank", label: t => t.tabRank, C: Ranking },
  { id: "atlas", label: t => t.tabAtlas, C: AtlasTab, needs: m => m.id === "ct" },
];

function Tabs({ tabs, active }) {
  const { state, set, t } = useApp();
  return (
    <div className="tabs" role="tablist">
      {tabs.map(x => (
        <button key={x.id} role="tab" aria-selected={x === active} className={x === active ? "on" : ""}
                onClick={() => set({ bottomTab: x.id, panels: { ...state.panels, bottom: true } })}>
          {x.label(t)}
        </button>
      ))}
    </div>
  );
}

// Phones: bottom sheet. Closed: one line about the selection. Open: the
// ficha. Full: ficha and the tabs. Swipe or tap the handle to change.
function Sheet({ tabs, active }) {
  const { state, set, setPanels, table, selectedIndex, t } = useApp();
  const colors = useColors();
  const open = state.panels.bottom;
  const full = open && state.panels.sheetFull;
  const start = useRef(null);
  const size = s => setPanels(s === "closed" ? { bottom: false, sheetFull: false }
    : s === "open" ? { bottom: true, sheetFull: false } : { bottom: true, sheetFull: true });
  const current = full ? "full" : open ? "open" : "closed";
  const bigger = { closed: "open", open: "full", full: "full" };
  const smaller = { closed: "closed", open: "closed", full: "open" };

  // Capture the pointer: the finger usually ends the swipe outside the handle
  const down = e => {
    start.current = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const up = e => {
    if (start.current == null) return;
    const dy = e.clientY - start.current;
    start.current = null;
    if (dy < -30) size(bigger[current]);
    else if (dy > 30) size(smaller[current]);
    else size(current === "closed" ? "open" : current === "open" ? "closed" : "open");   // tap
  };
  const sel = table && selectedIndex != null;

  return (
    <div className={"bottom sheet" + (open ? " open" : "") + (full ? " full" : "")}>
      <div className="sheet-grip" onPointerDown={down} onPointerUp={up} onPointerCancel={() => { start.current = null; }}>
        <div className="sheet-handle" role="button" tabIndex={0} aria-label={t.sheetToggle} title={t.sheetToggle}
             onKeyDown={e => (e.key === "Enter" || e.key === " ") && size(bigger[current] === current ? "open" : bigger[current])}>
          <span />
        </div>
        {!open && (
          <div className="sheet-peek">
            {sel ? (
              <>
                <b className="peek-name">{table.names.mun[table.mun[selectedIndex]]}</b>
                <span className="peek-ip">IP <b>{Number.isFinite(table.ip[selectedIndex]) ? fmtNum(state.lang, table.ip[selectedIndex]) : "—"}</b></span>
                <QuintileChip q={table.q[selectedIndex]} colors={colors} />
              </>
            ) : <span className="muted">{t.noSelectionMobile}</span>}
          </div>
        )}
      </div>
      {open && (
        <>
          <div className="sheet-actions">
            {sel && (
              <>
                <button className="m-btn flat" title={t.flyTo} aria-label={t.flyTo}
                        onClick={() => mapBus.fitUnit(table, selectedIndex)}>⌖</button>
                <button className="m-btn flat" title={t.clearSelection} aria-label={t.clearSelection}
                        onClick={() => set({ selected: null })}>✕</button>
              </>
            )}
            <button className="btn sheet-more" onClick={() => size(full ? "open" : "full")}>
              {full ? "▾ " + t.sheetLess : "▴ " + t.sheetMore}
            </button>
          </div>
          <div className="bottom-body">
            {sel ? <Details /> : <div className="details empty"><p className="muted">{t.noSelectionMobile}</p></div>}
            {full && (
              <>
                <Tabs tabs={tabs} active={active} />
                <div className="bottom-tab"><active.C /></div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function BottomPanel() {
  const { state, set, setPanels, mode, table, selectedIndex, t } = useApp();
  const mobile = useIsMobile();
  const open = state.panels.bottom;
  const tabs = TABS.filter(x => !x.needs || x.needs(mode));
  const active = tabs.find(x => x.id === state.bottomTab) ?? tabs[0];

  if (mobile) return <Sheet tabs={tabs} active={active} />;

  return (
    <div className={"bottom" + (open ? " open" : "")}>
      <div className="bottom-bar">
        <div className="bottom-title">
          <span>{t.details}</span>
          {table && selectedIndex != null && (
            <span className="title-actions">
              <button className="btn small" title={t.flyTo} onClick={() => mapBus.fitUnit(table, selectedIndex)}>⌖<span className="lbl"> {t.flyTo}</span></button>
              <button className="btn small" title={t.clearSelection + " (Esc)"} onClick={() => set({ selected: null })}>✕<span className="lbl"> {t.clearSelection}</span></button>
            </span>
          )}
        </div>
        <Tabs tabs={tabs} active={active} />
        <button className="collapse" title={open ? t.bottomCollapse : t.bottomExpand}
                onClick={() => setPanels({ bottom: !open })}>{open ? "▾" : "▴"}</button>
      </div>
      {open && (
        <div className="bottom-body">
          <Details />
          <div className="bottom-tab"><active.C /></div>
        </div>
      )}
    </div>
  );
}
