import React, { useState, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import { autorun, runInAction } from "mobx";
import { MenuLeft } from "terriajs/lib/ReactViews/StandardUserInterface/customizable/Groups";
import StandardUserInterface from "terriajs/lib/ReactViews/StandardUserInterface/StandardUserInterface";
import version from "../../version";
import ExportPanel from "./ExportPanel";
import ExtentChart from "./ExtentChart";
import AboutPanel from "./AboutPanel";
import ProvinceAtlasPanel from "./ProvinceAtlasPanel";
import SearchPanel from "./SearchPanel";
import { AppProvider, useApp } from "./AppContext";
import { TR } from "./translations";
import { DEMO_MODE } from "./buildConfig";

const SS_KEY_DEMO_BANNER = "atlas.demoBannerDismissed";
const isDemoMode = () =>
  DEMO_MODE ||
  (typeof window !== "undefined" &&
    window.location.search.includes("demo=1"));

function DemoBanner() {
  const { lang } = useApp();
  const tr = TR[lang];
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage?.getItem(SS_KEY_DEMO_BANNER) === "1";
  });

  if (!isDemoMode() || dismissed) return null;

  const dismiss = () => {
    try { window.sessionStorage?.setItem(SS_KEY_DEMO_BANNER, "1"); } catch (_) {}
    setDismissed(true);
  };

  return (
    <div style={{
      position:   "fixed",
      top:        0,
      left:       0,
      right:      0,
      zIndex:     100001,
      background: "#fef3c7",
      borderBottom: "1px solid #fcd34d",
      color:      "#78350f",
      padding:    "5px 38px 5px 16px",
      fontSize:   12,
      fontWeight: 500,
      letterSpacing: "0.2px",
      textAlign:  "center",
      lineHeight: 1.4,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      boxShadow:  "0 1px 2px rgba(0,0,0,0.04)",
    }}>
      {tr.demoBanner}
      <button
        onClick={dismiss}
        title={tr.demoDismissTitle}
        style={{
          position:   "absolute",
          top:        "50%",
          right:      10,
          transform:  "translateY(-50%)",
          background: "none",
          border:     "none",
          color:      "#78350f",
          fontSize:   16,
          fontWeight: 700,
          cursor:     "pointer",
          lineHeight: 1,
          padding:    "2px 6px",
          opacity:    0.75,
        }}
      >
        {tr.demoDismiss}
      </button>
    </div>
  );
}

// ── Color palettes ─────────────────────────────────────────────────────────────
export const STD_COLORS = ["#1a9850", "#91cf60", "#ffffbf", "#fc8d59", "#d73027"];
export const CB_COLORS  = ["#4575b4", "#91bfdb", "#ffffbf", "#fc8d59", "#d73027"];

// Exact data values in the GeoJSON (must match precisely)
const ENUM_2021 = [
  "1. Inferior [-2,82/-0,82]",
  "2. Intermedio bajo [-0,82/-0,26]",
  "3. Intermedio [-0,26/0,20]",
  "4. Intermedio alto [0,20/0,76]",
  "5. Superior [0,76/7,29]",
];
const ENUM_2011 = [
  "1. Inferior [-2,58/-0,86]",
  "2. Intermedio bajo [-0,87/-0,27]",
  "3. Intermedio [-0,28/-0,21]",
  "4. Intermedio alto [0,22/0,82]",
  "5. Superior [0,83/4,88]",
];

const COLS_2021 = title => [
  { name: "Q21_Label", title },
  { name: "IP2021",    type: "hidden" },
  { name: "IP2011",    type: "hidden" },
  { name: "Q11_Label", type: "hidden" },
  { name: "Q21_num",   type: "hidden" },
  { name: "CUSEC",     type: "hidden" },
  { name: "NMUN",      type: "hidden" },
  { name: "NPRO",      type: "hidden" },
];
const COLS_2011 = title => [
  { name: "Q11_Label", title },
  { name: "IP2011",    type: "hidden" },
  { name: "IP2021",    type: "hidden" },
  { name: "Q21_Label", type: "hidden" },
  { name: "Q21_num",   type: "hidden" },
  { name: "CUSEC",     type: "hidden" },
  { name: "NMUN",      type: "hidden" },
  { name: "NPRO",      type: "hidden" },
];

// ── Light theme overrides ──────────────────────────────────────────────────────
const LIGHT_THEME = {
  dark:                   "#ffffff",
  darkWithOverlay:        "#f9fafb",
  darkMid:                "#f3f4f6",
  darkLighter:            "#e5e7eb",
  darkAlpha:              "0.04",
  textLight:              "#111827",       // primary text — very dark
  textLightDimmed:        "#374151",       // secondary text — dark enough to read
  textLightTranslucent:   "rgba(17,24,39,0.3)",
  colorPrimary:           "#2563eb",
  grey:                   "#374151",       // label/hint text — dark enough on white
  greyLighter:            "#6b7280",       // borders and muted elements
  greyLighter2:           "#e5e7eb",       // subtle dividers
  charcoalGrey:           "#1f2937",       // high-contrast accents
  scrollbarColor:         "#9ca3af",
  scrollbarTrackColor:    "#f3f4f6",
  overlay:                "rgba(0,0,0,0.45)",
  overlayInvert:          "rgba(255,255,255,0.85)",
  modalBg:                "#ffffff",
  modalText:              "#111827",
  modalHighlight:         "#2563eb",
  mapButtonColor:         "#374151",
};

// ── Sync TerriaJS catalog items with current lang + colorblind state ──────────
function updateCatalogItems(terria, lang, colorblind, selectedQ = null) {
  const colors = colorblind ? CB_COLORS : STD_COLORS;
  const tr = TR[lang];

  // When a quintile is selected, grey out all others on the map
  const dimColor = "#d0d0d0";
  const mapColors = selectedQ === null
    ? colors
    : colors.map((c, i) => i === selectedQ ? c : dimColor);

  const ITEM_DEFS = {
    "atlas-2021": { name: tr.layer2021, cols: COLS_2021(tr.column2021), col: "Q21_Label", enums: ENUM_2021 },
    "atlas-2011": { name: tr.layer2011, cols: COLS_2011(tr.column2011), col: "Q11_Label", enums: ENUM_2011 },
  };

  (terria.workbench?.items ?? []).forEach(item => {
    const def = ITEM_DEFS[item.uniqueId];
    if (!def) return;
    runInAction(() => {
      item.setTrait("user", "name", def.name);
      item.setTrait("user", "columns", def.cols);
      item.setTrait("user", "defaultStyle", {
        outline: { null: { color: "rgba(0,0,0,0)", width: 0 } },
        color: {
          colorColumn: def.col,
          nullColor: "#d3d3d3",
          enumColors: def.enums.map((value, i) => ({ value, color: mapColors[i] })),
        },
      });
      item.setTrait("user", "legends", [{
        items: tr.legendItems.map((title, i) => ({ color: mapColors[i], title })),
      }]);
    });
  });
}

// ── Small toggle button ────────────────────────────────────────────────────────
function ToggleBtn({ active, onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background:    active ? "#eff6ff" : "transparent",
        border:        active ? "1px solid #93c5fd" : "1px solid #d1d5db",
        borderRadius:  6,
        color:         active ? "#2563eb" : "#374151",
        cursor:        "pointer",
        fontSize:      12,
        fontWeight:    600,
        padding:       "4px 10px",
        lineHeight:    1.5,
        letterSpacing: "0.3px",
        marginLeft:    4,
        whiteSpace:    "nowrap",
        transition:    "background 0.15s, border-color 0.15s, color 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ── Inner component (has access to context) ────────────────────────────────────
function TerriaUIInner({ terria, viewState }) {
  const { lang, toggleLang, colorblind, toggleColorblind } = useApp();
  const [exportOpen,       setExportOpen]       = useState(false);
  const [aboutOpen,        setAboutOpen]         = useState(false);
  const [selectedQuintile, setSelectedQuintile]  = useState(null);
  const openExport  = useCallback(() => setExportOpen(true),  []);
  const closeExport = useCallback(() => setExportOpen(false), []);
  const tr = TR[lang];

  const toggleQuintile = useCallback(
    i => setSelectedQuintile(q => (q === i ? null : i)),
    []
  );

  // MobX autorun: re-runs when workbench items change (e.g. on initial load)
  // and re-creates when lang / colorblind / selectedQuintile state changes.
  useEffect(() => {
    const dispose = autorun(() => {
      const items = terria.workbench?.items ?? [];
      if (items.length > 0) {
        updateCatalogItems(terria, lang, colorblind, selectedQuintile);
      }
    });
    return dispose;
  }, [terria, lang, colorblind, selectedQuintile]);

  return (
    <>
      {/* Light-theme overrides for TerriaJS chrome */}
      <style>{`
        /* Hide Display Variable picker — only one column per layer */
        div:has(> label[for*="-activeStyle"]) { display: none !important; }

        /* Fix ReactSelect text color on light background */
        [class*="-singleValue"] { color: #111827 !important; }
        [class*="-placeholder"] { color: #6b7280 !important; }
        [class*="-Input"] input { color: #111827 !important; }

        /* ── Feature Information Panel ──────────────────────── */
        .tjs-feature-info-panel__panel {
          background: #ffffff !important;
          color: #111827 !important;
        }
        .tjs-feature-info-panel__header {
          background: #f3f4f6 !important;
          border-bottom: 1px solid #e5e7eb;
        }
        .tjs-feature-info-panel__btnPanelHeading {
          color: #111827 !important;
        }
        .tjs-feature-info-panel__header svg,
        .tjs-feature-info-panel__btnToggleFeature svg,
        .tjs-feature-info-panel__btn--close-feature svg,
        .tjs-feature-info-panel__btn-location svg {
          fill: #374151 !important;
        }
        .tjs-feature-info-panel__location {
          color: #374151 !important;
        }
        .tjs-feature-info-panel__no-results {
          color: #374151 !important;
        }
        /* Feature item rows */
        .tjs-feature-info-section__section {
          background: #ffffff !important;
          border-top-color: #e5e7eb !important;
        }
        .tjs-feature-info-section__title {
          background: #f9fafb !important;
          color: #111827 !important;
        }
        .tjs-feature-info-section__title span {
          color: #111827 !important;
        }
        .tjs-feature-info-section__title svg {
          fill: #374151 !important;
        }
        .tjs-feature-info-section__content {
          background: #ffffff !important;
          color: #111827 !important;
        }
        .tjs-feature-info-section__content table,
        .tjs-feature-info-section__content td {
          border-color: #e5e7eb !important;
          color: #111827 !important;
        }
      `}</style>

      <StandardUserInterface
        terria={terria}
        viewState={viewState}
        themeOverrides={LIGHT_THEME}
        version={version}
      >
        <MenuLeft>
          <ToggleBtn active={aboutOpen} onClick={() => setAboutOpen(o => !o)}
                     title={tr.aboutTitle}>
            {tr.aboutBtn}
          </ToggleBtn>
          <ToggleBtn onClick={toggleLang} title={tr.langTitle}>
            {tr.langBtn}
          </ToggleBtn>
          <ToggleBtn active={colorblind} onClick={toggleColorblind}
                     title={colorblind ? tr.colorblindActive : tr.colorblindTitle}>
            ◑
          </ToggleBtn>
        </MenuLeft>
      </StandardUserInterface>

      {/* ── Bottom-right widget: Export button + chart ──────────────────────── */}
      <div style={{
        position:   "fixed",
        bottom:     72,
        right:      16,
        zIndex:     950,
        width:      280,
        display:    "flex",
        flexDirection: "column",
        gap:        8,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        <button
          onClick={() => setExportOpen(o => !o)}
          title={tr.exportBtnLabel}
          style={{
            width:          "100%",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            gap:            8,
            padding:        "11px 0",
            borderRadius:   10,
            border:         exportOpen
              ? "1px solid rgba(37,99,235,0.55)"
              : "1px solid rgba(37,99,235,0.35)",
            background:     exportOpen
              ? "rgba(37,99,235,0.95)"
              : "rgba(37,99,235,0.82)",
            backdropFilter:       "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            color:          "#fff",
            fontSize:       14,
            fontWeight:     700,
            cursor:         "pointer",
            boxShadow:      exportOpen
              ? "0 6px 24px rgba(37,99,235,0.45)"
              : "0 4px 18px rgba(37,99,235,0.3)",
            transition:     "background 0.2s, box-shadow 0.2s",
            letterSpacing:  "0.3px",
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>⬇</span>
          {tr.exportBtnLabel.replace("⬇ ", "")}
        </button>

        <ExtentChart
          terria={terria}
          selectedQuintile={selectedQuintile}
          onQuintileToggle={toggleQuintile}
        />
      </div>

      {/* ── About panel ─────────────────────────────────────────────────────── */}
      <AboutPanel
        isOpen={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />

      {/* ── Export panel ────────────────────────────────────────────────────── */}
      <ExportPanel
        terria={terria}
        isOpen={exportOpen}
        onClose={closeExport}
        onReopen={openExport}
      />

      {/* ── Province atlas panel (appears on feature click) ──────────────── */}
      <ProvinceAtlasPanel terria={terria} />

      {/* ── Search panel (top-right) ─────────────────────────────────────── */}
      <SearchPanel terria={terria} />

      {/* ── Demo banner (only when DEMO_MODE or ?demo=1) ─────────────────── */}
      <DemoBanner />
    </>
  );
}

// ── Public export ──────────────────────────────────────────────────────────────
export const TerriaUserInterface = ({ terria, viewState }) => (
  <AppProvider>
    <TerriaUIInner terria={terria} viewState={viewState} />
  </AppProvider>
);

TerriaUserInterface.propTypes = {
  terria:    PropTypes.object.isRequired,
  viewState: PropTypes.object.isRequired,
};
