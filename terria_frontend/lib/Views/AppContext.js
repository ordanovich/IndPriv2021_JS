import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const AppContext = createContext(null);

export const LANG_STORAGE_KEY = "atlas.lang";

export function readPersistedLang() {
  if (typeof window === "undefined") return "es";
  try {
    const stored = window.localStorage?.getItem(LANG_STORAGE_KEY);
    if (stored === "es" || stored === "en") return stored;
  } catch (_) { /* localStorage may be disabled */ }
  return "es";
}

export function AppProvider({ children, initialLang }) {
  const [lang,      setLang]      = useState(() =>
    initialLang === "es" || initialLang === "en" ? initialLang : readPersistedLang()
  );
  const [colorblind, setColorblind] = useState(false);

  useEffect(() => {
    try { window.localStorage?.setItem(LANG_STORAGE_KEY, lang); } catch (_) {}
  }, [lang]);

  const toggleLang      = useCallback(() => setLang(l => l === "es" ? "en" : "es"), []);
  const toggleColorblind = useCallback(() => setColorblind(c => !c), []);

  return (
    <AppContext.Provider value={{ lang, setLang, toggleLang, colorblind, toggleColorblind }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
