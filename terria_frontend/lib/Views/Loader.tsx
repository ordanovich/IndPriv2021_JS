import { autorun } from "mobx";
import React, { useState, useEffect } from "react";
import { onDataReady, ensureDataLoaded } from "./geoDataStore";

const Q_COLORS = ["#1a9850", "#91cf60", "#ffffbf", "#fc8d59", "#d73027"];

const FACTS = [
  "Construido a partir del primer componente principal (CP1) de un ACP sobre 9 indicadores socioeconómicos estandarizados a nivel de sección censal.",
  "El CP1 captura la dimensión principal de privación y explica el 47,3 % de la varianza total del modelo final (KMO = 0,816).",
  "Las secciones se clasifican en 5 quintiles — cada uno con aproximadamente el 20 % del total de secciones.",
  "Los índices de 2011 y 2021 se calcularon de forma independiente; su comparación se realiza mediante quintiles para facilitar la lectura territorial.",
];

interface LoaderProps {
  overlay?: boolean;
  terria?: any;
}

export const Loader: React.FC<LoaderProps> = ({ overlay = false, terria }) => {
  const [gone,    setGone]    = useState(false);
  const [fading,  setFading]  = useState(false);
  const [factIdx, setFactIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setFactIdx(i => (i + 1) % FACTS.length), 4200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!overlay) return;

    ensureDataLoaded();

    let dataReady = false;
    let mapReady  = !terria;  // skip map-ready check when terria isn't provided
    let dismissed = false;

    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      setTimeout(() => {
        setFading(true);
        setTimeout(() => setGone(true), 650);
      }, 500);
    };

    const tryDismiss = () => {
      if (dataReady && mapReady) dismiss();
    };

    // Our GeoJSON cache is ready
    const unsubData = onDataReady(() => {
      dataReady = true;
      tryDismiss();
    });

    // TerriaJS items have finished loading (tiles visible)
    let disposeMap: (() => void) | undefined;
    if (terria) {
      disposeMap = autorun(() => {
        const items: any[] = terria.workbench?.items ?? [];
        if (items.length > 0 && items.every((item: any) => !item.isLoading)) {
          mapReady = true;
          tryDismiss();
        }
      });
    }

    // Safety valve: never block more than 25 s
    const fallback = setTimeout(dismiss, 25_000);

    return () => {
      unsubData();
      disposeMap?.();
      clearTimeout(fallback);
    };
  }, [overlay, terria]);

  if (overlay && gone) return null;

  return (
    <>
      <style>{`
        @keyframes _atlasRing {
          to { transform: rotate(360deg); }
        }
        @keyframes _atlasBar {
          0%   { left: -45%; width: 45%; }
          60%  { left: 40%; width: 55%; }
          100% { left: 110%; width: 45%; }
        }
        @keyframes _atlasFade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Full-screen white overlay */}
      <div style={{
        position:       "fixed",
        inset:          0,
        zIndex:         99999,
        background:     "#ffffff",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        fontFamily:     "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        opacity:        fading ? 0 : 1,
        transition:     "opacity 0.65s ease",
        pointerEvents:  fading ? "none" : "all",
      }}>
        {/* Logo + title */}
        <div style={{
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          gap:           12,
          animation:     overlay ? "none" : "_atlasFade 0.5s ease forwards",
        }}>
          <img
            src="images/logo.jpg"
            alt="Logo institucional"
            style={{ height: 72, width: "auto", objectFit: "contain" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <span style={{
            fontSize:      16,
            fontWeight:    600,
            color:         "#111827",
            letterSpacing: "0.2px",
          }}>
            Atlas de Privación de España
          </span>
        </div>

        {/* Spinner */}
        <div style={{ marginTop: 32 }}>
          <div style={{
            width:          40,
            height:         40,
            borderRadius:   "50%",
            border:         "3px solid #e5e7eb",
            borderTopColor: "#2563eb",
            animation:      "_atlasRing 0.85s linear infinite",
          }} />
        </div>

        <p style={{
          marginTop:     14,
          fontSize:      11,
          color:         "#9ca3af",
          letterSpacing: "0.8px",
          textTransform: "uppercase",
        }}>
          Cargando…
        </p>

        {/* ── Info panel ──────────────────────────────────────────────── */}
        <div style={{
          marginTop:     30,
          width:         300,
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
        }}>
          {/* Divider */}
          <div style={{ width: "100%", height: 1,
                        background: "#e5e7eb", marginBottom: 22 }} />

          {/* Quintile colour gradient */}
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", height: 10, borderRadius: 5,
                          overflow: "hidden", gap: 2 }}>
              {Q_COLORS.map((c, i) => (
                <div key={i} style={{
                  flex: 1, background: c,
                  animation: `_atlasFade 0.5s ease ${i * 0.07}s backwards`,
                }} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between",
                          fontSize: 9, color: "#9ca3af", marginTop: 5,
                          letterSpacing: "0.2px" }}>
              <span>← Menor privación</span>
              <span>Mayor privación →</span>
            </div>
          </div>

          {/* Key numbers */}
          <div style={{ display: "flex", justifyContent: "space-around",
                        width: "100%", marginTop: 22 }}>
            {([ ["36.333", "secciones censales"],
                ["9",      "variables del modelo"],
                ["47,3 %", "varianza explicada"],
            ] as [string, string][]).map(([val, lbl], i) => (
              <div key={i} style={{
                textAlign: "center",
                animation: `_atlasFade 0.5s ease ${0.25 + i * 0.13}s backwards`,
              }}>
                <div style={{ fontSize: 19, fontWeight: 700, color: "#1f2937",
                              lineHeight: 1.1 }}>{val}</div>
                <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 3,
                              textTransform: "uppercase",
                              letterSpacing: "0.4px" }}>{lbl}</div>
              </div>
            ))}
          </div>

          {/* Rotating fact */}
          <div style={{ marginTop: 24, minHeight: 54,
                        display: "flex", alignItems: "center",
                        padding: "0 4px" }}>
            <p key={factIdx} style={{
              margin: 0, fontSize: 11, color: "#6b7280",
              lineHeight: 1.65, textAlign: "center",
              animation: "_atlasFade 0.5s ease forwards",
            }}>
              {FACTS[factIdx]}
            </p>
          </div>

          {/* Dot indicators */}
          <div style={{ marginTop: 10, display: "flex", gap: 5 }}>
            {FACTS.map((_, i) => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: "50%",
                background: i === factIdx ? "#2563eb" : "#d1d5db",
                transition: "background 0.35s",
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Indeterminate progress bar */}
      {!fading && (
        <div style={{
          position:   "fixed",
          bottom:     0,
          left:       0,
          right:      0,
          height:     3,
          background: "#e5e7eb",
          overflow:   "hidden",
          zIndex:     100000,
        }}>
          <div style={{
            position:     "absolute",
            height:       "100%",
            background:   "linear-gradient(90deg, #2563eb, #60a5fa)",
            borderRadius: 2,
            animation:    "_atlasBar 1.8s ease-in-out infinite",
          }} />
        </div>
      )}
    </>
  );
};
