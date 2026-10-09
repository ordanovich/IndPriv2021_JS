"""Per-zoom tile statistics of a PMTiles file (count, total, mean, max size).

Usage: python tile_stats.py path/to/file.pmtiles
"""
import sys
from collections import defaultdict

from pmtiles.reader import MmapSource, Reader, all_tiles
from pmtiles.tile import tileid_to_zxy

path = sys.argv[1]
with open(path, "rb") as f:
    reader = Reader(MmapSource(f))
    h = reader.header()
    print("zoom", h["min_zoom"], "-", h["max_zoom"], "| tile compression", h["tile_compression"])
    sizes = defaultdict(list)
    for (z, x, y), data in all_tiles(reader.get_bytes):
        sizes[z].append(len(data))
    print(f"{'z':>3} {'tiles':>7} {'total MB':>9} {'mean KB':>8} {'max KB':>8}")
    for z in sorted(sizes):
        s = sizes[z]
        print(f"{z:>3} {len(s):>7} {sum(s)/1e6:>9.1f} {sum(s)/len(s)/1e3:>8.1f} {max(s)/1e3:>8.1f}")
