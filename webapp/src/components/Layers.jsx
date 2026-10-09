import React from "react";
import { useApp } from "../state";
import { Check, Field, Segmented } from "./ui";

// Index layer settings. Basemap and WMS layers live in the top bar menus
// (components/MapMenus.jsx).
export default function Layers() {
  const { state, set, setBoundaries, mode, t } = useApp();
  const years = Object.keys(mode.years);

  // The selection keeps its original year; App's SelectionCarrier moves it
  // to the overlapping unit of the new year.
  const setYear = year => set({ year });

  return (
    <div className="layers">
      {years.length > 1 && (
        <Field label={t.year}>
          <Segmented value={state.year} onChange={setYear}
                     options={years.map(y => ({ value: y, label: y }))} />
          <Check checked={state.compare} onChange={v => set({ compare: v })}>⇔ {t.compare(years)}</Check>
        </Field>
      )}

      <Field label={`${t.opacity} · ${Math.round(state.opacity * 100)} %`}>
        <input type="range" min="0.2" max="1" step="0.05" value={state.opacity}
               onChange={e => set({ opacity: Number(e.target.value) })} />
      </Field>

      <Field label={t.boundaries}>
        <Check checked={state.boundaries.ccaa} onChange={v => setBoundaries({ ccaa: v })}>{t.bCcaa}</Check>
        <Check checked={state.boundaries.prov} onChange={v => setBoundaries({ prov: v })}>{t.bProv}</Check>
        <Check checked={state.boundaries.mun} onChange={v => setBoundaries({ mun: v })}>{t.bMun}</Check>
      </Field>
    </div>
  );
}
