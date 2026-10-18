// Phone layout: floating top bar (search + Menú), year switch and the Menú
// sheet that holds every secondary tool. The panels themselves are the same
// components as on desktop; only where they are shown changes.
import React, { useEffect, useState } from "react";
import { useApp } from "../state";
import { MODES } from "../config";
import { activeFilterCount } from "../data";
import { copyText, Section, Segmented } from "./ui";
import Search from "./Search";
import { Notice } from "./MetaBar";
import { BasemapList, LayersList } from "./MapMenus";
import Filters from "./Filters";
import Layers from "./Layers";
import Legend from "./Legend";
import ExportPanel from "./ExportPanel";
import { maybeStartTour, startTour } from "./tour";

export function MobileTopBar() {
  const { state, setPanels, t } = useApp();
  const n = activeFilterCount(state.filters);
  return (
    <div className="m-top">
      <div className="m-search"><Search /></div>
      <button className="m-btn m-menu-btn" aria-label={t.menu} title={t.menu}
              onClick={() => setPanels({ menu: true, menuSection: null })}>
        <span aria-hidden="true">☰</span>
        {n > 0 && <span className="badge">{n}</span>}
      </button>
      <Notice />
    </div>
  );
}

export function YearSwitch() {
  const { state, set, mode, t } = useApp();
  const years = Object.keys(mode.years);
  if (years.length < 2) return null;
  // The selection follows to the same territory (App's SelectionCarrier)
  return (
    <div className="m-year" role="group" aria-label={t.year}>
      {years.map(y => (
        <button key={y} className={y === state.year ? "on" : ""} aria-pressed={y === state.year}
                onClick={() => set({ year: y })}>{y}</button>
      ))}
    </div>
  );
}

function ModeButtons() {
  const { state, set, t } = useApp();
  const lang = state.lang;
  return (
    <div className="m-row">
      {MODES.map(m => (
        <button key={m.id} className={"btn" + (state.mode === m.id ? " on" : "")} disabled={!m.available}
                onClick={() => set({ mode: m.id, year: m.defaultYear, selected: null })}>
          {m.short[lang]}{!m.available && <small> · {t.modeSoon}</small>}
        </button>
      ))}
    </div>
  );
}

export function MobileMenu({ onAbout }) {
  const { state, set, setPanels, t } = useApp();
  const [shared, setShared] = useState(false);
  const open = state.panels.menu;
  const close = () => setPanels({ menu: false, menuSection: null });

  useEffect(() => {
    if (!open) return;
    const esc = e => e.key === "Escape" && close();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  if (!open) return null;
  const lang = state.lang;
  const sec = state.panels.menuSection;
  const nFilters = activeFilterCount(state.filters);
  const share = () => copyText(window.location.href).then(() => {
    setShared(true);
    setTimeout(() => setShared(false), 1600);
  });
  // Sections start closed, except the one the Menú was opened for
  const S = (id, title, body, right = null) => (
    <Section key={id} title={title} right={right} defaultOpen={sec === id}>{body}</Section>
  );

  return (
    <div className="m-menu" onClick={close}>
      <div className="m-menu-sheet" role="dialog" aria-modal="true" aria-label={t.menu} onClick={e => e.stopPropagation()}>
        <div className="m-menu-head">
          <img src="images/logo.jpg" alt="SEE" className="m-menu-logo" onError={e => { e.currentTarget.style.display = "none"; }} />
          <div className="m-menu-title">
            <b>{t.appTitle}</b>
            <small>{t.appSubtitle}</small>
          </div>
          <button className="m-btn flat" aria-label={t.menuClose} title={t.menuClose} onClick={close}>✕</button>
        </div>
        {/* Quick settings, in sight as soon as the Menú opens */}
        <div className="m-quick">
          <div className="m-quick-item" aria-label={t.language}>
            <Segmented value={lang} onChange={v => set({ lang: v })}
                       options={[{ value: "es", label: "ES", title: "Español" }, { value: "en", label: "EN", title: "English" }]} />
          </div>
          <button className={"m-chip" + (state.colorblind ? " on" : "")} aria-pressed={state.colorblind}
                  onClick={() => set({ colorblind: !state.colorblind })}>
            <span aria-hidden="true">◑</span> {t.colorblind}
          </button>
        </div>
        <div className="m-menu-body">
          {S("filters", t.filters, <Filters />, nFilters ? <span className="badge">{nFilters}</span> : null)}
          {S("layers", t.layers, <Layers />)}
          {S("legend", t.legend, <Legend />)}
          {S("basemap", t.basemap, <BasemapList />)}
          {S("wms", t.wmsAndFiles, <LayersList />)}
          {S("export", t.export, <ExportPanel />)}
          {S("unit", t.unitType, <ModeButtons />)}
          <div className="m-menu-foot">
            <button className="m-item" onClick={() => { close(); onAbout(); }}><span aria-hidden="true">ⓘ</span> {t.about}</button>
            <button className="m-item" onClick={share}><span aria-hidden="true">{shared ? "✓" : "🔗"}</span> {shared ? t.shareDone : t.share}</button>
            <button className="m-item" onClick={() => { close(); setTimeout(() => startTour(t).catch(() => {}), 300); }}>
              <span aria-hidden="true">?</span> {t.showTour}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Starts the first-visit tour of the layout on screen (phone or desktop)
export function TourStarter({ mobile }) {
  const { t } = useApp();
  useEffect(() => { maybeStartTour(t, mobile); }, [mobile]);
  return null;
}
