import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useApp } from "./AppContext";
import { TR } from "./translations";

// ── Final model variables (ACP Fase 5 · 9 variables) ──────────────────────────
// Source: Tabla 04 – real data provided by co-author.
// rho  = Spearman correlation with PC1 (Cor. Spearman comp. 1)
// peso = Eigenvector weight on PC1 (Peso comp. 1)
// Sorted by |rho| descending so the most important variable is at the top.
const PCA_VARS = [
  {
    code: "IE33_i",
    rho: 0.859, peso: 0.416,
    label_es: "Hog. con todos los ocup. como trabajadores manuales (≥16 a.)",
    label_en: "HH where all employed are manual workers (16+)",
  },
  {
    code: "REPRUCON_20_est_i",
    rho: -0.842, peso: -0.408,
    label_es: "Renta promedio por unidad de consumo (2020)",
    label_en: "Avg. income per consumption unit (2020)",
  },
  {
    code: "IE36_i",
    rho: 0.743, peso: 0.360,
    label_es: "Hog. con todos los 16–64 a. con instrucción insuf. o elemental",
    label_en: "HH where all 16–64 yr olds have insufficient/basic education",
  },
  {
    code: "IE03_i",
    rho: 0.727, peso: 0.352,
    label_es: "Parados s/ activos de 16 años y más",
    label_en: "Unemployed / economically active (16+)",
  },
  {
    code: "IE35_i",
    rho: 0.720, peso: 0.349,
    label_es: "Hog. con todos los ocup. como asalariados eventuales (≥16 a.)",
    label_en: "HH where all employed are temporary workers (16+)",
  },
  {
    code: "IE06_i",
    rho: 0.709, peso: 0.344,
    label_es: "Instrucción insuficiente s/ pobl. de 16 años y más",
    label_en: "Insufficient education / population 16+",
  },
  {
    code: "IE28_i",
    rho: 0.599, peso: 0.291,
    label_es: "Instrucción elemental s/ pobl. de 16 años y más",
    label_en: "Basic education / population 16+",
  },
  {
    code: "IE07a_e2_i",
    rho: 0.459, peso: 0.222,
    label_es: "Instrucción insuficiente s/ jóvenes de 16–29 años",
    label_en: "Insufficient education / youth 16–29",
  },
  {
    code: "IE40_i",
    rho: 0.372, peso: 0.180,
    label_es: "Hogares en viviendas de menos de 15 m² por ocupante",
    label_en: "Dwellings with less than 15 m² per occupant",
  },
];

const MAX_RHO = 0.90; // scale reference (slightly above 0.859)

// ── Style tokens ───────────────────────────────────────────────────────────────
const S = {
  panel: {
    position: "fixed", top: 58, left: 0,
    width: 360, zIndex: 9999,
    background: "#ffffff", color: "#111827",
    borderRadius: "0 8px 8px 0",
    boxShadow: "4px 0 24px rgba(0,0,0,0.13)",
    border: "1px solid #e5e7eb",
    display: "flex", flexDirection: "column",
    maxHeight: "calc(100vh - 80px)", overflow: "hidden",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    background: "#f3f4f6", padding: "12px 16px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    flexShrink: 0, borderBottom: "1px solid #e5e7eb",
  },
  body: { padding: "16px 16px 28px", overflowY: "auto", flex: 1 },
  sectionLabel: {
    fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px",
    color: "#6b7280", marginBottom: 8, marginTop: 0, display: "block",
  },
  section: { marginBottom: 22 },
  divider: { borderTop: "1px solid #e5e7eb", marginTop: 0, paddingTop: 18 },
  para: { fontSize: 12, lineHeight: 1.7, color: "#374151", margin: 0 },
  caption: { fontSize: 10, color: "#9ca3af", marginTop: 5, lineHeight: 1.5 },
  tabBar: {
    display: "flex", borderBottom: "1px solid #e5e7eb", flexShrink: 0,
  },
};

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ position: "relative" }}>
        {/* Controls */}
        <div style={{
          position: "absolute", top: -38, right: 0,
          display: "flex", gap: 16, alignItems: "center",
        }}>
          <a
            href={src} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ color: "#93c5fd", fontSize: 12, textDecoration: "none", lineHeight: 1 }}
          >
            Abrir tamaño completo ↗
          </a>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#ffffff",
                     fontSize: 26, cursor: "pointer", lineHeight: 1, padding: 0 }}
          >×</button>
        </div>
        <img
          src={src} alt={alt}
          style={{
            maxWidth: "88vw", maxHeight: "86vh",
            display: "block", borderRadius: 4,
            boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          }}
        />
      </div>
    </div>
  );
}
Lightbox.propTypes = { src: PropTypes.string, alt: PropTypes.string, onClose: PropTypes.func };

// ── Zoomable image (click → lightbox) ─────────────────────────────────────────
function ZoomableImage({ src, alt, caption, sectionLabel }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={S.section}>
      {sectionLabel && <span style={S.sectionLabel}>{sectionLabel}</span>}
      <div
        onClick={() => setOpen(true)}
        title="Pulse para ampliar · Click to enlarge"
        style={{ cursor: "zoom-in", lineHeight: 0 }}
      >
        <img
          src={src} alt={alt}
          style={{
            width: "100%", display: "block",
            borderRadius: 6, border: "1px solid #e5e7eb",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => { e.target.style.opacity = "0.88"; }}
          onMouseLeave={e => { e.target.style.opacity = "1"; }}
        />
      </div>
      {caption && (
        <p style={{ ...S.caption, textAlign: "center" }}>{caption}</p>
      )}
      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </div>
  );
}
ZoomableImage.propTypes = {
  src: PropTypes.string, alt: PropTypes.string,
  caption: PropTypes.string, sectionLabel: PropTypes.string,
};

// ── PCA variable row ───────────────────────────────────────────────────────────
function PcaRow({ code, label, rho, peso }) {
  const positive = rho >= 0;
  const barColor  = positive ? "#2563eb" : "#d97706";          // blue · amber
  const tagBg     = positive ? "#eff6ff" : "#fffbeb";
  const tagColor  = positive ? "#1d4ed8" : "#92400e";
  const barPct    = (Math.abs(rho) / MAX_RHO) * 100;

  return (
    <div style={{
      padding: "10px 0",
      borderBottom: "1px solid #f3f4f6",
    }}>
      {/* Code + rho badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
        <code style={{
          fontSize: 10, fontFamily: "monospace",
          background: "#f3f4f6", color: "#374151",
          padding: "1px 5px", borderRadius: 3,
          flexShrink: 0,
        }}>
          {code}
        </code>
        <span style={{
          fontSize: 10, fontWeight: 700,
          background: tagBg, color: tagColor,
          padding: "1px 6px", borderRadius: 10,
          flexShrink: 0,
        }}>
          ρ = {rho >= 0 ? "+" : ""}{rho.toFixed(3)}
        </span>
        <span style={{ fontSize: 9, color: "#9ca3af", marginLeft: "auto", flexShrink: 0 }}>
          w = {peso >= 0 ? "+" : ""}{peso.toFixed(3)}
        </span>
      </div>

      {/* Variable label */}
      <p style={{ fontSize: 11, color: "#374151", lineHeight: 1.4, margin: "0 0 6px 0" }}>
        {label}
      </p>

      {/* Bar */}
      <div style={{
        position: "relative", height: 7,
        background: "#f3f4f6", borderRadius: 4, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${barPct}%`,
          background: barColor,
          borderRadius: 4,
          opacity: 0.80,
        }} />
      </div>
    </div>
  );
}
PcaRow.propTypes = {
  code: PropTypes.string, label: PropTypes.string,
  rho: PropTypes.number, peso: PropTypes.number,
};

// ── Tab button ─────────────────────────────────────────────────────────────────
function Tab({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "10px 0", fontSize: 12,
      fontWeight: active ? 700 : 400,
      color: active ? "#2563eb" : "#6b7280",
      background: active ? "#eff6ff" : "transparent",
      border: "none",
      borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
      cursor: "pointer", transition: "all 0.15s",
    }}>
      {label}
    </button>
  );
}
Tab.propTypes = { label: PropTypes.string, active: PropTypes.bool, onClick: PropTypes.func };

// ── Citation constants ─────────────────────────────────────────────────────────
// TODO: REPLACE_DOI — once the Zenodo DOI is assigned, replace CITATION_DOI
// with the real value (e.g. "10.5281/zenodo.0000000") and remove the
// "[DOI pendiente / DOI pending]" placeholder in the UI.
const CITATION_DOI = null;
const CITATION_YEAR = 2026;
const CITATION_AUTHORS =
  "Duque, I., Gras-García, E. M., Ordanovich, D., Mari Dell-Olmo, M., " +
  "Aguilar-Palacio, I., La Parra-Casado, D., Fernández-Villa, T., " +
  "Martin Roncero, U., & Grupo de Determinantes Sociales de la Salud de la SEE";
const CITATION_TITLE_ES =
  "Atlas de Privación de España: Índice de Privación 2021 a nivel de sección censal";
const CITATION_TITLE_EN =
  "Atlas of Deprivation of Spain: 2021 Deprivation Index at census section level";
const CITATION_PUBLISHER = "Zenodo";

function buildApa(lang) {
  const title = lang === "es" ? CITATION_TITLE_ES : CITATION_TITLE_EN;
  const doiStr = CITATION_DOI
    ? `https://doi.org/${CITATION_DOI}`
    : (lang === "es" ? "[DOI pendiente]" : "[DOI pending]");
  return `${CITATION_AUTHORS} (${CITATION_YEAR}). ${title}. ${CITATION_PUBLISHER}. ${doiStr}`;
}

function buildBibtex(lang) {
  const title = lang === "es" ? CITATION_TITLE_ES : CITATION_TITLE_EN;
  const doiLine = CITATION_DOI ? `  doi          = {${CITATION_DOI}},\n` : "";
  return (
`@misc{atlasPrivacionEspana${CITATION_YEAR},
  author       = {${CITATION_AUTHORS}},
  title        = {${title}},
  year         = {${CITATION_YEAR}},
  publisher    = {${CITATION_PUBLISHER}},
${doiLine}  note         = {${CITATION_DOI ? "" : "DOI pending"}}
}`);
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AboutPanel({ isOpen, onClose }) {
  const { lang } = useApp();
  const tr = TR[lang];
  const [activeTab, setActiveTab] = useState("vars");
  const [copiedFlash, setCopiedFlash] = useState(false);

  if (!isOpen) return null;
  const isEs = lang === "es";

  const copyBibtex = () => {
    const bibtex = buildBibtex(lang);
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = bibtex;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand("copy"); } catch (_) {}
      document.body.removeChild(ta);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(bibtex).catch(fallback);
    } else {
      fallback();
    }
    setCopiedFlash(true);
    setTimeout(() => setCopiedFlash(false), 1500);
  };

  return (
    <div style={S.panel}>
      {/* Header */}
      <div style={S.header}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
          {tr.aboutTitle}
        </span>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#9ca3af",
                   fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0 }}
        >×</button>
      </div>

      {/* Tabs */}
      <div style={S.tabBar}>
        <Tab label={isEs ? "Variables" : "Variables"} active={activeTab === "vars"} onClick={() => setActiveTab("vars")} />
        <Tab label={isEs ? "ACP" : "PCA"}             active={activeTab === "pca"}  onClick={() => setActiveTab("pca")}  />
        <Tab label={isEs ? "Atlas" : "Atlas"}         active={activeTab === "atlas"} onClick={() => setActiveTab("atlas")} />
      </div>

      <div style={S.body}>

        {/* ── Tab-specific intro ────────────────────────────────────────── */}
        <div style={{ ...S.section, marginBottom: 18 }}>
          <p style={S.para}>
            {activeTab === "vars"  && tr.aboutIntroVars}
            {activeTab === "pca"   && tr.aboutIntroPca}
            {activeTab === "atlas" && tr.aboutIntroAtlas}
          </p>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* VARIABLES TAB                                                   */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "vars" && (
          <>
            <ZoomableImage
              src="atlas/national/p001_Nacional_Diccionario.png"
              alt={tr.aboutDictCaption}
              sectionLabel={tr.aboutVarsTitle}
              caption={tr.aboutDictCaption}
            />

            <div style={{ ...S.section, ...S.divider }}>
              <ZoomableImage
                src="atlas/national/p002_Nacional_Indice_IP2021.png"
                alt={isEs ? "Mapa nacional IP2021" : "National map IP2021"}
                sectionLabel={isEs ? "Mapa nacional del IP 2021" : "National map – IP 2021"}
                caption={isEs
                  ? "Índice de Privación 2021 a nivel nacional (quintiles). Pulse para ampliar."
                  : "2021 Deprivation Index at national level (quintiles). Click to enlarge."}
              />
            </div>

            <div style={{ ...S.section, ...S.divider }}>
              <ZoomableImage
                src="atlas/national/p003_Nacional_Variables_Matriz.png"
                alt={tr.aboutMatrixCaption}
                sectionLabel={tr.aboutVarMapsLabel}
                caption={tr.aboutMatrixCaption}
              />
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* PCA TAB                                                         */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "pca" && (
          <>
            <div style={S.section}>
              <span style={S.sectionLabel}>{tr.aboutPcaTitle}</span>
              <p style={{ ...S.para, marginBottom: 14 }}>{tr.aboutPcaDesc}</p>

              {/* Stats summary */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 8, marginBottom: 20,
              }}>
                {[
                  { label: isEs ? "Varianza explicada CP1" : "Variance explained PC1", value: "47.3 %" },
                  { label: "KMO", value: "0.816" },
                  { label: isEs ? "Validación" : "Validation", value: "Spearman · RF · Bootstrap" },
                  { label: isEs ? "Método" : "Method", value: "ACP / PCA" },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    background: "#f9fafb", border: "1px solid #e5e7eb",
                    borderRadius: 6, padding: "8px 10px",
                  }}>
                    <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 2 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 12, height: 12, background: "#2563eb", borderRadius: 2, opacity: 0.8 }} />
                  <span style={{ fontSize: 10, color: "#374151" }}>
                    {isEs ? "Factor de riesgo (ρ > 0)" : "Risk factor (ρ > 0)"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 12, height: 12, background: "#d97706", borderRadius: 2, opacity: 0.8 }} />
                  <span style={{ fontSize: 10, color: "#374151" }}>
                    {isEs ? "Factor protector (ρ < 0)" : "Protective factor (ρ < 0)"}
                  </span>
                </div>
              </div>

              {/* Variable rows */}
              <div>
                {PCA_VARS.map(v => (
                  <PcaRow
                    key={v.code}
                    code={v.code}
                    label={isEs ? v.label_es : v.label_en}
                    rho={v.rho}
                    peso={v.peso}
                  />
                ))}
              </div>

              <p style={{ ...S.caption, marginTop: 12 }}>
                {isEs
                  ? "ρ = correlación de Spearman con CP1; w = peso (coef. del eigenvector). Datos: Tabla 04 del informe final."
                  : "ρ = Spearman correlation with PC1; w = eigenvector weight. Source: Table 04, final report."}
              </p>

              {/* Validation note */}
              <div style={{
                marginTop: 18, padding: "10px 12px",
                background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: 6,
              }}>
                <span style={{ ...S.sectionLabel, color: "#166534", marginBottom: 6 }}>
                  {isEs ? "Validación del índice (4 pruebas)" : "Index validation (4 tests)"}
                </span>
                {(isEs ? [
                  ["1. Criterio externo — Spearman", "Correlaciones de Spearman entre el IP2021 y variables de renta externas al modelo: ρ = −0,926 con el precio de compraventa de vivienda y ρ = −0,914 con la renta bruta per cápita."],
                  ["2. Coherencia interna — Random Forest", "El CP1 se reconstruye mediante Random Forest a partir de las 9 variables componentes. Un R² elevado confirma que el índice es una síntesis coherente y determinista de las variables de entrada."],
                  ["3. Estabilidad estructural — Bootstrap PCA", "Se aplica remuestreo con reemplazo (B = 100 iteraciones) para evaluar la estabilidad de las cargas factoriales. Intervalos de confianza estrechos sin cruce de cero indican robustez muestral."],
                  ["4. Consistencia territorial — DEGURBA", "Modelos factoriales locales, estimados por estrato de urbanización (zona urbana, intermedia y rural), se correlacionan con el índice nacional para verificar la invarianza del constructo en distintos contextos territoriales."],
                ] : [
                  ["1. External criterion — Spearman", "Spearman correlations between IP2021 and income indicators external to the model: ρ = −0.926 with housing sale price and ρ = −0.914 with gross income per capita."],
                  ["2. Internal coherence — Random Forest", "PC1 is reconstructed via Random Forest from the 9 component variables. A high R² confirms the index is a coherent, deterministic synthesis of the input variables."],
                  ["3. Structural stability — Bootstrap PCA", "Resampling with replacement (B = 100 iterations) is used to evaluate factorial loading stability. Narrow confidence intervals that do not cross zero indicate sample robustness."],
                  ["4. Territorial consistency — DEGURBA", "Local factor models, estimated by urbanisation stratum (urban, intermediate, rural), are correlated with the national index to verify construct invariance across different territorial contexts."],
                ]).map(([title, desc]) => (
                  <div key={title} style={{ marginBottom: 9 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#166534", marginBottom: 2 }}>{title}</div>
                    <p style={{ fontSize: 11, color: "#374151", lineHeight: 1.5, margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>

              {/* Abbreviations */}
              <div style={{
                marginTop: 12, padding: "10px 12px",
                background: "#f9fafb", border: "1px solid #e5e7eb",
                borderRadius: 6,
              }}>
                <span style={{ ...S.sectionLabel, marginBottom: 6 }}>
                  {isEs ? "Glosario de siglas" : "Abbreviations"}
                </span>
                <table style={{ fontSize: 10, width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {(isEs ? [
                      ["ACP / PCA", "Análisis de Componentes Principales"],
                      ["CP1",       "Primer Componente Principal (primera dimensión del ACP)"],
                      ["KMO",       "Índice Kaiser-Meyer-Olkin · adecuación muestral para ACP (> 0,8 = bueno)"],
                      ["ρ (rho)",   "Coeficiente de correlación de Spearman"],
                      ["w",         "Peso del eigenvector en CP1 (coeficiente de carga)"],
                    ] : [
                      ["PCA",       "Principal Component Analysis"],
                      ["PC1",       "First Principal Component (first PCA dimension)"],
                      ["KMO",       "Kaiser-Meyer-Olkin index · sampling adequacy for PCA (> 0.8 = good)"],
                      ["ρ (rho)",   "Spearman correlation coefficient"],
                      ["w",         "Eigenvector weight on PC1 (loading coefficient)"],
                    ]).map(([abbr, def]) => (
                      <tr key={abbr}>
                        <td style={{
                          padding: "3px 10px 3px 0", fontWeight: 700,
                          color: "#374151", whiteSpace: "nowrap", verticalAlign: "top",
                        }}>{abbr}</td>
                        <td style={{ padding: "3px 0", color: "#6b7280", lineHeight: 1.45 }}>{def}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ATLAS TAB                                                       */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "atlas" && (
          <>
            <div style={S.section}>
              <span style={S.sectionLabel}>{tr.aboutAtlasTitle}</span>
              <p style={{ ...S.para, marginBottom: 14 }}>{tr.aboutAtlasDesc}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: tr.aboutAtlasVol1, size: "151 MB" },
                  { label: tr.aboutAtlasVol2, size: "1.1 GB"  },
                  { label: tr.aboutAtlasVol3, size: "264 MB"  },
                  { label: tr.aboutAtlasVol4, size: "123 MB"  },
                  { label: tr.aboutAtlasVol5, size: "587 MB"  },
                ].map(({ label, size }) => (
                  <a
                    key={label}
                    href="#"
                    onClick={e => e.preventDefault()}
                    title={tr.aboutAtlasNote}
                    style={{
                      display: "flex", alignItems: "center",
                      padding: "10px 12px", borderRadius: 7,
                      border: "1px solid #e5e7eb", background: "#fafafa",
                      color: "#374151", textDecoration: "none",
                      cursor: "not-allowed", opacity: 0.72,
                      transition: "background 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 13, marginRight: 10 }}>📄</span>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap" }}>{size}</span>
                    <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 10, whiteSpace: "nowrap" }}>
                      {isEs ? "DOI pendiente" : "DOI pending"}
                    </span>
                  </a>
                ))}
              </div>

              <div style={{
                marginTop: 14, padding: "10px 12px",
                background: "#eff6ff", borderRadius: 7,
                border: "1px solid #bfdbfe",
              }}>
                <p style={{ fontSize: 11, color: "#1e40af", margin: 0, lineHeight: 1.55 }}>
                  {isEs
                    ? "Los atlas se publicarán en Zenodo con DOI permanente. El enlace estará disponible en cuanto se complete el proceso de publicación."
                    : "The atlases will be published on Zenodo with a permanent DOI. The link will be available once the publication process is complete."}
                </p>
              </div>
            </div>

            {/* ── Citation / BibTeX ────────────────────────────────────── */}
            <div style={{ ...S.section, ...S.divider }}>
              <span style={S.sectionLabel}>{tr.aboutCiteTitle}</span>
              <p style={{ ...S.para, marginBottom: 10 }}>{tr.aboutCiteDesc}</p>

              <div style={{
                background: "#f9fafb", border: "1px solid #e5e7eb",
                borderRadius: 7, padding: "10px 12px",
                fontSize: 11, color: "#374151", lineHeight: 1.55,
                fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace",
                marginBottom: 10, whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {buildApa(lang)}
              </div>

              {!CITATION_DOI && (
                <p style={{
                  ...S.caption, marginTop: -2, marginBottom: 12,
                  fontStyle: "italic",
                }}>
                  {tr.aboutCitePendDoi}
                </p>
              )}

              <button
                onClick={copyBibtex}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 12px",
                  borderRadius: 6,
                  border: copiedFlash
                    ? "1px solid #16a34a"
                    : "1px solid #d1d5db",
                  background: copiedFlash ? "#dcfce7" : "#ffffff",
                  color:      copiedFlash ? "#15803d" : "#374151",
                  fontSize:   12, fontWeight: 600, cursor: "pointer",
                  transition: "background 0.2s, color 0.2s, border-color 0.2s",
                }}
              >
                {copiedFlash ? `✓ ${tr.aboutCiteCopied}` : tr.aboutCiteCopy}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

AboutPanel.propTypes = {
  isOpen:  PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
