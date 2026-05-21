// Converts the colleague's 2011 census shapefile to GeoJSON and
// automatically creates the Andalucía demo subset.
//
// One-time setup (run once from the project root):
//   npm install
//
// Then whenever you receive the 2011 shapefile:
//   node scripts/import_2011_shp.js "C:\path\to\secciones_2011.shp"
//
// Outputs:
//   terria_frontend/wwwroot/data/secciones_2011.geojson        (full)
//   terria_frontend/wwwroot/data/secciones_demo_2011.geojson   (Andalucía demo)

const fs    = require("fs");
const path  = require("path");
const { execSync } = require("child_process");
const shapefile = require("shapefile");

// ── CRS detection ─────────────────────────────────────────────────────────────
// Spanish census shapefiles are commonly in ETRS89 UTM Zone 30N (EPSG:25830)
// or in geographic coordinates (ETRS89/WGS84). We read the .prj to decide.
const PROJ_UTM30N = "+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs";
const PROJ_WGS84  = "+proj=longlat +datum=WGS84 +no_defs";

function buildReprojector(prjText) {
  if (!prjText.includes("PROJCS")) return null; // already geographic
  const proj4 = require("proj4");
  // Default assumption: UTM30N — covers most of mainland Spain
  console.log("  Detected projected CRS — reprojecting from UTM30N to WGS84.");
  return proj4(PROJ_UTM30N, PROJ_WGS84);
}

function reprojectCoords(coords, forward) {
  if (typeof coords[0] === "number") {
    const [lon, lat] = forward(coords);
    coords[0] = lon;
    coords[1] = lat;
  } else {
    coords.forEach(c => reprojectCoords(c, forward));
  }
}

function reprojectGeometry(geom, forward) {
  if (!geom || !geom.coordinates) return;
  reprojectCoords(geom.coordinates, forward);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const shpPath = process.argv[2];
  if (!shpPath) {
    console.error("Usage: node scripts/import_2011_shp.js <path-to-shapefile.shp>");
    process.exit(1);
  }
  if (!fs.existsSync(shpPath)) {
    console.error("File not found: " + shpPath);
    process.exit(1);
  }

  // Read .prj for CRS
  const prjPath = shpPath.replace(/\.shp$/i, ".prj");
  let reprojector = null;
  if (fs.existsSync(prjPath)) {
    reprojector = buildReprojector(fs.readFileSync(prjPath, "utf8"));
  } else {
    console.log("  No .prj file found — assuming geographic coordinates (WGS84/ETRS89).");
  }

  console.log("Reading shapefile...");
  const features = [];
  // latin1 covers ISO-8859-1 and CP1252 — standard for Spanish DBF files
  const source = await shapefile.open(shpPath, undefined, { encoding: "latin1" });

  while (true) {
    const { done, value } = await source.read();
    if (done) break;
    if (reprojector && value.geometry) reprojectGeometry(value.geometry, reprojector.forward);
    features.push(value);
  }

  const outPath = "terria_frontend/wwwroot/data/secciones_2011.geojson";
  fs.writeFileSync(outPath, JSON.stringify({ type: "FeatureCollection", features }));
  console.log("Wrote " + features.length + " features → " + outPath);

  console.log("Creating Andalucía demo subset...");
  execSync("node scripts/make_demo_2011.js", { stdio: "inherit" });

  console.log("");
  console.log("Done. Start the app with: cd terria_frontend && npx gulp dev");
}

main().catch(err => { console.error(err.message); process.exit(1); });
