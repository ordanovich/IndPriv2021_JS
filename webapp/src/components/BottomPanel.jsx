import React from "react";
import { useApp } from "../state";
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

export default function BottomPanel() {
  const { state, set, setPanels, mode, t } = useApp();
  const open = state.panels.bottom;
  const tabs = TABS.filter(x => !x.needs || x.needs(mode));
  const active = tabs.find(x => x.id === state.bottomTab) ?? tabs[0];

  return (
    <div className={"bottom" + (open ? " open" : "")}>
      <div className="bottom-bar">
        <div className="bottom-title">{t.details}</div>
        <div className="tabs" role="tablist">
          {tabs.map(x => (
            <button key={x.id} role="tab" aria-selected={x === active} className={x === active ? "on" : ""}
                    onClick={() => set({ bottomTab: x.id, panels: { ...state.panels, bottom: true } })}>
              {x.label(t)}
            </button>
          ))}
        </div>
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
