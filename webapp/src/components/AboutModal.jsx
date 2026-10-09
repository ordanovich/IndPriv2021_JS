import React, { useEffect, useState } from "react";
import { useApp } from "../state";
import { ATLAS_NATIONAL_DIR, CITATION } from "../config";
import { fmtInt } from "../i18n";
import { copyText } from "./ui";

// Final model (PCA phase 5, 9 variables). rho = Spearman correlation with
// PC1; w = eigenvector weight. Source: Table 04 of the final report.
const PCA_VARS = [
  ["IE33_i", 0.859, 0.416, "Hog. con todos los ocupados trabajadores manuales (≥16 a.)", "Households where all employed are manual workers (16+)"],
  ["REPRUCON_20_est_i", -0.842, -0.408, "Renta promedio por unidad de consumo (2020)", "Average income per consumption unit (2020)"],
  ["IE36_i", 0.743, 0.36, "Hog. con todos los 16–64 a. con instrucción insuficiente o elemental", "Households where all aged 16–64 have insufficient/basic education"],
  ["IE03_i", 0.727, 0.352, "Parados sobre activos de 16 años y más", "Unemployed / economically active (16+)"],
  ["IE35_i", 0.72, 0.349, "Hog. con todos los ocupados asalariados eventuales (≥16 a.)", "Households where all employed are temporary workers (16+)"],
  ["IE06_i", 0.709, 0.344, "Instrucción insuficiente sobre población de 16 años y más", "Insufficient education / population 16+"],
  ["IE28_i", 0.599, 0.291, "Instrucción elemental sobre población de 16 años y más", "Basic education / population 16+"],
  ["IE07a_e2_i", 0.459, 0.222, "Instrucción insuficiente sobre jóvenes de 16–29 años", "Insufficient education / youth 16–29"],
  ["IE40_i", 0.372, 0.18, "Hogares en viviendas de menos de 15 m² por ocupante", "Dwellings with less than 15 m² per occupant"],
];

const VALIDATION = {
  es: [
    ["Criterio externo — Spearman", "Correlaciones entre el IP2021 y variables de renta externas al modelo: ρ = −0,926 con el precio de compraventa de vivienda y ρ = −0,914 con la renta bruta per cápita."],
    ["Coherencia interna — Random Forest", "El CP1 se reconstruye mediante Random Forest a partir de las 9 variables; un R² elevado confirma que el índice es una síntesis coherente de ellas."],
    ["Estabilidad estructural — Bootstrap PCA", "Remuestreo con reemplazo (B = 100) de las cargas factoriales; intervalos estrechos que no cruzan el cero indican robustez."],
    ["Consistencia territorial — DEGURBA", "Modelos factoriales por grado de urbanización (urbano, intermedio, rural) correlacionados con el índice nacional para verificar la invarianza del constructo."],
  ],
  en: [
    ["External criterion — Spearman", "Correlations between IP2021 and income indicators external to the model: ρ = −0.926 with housing sale price and ρ = −0.914 with gross income per capita."],
    ["Internal coherence — Random Forest", "PC1 is reconstructed by Random Forest from the 9 variables; a high R² confirms the index is a coherent synthesis of them."],
    ["Structural stability — Bootstrap PCA", "Resampling with replacement (B = 100) of the loadings; narrow intervals that do not cross zero indicate robustness."],
    ["Territorial consistency — DEGURBA", "Factor models by degree of urbanisation (urban, intermediate, rural) correlated with the national index to check construct invariance."],
  ],
};

const TEXT = {
  es: {
    title: "Sobre el Índice de Privación",
    tabs: { index: "Índice", validation: "Validación", geometry: "Geometrías 2011 / 2021", atlas: "Atlas y cita" },
    intro: "El índice es el primer componente principal (CP1) de un análisis de componentes principales sobre indicadores socioeconómicos estandarizados a nivel de sección censal. Partiendo de 18 indicadores censales, el modelo final retiene 9 variables (KMO = 0,816). El CP1 explica el 47,3 % de la varianza. Valores más altos indican mayor privación.",
    compare: "Los índices de 2011 y 2021 se calcularon de forma independiente, con metodologías similares pero insumos distintos: sus valores absolutos no son directamente comparables. Por eso el visor los representa en quintiles, calculados por separado para cada año sobre todas sus secciones.",
    varsTitle: "Variables del modelo 2021 (correlación con el CP1)",
    risk: "Factor de riesgo (ρ > 0)", protective: "Factor protector (ρ < 0)",
    geomIntro: "Las secciones censales cambian de trazado entre censos: se dividen, se fusionan o se redibujan sus límites. Por eso cada año se muestra sobre su propia geometría oficial del INE, y el índice de cada año se asocia solo a las secciones de ese año.",
    geomHow: "Para comparar entre años, el visor cruza las dos geometrías y calcula qué parte de cada sección de un año se superpone con cada sección del otro. Una sección se considera «la misma» en ambos años solo si tiene el mismo código y sus polígonos coinciden al menos en un 95 %.",
    geomStats: s => [
      ["Secciones en 2021", s.sections_2021],
      ["Secciones en 2011", s.sections_2011],
      ["Mismo código y mismo trazado", s.stable],
      ["Mismo código pero trazado distinto", s.same_code_redrawn],
      ["Solo existen en 2021", s.only_2021],
      ["Solo existen en 2011", s.only_2011],
    ],
    geomUse: "El gráfico 2011 ↔ 2021 y el filtro «mismo trazado» usan solo las secciones comparables. Para las demás, la ficha muestra a qué secciones del otro año corresponde y en qué proporción.",
    geomPrecision: "La geometría es la original del INE, sin simplificar: en el máximo nivel de detalle el error de representación es inferior a medio metro.",
    atlasTitle: "Atlas cartográfico",
    atlasText: "El atlas estático incluye mapas a escala nacional, provincial, de ciudades, conurbaciones y áreas urbanas funcionales. Se publicará en Zenodo con DOI permanente.",
    cite: "Citar", copyBib: "Copiar BibTeX", copied: "Copiado", doiPending: "[DOI pendiente]",
    dict: "Diccionario de variables", natMap: "Mapa nacional del IP 2021", varMaps: "Mapas nacionales de las variables",
  },
  en: {
    title: "About the Deprivation Index",
    tabs: { index: "Index", validation: "Validation", geometry: "2011 / 2021 geometries", atlas: "Atlas & citation" },
    intro: "The index is the first principal component (PC1) of a principal component analysis of standardised socioeconomic indicators at census tract level. Starting from 18 census indicators, the final model keeps 9 variables (KMO = 0.816). PC1 explains 47.3% of the variance. Higher values mean more deprivation.",
    compare: "The 2011 and 2021 indices were computed independently, with similar methods but different inputs: their absolute values are not directly comparable. The viewer therefore shows them as quintiles, computed separately for each year over all its tracts.",
    varsTitle: "2021 model variables (correlation with PC1)",
    risk: "Risk factor (ρ > 0)", protective: "Protective factor (ρ < 0)",
    geomIntro: "Census tracts change between censuses: they are split, merged or redrawn. Each year is therefore shown on its own official INE geometry, and each year's index is attached only to that year's tracts.",
    geomHow: "To compare years, the viewer overlays both geometries and computes how much of each tract of one year overlaps each tract of the other. A tract counts as \"the same\" in both years only if it has the same code and its polygons match by at least 95%.",
    geomStats: s => [
      ["Tracts in 2021", s.sections_2021],
      ["Tracts in 2011", s.sections_2011],
      ["Same code, same boundaries", s.stable],
      ["Same code, different boundaries", s.same_code_redrawn],
      ["Only in 2021", s.only_2021],
      ["Only in 2011", s.only_2011],
    ],
    geomUse: "The 2011 ↔ 2021 chart and the \"same boundaries\" filter use only comparable tracts. For the others, the details panel shows which tracts of the other year they correspond to, and by how much.",
    geomPrecision: "Geometry is INE's original, not simplified: at the deepest zoom the drawing error is below half a metre.",
    atlasTitle: "Cartographic atlas",
    atlasText: "The static atlas includes national, provincial, city, conurbation and functional urban area maps. It will be published on Zenodo with a permanent DOI.",
    cite: "Cite", copyBib: "Copy BibTeX", copied: "Copied", doiPending: "[DOI pending]",
    dict: "Variable dictionary", natMap: "National map of IP 2021", varMaps: "National maps of the variables",
  },
};

function citation(lang) {
  const title = CITATION.title[lang];
  const doi = CITATION.doi ? `https://doi.org/${CITATION.doi}` : TEXT[lang].doiPending;
  const apa = `${CITATION.authors} (${CITATION.year}). ${title}. ${CITATION.publisher}. ${doi}`;
  const bib = `@misc{atlasPrivacionEspana${CITATION.year},
  author    = {${CITATION.authors}},
  title     = {${title}},
  year      = {${CITATION.year}},
  publisher = {${CITATION.publisher}},${CITATION.doi ? `\n  doi       = {${CITATION.doi}},` : ""}
}`;
  return { apa, bib };
}

export default function AboutModal({ open, onClose }) {
  const { state } = useApp();
  const lang = state.lang;
  const X = TEXT[lang];
  const [tab, setTab] = useState("index");
  const [meta, setMeta] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const key = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    if (!meta) fetch("data/ct/meta.json").then(r => r.json()).then(setMeta).catch(() => {});
    return () => window.removeEventListener("keydown", key);
  }, [open]);

  if (!open) return null;
  const cit = citation(lang);

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={X.title}>
        <header className="modal-head">
          <h2>{X.title}</h2>
          <button className="close" onClick={onClose}>✕</button>
        </header>
        <nav className="modal-tabs">
          {Object.entries(X.tabs).map(([id, label]) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
        <div className="modal-body">
          {tab === "index" && (
            <>
              <p>{X.intro}</p>
              <p>{X.compare}</p>
              <h3>{X.varsTitle}</h3>
              <div className="pca-legend">
                <span><i style={{ background: "#2563eb" }} />{X.risk}</span>
                <span><i style={{ background: "#d97706" }} />{X.protective}</span>
              </div>
              <table className="pca">
                <tbody>
                  {PCA_VARS.map(([code, rho, w, les, len]) => (
                    <tr key={code}>
                      <td><code>{code}</code><div>{lang === "es" ? les : len}</div></td>
                      <td className="pca-bar">
                        <span style={{ width: (Math.abs(rho) / 0.9) * 100 + "%", background: rho > 0 ? "#2563eb" : "#d97706" }} />
                      </td>
                      <td className="num">ρ {rho > 0 ? "+" : ""}{rho.toFixed(3)}<div className="muted">w {w.toFixed(3)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="figs">
                <figure><a href={ATLAS_NATIONAL_DIR + "p001_Nacional_Diccionario.png"} target="_blank" rel="noopener noreferrer"><img src={ATLAS_NATIONAL_DIR + "p001_Nacional_Diccionario.png"} alt={X.dict} /></a><figcaption>{X.dict}</figcaption></figure>
                <figure><a href={ATLAS_NATIONAL_DIR + "p002_Nacional_Indice_IP2021.png"} target="_blank" rel="noopener noreferrer"><img src={ATLAS_NATIONAL_DIR + "p002_Nacional_Indice_IP2021.png"} alt={X.natMap} /></a><figcaption>{X.natMap}</figcaption></figure>
                <figure><a href={ATLAS_NATIONAL_DIR + "p003_Nacional_Variables_Matriz.png"} target="_blank" rel="noopener noreferrer"><img src={ATLAS_NATIONAL_DIR + "p003_Nacional_Variables_Matriz.png"} alt={X.varMaps} /></a><figcaption>{X.varMaps}</figcaption></figure>
              </div>
            </>
          )}
          {tab === "validation" && VALIDATION[lang].map(([h, p]) => (
            <div key={h} className="val"><h3>{h}</h3><p>{p}</p></div>
          ))}
          {tab === "geometry" && (
            <>
              <p>{X.geomIntro}</p>
              <p>{X.geomHow}</p>
              {meta?.link && (
                <table className="kv-table">
                  <tbody>
                    {X.geomStats(meta.link).map(([k, v]) => (
                      <tr key={k}><td>{k}</td><td className="num">{fmtInt(lang, v)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p>{X.geomUse}</p>
              <p className="muted">{X.geomPrecision}</p>
            </>
          )}
          {tab === "atlas" && (
            <>
              <h3>{X.atlasTitle}</h3>
              <p>{X.atlasText}</p>
              <h3>{X.cite}</h3>
              <pre className="cite">{cit.apa}</pre>
              <button className="btn small" onClick={() => copyText(cit.bib).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
                {copied ? "✓ " + X.copied : "⧉ " + X.copyBib}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
