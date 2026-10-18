import React, { useEffect, useState } from "react";
import { AppProvider, useApp } from "./state";
import { loadLink, loadTable } from "./data";
import { useIsMobile } from "./hooks";
import Header from "./components/Header";
import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";
import MetaBar from "./components/MetaBar";
import BottomPanel from "./components/BottomPanel";
import AboutModal from "./components/AboutModal";
import { MobileMenu, MobileTopBar, TourStarter, YearSwitch } from "./components/MobileShell";
import MapView from "./map/MapView";
import ErrorBoundary, { CrashScreen } from "./components/ErrorBoundary";

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
  const { state, set, mode, loadError, t } = useApp();
  const [about, setAbout] = useState(false);

  const mobile = useIsMobile();
  useEffect(() => {
    if (mobile && state.selected) set({ panels: { ...state.panels, bottom: true, left: false, right: false, menu: false } });
  }, [mobile, state.selected?.id]);

  // Esc clears the selected unit, unless something else is open to close.
  useEffect(() => {
    const key = e => {
      if (e.key !== "Escape" || state.drawing || !state.selected) return;
      if (document.querySelector(".modal-backdrop, .menu-panel, .search-results")) return;
      set({ selected: null });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [state.drawing, state.selected]);
  // Phones get their own layout (components/MobileShell.jsx). The map keeps
  // its place in the tree, so switching layout does not rebuild it.
  return (
    <div className={"app" + (mobile ? " m" : "")}>
      {!mobile && <Header onAbout={() => setAbout(true)} />}
      <div className="app-body">
        {!mobile && <LeftPanel />}
        <main className="center">
          {!mobile && <MetaBar />}
          {mode.available ? <MapView /> : <div className="map-wrap placeholder">{t.modeUnavailable}</div>}
          {mobile && <MobileTopBar />}
          {mobile && <YearSwitch />}
          {loadError && <div className="load-error">{t.loadError} <code>{loadError}</code></div>}
          <BottomPanel />
        </main>
        {!mobile && <RightPanel />}
      </div>
      {mobile && <MobileMenu onAbout={() => setAbout(true)} />}
      <AboutModal open={about} onClose={() => setAbout(false)} />
      <SelectionCarrier />
      <TourStarter mobile={mobile} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary fallback={<CrashScreen />}>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ErrorBoundary>
  );
}
