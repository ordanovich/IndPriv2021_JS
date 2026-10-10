import React from "react";
import { useApp } from "../state";
import { useIsMobile } from "../hooks";
import { Section } from "./ui";
import Legend from "./Legend";
import ExportPanel from "./ExportPanel";

export default function RightPanel() {
  const { state, setPanels, t } = useApp();
  const mobile = useIsMobile();

  if (!state.panels.right) {
    return (
      <aside className="rail right">
        <button className="rail-btn" title={t.panelExpand} onClick={() => setPanels({ right: true })}>«</button>
      </aside>
    );
  }
  return (
    <aside className="side right">
      <div className="side-top">
        <button className="collapse" title={t.panelCollapse} onClick={() => setPanels({ right: false })}>{mobile ? "✕ " + t.legend : "»"}</button>
      </div>
      <div className="side-scroll">
        <Section title={t.legend} open={state.panels.legend} onToggle={v => setPanels({ legend: v })}>
          <Legend />
        </Section>
        <Section title={t.export}>
          <ExportPanel />
        </Section>
      </div>
    </aside>
  );
}
