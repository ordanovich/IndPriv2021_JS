import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../state";
import { describe, loadMeta, loadProvinceGeometry, loadVariables, selectRows } from "../data";
import { fmtInt } from "../i18n";
import { Check, download } from "./ui";

function buildRecords(table, rows, t, vars) {
  return rows.map(i => {
    const rec = {
      CUSEC: table.id[i],
      CCAA: table.names.ccaa[table.ccaa[i]] ?? "",
      Provincia: table.names.prov[table.prov[i]] ?? "",
      Municipio: table.names.mun[table.mun[i]] ?? "",
      Anio: Number(table.year),
      IP: Number.isFinite(table.ip[i]) ? table.ip[i] : null,
      Quintil: table.q[i] || null,
      Quintil_etiqueta: table.q[i] ? t.qLabels[table.q[i] - 1] : "",
    };
    if (table.u) rec.DEGURBA = table.u[i] || null;
    rec.Mismo_trazado_2011_2021 = table.s[i] === 1 ? 1 : 0;
    if (vars) for (const c of vars.columns) rec[c] = vars.values[c][i];
    return rec;
  });
}

function toCsv(records) {
  if (!records.length) return "";
  const cols = Object.keys(records[0]);
  const esc = v => {
    if (v == null) return "";
    const s = String(v);
    return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cols.join(","), ...records.map(r => cols.map(c => esc(r[c])).join(","))].join("\r\n");
}

export default function ExportPanel() {
  const { state, set, table, mode, t } = useApp();
  const lang = state.lang;
  const [busy, setBusy] = useState(null);
  const [withVars, setWithVars] = useState(false);
  const [geoExport, setGeoExport] = useState(false);
  useEffect(() => {
    loadMeta(mode.id).then(m => setGeoExport(m.geojson_export === true)).catch(() => setGeoExport(false));
  }, [mode.id]);

  const box = state.scope === "view" ? state.view : state.scope === "rect" ? state.rect : null;
  const rows = useMemo(() => {
    if (!table) return [];
    if (state.scope === "rect" && !state.rect) return [];
    return selectRows(table, state.filters, box);
  }, [table, state.filters, state.scope, box]);

  if (!table) return null;
  const base = `privacion_${mode.id}_${table.year}`;
  const varsOk = table.hasVariables;

  const run = async (kind, fn) => {
    setBusy(kind);
    try { await fn(); } catch (err) { console.error(err); alert(t.loadError); } finally { setBusy(null); }
  };
  const records = async () => buildRecords(table, rows, t, varsOk && withVars ? await loadVariables(mode.id, table.year) : null);

  const csv = () => run("csv", async () => {
    download(new Blob([toCsv(await records())], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
  });
  const xlsx = () => run("xlsx", async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(await records());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `IP ${table.year}`);
    XLSX.writeFile(wb, `${base}.xlsx`);
  });
  const geojson = () => run("geojson", async () => {
    const recs = await records();
    const byId = new Map(recs.map(r => [r.CUSEC, r]));
    const provs = [...new Set(rows.map(i => table.prov[i]))];
    const features = [];
    for (const p of provs) {
      const fc = await loadProvinceGeometry(mode.id, table.year, p);
      for (const f of fc.features) {
        const r = byId.get(f.properties.CUSEC);
        if (r) features.push({ type: "Feature", properties: r, geometry: f.geometry });
      }
    }
    download(new Blob([JSON.stringify({ type: "FeatureCollection", features })], { type: "application/geo+json" }),
      `${base}.geojson`);
  });
  const stats = () => run("stats", async () => {
    const byQ = [1, 2, 3, 4, 5].map(q => {
      const d = describe(rows.filter(i => table.q[i] === q).map(i => table.ip[i]));
      return { quintil: q, n: d?.n ?? 0, ...(d ?? {}) };
    });
    const out = {
      generado: new Date().toISOString(),
      modo: mode.id, anio: table.year,
      ambito: state.scope, filtros: state.filters, caja: box,
      cortes_quintiles: table.breaks,
      total: describe(rows.map(i => table.ip[i])),
      por_quintil: byQ,
    };
    download(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }), `${base}_estadisticas.json`);
  });

  return (
    <div className="export">
      <div className="field-label">{t.scope}</div>
      <div className="radio-list">
        {[["filters", t.scopeFilters], ["view", t.scopeView], ["rect", t.scopeRect]].map(([v, label]) => (
          <label key={v} className="radio">
            <input type="radio" name="scope" checked={state.scope === v} onChange={() => set({ scope: v })} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {state.scope === "rect" && (
        <div className="row">
          <button className={"btn small" + (state.drawing ? " primary" : "")}
                  onClick={() => set({ drawing: !state.drawing })}>
            ⬚ {state.rect ? t.redrawRect : t.drawRect}
          </button>
          {state.rect && <button className="link" onClick={() => set({ rect: null })}>{t.clearRect}</button>}
        </div>
      )}

      <div className="export-count">{rows.length ? t.exportCount(fmtInt(lang, rows.length), mode.units[lang]) : t.exportEmpty}</div>

      {varsOk && (
        <Check checked={withVars} onChange={setWithVars}>
          {t.exportVars} <small className="muted">{t.exportVarsNote}</small>
        </Check>
      )}

      <div className="export-buttons">
        <button className="btn" disabled={!rows.length || busy} onClick={csv}>{busy === "csv" ? t.exportBusy : "⬇ " + t.exportCsv}</button>
        <button className="btn" disabled={!rows.length || busy} onClick={xlsx}>{busy === "xlsx" ? t.exportBusy : "⬇ " + t.exportXlsx}</button>
        {geoExport && (
          <button className="btn wide" disabled={!rows.length || busy} onClick={geojson}>{busy === "geojson" ? t.exportBusy : "⬇ " + t.exportGeojson}</button>
        )}
        <button className="btn wide ghost" disabled={!rows.length || busy} onClick={stats}>{busy === "stats" ? t.exportBusy : "⬇ " + t.exportStats}</button>
      </div>
      <p className="muted small">{t.exportNote}</p>
    </div>
  );
}
