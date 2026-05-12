import { autorun } from "mobx";
import React, { useState, useEffect } from "react";
import { onDataReady, ensureDataLoaded } from "./geoDataStore";

interface LoaderProps {
  overlay?: boolean;
  terria?: any;
}

export const Loader: React.FC<LoaderProps> = ({ overlay = false, terria }) => {
  const [gone,   setGone]   = useState(false);
  const [fading, setFading] = useState(false);

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
