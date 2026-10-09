import React, { useRef, useState } from "react";
import { useApp } from "../state";
import { BASEMAPS, WMS_CATALOG } from "../config";
import { mapBus } from "../map/mapBus";
import { Check, Field, Segmented } from "./ui";

// Minimal GetCapabilities reader: named layers with their titles.
async function wmsLayers(url) {
  const base = url.split("?")[0];
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}SERVICE=WMS&REQUEST=GetCapabilities`);
  if (!res.ok) throw new Error(res.status);
  const xml = new DOMParser().parseFromString(await res.text(), "text/xml");
  const version = xml.documentElement.getAttribute("version") || "1.3.0";
  const out = [];
  for (const l of xml.getElementsByTagName("Layer")) {
    const name = [...l.children].find(c => c.localName === "Name")?.textContent;
    const title = [...l.children].find(c => c.localName === "Title")?.textContent;
    if (name) out.push({ name, title: title || name });
  }
  if (!out.length) throw new Error("no layers");
  return { base, version: version.startsWith("1.1") ? "1.1.1" : "1.3.0", layers: out };
}

function bboxOf(geojson) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const walk = c => {
    if (typeof c[0] === "number") {
      w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]);
    } else c.forEach(walk);
  };
  const feats = geojson.type === "FeatureCollection" ? geojson.features : [geojson];
  feats.forEach(f => f.geometry && walk(f.geometry.coordinates ?? []));
  return w < e ? { west: w, south: s, east: e, north: n } : null;
}

function AddWms() {
  const { state, set, t } = useApp();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [caps, setCaps] = useState(null);
  const [pick, setPick] = useState("");

  const load = async () => {
    setBusy(true); setError(null); setCaps(null);
    try {
      const c = await wmsLayers(url.trim());
      setCaps(c);
      setPick(c.layers[0].name);
    } catch (_) {
      setError(t.wmsError);
    } finally {
      setBusy(false);
    }
  };
  const add = () => {
    const l = caps.layers.find(x => x.name === pick);
    const id = "u" + Date.now().toString(36);
    const entry = { id, url: caps.base, layers: l.name, version: caps.version, name: { es: l.title, en: l.title }, above: true, opacity: 0.9 };
    set({ customWms: [...state.customWms, entry], wms: [...state.wms, id] });
    setCaps(null); setUrl("");
  };

  return (
    <div className="addwms">
      <div className="row">
        <input type="url" placeholder={t.wmsUrl} value={url} onChange={e => setUrl(e.target.value)}
               onKeyDown={e => e.key === "Enter" && url && load()} />
        <button className="btn small" disabled={!url || busy} onClick={load}>{busy ? t.wmsLoading : t.wmsLoad}</button>
      </div>
      {error && <div className="error">{error}</div>}
      {caps && (
        <div className="row">
          <select value={pick} onChange={e => setPick(e.target.value)} aria-label={t.wmsPick}>
            {caps.layers.map(l => <option key={l.name} value={l.name}>{l.title}</option>)}
          </select>
          <button className="btn small primary" onClick={add}>{t.wmsAddLayer}</button>
        </div>
      )}
    </div>
  );
}

export default function Layers() {
  const { state, set, setBoundaries, mode, t } = useApp();
  const lang = state.lang;
  const fileRef = useRef(null);
  const [uploadError, setUploadError] = useState(null);
  const years = Object.keys(mode.years);

  // A layer drawn under the index is invisible at high index opacity, so
  // turning one on makes the index see-through.
  const toggleWms = (id, on) => {
    const w = [...WMS_CATALOG, ...state.customWms].find(x => x.id === id);
    const patch = { wms: on ? [...state.wms, id] : state.wms.filter(x => x !== id) };
    if (on && w && !w.above && state.opacity > 0.5) patch.opacity = 0.5;
    set(patch);
  };
  const removeCustom = id => set({
    customWms: state.customWms.filter(w => w.id !== id),
    wms: state.wms.filter(x => x !== id),
  });

  const onFile = async e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    try {
      const data = JSON.parse(await file.text());
      if (!["FeatureCollection", "Feature"].includes(data.type)) throw new Error("type");
      set({ upload: { name: file.name, data } });
      const b = bboxOf(data);
      if (b) mapBus.fitBox(b);
    } catch (_) {
      setUploadError(t.uploadError);
    }
  };

  // The selection keeps its original year; App's SelectionCarrier moves it
  // to the overlapping unit of the new year.
  const setYear = year => set({ year });

  return (
    <div className="layers">
      {years.length > 1 && (
        <Field label={t.year}>
          <Segmented value={state.year} onChange={setYear}
                     options={years.map(y => ({ value: y, label: y }))} />
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
        <Check checked={state.boundaries.units} onChange={v => setBoundaries({ units: v })}>{t.bUnits}</Check>
      </Field>

      <Field label={t.basemap}>
        <select value={state.basemap} onChange={e => set({ basemap: e.target.value, notice: null })}>
          {BASEMAPS.map(b => <option key={b.id} value={b.id}>{b.name[lang]}</option>)}
        </select>
      </Field>

      <Field label={t.wms}>
        <div className="wms-list">
          {WMS_CATALOG.map(w => (
            <Check key={w.id} checked={state.wms.includes(w.id)} onChange={v => toggleWms(w.id, v)}>
              {w.name[lang]} <small className="muted">{w.group}{w.minzoom ? " · " + t.wmsMinZoom(w.minzoom) : ""}</small>
            </Check>
          ))}
          {state.customWms.length > 0 && <div className="field-label sub">{t.wmsCustom}</div>}
          {state.customWms.map(w => (
            <div key={w.id} className="row">
              <Check checked={state.wms.includes(w.id)} onChange={v => toggleWms(w.id, v)}>{w.name[lang]}</Check>
              <button className="link" onClick={() => removeCustom(w.id)}>{t.wmsRemove}</button>
            </div>
          ))}
        </div>
        <details className="sub-details">
          <summary>{t.wmsAdd}</summary>
          <AddWms />
        </details>
      </Field>

      <Field hint={t.uploadHelp}>
        <input ref={fileRef} type="file" accept=".geojson,.json,application/geo+json" hidden onChange={onFile} />
        <div className="row">
          <button className="btn small" onClick={() => fileRef.current.click()}>⬆ {t.upload}</button>
          {state.upload && <button className="link" onClick={() => set({ upload: null })}>{t.wmsRemove} · {state.upload.name}</button>}
        </div>
        {uploadError && <div className="error">{uploadError}</div>}
      </Field>
    </div>
  );
}
