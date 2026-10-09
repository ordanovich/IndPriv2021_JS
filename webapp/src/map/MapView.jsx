import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { useApp } from "../state";
import {
  BASEMAPS, DIM_COLOR, NO_DATA_COLOR, PALETTES, VIEWS, WMS_CATALOG, wmsTileUrl,
} from "../config";
import { mapBus } from "./mapBus";
import { hoverStore } from "./hoverStore";

let protocolReady = false;
function ensureProtocol() {
  if (protocolReady) return;
  maplibregl.addProtocol("pmtiles", new Protocol().tile);
  protocolReady = true;
}

const abs = rel => new URL(rel, document.baseURI).href;
const pmtiles = rel => "pmtiles://" + abs(rel);

const DATA_ATTRIBUTION = {
  es: "Índice: Grupo de Determinantes Sociales de la Salud (SEE) · Secciones: © INE",
  en: "Index: Social Determinants of Health Group (SEE) · Tracts: © INE",
};

// ── Style expressions ────────────────────────────────────────────────────────

function colorExpression(classes, colors, breaks) {
  if (classes === "c" && breaks) {
    const stops = [];
    for (let k = 0; k < 5; k++) stops.push((breaks[k] + breaks[k + 1]) / 2, colors[k]);
    return ["case", ["<=", ["get", "q"], 0], NO_DATA_COLOR,
      ["interpolate", ["linear"], ["get", "ip"], ...stops]];
  }
  return ["match", ["get", "q"], 1, colors[0], 2, colors[1], 3, colors[2], 4, colors[3], 5, colors[4], NO_DATA_COLOR];
}

function filterExpression(filters, table) {
  const c = [];
  if (filters.mun) c.push(["==", ["get", "m"], Number(filters.mun)]);
  else if (filters.prov) c.push(["==", ["get", "p"], Number(filters.prov)]);
  else if (filters.ccaa && table) {
    const provs = Object.entries(table.names.prov_ccaa)
      .filter(([, cc]) => cc === filters.ccaa).map(([p]) => Number(p));
    c.push(["in", ["get", "p"], ["literal", provs]]);
  }
  if (filters.quintiles.length) c.push(["in", ["get", "q"], ["literal", filters.quintiles]]);
  if (filters.degurba && table?.u) c.push(["==", ["get", "u"], filters.degurba]);
  if (filters.stable) c.push(["==", ["get", "s"], 1]);
  return c.length ? ["all", ...c] : true;
}

function rectGeoJSON(r) {
  if (!r) return { type: "FeatureCollection", features: [] };
  const ring = [[r.west, r.south], [r.east, r.south], [r.east, r.north], [r.west, r.north], [r.west, r.south]];
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }] };
}

// Diagonal hatch for the coverage gaps (drawn at 2x for sharp screens).
function hatchImage() {
  const s = 16;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  g.fillStyle = "#f3f4f6";
  g.fillRect(0, 0, s, s);
  g.strokeStyle = "#9ca3af";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-2, s + 2); g.lineTo(s + 2, -2);
  g.moveTo(-2, 2); g.lineTo(2, -2);
  g.moveTo(s - 2, s + 2); g.lineTo(s + 2, s - 2);
  g.stroke();
  return g.getImageData(0, 0, s, s);
}

function addBasemap(map, id, beforeId) {
  if (map.getLayer("basemap")) map.removeLayer("basemap");
  if (map.getSource("basemap")) map.removeSource("basemap");
  const b = BASEMAPS.find(x => x.id === id);
  if (!b?.tiles) return;
  map.addSource("basemap", {
    type: "raster", tiles: b.tiles, tileSize: 256, maxzoom: b.maxzoom ?? 19, attribution: b.attribution,
  });
  map.addLayer({ id: "basemap", type: "raster", source: "basemap" }, beforeId);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MapView() {
  const app = useApp();
  const { state, set, mode, table, t } = app;
  const container = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const live = useRef(app);       // latest context for map event handlers
  live.current = app;
  const hoverId = useRef(null);
  const yearCfg = mode.years[state.year];

  // Create the map once.
  useEffect(() => {
    ensureProtocol();
    const b = state.initialBbox;
    const map = new maplibregl.Map({
      container: container.current,
      style: { version: 8, sources: {}, layers: [] },
      bounds: b ? [[b.west, b.south], [b.east, b.north]] : VIEWS.peninsula,
      minZoom: 3, maxZoom: 19,
      dragRotate: false, pitchWithRotate: false, touchPitch: false,
      attributionControl: false,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;
    mapBus.attach(map);
    if (import.meta.env.DEV) window.__map = map;   // for automated UI checks

    map.on("load", () => {
      const anchor = id => map.addLayer({ id, type: "background", layout: { visibility: "none" } });
      anchor("anchor-base");
      map.addSource("units", {
        type: "vector", url: pmtiles(yearCfg.tiles), promoteId: { units: "i" },
        attribution: DATA_ATTRIBUTION[live.current.state.lang],
      });
      map.addSource("bounds", { type: "vector", url: pmtiles(yearCfg.bounds) });
      map.addSource("gaps", { type: "vector", url: pmtiles(yearCfg.gaps) });
      map.addImage("hatch", hatchImage(), { pixelRatio: 2 });
      map.addLayer({
        id: "units-fill", type: "fill", source: "units", "source-layer": "units",
        paint: { "fill-color": NO_DATA_COLOR, "fill-opacity": 0.8 },
      });
      map.addLayer({
        id: "units-line", type: "line", source: "units", "source-layer": "units", minzoom: 10,
        paint: {
          "line-color": "#ffffff",
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.15, 13, 0.6, 16, 1.2],
          "line-opacity": 0.85,
        },
      });
      // Areas no census section covers (territorios comunes): hatched, so
      // they read as "no unit here" rather than as missing data.
      map.addLayer({
        id: "gaps-fill", type: "fill", source: "gaps", "source-layer": "gaps",
        paint: { "fill-pattern": "hatch", "fill-opacity": 0.9 },
      });
      anchor("anchor-above");
      map.addSource("upload", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "upload-fill", type: "fill", source: "upload", filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#7c3aed", "fill-opacity": 0.15 } });
      map.addLayer({ id: "upload-line", type: "line", source: "upload", filter: ["!=", ["geometry-type"], "Point"],
        paint: { "line-color": "#7c3aed", "line-width": 2 } });
      map.addLayer({ id: "upload-point", type: "circle", source: "upload", filter: ["==", ["geometry-type"], "Point"],
        paint: { "circle-color": "#7c3aed", "circle-radius": 5, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
      map.addLayer({
        id: "bounds-mun", type: "line", source: "bounds", "source-layer": "bounds", minzoom: 8,
        filter: ["==", ["get", "l"], 2],
        paint: { "line-color": "#4b5563", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 13, 1.1], "line-opacity": 0.7 },
      });
      map.addLayer({
        id: "bounds-prov", type: "line", source: "bounds", "source-layer": "bounds",
        filter: ["==", ["get", "l"], 1],
        paint: { "line-color": "#374151", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.35, 8, 0.9, 11, 1.6], "line-opacity": 0.8 },
      });
      map.addLayer({
        id: "bounds-ccaa", type: "line", source: "bounds", "source-layer": "bounds",
        filter: ["==", ["get", "l"], 0],
        paint: { "line-color": "#111827", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 8, 1.4, 11, 2.4] },
      });
      map.addLayer({
        id: "units-hover", type: "line", source: "units", "source-layer": "units",
        paint: {
          "line-color": "#111827", "line-width": 2,
          "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0],
        },
      });
      map.addLayer({
        id: "units-selected", type: "line", source: "units", "source-layer": "units",
        filter: ["==", ["get", "i"], -1],
        paint: { "line-color": "#0f172a", "line-width": 3.5 },
      });
      map.addSource("rect", { type: "geojson", data: rectGeoJSON(null) });
      map.addLayer({ id: "rect-fill", type: "fill", source: "rect", paint: { "fill-color": "#2563eb", "fill-opacity": 0.08 } });
      map.addLayer({ id: "rect-line", type: "line", source: "rect", paint: { "line-color": "#2563eb", "line-width": 2, "line-dasharray": [2, 1] } });
      addBasemap(map, live.current.state.basemap, "anchor-base");
      setReady(true);
    });

    const emitView = () => {
      const bb = map.getBounds();
      live.current.set({
        view: { west: bb.getWest(), south: bb.getSouth(), east: bb.getEast(), north: bb.getNorth(), zoom: map.getZoom() },
      });
    };
    map.on("moveend", emitView);
    map.once("idle", emitView);

    const setHover = id => {
      if (hoverId.current === id) return;
      if (hoverId.current != null) map.setFeatureState({ source: "units", sourceLayer: "units", id: hoverId.current }, { hover: false });
      hoverId.current = id;
      if (id != null) map.setFeatureState({ source: "units", sourceLayer: "units", id }, { hover: true });
      hoverStore.set(id);
    };
    map.on("mousemove", "units-fill", e => {
      if (live.current.state.drawing) return;
      const f = e.features?.[0];
      setHover(f ? f.id : null);
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "units-fill", () => {
      setHover(null);
      if (!live.current.state.drawing) map.getCanvas().style.cursor = "";
    });
    map.on("mousemove", "gaps-fill", () => hoverStore.set("gap"));
    map.on("mouseleave", "gaps-fill", () => hoverStore.set(null));
    map.on("click", "units-fill", e => {
      const { table: tb, state: st, set: s } = live.current;
      if (st.drawing || !tb) return;
      const i = e.features?.[0]?.properties?.i;
      if (i == null) return;
      s({ selected: { year: st.year, id: tb.id[i] }, panels: { ...st.panels, bottom: true } });
    });

    // Basemap watchdog: if the chosen basemap keeps failing, use its fallback.
    let errors = 0, lastError = 0;
    const tried = new Set();
    map.on("error", e => {
      if (e.sourceId !== "basemap") return;
      const now = Date.now();
      errors = now - lastError > 15000 ? 1 : errors + 1;
      lastError = now;
      if (errors < 6) return;
      errors = 0;
      const { state: st, set: s, t: tt } = live.current;
      const cur = BASEMAPS.find(b => b.id === st.basemap);
      tried.add(cur.id);
      const next = BASEMAPS.find(b => b.id === cur.fallback && !tried.has(b.id));
      if (next) s({ basemap: next.id, notice: tt.basemapFallback(next.name[st.lang]) });
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container.current);
    return () => { ro.disconnect(); mapBus.detach(); map.remove(); };
  }, []);

  // Year → swap the tile sources.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !yearCfg) return;
    if (hoverId.current != null) { hoverId.current = null; hoverStore.set(null); }
    map.getSource("units").setUrl(pmtiles(yearCfg.tiles));
    map.getSource("bounds").setUrl(pmtiles(yearCfg.bounds));
    map.getSource("gaps").setUrl(pmtiles(yearCfg.gaps));
  }, [ready, state.mode, state.year]);

  // Colours, classes, filters, opacity.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready) return;
    const colors = PALETTES[state.colorblind ? "cb" : "std"];
    const color = colorExpression(state.classes, colors, table?.breaks);
    const f = filterExpression(state.filters, table);
    map.setPaintProperty("units-fill", "fill-color", f === true ? color : ["case", f, color, DIM_COLOR]);
    map.setPaintProperty("units-fill", "fill-opacity", state.opacity);
  }, [ready, state.classes, state.colorblind, state.filters, state.opacity, table]);

  // Boundaries.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready) return;
    const vis = on => (on ? "visible" : "none");
    map.setLayoutProperty("bounds-ccaa", "visibility", vis(state.boundaries.ccaa));
    map.setLayoutProperty("bounds-prov", "visibility", vis(state.boundaries.prov));
    map.setLayoutProperty("bounds-mun", "visibility", vis(state.boundaries.mun));
    map.setLayoutProperty("units-line", "visibility", vis(state.boundaries.units));
  }, [ready, state.boundaries]);

  // Selected unit outline.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready) return;
    map.setFilter("units-selected", ["==", ["get", "i"], app.selectedIndex ?? -1]);
  }, [ready, app.selectedIndex, state.year]);

  // Arriving from a shared link with a selection but no bbox: frame it.
  const framed = useRef(false);
  useEffect(() => {
    if (!ready || framed.current || !table) return;
    framed.current = true;
    if (!state.initialBbox && app.selectedIndex != null) mapBus.fitUnit(table, app.selectedIndex);
  }, [ready, table]);

  // Basemap.
  useEffect(() => {
    if (ready) addBasemap(mapRef.current, state.basemap, "anchor-base");
  }, [ready, state.basemap]);

  // WMS overlays.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready) return;
    const all = [...WMS_CATALOG, ...state.customWms];
    const wanted = state.wms.map(id => all.find(w => w.id === id)).filter(Boolean);
    const wantedIds = new Set(wanted.map(w => "wms-" + w.id));
    for (const l of map.getStyle().layers) {
      if (l.id.startsWith("wms-") && !wantedIds.has(l.id)) {
        map.removeLayer(l.id);
        map.removeSource(l.id);
      }
    }
    for (const w of wanted) {
      const id = "wms-" + w.id;
      if (map.getLayer(id)) continue;
      map.addSource(id, { type: "raster", tiles: [wmsTileUrl(w)], tileSize: 256, minzoom: w.minzoom ?? 0 });
      map.addLayer({ id, type: "raster", source: id, minzoom: w.minzoom ?? 0, paint: { "raster-opacity": w.opacity ?? 1 } },
        w.above ? "anchor-above" : "units-fill");
    }
  }, [ready, state.wms, state.customWms]);

  // Uploaded GeoJSON.
  useEffect(() => {
    if (!ready) return;
    mapRef.current.getSource("upload").setData(state.upload?.data ?? { type: "FeatureCollection", features: [] });
  }, [ready, state.upload]);

  // Rectangle (shown) and rectangle drawing (interaction).
  useEffect(() => {
    if (ready) mapRef.current.getSource("rect").setData(rectGeoJSON(state.rect));
  }, [ready, state.rect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !state.drawing) return;
    const canvas = map.getCanvas();
    canvas.style.cursor = "crosshair";
    map.dragPan.disable();
    let start = null;
    const box = (a, b) => ({
      west: Math.min(a.lng, b.lng), east: Math.max(a.lng, b.lng),
      south: Math.min(a.lat, b.lat), north: Math.max(a.lat, b.lat),
    });
    const down = e => { start = e.lngLat; };
    const move = e => { if (start) map.getSource("rect").setData(rectGeoJSON(box(start, e.lngLat))); };
    const up = e => {
      if (!start) return;
      const r = box(start, e.lngLat);
      start = null;
      if (r.east - r.west < 1e-6 || r.north - r.south < 1e-6) return;
      live.current.set({ rect: r, drawing: false, scope: "rect" });
    };
    const key = e => { if (e.key === "Escape") live.current.set({ drawing: false }); };
    map.on("mousedown", down);
    map.on("mousemove", move);
    map.on("mouseup", up);
    window.addEventListener("keydown", key);
    return () => {
      map.off("mousedown", down);
      map.off("mousemove", move);
      map.off("mouseup", up);
      window.removeEventListener("keydown", key);
      map.dragPan.enable();
      canvas.style.cursor = "";
      map.getSource("rect")?.setData(rectGeoJSON(live.current.state.rect));
    };
  }, [ready, state.drawing]);

  return (
    <div className="map-wrap">
      <div ref={container} className="map" />
      <div className="map-views">
        <button onClick={() => mapRef.current?.fitBounds(VIEWS.peninsula, { duration: 800 })}>{t.peninsula}</button>
        <button onClick={() => mapRef.current?.fitBounds(VIEWS.canarias, { duration: 800 })}>{t.canarias}</button>
      </div>
      {state.drawing && <div className="map-hint">{t.drawing} · Esc</div>}
    </div>
  );
}
