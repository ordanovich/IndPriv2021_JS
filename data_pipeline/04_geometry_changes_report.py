"""Illustrated PDF report: how census-tract geometry changed from 2011 to 2021.

Works directly from the INE shapefiles (no web data needed) and writes
  data_pipeline/output/cambios_geometria_2011_2021.pdf

Run from data_pipeline/:  python 04_geometry_changes_report.py
"""

import textwrap
from collections import defaultdict
from pathlib import Path

import geopandas as gpd
import matplotlib
import numpy as np
import pandas as pd
import pyogrio
import shapely

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.backends.backend_pdf import PdfPages  # noqa: E402
from matplotlib.lines import Line2D  # noqa: E402

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
OUT = HERE / "output" / "cambios_geometria_2011_2021.pdf"

STABLE = 0.95       # same code and >= 95 % overlap both ways = same territory
EQUAL_AREA = "EPSG:3035"

# Validated categorical pair (dataviz palette): blue = 2011, orange = 2021.
C11, C21, C_NEW = "#2a78d6", "#eb6834", "#1baf7a"
INK, MUTED, GRID = "#1f2937", "#6b7280", "#e5e7eb"

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 9, "axes.edgecolor": GRID,
    "axes.labelcolor": INK, "xtick.color": MUTED, "ytick.color": MUTED,
    "axes.spines.top": False, "axes.spines.right": False,
})


def load(shp):
    g = pyogrio.read_dataframe(DATA / shp, columns=["CUSEC", "NMUN", "NPRO", "NCA"])
    g["CUSEC"] = g["CUSEC"].str.strip()
    g["geometry"] = shapely.make_valid(g.geometry.values)
    return g.to_crs(EQUAL_AREA).reset_index(drop=True)


print("Leyendo shapefiles…")
a = load("SECC_CE_20210101.shp")              # 2021
b = load("SECC_CPV_E_20111101_01_R_INE.shp")   # 2011
area_a, area_b = a.area.to_numpy(), b.area.to_numpy()

print("Cruzando geometrías…")
ia, ib = b.sindex.query(a.geometry, predicate="intersects")
inter = shapely.area(shapely.intersection(a.geometry.values[ia], b.geometry.values[ib]))
sa, sb = inter / area_a[ia], inter / area_b[ib]
keep = (sa >= 0.01) | (sb >= 0.01)
ia, ib, sa, sb = ia[keep], ib[keep], sa[keep], sb[keep]

code_a, code_b = a["CUSEC"].to_numpy(), b["CUSEC"].to_numpy()
idx_b = {c: i for i, c in enumerate(code_b)}
idx_a = {c: i for i, c in enumerate(code_a)}
fromA, fromB = defaultdict(list), defaultdict(list)
for i, j, p, q in zip(ia, ib, sa, sb):
    fromA[i].append((j, p, q))
    fromB[j].append((i, q, p))

# ── Classify every 2021 section ──────────────────────────────────────────────
same_overlap = {}
for i, j, p, q in zip(ia, ib, sa, sb):
    if code_a[i] == code_b[j]:
        same_overlap[i] = min(p, q)
cls = np.full(len(a), "nueva", dtype=object)
for i, c in enumerate(code_a):
    if c in idx_b:
        cls[i] = "estable" if same_overlap.get(i, 0) >= STABLE else "redibujada"
a["clase"] = cls

# Label swaps: same territory (>=95 % both ways) but under another code that
# itself still exists in 2021.
swaps = []
for i in range(len(a)):
    for j, p, q in fromA.get(i, []):
        if p >= STABLE and q >= STABLE and code_b[j] != code_a[i] and code_b[j] in idx_a:
            swaps.append((i, j))

# Mutual swaps (A's territory is called B and B's is called A) make the
# clearest examples.
mutual = [(i, j) for i, j in swaps
          if code_b[j] in idx_a and code_a[i] in idx_b
          and any(jj == idx_b[code_a[i]] for jj, p, q in fromA[idx_a[code_b[j]]] if p >= STABLE and q >= STABLE)]

# Splits: one 2011 section covering >= 3 sections of 2021 (each >= 90 % inside it).
splits = [(j, [i for i, p, q in fromB[j] if q >= 0.9]) for j in range(len(b))]
splits = [(j, kids) for j, kids in splits if len(kids) >= 3]
# Merges: one 2021 section containing >= 2 whole 2011 sections.
merges = [(i, [j for j, p, q in fromA[i] if q >= 0.9]) for i in range(len(a))]
merges = [(i, kids) for i, kids in merges if len(kids) >= 2]
# For the examples, only cases without slivers (every piece >= 12 % of the whole).
clean_splits = [(j, kids) for j, kids in splits if min(area_a[k] for k in kids) >= 0.12 * area_b[j]]
clean_merges = [(i, kids) for i, kids in merges if min(area_b[k] for k in kids) >= 0.12 * area_a[i]]
# Same code, boundary moved: same code, overlap 40-85 %.
moved = [i for i in range(len(a)) if cls[i] == "redibujada" and 0.4 <= same_overlap.get(i, 0) <= 0.85]

only11 = sorted(set(code_b) - set(code_a))
stats = {
    "Secciones 2021": len(a), "Secciones 2011": len(b),
    "Mismo código y mismo trazado": int((cls == "estable").sum()),
    "Mismo código, trazado distinto": int((cls == "redibujada").sum()),
    "Códigos nuevos en 2021": int((cls == "nueva").sum()),
    "Códigos que desaparecen (solo 2011)": len(only11),
    "Intercambios de etiqueta": len(swaps),
    "Divisiones (1 → ≥3)": len(splits),
    "Fusiones (≥2 → 1)": len(merges),
}
print(stats)


# ── Figures ──────────────────────────────────────────────────────────────────

def page_title(fig, title, subtitle=None):
    h = fig.get_figheight()
    fig.text(0.06, 1 - 0.45 / h, title, fontsize=15, fontweight="bold", color=INK, va="top")
    if subtitle:
        fig.text(0.06, 1 - 0.8 / h, textwrap.fill(subtitle, 105), fontsize=9.5, color=MUTED, va="top")


def fmt(n):
    return f"{n:,}".replace(",", ".")


def cover(pdf):
    fig = plt.figure(figsize=(8.27, 11.69))
    page_title(fig, "Cambios en las secciones censales, 2011 → 2021",
               "Atlas de Privación de España · comparación de la cartografía del INE de ambos censos")
    tiles = [
        ("Secciones en 2021", stats["Secciones 2021"], INK),
        ("Secciones en 2011", stats["Secciones 2011"], INK),
        ("Mismo código y mismo trazado", stats["Mismo código y mismo trazado"], C11),
        ("Mismo código, trazado distinto", stats["Mismo código, trazado distinto"], C21),
        ("Códigos nuevos en 2021", stats["Códigos nuevos en 2021"], C_NEW),
        ("Códigos que desaparecen", stats["Códigos que desaparecen (solo 2011)"], MUTED),
    ]
    for k, (label, value, col) in enumerate(tiles):
        x, y = 0.06 + (k % 2) * 0.45, 0.80 - (k // 2) * 0.11
        fig.patches.append(plt.Rectangle((x, y - 0.075), 0.41, 0.09, transform=fig.transFigure,
                                         facecolor="#f8fafc", edgecolor=GRID))
        fig.patches.append(plt.Rectangle((x, y - 0.075), 0.006, 0.09, transform=fig.transFigure,
                                         facecolor=col, edgecolor="none"))
        fig.text(x + 0.02, y - 0.002, label, fontsize=9, color=MUTED, va="top")
        fig.text(x + 0.02, y - 0.03, fmt(value), fontsize=20, fontweight="bold", color=INK, va="top")
    text = (
        "Cómo se ha hecho la comparación\n\n"
        "Se superponen las dos cartografías oficiales del INE (secciones a 1/11/2011 y a 1/1/2021) y, para cada par de "
        "secciones que se tocan, se calcula qué parte de cada una cubre la otra. Una sección se considera «la misma» en "
        f"ambos censos solo si tiene el mismo código y sus polígonos coinciden al menos en un {STABLE:.0%} en las dos "
        "direcciones.\n\n"
        "Lo que muestra este informe\n\n"
        f"• {fmt(stats['Mismo código, trazado distinto'])} secciones conservan el código pero cambiaron de límites: "
        "compararlas por código, como hacía el visor v1, mezcla territorios distintos.\n"
        f"• {fmt(stats['Divisiones (1 → ≥3)'])} secciones de 2011 se dividieron en tres o más, y "
        f"{fmt(stats['Fusiones (≥2 → 1)'])} secciones de 2021 resultan de fusionar dos o más de 2011.\n"
        f"• En {fmt(stats['Intercambios de etiqueta'])} casos el territorio no cambió pero el código sí "
        "(etiquetas intercambiadas o renumeradas). El propio INE anota algunos en el campo OBS del shapefile, "
        "p. ej. «Mal etiquetada desde 2015: las secciones 01-001 y 02-001 tenían las etiquetas intercambiadas».\n\n"
        "En los mapas de ejemplo, 2011 se dibuja en azul con línea discontinua y 2021 en naranja con línea continua."
    )
    fig.text(0.06, 0.43, text, fontsize=9.5, color=INK, va="top", wrap=True, linespacing=1.5)
    pdf.savefig(fig)
    plt.close(fig)


def by_ccaa(pdf):
    t = (a.groupby(["NCA", "clase"]).size().unstack(fill_value=0)
         .reindex(columns=["estable", "redibujada", "nueva"], fill_value=0))
    t = t.div(t.sum(axis=1), axis=0).sort_values("estable") * 100
    fig = plt.figure(figsize=(8.27, 11.69))
    page_title(fig, "Secciones de 2021 según su relación con 2011",
               "Por comunidad autónoma · porcentaje de las secciones de 2021 de cada comunidad")
    ax = fig.add_axes([0.32, 0.12, 0.6, 0.74])
    left = np.zeros(len(t))
    labels = {"estable": "Mismo código y trazado", "redibujada": "Mismo código, trazado distinto", "nueva": "Código nuevo"}
    for col, color in (("estable", C11), ("redibujada", C21), ("nueva", C_NEW)):
        vals = t[col].to_numpy()
        ax.barh(t.index, vals, left=left, color=color, edgecolor="white", linewidth=2, height=0.72, label=labels[col])
        for y, (l, v) in enumerate(zip(left, vals)):
            if v >= 6:
                ax.text(l + v / 2, y, f"{v:.0f} %", ha="center", va="center", fontsize=7.5,
                        color="white" if col != "nueva" else INK)
        left += vals
    ax.set_xlim(0, 100)
    ax.set_xlabel("% de las secciones de 2021")
    ax.xaxis.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.tick_params(axis="y", length=0, labelcolor=INK)
    ax.legend(loc="lower left", bbox_to_anchor=(-0.45, 1.01), ncol=3, frameon=False, fontsize=8.5)
    pdf.savefig(fig)
    plt.close(fig)


def overlap_hist(pdf):
    v = np.array([same_overlap[i] for i in same_overlap]) * 100
    fig = plt.figure(figsize=(8.27, 5.8))
    page_title(fig, "¿Cuánto coinciden las secciones que conservan el código?",
               "Solape mínimo entre el polígono de 2011 y el de 2021 con el mismo código (porcentaje del más pequeño de los dos)")
    ax = fig.add_axes([0.1, 0.12, 0.84, 0.64])
    bins = np.arange(0, 101, 2.5)
    n, edges, patches = ax.hist(v, bins=bins, color=C21, edgecolor="white", linewidth=1.5)
    for p, e in zip(patches, edges[:-1]):
        if e >= STABLE * 100:
            p.set_facecolor(C11)
    ax.set_yscale("log")
    ax.axvline(STABLE * 100, color=INK, linestyle="--", linewidth=1)
    ax.text(STABLE * 100 - 1, ax.get_ylim()[1] * 0.6, f"umbral {STABLE:.0%}", ha="right", color=INK, fontsize=8.5)
    ax.set_xlabel("Solape mínimo (%)")
    ax.set_ylabel("Número de secciones (escala log.)")
    ax.yaxis.grid(True, color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    stable_n = int((v >= STABLE * 100).sum())
    ax.text(0.01, 0.97, f"{fmt(stable_n)} por encima del umbral (azul) · {fmt(len(v) - stable_n)} por debajo (naranja)",
            transform=ax.transAxes, va="top", fontsize=8.5, color=INK)
    pdf.savefig(fig)
    plt.close(fig)


def draw_case(ax, idx21, idx11, title, note):
    sel_a, sel_b = a.iloc[sorted(set(idx21))], b.iloc[sorted(set(idx11))]
    box = shapely.box(*shapely.union_all(list(sel_a.geometry) + list(sel_b.geometry)).bounds)
    pad = max(box.bounds[2] - box.bounds[0], box.bounds[3] - box.bounds[1]) * 0.25
    view = box.buffer(pad, join_style="mitre")
    ctx = a[a.intersects(view)]
    ctx.boundary.plot(ax=ax, color="#d1d5db", linewidth=0.5)
    sel_b.plot(ax=ax, facecolor=C11, alpha=0.12, edgecolor="none")
    sel_a.boundary.plot(ax=ax, color=C21, linewidth=2.2)
    # 2011 on top, dashed: where both years share an edge it shows blue/orange.
    sel_b.boundary.plot(ax=ax, color=C11, linewidth=1.6, linestyle=(0, (4, 3)))
    for _, r in sel_b.iterrows():
        p = r.geometry.representative_point()
        ax.annotate(r.CUSEC[-5:], (p.x, p.y), fontsize=6.5, color=C11, ha="center", va="bottom",
                    xytext=(0, 3), textcoords="offset points", fontweight="bold")
    for _, r in sel_a.iterrows():
        p = r.geometry.representative_point()
        ax.annotate(r.CUSEC[-5:], (p.x, p.y), fontsize=6.5, color=C21, ha="center", va="top",
                    xytext=(0, -3), textcoords="offset points", fontweight="bold")
    x0, y0, x1, y1 = view.bounds
    ax.set_xlim(x0, x1)
    ax.set_ylim(y0, y1)
    ax.set_aspect("equal")
    ax.set_xticks([])
    ax.set_yticks([])
    for s in ax.spines.values():
        s.set_visible(True)
        s.set_color(GRID)
    r0 = sel_a.iloc[0]
    ax.set_title(f"{title}\n{r0.NMUN} ({r0.NPRO})", fontsize=9, color=INK, loc="left", fontweight="bold")
    ax.text(0, -0.03, textwrap.fill(note, 62), transform=ax.transAxes, fontsize=7.5, color=MUTED, va="top")
    # 1 km scale bar
    sx = x0 + (x1 - x0) * 0.05
    sy = y0 + (y1 - y0) * 0.05
    L = 10 ** np.floor(np.log10((x1 - x0) / 4))
    ax.plot([sx, sx + L], [sy, sy], color=INK, linewidth=2)
    ax.annotate(f"{L:g} m" if L < 1000 else f"{L / 1000:g} km", (sx + L / 2, sy), xytext=(0, 3),
                textcoords="offset points", ha="center", va="bottom", fontsize=7, color=INK)


def pick(items, key, n, prefer=("Madrid", "Barcelona", "Sevilla", "Valencia", "Zaragoza", "Málaga", "Bilbao", "Murcia")):
    """Up to n examples, favouring large cities and varied provinces."""
    out, seen = [], set()
    ranked = sorted(items, key=lambda it: (0 if a.NMUN[key(it)] in prefer else 1, -area_a[key(it)]))
    for it in ranked:
        prov = a.NPRO[key(it)]
        if prov in seen:
            continue
        out.append(it)
        seen.add(prov)
        if len(out) == n:
            break
    return out


def examples(pdf):
    cases = []
    for j, kids in pick(clean_splits, key=lambda s: s[1][0], n=4):
        cases.append(("División: 1 sección de 2011 → %d de 2021" % len(kids), kids, [j],
                      f"La sección {code_b[j]} de 2011 se divide en {len(kids)} secciones de 2021."))
    for i, kids in pick(clean_merges, key=lambda m: m[0], n=4):
        cases.append(("Fusión: %d secciones de 2011 → 1 de 2021" % len(kids), [i], kids,
                      f"La sección {code_a[i]} de 2021 agrupa {len(kids)} secciones enteras de 2011."))
    for i in pick(moved, key=lambda m: m, n=4):
        j = idx_b[code_a[i]]
        cases.append(("Mismo código, límites distintos", [i], [j],
                      f"{code_a[i]}: los polígonos de 2011 y 2021 solo coinciden en un {same_overlap[i]:.0%}. "
                      "Compararlos por código mezcla territorios distintos."))
    for i, j in pick(mutual, key=lambda s: s[0], n=4):
        k = idx_a[code_b[j]]
        jj = idx_b.get(code_a[i])
        cases.append(("Mismo territorio, código cambiado", [i, k], [j] + ([jj] if jj is not None else []),
                      f"Las secciones {code_b[j]} y {code_a[i]} intercambian el código entre 2011 y 2021: "
                      "el mismo territorio aparece con el código del vecino."))
    per_page = 4
    for start in range(0, len(cases), per_page):
        fig = plt.figure(figsize=(8.27, 11.69))
        page_title(fig, "Ejemplos de cambios de trazado",
                   "Azul discontinuo: secciones de 2011 · naranja continuo: secciones de 2021 · gris: secciones vecinas de 2021. "
                   "Las etiquetas son los 5 últimos dígitos del código.")
        handles = [Line2D([], [], color=C11, linestyle=(0, (4, 2)), linewidth=1.8, label="2011"),
                   Line2D([], [], color=C21, linewidth=1.4, label="2021")]
        fig.legend(handles=handles, loc="upper right", bbox_to_anchor=(0.95, 0.955), ncol=2, frameon=False)
        for k, (title, i21, i11, note) in enumerate(cases[start:start + per_page]):
            ax = fig.add_axes([0.06 + (k % 2) * 0.47, 0.49 - (k // 2) * 0.43, 0.42, 0.36])
            draw_case(ax, i21, i11, title, note)
        pdf.savefig(fig)
        plt.close(fig)


OUT.parent.mkdir(exist_ok=True)
with PdfPages(OUT) as pdf:
    cover(pdf)
    by_ccaa(pdf)
    overlap_hist(pdf)
    examples(pdf)
    meta = pdf.infodict()
    meta["Title"] = "Cambios en las secciones censales 2011-2021"
    meta["Author"] = "Atlas de Privación de España"
print("Escrito:", OUT)
