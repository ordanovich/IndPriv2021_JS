// A single place for components to move the map without holding a ref to it.

let map = null;

export const mapBus = {
  attach(m) { map = m; },
  detach() { map = null; },
  get() { return map; },
  fitBox(b, opts = {}) {
    if (!map || !b) return;
    map.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: 40, duration: 900, maxZoom: 16, ...opts });
  },
  // Frame one unit of a table (centre point + half-extent from the pipeline).
  fitUnit(t, i) {
    if (!map || i == null) return;
    const r = Math.max(t.r[i], 0.002) * 1.4;
    this.fitBox({ west: t.x[i] - r, east: t.x[i] + r, south: t.y[i] - r, north: t.y[i] + r });
  },
  flyTo(lon, lat, zoom = 16) {
    map?.flyTo({ center: [lon, lat], zoom, duration: 900 });
  },
};
