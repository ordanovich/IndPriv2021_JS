// Generates a lightweight demo GeoJSON containing only 5 representative
// provinces. Run once from the repository root:
//   node scripts/make_demo.js
//
// Reads: terria_frontend/wwwroot/data/secciones_unified.geojson
// Writes: terria_frontend/wwwroot/data/secciones_demo.geojson

const fs = require("fs");
const path = require("path");

const DEMO_PROVINCES = new Set([
  "08", // Barcelona — large urban
  "12", // Castellón — Mediterranean mid-size
  "28", // Madrid — large urban
  "33", // Asturias — Northern industrial decline
  "41", // Sevilla — Southern deprivation
]);

const SRC = path.join("terria_frontend", "wwwroot", "data", "secciones_unified.geojson");
const DST = path.join("terria_frontend", "wwwroot", "data", "secciones_demo.geojson");

if (!fs.existsSync(SRC)) {
  console.error(`Source not found: ${SRC}`);
  process.exit(1);
}

const src = JSON.parse(fs.readFileSync(SRC, "utf8"));
const before = src.features.length;
src.features = src.features.filter(f =>
  DEMO_PROVINCES.has(String(f.properties.CUSEC).padStart(9, "0").substring(0, 2))
);

fs.writeFileSync(DST, JSON.stringify(src));
const sizeMb = (fs.statSync(DST).size / 1024 / 1024).toFixed(2);
console.log(`Demo: ${src.features.length} / ${before} features (${sizeMb} MB) → ${DST}`);
