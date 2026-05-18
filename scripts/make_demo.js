// Generates a lightweight demo GeoJSON containing only 5 representative
// provinces. Run once from the repository root:
//   node scripts/make_demo.js
//
// Reads: terria_frontend/wwwroot/data/secciones_unified.geojson
// Writes: terria_frontend/wwwroot/data/secciones_demo.geojson

const fs = require("fs");
const path = require("path");

const DEMO_PROVINCES = new Set([
  "28", // Madrid
]);

const SRC = path.join("terria_frontend", "wwwroot", "data", "secciones_unified.geojson");
const DST = path.join("terria_frontend", "wwwroot", "data", "secciones_demo.geojson");

if (!fs.existsSync(SRC)) {
  console.error(`Source not found: ${SRC}`);
  process.exit(1);
}

const DELTA_ENUMS = [
  "1. Mejora notable",
  "2. Mejora leve",
  "3. Estable",
  "4. Empeoramiento leve",
  "5. Empeoramiento notable",
];
function deltaLabel(d) {
  if (d <= -2) return DELTA_ENUMS[0];
  if (d === -1) return DELTA_ENUMS[1];
  if (d ===  0) return DELTA_ENUMS[2];
  if (d ===  1) return DELTA_ENUMS[3];
  return DELTA_ENUMS[4];
}
function parseQ(label) {
  const n = parseInt(String(label || "").charAt(0), 10);
  return n >= 1 && n <= 5 ? n : null;
}

const src = JSON.parse(fs.readFileSync(SRC, "utf8"));
const before = src.features.length;

src.features = src.features.filter(f =>
  DEMO_PROVINCES.has(String(f.properties.CUSEC).padStart(9, "0").substring(0, 2))
);

// Bake delta fields into the GeoJSON so TerriaJS can style the change layer.
src.features.forEach(f => {
  const p = f.properties;
  const q21 = p.Q21_num;
  const q11 = parseQ(p.Q11_Label);
  if (q21 != null && q11 != null) {
    p.deltaQ    = q21 - q11;
    p.DeltaLabel = deltaLabel(p.deltaQ);
  }
});

fs.writeFileSync(DST, JSON.stringify(src));
const sizeMb = (fs.statSync(DST).size / 1024 / 1024).toFixed(2);
console.log(`Demo: ${src.features.length} / ${before} features (${sizeMb} MB) → ${DST}`);
