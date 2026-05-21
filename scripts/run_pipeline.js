// Data pipeline runner — called automatically by npm run dev/build/build-demo.
// Compares modification times of source files vs output GeoJSONs and only
// re-runs the R pipeline when something has changed. Safe to call on every
// app start (fast no-op when data is up to date).

const fs   = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const DATA_DIR = path.join("data_pipeline", "data");
const OUT_DIR  = path.join("terria_frontend", "wwwroot", "data");
const OUT_2021 = path.join(OUT_DIR, "secciones_unified.geojson");
const OUT_2011 = path.join(OUT_DIR, "secciones_2011.geojson");

function mtime(f) {
  try { return fs.statSync(f).mtimeMs; } catch { return 0; }
}

function latestInputMtime() {
  if (!fs.existsSync(DATA_DIR)) return 0;
  return fs.readdirSync(DATA_DIR)
    .filter(f => /\.(shp|xlsx)$/i.test(f))
    .reduce((max, f) => Math.max(max, mtime(path.join(DATA_DIR, f))), 0);
}

const inputMtime = latestInputMtime();
const out2021    = mtime(OUT_2021);

if (out2021 && inputMtime <= out2021) {
  console.log("Data is up to date — skipping pipeline.");
  process.exit(0);
}

console.log("Source data changed — running R pipeline...");

try {
  execSync("Rscript 01_process_and_export.R", {
    cwd: "data_pipeline",
    stdio: "inherit",
  });
} catch (_) {
  if (!fs.existsSync(OUT_2021)) {
    console.error(
      "\nERROR: R pipeline failed and no existing GeoJSON found.\n" +
      "Make sure R is installed and the following packages are available:\n" +
      "  sf, data.table, rmapshaper, dplyr, readxl\n" +
      "Install missing packages in R with: install.packages(c('sf','data.table','rmapshaper','dplyr','readxl'))"
    );
    process.exit(1);
  }
  console.warn("\nWARNING: R pipeline failed — continuing with existing GeoJSON files.");
}

// Regenerate Andalucía demo subsets from the freshly produced GeoJSONs
if (fs.existsSync(OUT_2021)) {
  console.log("Generating 2021 demo subset (Andalucía)...");
  execSync("node scripts/make_demo.js", { stdio: "inherit" });
}
if (fs.existsSync(OUT_2011)) {
  console.log("Generating 2011 demo subset (Andalucía)...");
  execSync("node scripts/make_demo_2011.js", { stdio: "inherit" });
}

console.log("Pipeline complete.");
