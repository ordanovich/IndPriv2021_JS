// Permalink / shareable URL state.
//
// Format (see IMPROVEMENTS.md §3.1):
//   #v=2021&q=5&lang=es&bbox=-4.2,37.8,-3.1,38.6
//
// Keys are intentionally short so the link stays compact. bbox uses
// decimal degrees in west,south,east,north order. The state we expose
// is additive — only keys we know are emitted, so a stale hash never
// blocks startup.

const VALID_YEARS = new Set(["2021", "2011"]);
const VALID_LANGS = new Set(["es", "en"]);

export function parseHash(hashLike) {
  const out = {};
  const raw = String(hashLike || "").replace(/^#/, "");
  if (!raw) return out;
  for (const part of raw.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    let k, v;
    try {
      k = decodeURIComponent(part.slice(0, eq));
      v = decodeURIComponent(part.slice(eq + 1));
    } catch (_) { continue; }
    if (k === "v" && VALID_YEARS.has(v)) {
      out.v = v;
    } else if (k === "q") {
      const n = parseInt(v, 10);
      if (n >= 1 && n <= 5) out.q = n;
    } else if (k === "lang" && VALID_LANGS.has(v)) {
      out.lang = v;
    } else if (k === "bbox") {
      const nums = v.split(",").map(s => Number(s));
      if (nums.length === 4 && nums.every(Number.isFinite)) {
        const [west, south, east, north] = nums;
        if (west >= -180 && west <= 180 && east >= -180 && east <= 180 &&
            south >= -90 && south <= 90 && north >= -90 && north <= 90 &&
            west < east && south < north) {
          out.bbox = { west, south, east, north };
        }
      }
    }
  }
  return out;
}

export function buildHash(state) {
  const parts = [];
  if (state.v && VALID_YEARS.has(state.v)) parts.push("v=" + state.v);
  if (state.q != null && state.q >= 1 && state.q <= 5) parts.push("q=" + state.q);
  if (state.lang && VALID_LANGS.has(state.lang)) parts.push("lang=" + state.lang);
  if (state.bbox) {
    const b = state.bbox;
    parts.push("bbox=" +
      b.west.toFixed(3) + "," + b.south.toFixed(3) + "," +
      b.east.toFixed(3) + "," + b.north.toFixed(3));
  }
  return parts.length ? "#" + parts.join("&") : "";
}

/** Replace the current URL hash without pushing a history entry. */
export function replaceHash(newHash) {
  if (typeof window === "undefined") return;
  const cur = window.location.hash || "";
  const next = newHash || "#";
  if (cur === next) return;
  try {
    const base = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", base + next);
  } catch (_) {
    window.location.hash = next;
  }
}

/** Tiny trailing-edge debounce. */
export function debounce(fn, ms) {
  let h = null;
  return function (...args) {
    if (h) clearTimeout(h);
    h = setTimeout(() => { h = null; fn(...args); }, ms);
  };
}
