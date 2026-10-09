import React from "react";
import { useApp } from "../state";
import { MODES } from "../config";
import { activeFilterCount } from "../data";
import { Section } from "./ui";
import Filters from "./Filters";
import Layers from "./Layers";

export default function LeftPanel() {
  const { state, set, setPanels, t } = useApp();
  const lang = state.lang;

  if (!state.panels.left) {
    return (
      <aside className="rail left">
        <button className="rail-btn" title={t.panelExpand} onClick={() => setPanels({ left: true })}>»</button>
      </aside>
    );
  }

  const nFilters = activeFilterCount(state.filters);
  return (
    <aside className="side left">
      <div className="mode-tabs" role="tablist">
        {MODES.map(m => (
          <button key={m.id} role="tab" aria-selected={state.mode === m.id}
                  className={state.mode === m.id ? "on" : ""} disabled={!m.available}
                  title={m.available ? m.label[lang] : `${m.label[lang]} · ${t.modeSoon}`}
                  onClick={() => set({ mode: m.id, year: m.defaultYear, selected: null })}>
            {m.short[lang]}
            {!m.available && <small>{t.modeSoon}</small>}
          </button>
        ))}
        <button className="collapse" title={t.panelCollapse} onClick={() => setPanels({ left: false })}>«</button>
      </div>
      <div className="side-scroll">
        <Section title={t.filters} right={nFilters ? <span className="badge">{nFilters}</span> : null}>
          <Filters />
        </Section>
        <Section title={t.layers}>
          <Layers />
        </Section>
      </div>
    </aside>
  );
}
