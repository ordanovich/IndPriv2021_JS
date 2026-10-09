import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../state";
import { PROVINCE_ATLAS } from "../atlas";
import { ATLAS_DIR } from "../config";
import { fmtInt, fmtNum } from "../i18n";
import { useColors, useTable } from "../hooks";
import { Segmented } from "./ui";

const ORDER = Object.entries(PROVINCE_ATLAS).sort((a, b) => a[1].name.localeCompare(b[1].name, "es")).map(([c]) => c);

// Province shown: the selected unit's, else the filtered one, else the
// province at the centre of the map when zoomed in enough.
function useDefaultProvince() {
  const { state, table, selectedIndex } = useApp();
  return useMemo(() => {
    if (!table) return null;
    if (selectedIndex != null) return table.prov[selectedIndex];
    if (state.filters.prov) return state.filters.prov;
    const v = state.view;
    if (!v || v.zoom < 7) return null;
    const cx = (v.west + v.east) / 2, cy = (v.south + v.north) / 2;
    let best = null, bd = Infinity;
    for (let i = 0; i < table.n; i++) {
      const d = (table.x[i] - cx) ** 2 + (table.y[i] - cy) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best == null ? null : table.prov[best];
  }, [table, selectedIndex, state.filters.prov, state.view]);
}

export default function AtlasTab() {
  const { state, mode, t } = useApp();
  const lang = state.lang;
  const colors = useColors();
  const def = useDefaultProvince();
  const [cpro, setCpro] = useState(def);
  const [kind, setKind] = useState("c");
  useEffect(() => { if (def) setCpro(def); }, [def]);
  // The atlas is built on the 2021 index; its statistics too.
  const t21 = useTable(mode.id, mode.years["2021"] ? "2021" : null);

  const stats = useMemo(() => {
    if (!t21 || !cpro) return null;
    const counts = [0, 0, 0, 0, 0];
    let sum = 0, n = 0, total = 0;
    for (let i = 0; i < t21.n; i++) {
      if (t21.prov[i] !== cpro) continue;
      total++;
      if (t21.q[i] > 0) counts[t21.q[i] - 1]++;
      if (Number.isFinite(t21.ip[i])) { sum += t21.ip[i]; n++; }
    }
    return { total, mean: n ? sum / n : null, counts };
  }, [t21, cpro]);

  const entry = cpro && PROVINCE_ATLAS[cpro];
  if (mode.id !== "ct") return null;
  if (!entry) return <p className="muted pad">{t.atlasNone}</p>;
  const src = ATLAS_DIR + entry[kind];
  const step = d => setCpro(ORDER[(ORDER.indexOf(cpro) + d + ORDER.length) % ORDER.length]);

  return (
    <div className="atlas">
      <a className="atlas-img" href={src} target="_blank" rel="noopener noreferrer">
        <img src={src} alt={entry.name} />
      </a>
      <div className="atlas-side">
        <div className="atlas-nav">
          <button onClick={() => step(-1)}>‹</button>
          <b>{entry.name}</b>
          <button onClick={() => step(1)}>›</button>
        </div>
        <Segmented size="small" value={kind} onChange={setKind}
                   options={[{ value: "c", label: t.atlasContinuous }, { value: "q", label: t.atlasQuintiles }]} />
        {stats && (
          <>
            <div className="kv"><span>{t.sections}</span><b>{fmtInt(lang, stats.total)}</b></div>
            <div className="kv"><span>{t.meanIp} 2021</span><b>{fmtNum(lang, stats.mean)}</b></div>
            <div className="qbar">
              {stats.counts.map((c, k) => (
                <span key={k} style={{ flex: Math.max(c, 0.0001), background: colors[k] }} title={`Q${k + 1} · ${c}`} />
              ))}
            </div>
          </>
        )}
        <a className="btn small" href={src} download={entry[kind]}>⬇ {t.atlasDownload}</a>
        <p className="muted small">{t.atlasNote}</p>
      </div>
    </div>
  );
}
