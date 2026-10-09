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
  const [ready, setReady] = useState(false);
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
    m.on("load", () => {
      m.addLayer({ id: "anchor-base", type: "background", layout: { visibility: "none" } });
      addIndexSources(m, mode.years[other], live.current.lang);
      addUnitLayers(m);
      addBoundaryLayers(m);
      addBasemap(m, live.current.basemap, "anchor-base");
      setReady(true);
    });
    const sync = () => m.jumpTo({ center: mainMap.getCenter(), zoom: mainMap.getZoom() });
    mainMap.on("move", sync);
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(host);
    return () => {
      mainMap.off("move", sync);
      ro.disconnect();
      m.remove();
      div.remove();
      setReady(false);
      mapBus.compare = null;
    };
  }, [mainMap, other]);

  // Clip to the overlay's side and tell the main map which part is covered.
  useEffect(() => {
    if (!holder.current) return;
    const pct = ratio * 100;
    holder.current.style.clipPath = otherOnLeft ? `inset(0 ${100 - pct}% 0 0)` : `inset(0 0 0 ${pct}%)`;
    mapBus.compare = { ratio, otherOnLeft };
  }, [ratio, otherOnLeft, ready]);

  // Same styling as the main map, with the other year's own breaks.
  useEffect(() => {
    const m = overlay.current;
    if (!ready || !m) return;
    styleUnits(m, {
      classes: state.classes, colors: PALETTES[state.colorblind ? "cb" : "std"],
      filters: state.filters, opacity: state.opacity, table: otherTable,
    });
    showBoundaries(m, state.boundaries);
  }, [ready, state.classes, state.colorblind, state.filters, state.opacity, state.boundaries, otherTable]);

  useEffect(() => {
    if (ready) addBasemap(overlay.current, state.basemap, "anchor-base");
  }, [ready, state.basemap]);

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
