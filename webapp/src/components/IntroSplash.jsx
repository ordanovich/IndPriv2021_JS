// Full-screen opening of the animated version (default; ?intro=0 = calm version, see map/intro.js):
// drifting quintile colours, logo, title word by word, subtitle, the colour
// bars and a counter of the tracts. "leaving": it opens from the centre
// (styles.css: "Animated version").
import React, { useEffect, useState } from "react";
import { useApp } from "../state";
import { fmtInt } from "../i18n";

// Counts from 0 to `target` (ease-out), starting after `delay` ms
function useCountUp(target, delay, ms = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) return;
    let raf;
    const t0 = performance.now() + delay;
    const tick = now => {
      const p = Math.min(1, Math.max(0, (now - t0) / ms));
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

export default function IntroSplash({ leaving }) {
  const { state, table, t } = useApp();
  const n = useCountUp(table?.n ?? 0, 1300);
  const words = t.appTitle.split(" ");
  return (
    <div className={"intro-splash" + (leaving ? " leaving" : "")} role="status" aria-live="polite" aria-label={t.loadingMap}>
      <div className="intro-aurora" aria-hidden="true"><i /><i /><i /></div>
      <div className="intro-content">
        <img className="intro-logo" src="images/logo_see.png" alt="Sociedad Española de Epidemiología" />
        <h1 className="intro-title">
          {words.map((w, i) => (
            <span key={i} style={{ animationDelay: `${0.45 + i * 0.09}s` }}>{w}{i < words.length - 1 ? " " : ""}</span>
          ))}
        </h1>
        <p className="intro-sub">{t.appSubtitle}</p>
        <span className="loader-bars intro-bars" aria-hidden="true"><b /><b /><b /><b /><b /></span>
        <p className="intro-count">{table ? t.introUnits(fmtInt(state.lang, n)) : " "}</p>
      </div>
    </div>
  );
}
