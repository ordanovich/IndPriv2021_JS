import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { MOBILE_QUERY, useApp } from "./state";
import { loadLink, loadTable, selectRows } from "./data";
import { PALETTES } from "./config";

// Rows of the current table that match the filters and lie in the map view.
// ignoreQuintiles: the legend shows the full quintile distribution even
// while some quintiles are being highlighted.
export function useViewRows({ ignoreQuintiles = false } = {}) {
  const { table, state } = useApp();
  const { filters, view } = state;
  return useMemo(() => {
    if (!table || !view) return [];
    const f = ignoreQuintiles ? { ...filters, quintiles: [] } : filters;
    return selectRows(table, f, view);
  }, [table, filters, view, ignoreQuintiles]);
}

export function useIsMobile() {
  return useSyncExternalStore(
    fn => { const m = window.matchMedia(MOBILE_QUERY); m.addEventListener("change", fn); return () => m.removeEventListener("change", fn); },
    () => window.matchMedia(MOBILE_QUERY).matches,
  );
}

export function useColors() {
  const { state } = useApp();
  return PALETTES[state.colorblind ? "cb" : "std"];
}

// Loads any (mode, year) table, or the cross-year link, on demand.
export function useTable(modeId, year) {
  const [t, setT] = useState(null);
  useEffect(() => {
    let live = true;
    setT(null);
    if (modeId && year) loadTable(modeId, year).then(x => live && setT(x)).catch(() => {});
    return () => { live = false; };
  }, [modeId, year]);
  return t;
}

export function useLink(modeId, enabled = true) {
  const [l, setL] = useState(null);
  useEffect(() => {
    let live = true;
    if (enabled) loadLink(modeId).then(x => live && setL(x)).catch(() => {});
    return () => { live = false; };
  }, [modeId, enabled]);
  return l;
}
