export const TR = {
  es: {
    // ── Export button & panel ─────────────────────────────────────────────────
    exportBtnLabel:  "Exportar / Seleccionar datos",
    exportTitle:     "Selección y Exportación",
    filterTitle:     "Filtrar por territorio",
    allCCAA:         "— Todas las CC.AA. —",
    allProvinces:    "— Todas las provincias —",
    clearTerritoryFilters: "✕ Quitar filtros de territorio",
    spatialTitle:    "Selección espacial",
    drawRect:        "⬚ Dibujar rectángulo en el mapa",
    clearRect:       "✕ Quitar selección rectangular",
    clearAllFilters: "✕ Borrar todos los filtros",
    exportCount:     n => `Exportar ${n.toLocaleString("es-ES")} secciones`,
    exportXlsx:      "⬇ Exportar a Excel (.xlsx)",
    exportGeoJSON:   "⬇ Exportar a GeoJSON",
    downloadTitle:   "Descarga completa",
    downloadAll:     "⬇ GeoJSON completo (~todos los datos)",
    loading:         "Cargando datos…",
    inSelectedArea:  "En área seleccionada",
    totalSections:   "Total secciones",
    filtered:        " · filtradas",
    drawMsg:         "Haz clic en dos puntos para definir el rectángulo de selección",
    cancel:          "Cancelar",
    // ── ExtentChart ───────────────────────────────────────────────────────────
    currentView:     "Vista actual",
    sectionsUnit:    "secc.",
    hideChart:       "−",
    showChart:       "+",
    quintileLabels:  ["Inferior", "Interm. bajo", "Intermedio", "Interm. alto", "Superior"],
    sectionCount:    n => `${n.toLocaleString("es-ES")} secciones`,
    // ── Workbench catalog items ───────────────────────────────────────────────
    layer2021:       "Índice de Privación 2021",
    layer2011:       "Índice de Privación 2011",
    column2021:      "Nivel de Privación (2021)",
    column2011:      "Nivel de Privación (2011)",
    // ── Legend labels (override the auto-generated Spanish data values) ───────
    legendItems: [
      "Q1 · Inferior",
      "Q2 · Intermedio bajo",
      "Q3 · Intermedio",
      "Q4 · Intermedio alto",
      "Q5 · Superior",
    ],
    // ── Controls ─────────────────────────────────────────────────────────────
    langBtn:         "EN",
    langTitle:       "Switch to English",
    colorblindTitle: "Modo daltónico",
    colorblindActive:"Modo daltónico: activado",
  },

  en: {
    // ── Export button & panel ─────────────────────────────────────────────────
    exportBtnLabel:  "Export / Select data",
    exportTitle:     "Selection and Export",
    filterTitle:     "Filter by territory",
    allCCAA:         "— All autonomous communities —",
    allProvinces:    "— All provinces —",
    clearTerritoryFilters: "✕ Clear territory filters",
    spatialTitle:    "Spatial selection",
    drawRect:        "⬚ Draw rectangle on the map",
    clearRect:       "✕ Clear rectangular selection",
    clearAllFilters: "✕ Clear all filters",
    exportCount:     n => `Export ${n.toLocaleString("en-GB")} census tracts`,
    exportXlsx:      "⬇ Export to Excel (.xlsx)",
    exportGeoJSON:   "⬇ Export to GeoJSON",
    downloadTitle:   "Full download",
    downloadAll:     "⬇ Full GeoJSON (~all data)",
    loading:         "Loading data…",
    inSelectedArea:  "In selected area",
    totalSections:   "Total tracts",
    filtered:        " · filtered",
    drawMsg:         "Click two points to define the selection rectangle",
    cancel:          "Cancel",
    // ── ExtentChart ───────────────────────────────────────────────────────────
    currentView:     "Current view",
    sectionsUnit:    "tracts",
    hideChart:       "−",
    showChart:       "+",
    quintileLabels:  ["Lower", "Lower-mid", "Middle", "Upper-mid", "Higher"],
    sectionCount:    n => `${n.toLocaleString("en-GB")} census tracts`,
    // ── Workbench catalog items ───────────────────────────────────────────────
    layer2021:       "Deprivation Index 2021",
    layer2011:       "Deprivation Index 2011",
    column2021:      "Deprivation Level (2021)",
    column2011:      "Deprivation Level (2011)",
    // ── Legend labels ─────────────────────────────────────────────────────────
    legendItems: [
      "Q1 · Lower deprivation",
      "Q2 · Lower-medium",
      "Q3 · Medium",
      "Q4 · Upper-medium",
      "Q5 · Higher deprivation",
    ],
    // ── Controls ─────────────────────────────────────────────────────────────
    langBtn:         "ES",
    langTitle:       "Cambiar a español",
    colorblindTitle: "Colorblind-safe palette",
    colorblindActive:"Colorblind-safe palette: ON",
  },
};

/** Helper: get a translation string (or call it if it's a function) */
export function t(lang, key, ...args) {
  const val = TR[lang]?.[key];
  if (typeof val === "function") return val(...args);
  return val ?? key;
}
