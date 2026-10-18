// Basemap tiles are fetched through a small "basemap://" protocol that
// retries brief failures and keeps a tally of how the service is answering,
// so the map can tell a real outage (switch to the fallback basemap) from a
// few slow or lost tiles (just retry them).
//
// Measured on the IGN services (2026-10-11): zoom 5–10 come from Amazon
// CloudFront (~7 ms), zoom 11–17 from the IGN's own tile cache (~100 ms) and
// street-map zoom 18–19 are drawn on demand (2–3 s per tile). When the IGN's
// servers are down only the zoomed-out tiles still load.
import maplibregl from "maplibre-gl";

const PREFIX = "basemap://";
const TIMEOUT = 25000;              // ms per attempt; on-demand tiles take ~3 s
const RETRY_DELAYS = [1500, 4000];  // two retries for transient failures
const WINDOW = 20000;               // ms of recent results the verdict looks at
// A tile only counts as failed after its retries, which a service losing
// even 15 % of requests almost never causes (0.15³ ≈ 0.3 %). A phone screen
// shows only ~6 tiles, so a handful must be enough to call an outage.
const MIN_FAILURES = 4;             // …at least this many failed tiles
const MIN_FAILURE_SHARE = 0.5;      // …and at least half of the finished ones

export const basemapUrl = url => PREFIX + url;

// ── Tally of recent results ──────────────────────────────────────────────────
let results = [];                   // { t, ok }
const listeners = new Set();

function record(ok) {
  const now = Date.now();
  results.push({ t: now, ok });
  results = results.filter(r => now - r.t <= WINDOW);
  listeners.forEach(fn => fn());
}

// A vector basemap whose style cannot be loaded at all: an outage straight away
export function reportBasemapOutage() {
  for (let k = 0; k < MIN_FAILURES; k++) record(false);
}

export const basemapHealth = {
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  reset() { results = []; },
  // True when the service is failing, not just slow or losing a few tiles.
  failing() {
    const now = Date.now();
    const recent = results.filter(r => now - r.t <= WINDOW);
    const failed = recent.filter(r => !r.ok).length;
    return failed >= MIN_FAILURES && failed / recent.length >= MIN_FAILURE_SHARE;
  },
};

// ── Fetching ─────────────────────────────────────────────────────────────────
const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const id = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(id); reject(signal.reason); }, { once: true });
});

// A failure worth retrying (and counting as the service failing): no answer,
// a server error or "too many requests". Other 4xx mean "no tile here".
const transient = status => status === 0 || status === 429 || status >= 500;

// Fetch one tile with a time limit and retries. Resolves to an ArrayBuffer;
// rejects with an error carrying `status` (0 = network error or timeout).
export async function fetchTile(url, signal, { cache = "default" } = {}) {
  for (let attempt = 0; ; attempt++) {
    const ctl = new AbortController();
    const stop = () => ctl.abort();
    signal?.addEventListener("abort", stop, { once: true });
    const timer = setTimeout(stop, TIMEOUT);
    let status = 0;
    try {
      const r = await fetch(url, { signal: ctl.signal, cache });
      status = r.status;
      if (r.ok) return await r.arrayBuffer();
    } catch (e) {
      if (signal?.aborted) throw e;  // the map no longer needs this tile
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
    }
    if (!transient(status) || attempt >= RETRY_DELAYS.length) {
      throw Object.assign(new Error(`Basemap tile failed (${status || "no response"})`), { status });
    }
    await sleep(RETRY_DELAYS[attempt], signal);
  }
}

let ready = false;
export function ensureBasemapProtocol() {
  if (ready) return;
  ready = true;
  maplibregl.addProtocol("basemap", async (params, abortController) => {
    const signal = abortController.signal;
    try {
      const data = await fetchTile(params.url.slice(PREFIX.length), signal);
      record(true);
      return { data };
    } catch (e) {
      if (!signal.aborted && transient(e.status ?? 0)) record(false);
      throw e;
    }
  });
}

// One tile of `template` somewhere in mainland Spain at zoom 14, which the
// IGN serves from its own servers (not the CloudFront copy), fetched past the
// browser cache: answers whether the service itself is back.
export async function probe(template) {
  const z = 14, n = 2 ** z;
  const lon = -6.5 + Math.random() * 7, lat = 37.5 + Math.random() * 5;
  const r = lat * Math.PI / 180;
  const x = Math.floor((lon + 180) / 360 * n);
  const y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
  const url = template.replace("{z}", z).replace("{x}", x).replace("{y}", y);
  try { await fetchTile(url, null, { cache: "no-store" }); return true; } catch { return false; }
}
