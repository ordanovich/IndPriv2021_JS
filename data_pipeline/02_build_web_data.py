"""Build the data for the v2 web viewer (webapp/).

For each spatial mode (today only census tracts, "ct") and each year, writes:

  webapp/public/data/<mode>/<year>.pmtiles        unit polygons as vector tiles
  webapp/public/data/<mode>/<year>_bounds.pmtiles CCAA / province / municipality
                                                  lines dissolved from the SAME
                                                  units, so they coincide exactly
  webapp/public/data/<mode>/<year>_gaps.pmtiles   areas no unit covers
                                                  (territorios comunes)
  webapp/public/data/<mode>/<year>.json           compact attribute table
  webapp/public/data/<mode>/link_2021_2011.json   overlap between the two years'
                                                  geometries (cross-year panels)
  webapp/public/data/<mode>/geo/<year>_<cpro>.json  exact GeoJSON per province,
                                                  fetched only by the GeoJSON export

Geometry is the original INE geometry. Tiles are built in two parts:
  zoom 4-8   finer grid (16384 units/tile), simplified by at most 1/8 of a
             screen pixel: every section that covers a pixel is drawn
  zoom 9-14  no simplification at zoom 14 (grid ~0.5 m), at most 1/4 pixel
             below it; every section is present
and merged into one PMTiles file. Check the output with 03_validate_web_data.py.

Run from data_pipeline/:  python 02_build_web_data.py
"""

import json
import shutil
import tempfile
import os
import sys
import time
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import pyogrio
import shapely
from pmtiles.reader import Reader, all_tiles
from pmtiles.tile import zxy_to_tileid
from pmtiles.writer import write as pmtiles_write

# Publish the index's input variables (imputed, standardised) alongside the
# index? Pending the INE's permission. When True, <year>_vars.json is written
# and the viewer offers it in the export panel; when False nothing is
# written, so nothing can leak through the deployed folder.
EXPORT_VARIABLES = False

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
OUT = HERE.parent / "webapp" / "public" / "data" / "ct"

# Tile units: with 512 px tiles, 1 screen pixel = EXTENT / 512 units.
NO_DROP = dict(MAX_SIZE=50_000_000, MAX_FEATURES=5_000_000)  # never drop features to fit a budget
TILES_LOW = dict(MINZOOM=4, MAXZOOM=8, EXTENT=16384,          # national / regional views
                 SIMPLIFICATION=4, SIMPLIFICATION_MAX_ZOOM=4, **NO_DROP)
TILES_HIGH = dict(MINZOOM=9, MAXZOOM=14, EXTENT=4096,         # local views
                  SIMPLIFICATION=2, SIMPLIFICATION_MAX_ZOOM=0, **NO_DROP)

# Holes in the national coverage larger than this are real areas with no
# census section (territorios comunes such as the Bardenas Reales or
# Aldovera); smaller ones are digitising gaps between neighbouring sections.
MIN_GAP_AREA = 10_000   # m²

YEARS = {
    "2021": dict(
        shp="SECC_CE_20210101.shp",
        xlsx="T25_IP2021_ACP_C_[i2_29]_v1.xlsx",
        sheet="IP21_i2_29_cpa_Cna_tt_importar",
        ip_col="IP21_i2_29_cpa_Cna_df",
        var_cols=["IE03_i", "IE06_i", "IE28_i", "IE07a_e2_i", "IE33_i",
                  "IE35_i", "IE36_i", "IE40_i", "REPRUCON_20_est_i"],
        extra_cols={"DEGURBA": "u"},
    ),
    "2011": dict(
        shp="SECC_CPV_E_20111101_01_R_INE.shp",
        xlsx="IP2011_RE.xlsx",
        sheet="Datos",
        ip_col="IP2011",
        var_cols=["manuales", "desempleo", "eventuales", "instr_insuf",
                  "instr_insuf_jov", "sin_internet"],
        extra_cols={},
    ),
}

# Same-code sections whose polygons overlap by at least this share (of both
# polygons) are treated as the same territory in both years.
STABLE_SHARE = 0.95
# Overlaps smaller than this share of a section are digitising noise.
MIN_LINK_SHARE = 0.01

EQUAL_AREA = "EPSG:3035"


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def polygonal(geoms):
    """make_valid, keeping only the polygonal parts (drops stray lines/points)."""
    geoms = shapely.make_valid(geoms)
    out = []
    for g in geoms:
        if g is None or g.is_empty:
            out.append(None)
            continue
        if g.geom_type in ("Polygon", "MultiPolygon"):
            out.append(g)
            continue
        parts = [p for p in shapely.get_parts(g) if p.geom_type in ("Polygon", "MultiPolygon")]
        out.append(shapely.union_all(parts) if parts else None)
    return np.array(out, dtype=object)


def quintile_breaks(values):
    v = values[np.isfinite(values)]
    return np.quantile(v, [0, 0.2, 0.4, 0.6, 0.8, 1.0])


def assign_quintile(values, breaks):
    """1..5, right-closed intervals (b[k-1], b[k]]; the minimum falls in 1; NaN -> 0."""
    q = np.searchsorted(breaks[1:5], values, side="left") + 1
    q[~np.isfinite(values)] = 0
    return q.astype(int)


def exterior_lines(geoms):
    """Outer rings of each (multi)polygon, as one MultiLineString per unit."""
    out = []
    for geom in geoms:
        rings = [p.exterior for p in shapely.get_parts(geom) if p.geom_type == "Polygon"]
        out.append(shapely.MultiLineString(rings))
    return out


def coverage_gaps(geoms):
    """Areas inside the national outline that no unit covers."""
    union = shapely.union_all(geoms)
    holes = [shapely.Polygon(r) for p in shapely.get_parts(union) if p.geom_type == "Polygon"
             for r in p.interiors]
    return np.array([h for h in holes if h.area > MIN_GAP_AREA], dtype=object)


def write_pmtiles(gdf, path, layer):
    """Write the low- and high-zoom parts with GDAL, then merge them."""
    # Temporary parts live outside Dropbox, which locks files it is syncing.
    tmpdir = Path(tempfile.mkdtemp(prefix="pmtiles_"))
    parts = []
    for tag, opts in (("low", TILES_LOW), ("high", TILES_HIGH)):
        tmp = tmpdir / f"{path.stem}.{tag}.pmtiles"
        pyogrio.write_dataframe(gdf, tmp, driver="PMTiles", layer=layer, dataset_options=opts)
        parts.append(tmp)
    tiles, header, metadata = [], None, None
    for tmp in parts:
        with open(tmp, "rb") as fh:
            def get_bytes(offset, length):
                fh.seek(offset)
                return fh.read(length)
            r = Reader(get_bytes)
            if header is None:
                header, metadata = r.header(), r.metadata()
            tiles += [(zxy_to_tileid(z, x, y), data) for (z, x, y), data in all_tiles(get_bytes)]
    tiles.sort(key=lambda t: t[0])
    zmin, zmax = TILES_LOW["MINZOOM"], TILES_HIGH["MAXZOOM"]
    metadata.update(name=path.stem, minzoom=str(zmin), maxzoom=str(zmax))
    for vl in metadata.get("vector_layers", []):
        vl.update(minzoom=zmin, maxzoom=zmax)
    with pmtiles_write(str(path)) as w:
        for tid, data in tiles:
            w.write_tile(tid, data)
        w.finalize(header, metadata)
    shutil.rmtree(tmpdir, ignore_errors=True)


def load_year(year, cfg):
    log(f"[{year}] reading {cfg['shp']}")
    g = pyogrio.read_dataframe(DATA / cfg["shp"],
                               columns=["CUSEC", "CPRO", "CCA", "NCA", "NPRO", "NMUN", "CUMUN"])
    g["CUSEC"] = g["CUSEC"].str.strip()
    if g["CUSEC"].duplicated().any():
        sys.exit(f"[{year}] duplicated CUSEC codes in {cfg['shp']}")
    g["geometry"] = polygonal(g.geometry.values)
    empty = g.geometry.isna()
    if empty.any():
        log(f"[{year}] WARNING: {empty.sum()} sections with empty geometry dropped")
        g = g[~empty]
    g = g.sort_values("CUSEC").reset_index(drop=True)

    log(f"[{year}] reading values from {cfg['xlsx']} / {cfg['sheet']}")
    x = pd.read_excel(DATA / cfg["xlsx"], sheet_name=cfg["sheet"], dtype={"CUSEC": str})
    x["CUSEC"] = x["CUSEC"].str.strip().str.zfill(10)
    keep = ["CUSEC", cfg["ip_col"], *cfg["var_cols"], *cfg["extra_cols"]]
    g = g.merge(x[keep], on="CUSEC", how="left", validate="one_to_one")
    g = g.rename(columns={cfg["ip_col"]: "IP"})
    unmatched = set(x["CUSEC"]) - set(g["CUSEC"])
    log(f"[{year}] {len(g)} sections; {g['IP'].isna().sum()} without IP; "
        f"{len(unmatched)} Excel rows with no polygon")
    return g


def add_quintiles(year, g):
    """Quintiles computed once, over this year's own sections."""
    ip = g["IP"].to_numpy(dtype=float)
    breaks = quintile_breaks(ip)
    g["q"] = assign_quintile(ip, breaks)
    log(f"[{year}] quintile breaks {np.round(breaks, 3).tolist()} "
        f"counts {np.bincount(g['q'], minlength=6)[1:].tolist()}")
    return breaks


def build_year(year, cfg, g, breaks):
    ip = g["IP"].to_numpy(dtype=float)
    q = g["q"].to_numpy()
    g4326 = g.to_crs(4326)
    pts = g4326.geometry.representative_point()
    b = g4326.geometry.bounds
    half = np.maximum(b.maxx - b.minx, b.maxy - b.miny) / 2

    # Tiles: integer index i (= row in the attribute table) plus what the map
    # styles and filters on, so the map never waits for the table.
    log(f"[{year}] writing section tiles")
    tiles = gpd.GeoDataFrame({
        "i": np.arange(len(g), dtype=np.int32),
        "q": q.astype(np.int16),
        "ip": np.round(ip, 3),
        "p": g["CPRO"].astype(int).to_numpy(np.int16),
        "m": g["CUMUN"].astype(int).to_numpy(np.int32),
        "s": g["s"].to_numpy(np.int16),
        **{short: g[src].fillna(0).astype(int).to_numpy(np.int16)
           for src, short in cfg["extra_cols"].items()},
    }, geometry=g4326.geometry.values, crs=4326)
    write_pmtiles(tiles, OUT / f"{year}.pmtiles", "units")

    log(f"[{year}] dissolving municipality / province / CCAA boundaries")
    mun = g.dissolve(by="CUMUN")[["geometry"]]
    prov = g.dissolve(by="CPRO")[["geometry"]]
    cca = g.dissolve(by="CCA")[["geometry"]]
    # Only outer edges: the INE sections leave hairline gaps between
    # neighbours, which become interior rings when dissolved and would be
    # drawn as broken boundary lines. Real enclaves are still drawn, by the
    # outer edge of the unit they belong to.
    lines = pd.concat([
        gpd.GeoDataFrame({"l": [level] * len(d)}, geometry=exterior_lines(d.geometry.values), crs=g.crs)
        for level, d in ((0, cca), (1, prov), (2, mun))
    ], ignore_index=True)
    lines["l"] = lines["l"].astype(np.int16)
    write_pmtiles(lines.to_crs(4326), OUT / f"{year}_bounds.pmtiles", "bounds")

    # A tile layer holds one geometry type, so the gaps get their own file.
    gaps = coverage_gaps(g.geometry.values)
    log(f"[{year}] {len(gaps)} areas without census sections (> {MIN_GAP_AREA / 1e4:.0f} ha), "
        f"{sum(shapely.area(gaps)) / 1e6:.0f} km²")
    gaps_gdf = gpd.GeoDataFrame({"g": np.ones(len(gaps), dtype=np.int16)}, geometry=gaps, crs=g.crs)
    write_pmtiles(gaps_gdf.to_crs(4326), OUT / f"{year}_gaps.pmtiles", "gaps")

    names = {
        "ccaa": dict(sorted(zip(g["CCA"], g["NCA"]))),
        "prov": dict(sorted(zip(g["CPRO"], g["NPRO"]))),
        "prov_ccaa": dict(sorted(zip(g["CPRO"], g["CCA"]))),
        "mun": dict(sorted(zip(g["CUMUN"], g["NMUN"]))),
    }
    table = {
        "mode": "ct",
        "year": year,
        "n": len(g),
        "breaks": [round(float(v), 4) for v in breaks],
        "names": names,
        "fields": {
            "id": g["CUSEC"].tolist(),
            "ip": [None if not np.isfinite(v) else round(float(v), 3) for v in ip],
            "q": q.tolist(),
            "x": np.round(pts.x, 5).tolist(),
            "y": np.round(pts.y, 5).tolist(),
            "r": np.round(half, 4).tolist(),
            "s": g["s"].tolist(),
        },
    }
    for src, short in cfg["extra_cols"].items():
        table["fields"][short] = [None if pd.isna(v) else int(v) for v in g[src]]

    if EXPORT_VARIABLES:
        vars_ = {c: [None if pd.isna(v) else round(float(v), 4) for v in g[c]] for c in cfg["var_cols"]}
        (OUT / f"{year}_vars.json").write_text(json.dumps({"columns": cfg["var_cols"], "values": vars_}),
                                              encoding="utf-8")
    elif (OUT / f"{year}_vars.json").exists():
        (OUT / f"{year}_vars.json").unlink()

    log(f"[{year}] writing exact GeoJSON per province (for export)")
    geo_dir = OUT / "geo"
    geo_dir.mkdir(exist_ok=True)
    for cpro, part in g4326.groupby("CPRO"):
        fc = part[["CUSEC", "geometry"]].copy()
        pyogrio.write_dataframe(fc, geo_dir / f"{year}_{cpro}.json", driver="GeoJSON",
                                layer_options={"COORDINATE_PRECISION": 6, "RFC7946": "YES"})
    return table


def build_link(g21, g11):
    """Overlap between 2021 and 2011 sections, in shares of each polygon's area."""
    log("[link] intersecting 2021 and 2011 geometries")
    a = g21[["CUSEC", "geometry"]].to_crs(EQUAL_AREA)
    b = g11[["CUSEC", "geometry"]].to_crs(EQUAL_AREA)
    area_a = a.area.to_numpy()
    area_b = b.area.to_numpy()
    ia, ib = b.sindex.query(a.geometry, predicate="intersects")
    inter = shapely.area(shapely.intersection(a.geometry.values[ia], b.geometry.values[ib]))
    sa = inter / area_a[ia]
    sb = inter / area_b[ib]
    keep = (sa >= MIN_LINK_SHARE) | (sb >= MIN_LINK_SHARE)
    ia, ib, sa, sb = ia[keep], ib[keep], sa[keep], sb[keep]

    same_code = a["CUSEC"].to_numpy()[ia] == b["CUSEC"].to_numpy()[ib]
    stable = same_code & (sa >= STABLE_SHARE) & (sb >= STABLE_SHARE)
    s21 = np.zeros(len(a), dtype=int)
    s11 = np.zeros(len(b), dtype=int)
    s21[ia[stable]] = 1
    s11[ib[stable]] = 1
    g21["s"] = s21
    g11["s"] = s11

    codes_a = set(a["CUSEC"])
    codes_b = set(b["CUSEC"])
    common = codes_a & codes_b
    stats = {
        "sections_2021": len(a),
        "sections_2011": len(b),
        "common_codes": len(common),
        "stable": int(stable.sum()),
        "same_code_redrawn": len(common) - int(stable.sum()),
        "only_2021": len(codes_a - codes_b),
        "only_2011": len(codes_b - codes_a),
        "stable_share": STABLE_SHARE,
    }
    log(f"[link] {stats}")
    link = {
        "stats": stats,
        # parallel arrays: row in 2021 table, row in 2011 table,
        # % of the 2021 section covered, % of the 2011 section covered
        "a": ia.tolist(),
        "b": ib.tolist(),
        "pa": np.round(sa * 100).astype(int).clip(0, 100).tolist(),
        "pb": np.round(sb * 100).astype(int).clip(0, 100).tolist(),
    }
    return link, stats


def main():
    # Delete old files but keep the folders: Dropbox keeps handles on them.
    OUT.mkdir(parents=True, exist_ok=True)
    for p in OUT.rglob("*"):
        if p.is_file():
            p.unlink()

    gdfs = {year: load_year(year, cfg) for year, cfg in YEARS.items()}
    breaks = {year: add_quintiles(year, g) for year, g in gdfs.items()}

    # The cross-year link sets the "s" (same territory in both years) flag
    # that both the tiles and the tables carry, so it runs first.
    link, stats = build_link(gdfs["2021"], gdfs["2011"])
    (OUT / "link_2021_2011.json").write_text(json.dumps(link, separators=(",", ":")), encoding="utf-8")

    tables = {year: build_year(year, YEARS[year], gdfs[year], breaks[year]) for year in YEARS}

    for year, t in tables.items():
        t["variables"] = EXPORT_VARIABLES
        (OUT / f"{year}.json").write_text(json.dumps(t, separators=(",", ":"), ensure_ascii=False),
                                          encoding="utf-8")

    meta = {
        "built": time.strftime("%Y-%m-%d"),
        "years": list(YEARS),
        "link": stats,
        "variables": EXPORT_VARIABLES,
        # Per-province exact GeoJSON (geo/) present? A lighter deploy can omit
        # the folder and set this to false: the viewer then hides that export.
        "geojson_export": True,
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    for p in sorted(OUT.rglob("*")):
        if p.is_file() and p.parent == OUT:
            log(f"  {p.name:28s} {p.stat().st_size / 1e6:8.2f} MB")
    log("done")


if __name__ == "__main__":
    main()
