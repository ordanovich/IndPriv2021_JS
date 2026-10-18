// Opening sequence of the animated version (the default): when the
// loader dissolves, the camera glides into Spain, the sections light up
// class by class (Q1 → Q5, the legend in step) and the interface rises in.
// The calm version (address ?intro=0) never runs any of this.
// Skipped with prefers-reduced-motion; any touch, click, scroll or key ends it.
// State lives on <html data-intro="pending|run"> so React's own class names
// on .app are never touched (styles.css: "Animated version").
import { VIEWS } from "../config";

export const INTRO_ON = typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("intro") !== "0"
  && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const FLIGHT_MS = 1700;
const STEP_MS = 250;                 // between quintile classes
const UI_MS = 2100;                  // until the interface has fully arrived
const easeOut = t => 1 - Math.pow(1 - t, 3);
const html = () => document.documentElement;

// From the first render (the splash covers the screen meanwhile)
export function markIntroPending() {
  if (INTRO_ON) html().dataset.intro = "pending";
}

// Under the loader: start wider and further north, so the glide is visible
export function prepareFlight(map) {
  const z = map.getZoom(), c = map.getCenter();
  map.jumpTo({ center: [c.lng + 4, c.lat + 3.5], zoom: Math.max(map.getMinZoom(), z - 1.3) });
}

// Histogram bars rise left to right; legend bars grow in quintile order
function staggerBars(on) {
  const rects = [...document.querySelectorAll(".hist rect")];
  rects.forEach((r, i) => { r.style.animationDelay = on ? `${0.55 + (i / Math.max(1, rects.length)) * 0.7}s` : ""; });
  for (const el of document.querySelectorAll(".legend-row[data-q] .bar span")) {
    el.style.animationDelay = on ? `${0.35 + Number(el.closest("[data-q]").dataset.q) * 0.14}s` : "";
  }
}

function paintLegend(k) {
  for (const el of document.querySelectorAll(".legend-row[data-q], .mini-legend [data-q]")) {
    const q = Number(el.dataset.q);
    el.style.opacity = k == null || q <= k ? "" : "0.25";
    el.classList.toggle("intro-pop", q === k);
  }
}

// Runs the sequence. getOpacity: the index opacity to restore at the end.
// Returns a function that ends it at once.
export function runIntro(map, { flight, getOpacity }) {
  const timers = [];
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    timers.forEach(clearTimeout);
    if (flight && map.isMoving()) map.stop();
    if (map.getLayer("units-fill")) map.setPaintProperty("units-fill", "fill-opacity", getOpacity());
    paintLegend(null);
    staggerBars(false);
    delete html().dataset.intro;
    for (const ev of ["pointerdown", "wheel", "keydown"]) window.removeEventListener(ev, end, true);
  };
  for (const ev of ["pointerdown", "wheel", "keydown"]) window.addEventListener(ev, end, true);

  staggerBars(true);
  html().dataset.intro = "run";
  if (flight) map.fitBounds(VIEWS.peninsula, { duration: FLIGHT_MS, easing: easeOut });

  // Quintile wave: only classes 1..k are drawn
  const show = k => {
    if (map.getLayer("units-fill")) {
      map.setPaintProperty("units-fill", "fill-opacity",
        ["case", ["all", [">=", ["get", "q"], 1], ["<=", ["get", "q"], k]], getOpacity(), 0]);
    }
    paintLegend(k);
  };
  show(0);
  for (let k = 1; k <= 5; k++) timers.push(setTimeout(() => show(k), 150 + (k - 1) * STEP_MS));
  timers.push(setTimeout(end, Math.max(UI_MS, 150 + 5 * STEP_MS + 300, flight ? FLIGHT_MS : 0)));
  return end;
}
