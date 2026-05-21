// Creates the Andalucía demo subset of the 2011 GeoJSON.
// Run once after placing secciones_2011.geojson in wwwroot/data/:
//   node scripts/make_demo_2011.js
//
// Input:  terria_frontend/wwwroot/data/secciones_2011.geojson
// Output: terria_frontend/wwwroot/data/secciones_demo_2011.geojson

const fs = require("fs");

const DEMO_PROVINCES = new Set(["04","11","14","18","21","23","29","41"]);
const src  = "terria_frontend/wwwroot/data/secciones_2011.geojson";
const dest = "terria_frontend/wwwroot/data/secciones_demo_2011.geojson";

if (!fs.existsSync(src)) {
  console.error("ERROR: " + src + " not found. Place the 2011 shapefile there first.");
  process.exit(1);
}

const gj = JSON.parse(fs.readFileSync(src, "utf8"));
gj.features = gj.features.filter(f =>
  DEMO_PROVINCES.has(String(f.properties.CUSEC).padStart(9, "0").slice(0, 2))
);
fs.writeFileSync(dest, JSON.stringify(gj));
console.log("Demo 2011: " + gj.features.length + " features → " + dest);
