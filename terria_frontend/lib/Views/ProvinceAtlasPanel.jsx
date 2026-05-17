import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { autorun } from "mobx";
import { useApp } from "./AppContext";
import { TR } from "./translations";
import { getCachedData, onDataReady } from "./geoDataStore";
import { STD_COLORS, CB_COLORS } from "./UserInterface";

// CPRO (zero-padded 2-digit code) → { continuo, discreto } PNG filenames
const PROVINCE_IMAGES = {
  "01": { name: "Araba / Álava",       continuo: "p003_Provincia_01_Araba_Alava_continuo.png",                discreto: "p004_Provincia_01_Araba_Alava_discreto.png" },
  "02": { name: "Albacete",            continuo: "p005_Provincia_02_Albacete_continuo.png",                   discreto: "p006_Provincia_02_Albacete_discreto.png" },
  "03": { name: "Alicante",            continuo: "p007_Provincia_03_Alicante_continuo.png",                   discreto: "p008_Provincia_03_Alicante_discreto.png" },
  "04": { name: "Almería",             continuo: "p009_Provincia_04_Almeria_continuo.png",                    discreto: "p010_Provincia_04_Almeria_discreto.png" },
  "05": { name: "Ávila",               continuo: "p011_Provincia_05_Avila_continuo.png",                      discreto: "p012_Provincia_05_Avila_discreto.png" },
  "06": { name: "Badajoz",             continuo: "p013_Provincia_06_Badajoz_continuo.png",                    discreto: "p014_Provincia_06_Badajoz_discreto.png" },
  "07": { name: "Illes Balears",       continuo: "p015_Provincia_07_Balears_Illes_continuo.png",              discreto: "p016_Provincia_07_Balears_Illes_discreto.png" },
  "08": { name: "Barcelona",           continuo: "p017_Provincia_08_Barcelona_continuo.png",                  discreto: "p018_Provincia_08_Barcelona_discreto.png" },
  "09": { name: "Burgos",              continuo: "p019_Provincia_09_Burgos_continuo.png",                     discreto: "p020_Provincia_09_Burgos_discreto.png" },
  "10": { name: "Cáceres",             continuo: "p021_Provincia_10_Caceres_continuo.png",                    discreto: "p022_Provincia_10_Caceres_discreto.png" },
  "11": { name: "Cádiz",               continuo: "p023_Provincia_11_Cadiz_continuo.png",                      discreto: "p024_Provincia_11_Cadiz_discreto.png" },
  "12": { name: "Castellón",           continuo: "p025_Provincia_12_Castellon_Castello_continuo.png",         discreto: "p026_Provincia_12_Castellon_Castello_discreto.png" },
  "13": { name: "Ciudad Real",         continuo: "p027_Provincia_13_Ciudad_Real_continuo.png",                discreto: "p028_Provincia_13_Ciudad_Real_discreto.png" },
  "14": { name: "Córdoba",             continuo: "p029_Provincia_14_Cordoba_continuo.png",                    discreto: "p030_Provincia_14_Cordoba_discreto.png" },
  "15": { name: "A Coruña",            continuo: "p031_Provincia_15_Coruna_A_continuo.png",                   discreto: "p032_Provincia_15_Coruna_A_discreto.png" },
  "16": { name: "Cuenca",              continuo: "p033_Provincia_16_Cuenca_continuo.png",                     discreto: "p034_Provincia_16_Cuenca_discreto.png" },
  "17": { name: "Girona",              continuo: "p035_Provincia_17_Girona_continuo.png",                     discreto: "p036_Provincia_17_Girona_discreto.png" },
  "18": { name: "Granada",             continuo: "p037_Provincia_18_Granada_continuo.png",                    discreto: "p038_Provincia_18_Granada_discreto.png" },
  "19": { name: "Guadalajara",         continuo: "p039_Provincia_19_Guadalajara_continuo.png",                discreto: "p040_Provincia_19_Guadalajara_discreto.png" },
  "20": { name: "Gipuzkoa",            continuo: "p041_Provincia_20_Gipuzkoa_continuo.png",                   discreto: "p042_Provincia_20_Gipuzkoa_discreto.png" },
  "21": { name: "Huelva",              continuo: "p043_Provincia_21_Huelva_continuo.png",                     discreto: "p044_Provincia_21_Huelva_discreto.png" },
  "22": { name: "Huesca",              continuo: "p045_Provincia_22_Huesca_continuo.png",                     discreto: "p046_Provincia_22_Huesca_discreto.png" },
  "23": { name: "Jaén",                continuo: "p047_Provincia_23_Jaen_continuo.png",                       discreto: "p048_Provincia_23_Jaen_discreto.png" },
  "24": { name: "León",                continuo: "p049_Provincia_24_Leon_continuo.png",                       discreto: "p050_Provincia_24_Leon_discreto.png" },
  "25": { name: "Lleida",              continuo: "p051_Provincia_25_Lleida_continuo.png",                     discreto: "p052_Provincia_25_Lleida_discreto.png" },
  "26": { name: "La Rioja",            continuo: "p053_Provincia_26_Rioja_La_continuo.png",                   discreto: "p054_Provincia_26_Rioja_La_discreto.png" },
  "27": { name: "Lugo",                continuo: "p055_Provincia_27_Lugo_continuo.png",                       discreto: "p056_Provincia_27_Lugo_discreto.png" },
  "28": { name: "Madrid",              continuo: "p057_Provincia_28_Madrid_continuo.png",                     discreto: "p058_Provincia_28_Madrid_discreto.png" },
  "29": { name: "Málaga",              continuo: "p059_Provincia_29_Malaga_continuo.png",                     discreto: "p060_Provincia_29_Malaga_discreto.png" },
  "30": { name: "Murcia",              continuo: "p061_Provincia_30_Murcia_continuo.png",                     discreto: "p062_Provincia_30_Murcia_discreto.png" },
  "31": { name: "Navarra",             continuo: "p063_Provincia_31_Navarra_continuo.png",                    discreto: "p064_Provincia_31_Navarra_discreto.png" },
  "32": { name: "Ourense",             continuo: "p065_Provincia_32_Ourense_continuo.png",                    discreto: "p066_Provincia_32_Ourense_discreto.png" },
  "33": { name: "Asturias",            continuo: "p067_Provincia_33_Asturias_continuo.png",                   discreto: "p068_Provincia_33_Asturias_discreto.png" },
  "34": { name: "Palencia",            continuo: "p069_Provincia_34_Palencia_continuo.png",                   discreto: "p070_Provincia_34_Palencia_discreto.png" },
  "35": { name: "Las Palmas",          continuo: "p071_Provincia_35_Palmas_Las_continuo.png",                 discreto: "p072_Provincia_35_Palmas_Las_discreto.png" },
  "36": { name: "Pontevedra",          continuo: "p073_Provincia_36_Pontevedra_continuo.png",                 discreto: "p074_Provincia_36_Pontevedra_discreto.png" },
  "37": { name: "Salamanca",           continuo: "p075_Provincia_37_Salamanca_continuo.png",                  discreto: "p076_Provincia_37_Salamanca_discreto.png" },
  "38": { name: "S.C. de Tenerife",    continuo: "p077_Provincia_38_Santa_Cruz_de_Tenerife_continuo.png",    discreto: "p078_Provincia_38_Santa_Cruz_de_Tenerife_discreto.png" },
  "39": { name: "Cantabria",           continuo: "p079_Provincia_39_Cantabria_continuo.png",                  discreto: "p080_Provincia_39_Cantabria_discreto.png" },
  "40": { name: "Segovia",             continuo: "p081_Provincia_40_Segovia_continuo.png",                    discreto: "p082_Provincia_40_Segovia_discreto.png" },
  "41": { name: "Sevilla",             continuo: "p083_Provincia_41_Sevilla_continuo.png",                    discreto: "p084_Provincia_41_Sevilla_discreto.png" },
  "42": { name: "Soria",               continuo: "p085_Provincia_42_Soria_continuo.png",                      discreto: "p086_Provincia_42_Soria_discreto.png" },
  "43": { name: "Tarragona",           continuo: "p087_Provincia_43_Tarragona_continuo.png",                  discreto: "p088_Provincia_43_Tarragona_discreto.png" },
  "44": { name: "Teruel",              continuo: "p089_Provincia_44_Teruel_continuo.png",                     discreto: "p090_Provincia_44_Teruel_discreto.png" },
  "45": { name: "Toledo",              continuo: "p091_Provincia_45_Toledo_continuo.png",                     discreto: "p092_Provincia_45_Toledo_discreto.png" },
  "46": { name: "Valencia",            continuo: "p093_Provincia_46_Valencia_Valencia_continuo.png",          discreto: "p094_Provincia_46_Valencia_Valencia_discreto.png" },
  "47": { name: "Valladolid",          continuo: "p095_Provincia_47_Valladolid_continuo.png",                 discreto: "p096_Provincia_47_Valladolid_discreto.png" },
  "48": { name: "Bizkaia",             continuo: "p097_Provincia_48_Bizkaia_continuo.png",                    discreto: "p098_Provincia_48_Bizkaia_discreto.png" },
  "49": { name: "Zamora",              continuo: "p099_Provincia_49_Zamora_continuo.png",                     discreto: "p100_Provincia_49_Zamora_discreto.png" },
  "50": { name: "Zaragoza",            continuo: "p101_Provincia_50_Zaragoza_continuo.png",                   discreto: "p102_Provincia_50_Zaragoza_discreto.png" },
  "51": { name: "Ceuta",               continuo: "p103_Provincia_51_Ceuta_continuo.png",                      discreto: "p104_Provincia_51_Ceuta_discreto.png" },
  "52": { name: "Melilla",             continuo: "p105_Provincia_52_Melilla_continuo.png",                    discreto: "p106_Provincia_52_Melilla_discreto.png" },
};

// Safely extract a raw values object from a TerriaJS feature's PropertyBag.
// TerriaJS stores feature properties as a Cesium PropertyBag; calling .getValue()
// on the bag returns a plain JS object with all property values.
function getProps(properties) {
  if (!properties) return {};
  if (typeof properties.getValue === "function") {
    try { return properties.getValue(new Date()) ?? {}; } catch { /* fall through */ }
  }
  return properties;
}

// CPRO codes sorted alphabetically by display name — used for prev/next nav.
const SORTED_CPROS = Object.entries(PROVINCE_IMAGES)
  .sort((a, b) => a[1].name.localeCompare(b[1].name, "es"))
  .map(([code]) => code);

function computeProvinceStats(geo, cpro) {
  if (!geo?.features) return null;
  const counts = [0, 0, 0, 0, 0];
  let total = 0;
  let sum = 0;
  let n = 0;
  for (const f of geo.features) {
    const cusec = f.properties?.CUSEC;
    if (!cusec || String(cusec).slice(0, 2) !== cpro) continue;
    total++;
    const q = f.properties.Q21_num;
    if (q >= 1 && q <= 5) counts[q - 1]++;
    const ip = f.properties.IP2021;
    if (ip != null && isFinite(ip)) { sum += ip; n++; }
  }
  if (total === 0) return null;
  return { total, mean: n > 0 ? sum / n : null, counts };
}

export default function ProvinceAtlasPanel({ terria }) {
  const { lang, colorblind } = useApp();
  const tr = TR[lang];
  const COLORS = colorblind ? CB_COLORS : STD_COLORS;

  const [cpro,   setCpro]   = useState(null);
  const [mode,   setMode]   = useState("continuo"); // "continuo" | "discreto"
  const [closed, setClosed] = useState(false);
  const [stats,  setStats]  = useState(null);

  const statsCacheRef = useRef(new Map());

  // Watch terria.selectedFeature — reset close state and derive CPRO
  useEffect(() => {
    const dispose = autorun(() => {
      const feat = terria.selectedFeature;
      if (!feat) return;
      setClosed(false);
      const props = getProps(feat.properties);
      const cusec = props?.CUSEC;
      if (cusec && String(cusec).length >= 2) {
        setCpro(String(cusec).slice(0, 2));
      } else {
        setCpro(null);
      }
    });
    return dispose;
  }, [terria]);

  // Compute (or look up cached) per-province aggregate stats whenever the
  // active CPRO changes. Also recompute once on first data-ready event in
  // case the panel is open before the GeoJSON finishes loading.
  useEffect(() => {
    if (!cpro) { setStats(null); return; }
    const compute = (geo) => {
      if (!geo) { setStats(null); return; }
      const cache = statsCacheRef.current;
      if (!cache.has(cpro)) cache.set(cpro, computeProvinceStats(geo, cpro));
      setStats(cache.get(cpro));
    };
    const cached = getCachedData();
    if (cached) compute(cached);
    return onDataReady(compute);
  }, [cpro]);

  const entry = cpro ? PROVINCE_IMAGES[cpro] : null;
  if (!entry || closed) return null;

  const imgSrc = `atlas/provinces/${entry[mode]}`;

  const goPrev = () => {
    const idx = SORTED_CPROS.indexOf(cpro);
    if (idx < 0) return;
    setCpro(SORTED_CPROS[(idx - 1 + SORTED_CPROS.length) % SORTED_CPROS.length]);
  };
  const goNext = () => {
    const idx = SORTED_CPROS.indexOf(cpro);
    if (idx < 0) return;
    setCpro(SORTED_CPROS[(idx + 1) % SORTED_CPROS.length]);
  };

  const localeFmt = lang === "es" ? "es-ES" : "en-GB";
  const fmtInt = v => v.toLocaleString(localeFmt);
  const fmt2 = v => v.toFixed(2);

  return (
    <div style={{
      position:       "fixed",
      bottom:         72,
      left:           16,
      zIndex:         950,
      width:          300,
      background:     "#ffffff",
      borderRadius:   10,
      boxShadow:      "0 4px 20px rgba(0,0,0,0.14)",
      border:         "1px solid #e5e7eb",
      fontFamily:     "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      overflow:       "hidden",
    }}>
      {/* Header */}
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        padding:        "9px 12px",
        background:     "#f3f4f6",
        borderBottom:   "1px solid #e5e7eb",
        gap:            6,
      }}>
        <button
          onClick={goPrev}
          title={tr.provPrev}
          style={{
            background: "none", border: "1px solid #d1d5db",
            borderRadius: 4, color: "#374151",
            fontSize: 14, lineHeight: 1, cursor: "pointer",
            padding: "4px 8px", flexShrink: 0,
          }}
        >
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: "#6b7280", display: "block" }}>
            {tr.provPanelTitle}
          </span>
          <span style={{
            fontSize: 13, fontWeight: 700, color: "#111827",
            display: "block",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {entry.name}
          </span>
        </div>
        <button
          onClick={goNext}
          title={tr.provNext}
          style={{
            background: "none", border: "1px solid #d1d5db",
            borderRadius: 4, color: "#374151",
            fontSize: 14, lineHeight: 1, cursor: "pointer",
            padding: "4px 8px", flexShrink: 0,
          }}
        >
          →
        </button>
        <button
          onClick={() => setClosed(true)}
          style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px", flexShrink: 0 }}
        >
          {tr.provClose}
        </button>
      </div>

      {/* Mode toggle */}
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
        {["continuo", "discreto"].map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex:       1,
              padding:    "6px 0",
              fontSize:   11,
              fontWeight: mode === m ? 700 : 400,
              color:      mode === m ? "#2563eb" : "#6b7280",
              background: mode === m ? "#eff6ff" : "transparent",
              border:     "none",
              borderBottom: mode === m ? "2px solid #2563eb" : "2px solid transparent",
              cursor:     "pointer",
              transition: "all 0.15s",
            }}
          >
            {m === "continuo" ? tr.provContinuo : tr.provDiscreto}
          </button>
        ))}
      </div>

      {/* Map image */}
      <div style={{ padding: 0, lineHeight: 0 }}>
        <img
          src={imgSrc}
          alt={`${entry.name} – ${mode}`}
          style={{ width: "100%", display: "block" }}
          onError={e => { e.target.style.display = "none"; }}
        />
      </div>

      {/* Download button */}
      <div style={{ padding: "8px 12px 4px", borderTop: "1px solid #f3f4f6" }}>
        <a
          href={imgSrc}
          download={entry[mode]}
          style={{
            display:        "block",
            textAlign:      "center",
            padding:        "6px 10px",
            borderRadius:   6,
            border:         "1px solid #d1d5db",
            background:     "#ffffff",
            color:          "#374151",
            fontSize:       11, fontWeight: 600,
            textDecoration: "none",
            transition:     "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#ffffff"; }}
        >
          {tr.provDownload}
        </a>
      </div>

      {/* Aggregate stats */}
      {stats && (
        <div style={{ padding: "6px 12px 12px" }}>
          <div style={{
            display: "flex", gap: 8, marginBottom: 8,
          }}>
            <div style={{
              flex: 1,
              background: "#f9fafb", border: "1px solid #e5e7eb",
              borderRadius: 6, padding: "6px 8px",
              textAlign: "center",
            }}>
              <div style={{
                fontSize: 9, color: "#6b7280",
                textTransform: "uppercase", letterSpacing: "0.5px",
                marginBottom: 2,
              }}>
                {tr.provStatsSections}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", lineHeight: 1.1 }}>
                {fmtInt(stats.total)}
              </div>
            </div>
            <div style={{
              flex: 1,
              background: "#f9fafb", border: "1px solid #e5e7eb",
              borderRadius: 6, padding: "6px 8px",
              textAlign: "center",
            }}>
              <div style={{
                fontSize: 9, color: "#6b7280",
                textTransform: "uppercase", letterSpacing: "0.5px",
                marginBottom: 2,
              }}>
                {tr.provStatsMean}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", lineHeight: 1.1 }}>
                {stats.mean != null ? fmt2(stats.mean) : "—"}
              </div>
            </div>
          </div>

          <div style={{
            fontSize: 9, color: "#6b7280",
            textTransform: "uppercase", letterSpacing: "0.5px",
            marginBottom: 4,
          }}>
            {tr.provStatsQuintileBar}
          </div>
          <div style={{
            display: "flex", height: 8, borderRadius: 4,
            overflow: "hidden", gap: 1,
          }}>
            {stats.counts.map((c, i) => (
              <div key={i}
                title={`${tr.legendItems[i]} · ${fmtInt(c)}`}
                style={{
                  flex: Math.max(c, 0.001),
                  background: COLORS[i],
                  minWidth: c > 0 ? 2 : 0,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

ProvinceAtlasPanel.propTypes = {
  terria: PropTypes.object.isRequired,
};
