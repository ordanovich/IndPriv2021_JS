import React, { useEffect, useState } from "react";
import { AppProvider, useApp } from "./state";
import { loadLink, loadTable } from "./data";
import Header from "./components/Header";
import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";
import MetaBar from "./components/MetaBar";
import BottomPanel from "./components/BottomPanel";
import AboutModal from "./components/AboutModal";
import MapView from "./map/MapView";

// When the year changes, move the selection to the same territory in the new
// year: the same unit if its boundaries did not change, otherwise the unit
// that covers most of it. Never by code alone.
function SelectionCarrier() {
  const { state, set, mode } = useApp();
  const sel = state.selected;
  useEffect(() => {
    if (!sel || sel.year === state.year) return;
    let live = true;
    (async () => {
      if (!mode.link || !mode.years[sel.year]) { set({ selected: null }); return; }
      const [from, to, link] = await Promise.all([
        loadTable(mode.id, sel.year), loadTable(mode.id, state.year), loadLink(mode.id),
      ]);
      const i = from.index.get(sel.id);
      const best = i == null ? null : link.matches(sel.year, i)[0];
      if (live) set({ selected: best ? { year: state.year, id: to.id[best.i] } : null });
    })().catch(() => live && set({ selected: null }));
    return () => { live = false; };
  }, [state.year, sel]);
  return null;
}

function Shell() {
  const { mode, loadError, t } = useApp();
  const [about, setAbout] = useState(false);
  return (
    <div className="app">
      <Header onAbout={() => setAbout(true)} />
      <div className="app-body">
        <LeftPanel />
        <main className="center">
          <MetaBar />
          {mode.available ? <MapView /> : <div className="map-wrap placeholder">{t.modeUnavailable}</div>}
          {loadError && <div className="load-error">{t.loadError} <code>{loadError}</code></div>}
          <BottomPanel />
        </main>
        <RightPanel />
      </div>
      <AboutModal open={about} onClose={() => setAbout(false)} />
      <SelectionCarrier />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
