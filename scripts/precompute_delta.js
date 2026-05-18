// Pre-computes deltaQ and DeltaLabel into secciones_unified.geojson in-place.
// Run ONCE from the repository root before starting the dev server:
//   node scripts/precompute_delta.js
//
// The script is idempotent — running it again is safe.

const fs   = require("fs");
const path = require("path");

const FILE = path.join("terria_frontend", "wwwroot", "data", "secciones_unified.geojson");

if (!fs.existsSync(FILE)) {
  console.error(`Not found: ${FILE}`);
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

console.log("Reading GeoJSON (this may take a moment for 139 MB)…");
const gj = JSON.parse(fs.readFileSync(FILE, "utf8"));

let computed = 0;
gj.features.forEach(f => {
  const p = f.properties;
  if (p.DeltaLabel) return; // already computed, skip
  const q21 = p.Q21_num;
  const q11 = parseQ(p.Q11_Label);
  if (q21 != null && q11 != null) {
    p.deltaQ     = q21 - q11;
    p.DeltaLabel = deltaLabel(p.deltaQ);
    computed++;
  }
});

console.log(`Writing back… (${computed} features updated)`);
fs.writeFileSync(FILE, JSON.stringify(gj));
console.log("Done.");
