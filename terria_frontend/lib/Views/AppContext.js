import React, { createContext, useContext, useState, useCallback } from "react";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [lang,      setLang]      = useState("es"); // "es" | "en"
  const [colorblind, setColorblind] = useState(false);

  const toggleLang      = useCallback(() => setLang(l => l === "es" ? "en" : "es"), []);
  const toggleColorblind = useCallback(() => setColorblind(c => !c), []);

  return (
    <AppContext.Provider value={{ lang, setLang, toggleLang, colorblind, toggleColorblind }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
