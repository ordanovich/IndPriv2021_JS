// Post-processes a GeoJSON file to strip non-polygon parts from GeometryCollection
// features left by ms_simplify. Overwrites the file in place.
"use strict";
const fs = require("fs");

function extractPolygonCoords(geom) {
  // Returns an array of polygon rings (each ring is an array of [lon,lat] positions)
  // from any geometry type, recursively.
  if (!geom) return [];
  if (geom.type === "Polygon") return [geom.coordinates];
  if (geom.type === "MultiPolygon") return geom.coordinates;
  if (geom.type === "GeometryCollection")
    return geom.geometries.flatMap(extractPolygonCoords);
  return []; // LineString, Point, etc. — discard
}

function fixFeature(feature) {
  const g = feature.geometry;
  if (!g || g.type !== "GeometryCollection") return feature;

  const polys = extractPolygonCoords(g); // array of polygon coordinate arrays
  if (polys.length === 0) {
    // No polygon found — keep geometry as-is (will render as null)
    return feature;
  }
  feature.geometry = polys.length === 1
    ? { type: "Polygon", coordinates: polys[0] }
    : { type: "MultiPolygon", coordinates: polys };
  return feature;
}

function fixFile(path) {
  const data = JSON.parse(fs.readFileSync(path, "utf8"));
  let fixed = 0;
  data.features = data.features.map(f => {
    if (f.geometry && f.geometry.type === "GeometryCollection") {
      fixed++;
      return fixFeature(f);
    }
    return f;
  });
  fs.writeFileSync(path, JSON.stringify(data), "utf8");
  console.log(`  Fixed ${fixed} GeometryCollection features in ${path}`);
}

const targets = [
  "terria_frontend/wwwroot/data/secciones_unified.geojson",
  "terria_frontend/wwwroot/data/secciones_demo.geojson",
  "terria_frontend/wwwroot/data/secciones_2011.geojson",
];

targets.forEach(p => {
  if (fs.existsSync(p)) fixFile(p);
});
