"""Independent check of the v2 web data against the original sources.

Re-reads the INE shapefiles and the Excel files and verifies, for each year:
  1. Table: one row per section, codes identical to the shapefile, IP equal
     to the Excel value, quintile consistent with the published cut-offs and
     with an independent recomputation.
  2. Tiles: at every zoom level, which sections are present, and that every
     feature's properties (q, ip, p, m) equal the table row it points to.
     From zoom 7 on, every section must be present. At zooms 4-6 a section
     may be absent only if it is smaller than one screen pixel there.

Run from data_pipeline/:  python 03_validate_web_data.py
Exits with code 1 if any value mismatches.
"""

import gzip
import json
import sys
from collections import defaultdict
from pathlib import Path

import mapbox_vector_tile
import numpy as np
import pandas as pd
import pyogrio
from pmtiles.reader import MmapSource, Reader, all_tiles

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
OUT = HERE.parent / "webapp" / "public" / "data" / "ct"

SOURCES = {
    "2021": ("SECC_CE_20210101.shp", "T25_IP2021_ACP_C_[i2_29]_v1.xlsx", "IP21_i2_29_cpa_Cna_tt_importar", "IP21_i2_29_cpa_Cna_df"),
    "2011": ("SECC_CPV_E_20111101_01_R_INE.shp", "IP2011_RE.xlsx", "Datos", "IP2011"),
}

FIRST_COMPLETE_ZOOM = 7


def metres_per_pixel(z):
    """512 px tiles, at the Canary Islands' latitude (the strictest in Spain)."""
    return 40075016.7 * np.cos(np.radians(28)) / (512 * 2 ** z)


errors = []


def fail(msg):
    errors.append(msg)
    print("  ERROR", msg)


for year, (shp, xlsx, sheet, col) in SOURCES.items():
    print(f"\n=== {year} ===")
    t = json.loads((OUT / f"{year}.json").read_text(encoding="utf-8"))
    f = t["fields"]
    ids = f["id"]
    n = len(ids)

    # 1. Table vs sources ---------------------------------------------------
    src = pyogrio.read_dataframe(DATA / shp, columns=["CUSEC"], read_geometry=True)
    src["CUSEC"] = src["CUSEC"].str.strip()
    if sorted(src["CUSEC"]) != ids:
        fail(f"{year}: table codes differ from shapefile codes")
    else:
        print(f"  table: {n} sections, codes identical to {shp}")
    x = pd.read_excel(DATA / xlsx, sheet_name=sheet, dtype={"CUSEC": str})
    x["CUSEC"] = x["CUSEC"].str.strip().str.zfill(10)
    excel = dict(zip(x["CUSEC"], x[col]))
    bad_ip = 0
    for i, c in enumerate(ids):
        v = excel.get(c)
        tv = f["ip"][i]
        if v is None or pd.isna(v):
            if tv is not None:
                bad_ip += 1
        elif tv is None or abs(round(float(v), 3) - tv) > 1e-9:
            bad_ip += 1
    if bad_ip:
        fail(f"{year}: {bad_ip} IP values differ from the Excel")
    else:
        print(f"  IP: all {n} values equal the Excel (3 decimals); {sum(v is None for v in f['ip'])} without value")

    ip = np.array([np.nan if v is None else v for v in f["ip"]])
    full = np.array([np.nan if v is None else float(v) for v in (excel.get(c) for c in ids)])
    br = np.quantile(full[np.isfinite(full)], [0, .2, .4, .6, .8, 1])
    if not np.allclose(br, t["breaks"], atol=1e-4):
        fail(f"{year}: cut-offs {t['breaks']} != recomputed {br}")
    q_re = np.where(np.isfinite(full), np.searchsorted(br[1:5], full, side="left") + 1, 0)
    q = np.array(f["q"])
    if (q != q_re).any():
        fail(f"{year}: {(q != q_re).sum()} quintiles differ from the recomputation")
    else:
        print(f"  quintiles: all consistent; cut-offs {np.round(br, 3).tolist()}; counts {np.bincount(q, minlength=6)[1:].tolist()}")

    # 2. Tiles vs table -----------------------------------------------------
    present = defaultdict(set)
    mismatches = 0
    with open(OUT / f"{year}.pmtiles", "rb") as fh:
        reader = Reader(MmapSource(fh))
        for (z, tx, ty), data in all_tiles(reader.get_bytes):
            if data[:2] == b"\x1f\x8b":
                data = gzip.decompress(data)
            layer = mapbox_vector_tile.decode(data).get("units")
            if not layer:
                continue
            for feat in layer["features"]:
                p = feat["properties"]
                i = p["i"]
                present[z].add(i)
                # Sections without a value carry no "ip" property at all.
                tip = p.get("ip")
                ip_ok = (tip is None) if not np.isfinite(ip[i]) else (tip is not None and abs(tip - ip[i]) <= 1e-6)
                if (p["q"] != q[i] or not ip_ok
                        or p["p"] != int(ids[i][:2]) or p["m"] != int(ids[i][:5])):
                    mismatches += 1
    if mismatches:
        fail(f"{year}: {mismatches} tile features whose values differ from the table")
    else:
        print("  tiles: every feature's values match its table row")

    area = src.set_index("CUSEC").loc[ids].geometry.area.to_numpy()   # m², EPSG:25830
    for z in sorted(present):
        miss = np.setdiff1d(np.arange(n), np.fromiter(present[z], int))
        if len(miss):
            px = np.sqrt(area[miss]) / metres_per_pixel(z)
            print(f"  z{z:>2}: {n - len(miss)} present, {len(miss)} absent (largest {px.max():.2f} px)")
            if z >= FIRST_COMPLETE_ZOOM:
                fail(f"{year} z{z}: {len(miss)} sections missing from tiles, e.g. {[ids[i] for i in miss[:5]]}")
            elif px.max() >= 1:
                fail(f"{year} z{z}: {(px >= 1).sum()} absent sections cover a pixel or more")
        else:
            print(f"  z{z:>2}: all {n} present")

print("\nRESULT:", "OK" if not errors else f"{len(errors)} problem(s)")
sys.exit(1 if errors else 0)
