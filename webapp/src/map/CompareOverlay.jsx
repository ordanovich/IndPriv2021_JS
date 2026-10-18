import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { useApp } from "../state";
import { PALETTES } from "../config";
import { useTable } from "../hooks";
import { mapBus } from "./mapBus";
import {
  addBasemap, addBoundaryLayers, addIndexSources, addUnitLayers, showBoundaries, styleUnits,
} from "./indexLayers";

// Swipe comparison: a second, non-interactive map showing the other year,
// kept in step with the main map and clipped to one side of a draggable bar.
// The older year is always on the left. The main map (and every panel)
// keeps showing the year chosen in Capas; the covered side ignores the mouse.
export default function CompareOverlay({ mainMap }) {
  const { state, mode, t } = useApp();
  const other = Object.keys(mode.years).find(y => y !== state.year);
  const otherTable = useTable(mode.id, other);
  const otherOnLeft = other < state.year;
  const [ratio, setRatio] = useState(0.5);
  // The overlay map whose style has finished loading. Holding the instance
  // (not a true/false flag) matters: switching year replaces the map, and in
  // that same render a flag would still say "ready" while the new map is
  // still loading — styling it then throws and took the whole app down.
  const [loaded, setLoaded] = useState(null);
  const holder = useRef(null);
  const overlay = useRef(null);
  const live = useRef(state);
  live.current = state;

  // Build the overlay map inside the main map, under its controls.
  useEffect(() => {
    if (!other) return;
    const host = mainMap.getContainer();
    const div = document.createElement("div");
    div.className = "compare-map";
    host.insertBefore(div, host.querySelector(".maplibregl-control-container"));
    holder.current = div;
    const m = new maplibregl.Map({
      container: div, style: { version: 8, sources: {}, layers: [] },
      center: mainMap.getCenter(), zoom: mainMap.getZoom(),
      interactive: false, attributionControl: false,
    });
    overlay.current = m;
    // Basemap tile failures are handled by the main map's watchdog.
    m.on("error", e => { if (e.sourceId !== "basemap") console.warn("compare map:", e.sourceId ?? "", e.error?.message ?? e); });
    m.on("load", () => {
      m.addLayer({ id: "anchor-base", type: "background", layout: { visibility: "none" } });
      addIndexSources(m, mode.years[other], live.current.lang);
      addUnitLayers(m);
      addBoundaryLayers(m);
      addBasemap(m, live.current.basemap, "anchor-base").catch(() => {});
      if (overlay.current === m) setLoaded(m);
    });
    const sync = () => m.jumpTo({ center: mainMap.getCenter(), zoom: mainMap.getZoom() });
    mainMap.on("move", sync);
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(host);
    return () => {
      mainMap.off("move", sync);
      ro.disconnect();
      if (overlay.current === m) overlay.current = null;
      m.remove();
      div.remove();
      setLoaded(null);
      mapBus.compare = null;
    };
  }, [mainMap, other]);

  // Clip to the overlay's side and tell the main map which part is covered.
  useEffect(() => {
    if (!holder.current) return;
    const pct = ratio * 100;
    holder.current.style.clipPath = otherOnLeft ? `inset(0 ${100 - pct}% 0 0)` : `inset(0 0 0 ${pct}%)`;
    mapBus.compare = { ratio, otherOnLeft };
  }, [ratio, otherOnLeft, loaded]);

  // Same styling as the main map, with the other year's own breaks.
  useEffect(() => {
    const m = overlay.current;
    if (!m || loaded !== m) return;
    styleUnits(m, {
      classes: state.classes, colors: PALETTES[state.colorblind ? "cb" : "std"],
      filters: state.filters, opacity: state.opacity, table: otherTable,
    });
    showBoundaries(m, state.boundaries);
  }, [loaded, state.classes, state.colorblind, state.filters, state.opacity, state.boundaries, otherTable]);

  useEffect(() => {
    const m = overlay.current;
    if (m && loaded === m) addBasemap(m, state.basemap, "anchor-base").catch(() => {});
  }, [loaded, state.basemap]);

  const drag = e => {
    e.preventDefault();
    const rect = mainMap.getContainer().getBoundingClientRect();
    const move = ev => setRatio(Math.min(0.98, Math.max(0.02, (ev.clientX - rect.left) / rect.width)));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  if (!other) return null;
  const left = otherOnLeft ? other : state.year;
  const right = otherOnLeft ? state.year : other;
  return (
    <div className="swipe" style={{ left: ratio * 100 + "%" }}>
      <div className="swipe-line" />
      <button className="swipe-handle" onPointerDown={drag} title={t.compareHint} aria-label={t.compareHint}>⇔</button>
      <span className="swipe-label left">{left}</span>
      <span className="swipe-label right">{right}</span>
    </div>
  );
}
