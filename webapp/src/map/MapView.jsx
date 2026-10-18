import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { EMPTY_FILTERS, useApp } from "../state";
import { activeFilterCount } from "../data";
import { BASEMAPS, MAX_BOUNDS, PALETTES, VIEWS, WMS_CATALOG, wmsTileUrl } from "../config";
import { mapBus } from "./mapBus";
import { hoverStore } from "./hoverStore";
import { basemapHealth, probe } from "./basemapHealth";
import {
  addBasemap, addBoundaryLayers, addIndexSources, addUnitLayers, basemapProbeTemplate, ensureProtocol,
  setIndexYear, showBoundaries, styleUnits,
} from "./indexLayers";
import CompareOverlay from "./CompareOverlay";
import ErrorBoundary from "../components/ErrorBoundary";
import { useIsMobile } from "../hooks";
import { INTRO_ON, markIntroPending, prepareFlight, runIntro } from "./intro";
import IntroSplash from "../components/IntroSplash";

function rectGeoJSON(r) {
  if (!r) return { type: "FeatureCollection", features: [] };
  const ring = [[r.west, r.south], [r.east, r.south], [r.east, r.north], [r.west, r.north], [r.west, r.south]];
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }] };
}

// Keep the credits folded behind the (i) button (they open on tap/click).
// MapLibre unfolds them whenever their content changes (first load, another
// basemap), so fold them again once the map settles.
// First loader: shown at least this long from opening the page, then dissolved
// (the animated version's splash a little longer, and it opens more slowly)
const BOOT_MIN_MS = INTRO_ON ? 3600 : 3000;
const LOADER_FADE_MS = INTRO_ON ? 1000 : 700;

function foldCredits(map) {
  map.once("idle", () => map.getContainer().querySelector(".maplibregl-ctrl-attrib")
    ?.classList.remove("maplibregl-compact-show"));
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
  // Basemap fallback in place: { from, to } (the user's choice, the stand-in).
  const fallback = useRef(null);
  const tried = useRef(new Set());
  const restores = useRef(0);

  // Create the map once.
  useEffect(() => {
    ensureProtocol();
    const b = state.initialBbox;
    const map = new maplibregl.Map({
      container: container.current,
      style: { version: 8, sources: {}, layers: [] },
      bounds: b ? [[b.west, b.south], [b.east, b.north]] : VIEWS.peninsula,
      // Tiles start at zoom 4 (TILES_LOW in the pipeline): never go below it,
      // or a narrow phone fitting the whole country would show a blank map.
      minZoom: 4, maxZoom: 19, maxBounds: MAX_BOUNDS,
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
      addIndexSources(map, yearCfg, live.current.state.lang);
      addUnitLayers(map);
      anchor("anchor-above");
      map.addSource("upload", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "upload-fill", type: "fill", source: "upload", filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#7c3aed", "fill-opacity": 0.15 } });
      map.addLayer({ id: "upload-line", type: "line", source: "upload", filter: ["!=", ["geometry-type"], "Point"],
        paint: { "line-color": "#7c3aed", "line-width": 2 } });
      map.addLayer({ id: "upload-point", type: "circle", source: "upload", filter: ["==", ["geometry-type"], "Point"],
        paint: { "circle-color": "#7c3aed", "circle-radius": 5, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
      addBoundaryLayers(map);
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
      addBasemap(map, live.current.state.basemap, "anchor-base").catch(() => {});   // failures: watchdog
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
      if (mapBus.coveredByCompare(e.point)) { setHover(null); map.getCanvas().style.cursor = ""; return; }
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
      if (st.drawing || !tb || mapBus.coveredByCompare(e.point)) return;
      const i = e.features?.[0]?.properties?.i;
      if (i == null) return;
      s({ selected: { year: st.year, id: tb.id[i] }, panels: { ...st.panels, bottom: true } });
    });

    // Basemap watchdog: if the basemap's service is failing (most recent
    // tiles fail even after retries, not just a few slow ones), switch to
    // its fallback. The notice offers going back.
    const unwatch = basemapHealth.subscribe(() => {
      if (!basemapHealth.failing()) return;
      basemapHealth.reset();
      const { state: st, set: s, t: tt } = live.current;
      const cur = BASEMAPS.find(b => b.id === st.basemap);
      if (!cur?.fallback) return;
      tried.current.add(cur.id);
      const next = BASEMAPS.find(b => b.id === cur.fallback && !tried.current.has(b.id));
      if (!next) return;
      const from = fallback.current?.from ?? cur.id;
      fallback.current = { from, to: next.id };
      const name = BASEMAPS.find(b => b.id === from).name[st.lang];
      s({
        basemap: next.id,
        notice: {
          text: tt.basemapFallback(next.name[st.lang]),
          action: { label: tt.basemapBack(name), patch: { basemap: from, notice: null } },
        },
      });
    });

    // Basemap tile failures are counted above; log anything else.
    map.on("error", e => { if (e.sourceId !== "basemap") console.warn("map:", e.sourceId ?? "", e.error?.message ?? e); });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container.current);
    return () => { unwatch(); ro.disconnect(); mapBus.detach(); map.remove(); };
  }, []);

  // Phones: "my location" button under the zoom. The browser asks for
  // permission only when it is pressed; the position never leaves the phone.
  const mobile = useIsMobile();
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !mobile) return;
    const geo = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      fitBoundsOptions: { maxZoom: 15 },
      trackUserLocation: false,
    });
    map.addControl(geo, "top-right");
    return () => map.removeControl(geo);
  }, [ready, mobile]);

  // Loader: covers the map until the sections and the basemap are in
  // ("map", first load) or shows a small notice ("year", after a switch).
  // Never longer than 8 s: a slow basemap must not block the app.
  // The first one stays at least BOOT_MIN_MS from opening the page (on
  // purpose: the map is usually ready sooner), then dissolves ("fading").
  const [loading, setLoading] = useState("map");
  const loadingNow = useRef(loading);
  loadingNow.current = loading;
  const [loadRound, setLoadRound] = useState(0);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (loadingNow.current !== "map") { setLoading(null); return; }
      setTimeout(() => setLoading(cur => (cur === "map" ? "fading" : cur)),
                 Math.max(0, BOOT_MIN_MS - performance.now()));
    };
    const check = () => {
      if (map.getSource("units") && map.isSourceLoaded("units") && map.areTilesLoaded()) finish();
    };
    map.on("idle", check);
    const safety = setTimeout(finish, 8000);
    check();
    return () => { map.off("idle", check); clearTimeout(safety); };
  }, [ready, loadRound]);

  // Animated version (default; ?intro=0 = calm): camera glide, quintile wave, interface rising
  // in, started as the loader dissolves. No glide when the link already
  // points somewhere (a selection or a view).
  const introFlight = useRef(INTRO_ON && !state.initialBbox && !state.selected);
  const introEnd = useRef(null);
  useEffect(() => { markIntroPending(); return () => { introEnd.current?.(); delete document.documentElement.dataset.intro; }; }, []);
  useEffect(() => { if (ready && introFlight.current) prepareFlight(mapRef.current); }, [ready]);
  useEffect(() => {
    if (!INTRO_ON || loading !== "fading" || introEnd.current) return;
    introEnd.current = runIntro(mapRef.current, {
      flight: introFlight.current, getOpacity: () => live.current.state.opacity,
    });
  }, [loading]);

  // End of the dissolve: remove the loader
  useEffect(() => {
    if (loading !== "fading") return;
    const id = setTimeout(() => setLoading(cur => (cur === "fading" ? null : cur)), LOADER_FADE_MS);
    return () => clearTimeout(id);
  }, [loading]);

  // Year → swap the tile sources.
  const firstYear = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !yearCfg) return;
    if (hoverId.current != null) { hoverId.current = null; hoverStore.set(null); }
    setIndexYear(map, yearCfg);
    if (firstYear.current) { firstYear.current = false; return; }
    setLoading(l => l ?? "year");
    setLoadRound(r => r + 1);
  }, [ready, state.mode, state.year]);

  // Colours, classes, filters, opacity.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready) return;
    styleUnits(map, {
      classes: state.classes, colors: PALETTES[state.colorblind ? "cb" : "std"],
      filters: state.filters, opacity: state.opacity, table,
    });
  }, [ready, state.classes, state.colorblind, state.filters, state.opacity, table]);

  // Boundaries.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready) return;
    showBoundaries(map, state.boundaries);
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

  // Basemap. Any change other than the watchdog's own ends the fallback.
  useEffect(() => {
    if (!ready) return;
    basemapHealth.reset();
    if (fallback.current && state.basemap !== fallback.current.to) {
      fallback.current = null;
      tried.current.clear();
    }
    addBasemap(mapRef.current, state.basemap, "anchor-base").catch(() => {});
    foldCredits(mapRef.current);
  }, [ready, state.basemap]);

  // While on a fallback, check the original service every minute and return
  // to it after two good answers in a row (at most twice per visit, so a
  // service that keeps dropping does not make the map flip back and forth).
  useEffect(() => {
    const fb = fallback.current;
    if (!ready || !fb || state.basemap !== fb.to || restores.current >= 2) return;
    const from = BASEMAPS.find(b => b.id === fb.from);
    let good = 0, busy = false, stopped = false;
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      const tpl = await basemapProbeTemplate(from);
      const ok = tpl ? await probe(tpl) : false;
      busy = false;
      if (stopped) return;
      good = ok ? good + 1 : 0;
      if (good < 2) return;
      restores.current++;
      const { set: s, state: st, t: tt } = live.current;
      s({ basemap: from.id, notice: tt.basemapRestored(from.name[st.lang]) });
    }, 60000);
    return () => { stopped = true; clearInterval(timer); };
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
      {INTRO_ON && (loading === "map" || loading === "fading") && <IntroSplash leaving={loading === "fading"} />}
      {!INTRO_ON && (loading === "map" || loading === "fading") && (
        <div className={"map-loader" + (loading === "fading" ? " out" : "")} role="status" aria-live="polite">
          <div className="map-loader-card">
            <img src="images/logo_see.png" alt="" onError={e => { e.currentTarget.style.display = "none"; }} />
            <span className="loader-bars" aria-hidden="true"><b /><b /><b /><b /><b /></span>
            <span className="loader-text">{t.loadingMap}</span>
          </div>
        </div>
      )}
      {loading === "year" && (
        <div className="map-loading-chip" role="status" aria-live="polite">
          <span className="spinner small" aria-hidden="true" />{t.loadingYear(state.year)}
        </div>
      )}
      {/* Q chips filter the map by quintile (same filter as the legend and the
          Filters panel; select again to remove); "Leyenda ›" opens the legend */}
      <div className={"mini-legend" + (state.filters.quintiles.length ? " has-sel" : "")} role="group" aria-label={t.legend}>
        {PALETTES[state.colorblind ? "cb" : "std"].map((c, k) => {
          const q = k + 1, on = state.filters.quintiles.includes(q);
          return (
            <button key={q} className={"ml-q" + (on ? " on" : "")} aria-pressed={on} title={`Q${q} · ${t.qLabels[k]}`}
                    onClick={() => app.setFilters({ quintiles: on ? state.filters.quintiles.filter(x => x !== q) : [...state.filters.quintiles, q].sort() })}>
              <i data-q={q} style={{ background: c }}>Q{q}</i>
            </button>
          );
        })}
        <button className="ml-open" aria-label={t.legend}
                onClick={() => app.setPanels(mobile ? { menu: true, menuSection: "legend" } : { right: true, left: false })}>
          <span>{t.legend}</span> ›
        </button>
      </div>
      <div className="map-actions">
        {activeFilterCount(state.filters) > 0 && (
          <button title={t.clearFilters} aria-label={t.clearFilters}
                  onClick={() => app.setFilters(EMPTY_FILTERS)}>
            {/* funnel with a cross: "remove filters" */}
            <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
              <path d="M2 3h14l-5.5 6.5V15l-3 1.8V9.5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M13 12.5l5 5M18 12.5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {app.selectedIndex != null && (
          <button title={t.clearSelection + " (Esc)"} aria-label={t.clearSelection}
                  onClick={() => set({ selected: null })}>
            <span aria-hidden="true">✕</span>
          </button>
        )}
      </div>
      {ready && state.compare && (
        <ErrorBoundary onError={() => set({ compare: false, notice: t.compareFailed })}>
          <CompareOverlay mainMap={mapRef.current} />
        </ErrorBoundary>
      )}
    </div>
  );
}
