import React from "react";
import { useApp } from "../state";
import { percentile } from "../data";
import { fmtNum } from "../i18n";
import { useColors, useLink, useTable } from "../hooks";
import { mapBus } from "../map/mapBus";
import { QuintileChip } from "./ui";

// The unit's counterpart(s) in the other census year, by real overlap.
function OtherYear({ i }) {
  const { state, set, mode, table, t } = useApp();
  const colors = useColors();
  const link = useLink(mode.id, !!mode.link);
  const otherYear = link?.other(state.year);
  const other = useTable(mode.id, otherYear);
  if (!mode.link || !link || !other) return null;

  const matches = link.matches(state.year, i);
  const stable = table.s[i] === 1;
  const go = j => set({ year: otherYear, selected: { year: otherYear, id: other.id[j] } });

  return (
    <div className="other-year">
      <div className="field-label">{t.otherYear(otherYear)}</div>
      {matches.length === 0 && <p className="muted">{t.noMatch(otherYear)}</p>}
      {matches.length > 0 && (
        <>
          <p className="muted small">{stable ? t.sameTerritory(otherYear) : t.redrawn(otherYear)}</p>
          <ul className="matches">
            {matches.slice(0, stable ? 1 : 6).map(m => (
              <li key={m.i}>
                <button className="link" title={t.goToYear(otherYear)} onClick={() => go(m.i)}>{other.id[m.i]}</button>
                <span>IP <b>{fmtNum(state.lang, other.ip[m.i])}</b></span>
                <QuintileChip q={other.q[m.i]} colors={colors} />
                {!stable && <small className="muted">{t.overlapOf(m.pThis, m.pOther)}</small>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function Details() {
  const { state, table, mode, t, selectedIndex: i } = useApp();
  const colors = useColors();
  const lang = state.lang;

  if (!table || i == null) return <div className="details empty"><p className="muted">{t.noSelection}</p></div>;

  const ip = table.ip[i];
  const pct = percentile(table, ip);
  return (
    <div className="details">
      <div className="details-head">
        <div>
          <div className="details-id">{mode.idLabel} {table.id[i]}</div>
          <div className="details-name">{table.names.mun[table.mun[i]]}</div>
          <div className="muted small">{table.names.prov[table.prov[i]]} · {table.names.ccaa[table.ccaa[i]]}</div>
        </div>
        <button className="btn small" onClick={() => mapBus.fitUnit(table, i)}>⌖ {t.flyTo}</button>
      </div>
      <div className="details-ip">
        <div>
          <div className="field-label">{t.ipValue} {state.year}</div>
          {Number.isFinite(ip)
            ? <div className="big">{fmtNum(lang, ip, 3)}</div>
            : <div className="muted">{t.noIp}</div>}
        </div>
        <QuintileChip q={table.q[i]} colors={colors} labels={t.qLabels} />
      </div>
      {pct != null && (
        <div className="pctbar" title={t.percentile(pct)}>
          <div className="pctbar-track" style={{ background: `linear-gradient(to right, ${colors.join(",")})` }}>
            <span style={{ left: pct + "%" }} />
          </div>
          <div className="muted small">{t.percentile(pct)}</div>
        </div>
      )}
      {table.u && table.u[i] > 0 && (
        <div className="muted small">{t.urbanisation}: <b>{t.degurba[table.u[i]]}</b></div>
      )}
      <OtherYear i={i} />
    </div>
  );
}
