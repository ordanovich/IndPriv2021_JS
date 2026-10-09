import React, { useState } from "react";
import { useApp } from "../state";
import { copyText } from "./ui";

export default function Header({ onAbout }) {
  const { state, set, t } = useApp();
  const [shared, setShared] = useState(false);

  const share = () => {
    copyText(window.location.href).then(() => {
      setShared(true);
      setTimeout(() => setShared(false), 1600);
    });
  };

  return (
    <header className="app-header">
      <div className="brand">
        <img src="images/logo.jpg" alt="" className="brand-logo" onError={e => { e.currentTarget.style.display = "none"; }} />
        <div>
          <h1>{t.appTitle}</h1>
          <p>{t.appSubtitle}</p>
        </div>
      </div>
      <nav className="header-actions">
        <button className="hbtn" onClick={onAbout}>ⓘ {t.about}</button>
        <button className="hbtn" onClick={share}>{shared ? "✓ " + t.shareDone : "🔗 " + t.share}</button>
        <button className={"hbtn icon" + (state.colorblind ? " on" : "")} title={t.colorblind}
                aria-pressed={state.colorblind} onClick={() => set({ colorblind: !state.colorblind })}>◑</button>
        <button className="hbtn lang" title={t.langSwitchTitle}
                onClick={() => set({ lang: state.lang === "es" ? "en" : "es" })}>
          <span className={state.lang === "es" ? "on" : ""}>ES</span>
          <span className={state.lang === "en" ? "on" : ""}>EN</span>
        </button>
      </nav>
    </header>
  );
}
