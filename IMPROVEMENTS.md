# Atlas de Privación de España — Improvement Brief
> Instructions for an autonomous Claude Code session. Read this document in full before touching any file.

---

## 0. Safety rules — read before anything else

The existing app on `master` is **fully working and must remain so at every step**. Follow these rules without exception:

### 0.1 Always work on a branch

**Git branches are entirely local — no GitHub account or internet connection is needed.** Creating a branch, committing to it, and merging it back to `master` all happen inside the project folder on this machine. This is purely a safety mechanism so that `master` always stays in a working state.

```powershell
git checkout -b feature/<short-name>   # create and switch to a new branch
# ... make changes, test them ...
git add <files>
git commit -m "Add <feature name>"
git checkout master
git merge feature/<short-name>         # merge back to master once verified
```

Never commit directly to `master`. Merge to `master` only after running the automated smoke tests described in §0.3.

### 0.2 Risk classification — safe vs risky tasks

**Safe tasks (new files only — existing code untouched):**
These can be done in any order. They add new components or content without modifying anything that currently works.
- Demo version (§4) — new script, new config files, new banner component
- Validation tab (§3.3) — new tab added to `AboutPanel.jsx`; existing tabs are untouched
- Search panel (§3.2) — new `SearchPanel.jsx` file; mounted in `UserInterface.jsx` as an additive render
- Rankings panel (§3.5) — new `RankingsPanel.jsx` file
- Citation / BibTeX in AboutPanel (§3.9) — additive content
- Province panel enhancements (§3.8) — additive to existing component
- Export: CSV + stats clipboard (§3.7) — additive to `ExportPanel.jsx`
- Loader localisation (§3.10) — moves hardcoded strings to `translations.js`, no logic change

**Risky tasks (modify existing working logic):**
Do these **last**, each on its own branch, with automated smoke tests (§0.3) after each one before merging.
- **Permalink / URL state (§3.1)** — touches `render.jsx` startup sequence and `AppContext.js`. If broken, the app will not initialise at all.
- **Delta / change layer (§3.4)** — mutates features in `geoDataStore.js` (affects all existing stats), adds a third item to `simple.json`, and extends `updateCatalogItems` in `UserInterface.jsx` (drives all quintile highlighting). If broken, the map colours and ExtentChart stats will be wrong.
- **IP scatterplot (§3.6)** — modifies the existing `ExtentChart.jsx`. If broken, the viewport distribution chart and quintile-click-to-highlight stop working.

### 0.3 Automated smoke tests — run after every risky task

**This session is designed to run without human interaction.** All checks below can be performed autonomously. Do not wait for a human to open a browser.

After completing a risky task, run these checks before merging to `master`:

**1. Build check** — verify the production bundle compiles without errors:
```powershell
cd terria_frontend
npx gulp build-app
```
If this exits with errors, do not merge. Fix the errors first.

**2. Dev server smoke test** — start the dev server, confirm it responds, then stop it:
```powershell
cd terria_frontend
# Start in background, wait for it to be ready, then make a request
Start-Process -NoNewWindow -FilePath "npx" -ArgumentList "gulp","dev" -PassThru | Out-Null
Start-Sleep -Seconds 20
$r = Invoke-WebRequest -Uri "http://localhost:3001" -UseBasicParsing -TimeoutSec 10
if ($r.StatusCode -ne 200) { throw "Dev server did not respond" }
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
```
HTTP 200 from the root confirms the app bundle is served correctly.

**3. Code review before merge** — before running `git merge`, re-read every file you changed and verify:
- No `console.error` or `throw` paths are reachable in normal usage.
- All new strings are in `translations.js` (no hardcoded Spanish or English in JSX).
- `updateCatalogItems` still handles all three layer names (`atlas-2021`, `atlas-2011`, `atlas-delta`) if you touched `UserInterface.jsx`.
- `geoDataStore.js` still exports `ensureDataLoaded`, `onDataReady`, `getCachedData`, `PROV_TO_CCAA`, `CCAA_LIST`, `provCode`, `centroid`, `inRect` — nothing removed.

If any check fails, fix it on the feature branch before merging.

> **Visual regression** (map colours, interactive clicks, panel animations) is deferred to a single review by the project owner once all work is complete and synced via Dropbox.

### 0.4 One feature per commit
Each logical unit of work gets its own commit with a clear subject line (e.g. `Add validation tab to AboutPanel`). No bundling unrelated changes. This makes it easy to `git revert` a single feature if it causes problems later.

### 0.5 GitHub is NOT accessible — work locally only

The git remote in `.git/config` points to `https://github.com/ordanovich/IndPriv2021_JS` — that is the original researcher's private repository and **you do not have push access to it**. Do not attempt `git push` at any point — it will fail and is not needed.

Everything you need to do (branches, commits, merges, history, `git log`, `git diff`, `git revert`) works entirely offline inside this folder. Git does not need GitHub to function — GitHub is only needed for `push` and `pull`, neither of which is required here.

This folder is shared via Dropbox — the project owner will see your commits automatically once Dropbox syncs. **Do not work simultaneously with the project owner** to avoid git state conflicts in the shared `.git/` directory.

### 0.6 Pre-flight — run this automatically before any other step

**Do this yourself at the very start of the session. No human action is needed.**

```powershell
# 1. Verify Node version
node --version   # must print v16 or higher; if not, stop and report the version found

# 2. Check the large data files are present
if (-not (Test-Path "terria_frontend/wwwroot/data/secciones_unified.geojson")) {
    throw "MISSING: secciones_unified.geojson — cannot proceed. Ask the project owner to confirm Dropbox has fully synced this file."
}
if (-not (Test-Path "terria_frontend/wwwroot/atlas")) {
    throw "MISSING: wwwroot/atlas/ folder — province images are absent."
}

# 3. Install dependencies (safe to re-run; no-op if already up to date)
cd terria_frontend
npm install
```

Only begin feature work once all three steps complete without errors.

### 0.7 When your work is complete

No zip, no file transfer, no human steps required. The session ends autonomously.

Before finishing:
1. Ensure all completed feature branches are merged to `master`.
2. Leave any incomplete task on its named feature branch (not `master`) with a clear last commit message describing the state.
3. Run `git log --oneline -20` and print the output as your final message — this gives the project owner an immediate summary of what was done.

The project owner will review the result visually on her own machine via `cd terria_frontend && npx gulp dev`.

---

## 1. Project overview

This is a **TerriaJS 8.11.3** web mapping application visualising Spain's Deprivation Index (Índice de Privación) at census-section level (36,333 secciones censales). The app lives in `terria_frontend/` inside a Dropbox-managed git repo.

- **Dev server:** `cd terria_frontend && npx gulp dev` → http://localhost:3001
- **Production build:** `cd terria_frontend && npx gulp build-app` (outputs to `wwwroot/build/`)
- **Git repo:** https://github.com/ordanovich/IndPriv2021_JS (branch: `master`)

All custom source files are in `terria_frontend/lib/Views/`. Do **not** modify anything under `terriajs/` (upstream library).

---

## 2. Current architecture — complete inventory

### Data
| File | Description |
|------|-------------|
| `wwwroot/data/secciones_unified.geojson` | 139 MB — excluded from git; **not available in the repo** — do not try to read it |

Each GeoJSON feature carries: `CUSEC` (section code), `NMUN` (municipality name), `NPRO` (province name), `IP2011` (raw 2011 index, float), `IP2021` (raw 2021 index, float), `Q11_Label` (2011 quintile string), `Q21_Label` (2021 quintile string), `Q21_num` (integer 1–5).

> **Critical methodological constraint:** The 2011 and 2021 indices were built with different variables and different PCA runs. They are **not directly comparable in absolute terms**. Any feature showing both must carry a clear disclaimer. Quintile classes are used only to facilitate relative territorial reading.

### Custom source files (`terria_frontend/lib/Views/`)

| File | Role |
|------|------|
| `AppContext.js` | React context: `{ lang, toggleLang, colorblind, toggleColorblind }` |
| `translations.js` | Full bilingual string map `TR = { es:{...}, en:{...} }` |
| `UserInterface.jsx` | Main UI wrapper. Exports `STD_COLORS` / `CB_COLORS`. Defines `LIGHT_THEME` (full token set). Defines `updateCatalogItems(terria, lang, colorblind, selectedQuintile)` which applies colors and dims non-selected quintile to `#d0d0d0` on the map. Wires `selectedQuintile` state to `ExtentChart`. |
| `geoDataStore.js` | Singleton GeoJSON cache: `ensureDataLoaded()`, `onDataReady(fn)`, `getCachedData()`. Also exports `PROV_TO_CCAA`, `CCAA_LIST`, `provCode()`, `centroid()`, `inRect()`. |
| `ExtentChart.jsx` | Bottom-right floating widget. Shows quintile distribution of sections in current map view; updates on pan/zoom. Clicking a quintile row highlights that class on the map (others → `#d0d0d0`) and opens a stats subpanel (n, μ, median, σ, 12-bin histogram with mean marker, min/max labels). Has a "× Quitar filtro / × Clear filter" button. |
| `ExportPanel.jsx` | Slide-in right panel. Filter by CCAA / province / drawn rectangle. Export XLSX or GeoJSON. Uses `xlsx` library. Uses `UserDrawing` from TerriaJS for rectangle drawing. |
| `AboutPanel.jsx` | Left-side 360 px slide-in panel. Three tabs: **Variables** (9 PCA variables with Spearman ρ bar chart; zoomable images), **ACP** (factor structure, stats box, PCA loadings table), **Atlas** (5 volumes with placeholder DOI links — href="#"). Sub-components: `ZoomableImage`, `Lightbox` (ESC key supported). |
| `ProvinceAtlasPanel.jsx` | Bottom-left floating card. Fires on `terria.selectedFeature` via MobX `autorun`. Derives `CPRO = String(CUSEC).slice(0,2)`. Shows province map images (continuo / discreto toggle) for all 52 provinces. |
| `Loader.tsx` | Full-screen loading overlay: logo, spinner, quintile colour bar (staggered fade-in), 3 stat cards, 4 rotating fact sentences (4.2 s interval). Waits for both GeoJSON cache ready AND TerriaJS workbench items loaded before auto-dismissing. |
| `render.jsx` | Root renderer — mounts everything into `#root`. |

### Config files
| File | Role |
|------|------|
| `wwwroot/config.json` | App name, `brandBarElements`, Spanish disclaimer |
| `wwwroot/init/simple.json` | Catalog: two GeoJSON items (`atlas-2021` / `atlas-2011`), `featureInfoTemplate`, `defaultStyle`, Carto Positron basemap |
| `wwwroot/index.ejs` | `lang="es"`, Spanish title/meta |

### Key design decisions (respect these)
- **Light theme:** `LIGHT_THEME` object in `UserInterface.jsx` overrides all TerriaJS dark defaults via `viewState.setTheme()`.
- **Quintile highlighting:** clicking a quintile dims all others to `#d0d0d0` via `updateCatalogItems`. This must remain consistent across both `ExtentChart` row clicks and any new UI that selects a class.
- **Colorblind palette:** `CB_COLORS = ["#4575b4","#91bfdb","#ffffbf","#fc8d59","#d73027"]`. Toggle via the ◑ button. All new colour-coded features must respect this toggle.
- **Bilingual:** Every user-visible string must live in `translations.js` under both `es` and `en` keys. Never hardcode Spanish or English strings directly in components.
- **Enum values are Spanish strings in the GeoJSON.** Language switching changes labels, not underlying data values.
- **Feature Info panel** is styled white via `tjs-feature-info-*` CSS class overrides in `UserInterface.jsx`.
- **Display Variable dropdown is hidden** via `div:has(> label[for*="-activeStyle"]) { display: none }`.

---

## 3. Improvements — priority order

Work through these in the order listed. Each section states what to build, which files to touch, and any constraints.

---

### 3.1 Permalink / shareable URL state `[HIGH PRIORITY]`

**Why it matters:** Colleagues need to share a specific map view (e.g., "look at Andalucía at quintile 5"). Currently there is no way to encode state in the URL.

**What to build:**
Encode the following in the URL hash on every relevant state change, and restore from hash on load:
- Map centre and zoom / bounding box (read from `terria.cesium` or `terria.leaflet`)
- Active year (`"2021"` or `"2011"`)
- Selected quintile (1–5 or `null`)
- Language (`"es"` or `"en"`)

Use a compact format like `#v=2021&q=5&lang=es&bbox=-4.2,37.8,-3.1,38.6` (west,south,east,north in degrees).

**Files to touch:** `render.jsx` (read hash on mount, write hash via `useEffect` monitoring terria state), `UserInterface.jsx` (pass initial state from hash to `AppProvider`), `AppContext.js` (accept initial lang from props).

**Constraints:**
- Do not use React Router — the app does not use it.
- Hash write must be debounced (300 ms) to avoid flooding history on pan/zoom.
- On page load, if a valid hash is present, fly to the encoded bbox after the loader dismisses.

---

### 3.2 Search / jump-to panel `[HIGH PRIORITY]`

**Why it matters:** Currently users must manually navigate to find a specific municipality or section. Researchers will want to look up named places directly.

**What to build:**
A search input in the top toolbar (right of the language toggle button). As the user types (≥ 3 characters), filter the in-memory GeoJSON for matching `NMUN` (municipality names) and `NPRO` (province names). Show a dropdown of up to 10 results. On selection, fly the map to the bounding box of all matching features.

- Use `getCachedData()` from `geoDataStore.js` — the data is already in memory.
- Group results: provinces first, then municipalities.
- Fly-to: compute bbox of all features with that `NMUN` value and call `terria.currentViewer.zoomTo(rectangle)`.
- Add both `es` and `en` strings to `translations.js`.

**New file:** `SearchPanel.jsx` in `lib/Views/`. Import and render it inside `UserInterface.jsx`.

---

### 3.3 Validation tab in `AboutPanel.jsx` `[HIGH PRIORITY]`

**Why it matters:** The RF R² = 0.953 result and territorial correlations are the strongest scientific validation of the index. They deserve a dedicated tab visible to any user.

**What to build:**
Add a 4th tab "Validación / Validation" to `AboutPanel.jsx` with the following hard-coded content (sourced from the R output files — use the values below as they are definitive):

**Random Forest reconstruction** (Bootstrap PCA + RF, expert variable selection):
- R² = 0.953
- Method: reconstruction of PC1 from the 9 model variables using a Random Forest; 100-iteration bootstrap PCA confirmed structural stability.

**Territorial correlations (IP2021 vs socioeconomic context by DEGURBA):**
| DEGURBA class | Spearman ρ |
|---|---|
| Urban (densely populated) | 0.734 |
| Intermediate | 0.341 |
| Rural | 0.609 |

Display these as a clean styled table with the same visual language as the existing `AboutPanel` tabs. Add a short explanatory paragraph (in both languages) noting that the lower intermediate correlation reflects the known heterogeneity of peri-urban areas, not a weakness of the index.

**Files to touch:** `AboutPanel.jsx`, `translations.js`.

---

### 3.4 Change / delta layer (2011 → 2021) `[HIGH PRIORITY]`

**Why it matters:** Researchers want to know which areas got better or worse between 2011 and 2021. Since the two indices are not directly comparable in absolute terms, use **quintile rank change** as the basis.

**What to build:**
Compute a derived column `deltaQ = Q21_num - Q11_num` (integer −4 to +4) and classify each section into one of 5 categories:
| Category | deltaQ range | Label ES | Label EN | Color |
|---|---|---|---|---|
| Mejora notable | ≤ −2 | Mejora notable | Strong improvement | `#1a9850` |
| Mejora leve | −1 | Mejora leve | Slight improvement | `#91cf60` |
| Estable | 0 | Estable | Stable | `#ffffbf` |
| Empeoramiento leve | +1 | Empeoramiento leve | Slight worsening | `#fc8d59` |
| Empeoramiento notable | ≥ +2 | Empeoramiento notable | Strong worsening | `#d73027` |

Add a **third catalog item** `atlas-delta` to `simple.json` that uses `secciones_unified.geojson` with a `defaultStyle` based on a new computed column. Because TerriaJS cannot compute derived columns server-side from a flat GeoJSON, compute `deltaQ` at load time in `geoDataStore.js` — mutate each feature's `properties` to add `deltaQ` and `DeltaLabel` after `ensureDataLoaded()` finishes.

- Hide the delta layer by default (`"show": false`).
- Add it to the workbench alongside the existing two layers.
- Add a disclaimer string to `translations.js` that appears in the feature info template for this layer: "Comparación basada en cambio de quintil. Los índices 2011 y 2021 no son directamente comparables en valores absolutos."
- Respect colorblind toggle: define a `CB_DELTA_COLORS` palette using colorblind-safe diverging colors (e.g., `["#2166ac","#92c5de","#f7f7f7","#f4a582","#d6604d"]`).
- Add delta-layer strings to `translations.js`.

**Files to touch:** `geoDataStore.js`, `simple.json`, `UserInterface.jsx` (handle delta layer in `updateCatalogItems`), `translations.js`.

---

### 3.5 Rankings table panel `[MEDIUM PRIORITY]`

**Why it matters:** Researchers want to identify the most deprived sections in a given area — by name, not just visually.

**What to build:**
A new floating panel (bottom-centre or as a tab in `ExtentChart`) showing a sortable table of all sections in the current viewport, ranked by IP score (descending by default).

Columns: `NMUN`, `NPRO`, `CUSEC`, `IP2021` (or `IP2011` when 2011 layer is active), `Q`-label.

Controls:
- Sort by IP (asc/desc toggle)
- Sort by province
- Pagination (25 rows per page)
- Click a row → fly to that section and trigger its `featureInfo` panel

The table should be collapsible (like `ExtentChart`) and only appear when the user explicitly opens it (add a button to the toolbar).

**New file:** `RankingsPanel.jsx`. Add strings to `translations.js`.

---

### 3.6 IP scatterplot (2011 vs 2021) `[MEDIUM PRIORITY]`

**Why it matters:** Showing the correlation between the two time-points for sections in the current view gives researchers an immediate visual sense of territorial continuity — and where sections moved between quintiles.

**What to build:**
Add a tab or a toggle in `ExtentChart.jsx` that renders a scatterplot of `IP2011` (x-axis) vs `IP2021` (y-axis) for all sections currently in the viewport. Use plain Canvas or a minimal SVG implementation (no additional chart library dependency).

- Points coloured by Q21 quintile using `STD_COLORS` / `CB_COLORS`.
- Axis labels: "IP 2011" / "IP 2021".
- A diagonal reference line (y = x scaled) to show "no change" — label it "Línea de referencia / Reference line".
- On hover, show a tooltip with `NMUN`, `CUSEC`, IP values.
- Add a **prominent disclaimer** below the chart: the x and y axes use different scales (the two indices have different distributions) so the absolute position of points is not meaningful — only relative cluster positions are informative.
- Add strings to `translations.js`.

**Files to touch:** `ExtentChart.jsx`, `translations.js`.

---

### 3.7 Export improvements `[MEDIUM PRIORITY]`

**What to add to `ExportPanel.jsx`:**

1. **CSV export** alongside the existing XLSX option. Use the same data-preparation logic; output a plain UTF-8 CSV with headers `CUSEC,NMUN,NPRO,IP2011,IP2021,Q11_Label,Q21_Label,DeltaQ` (DeltaQ only if the delta field has been computed by geoDataStore).

2. **Export stats snapshot** — a button that downloads the current viewport stats (quintile counts, mean, median, σ for active year) as a small JSON file. Label: "⬇ Exportar estadísticas actuales / ⬇ Export current stats".

3. **"Copy stats to clipboard"** button in `ExtentChart.jsx` stats subpanel — copies a formatted plain-text summary (for pasting into emails or reports).

Add all new strings to `translations.js`.

---

### 3.8 Province panel enhancements `[MEDIUM PRIORITY]`

Improvements to `ProvinceAtlasPanel.jsx`:

1. **Download button** — a small "⬇ Descargar imagen / ⬇ Download image" button that triggers a download of the currently displayed province PNG. Use an `<a download>` element pointing to the same `/atlas/provinces/` path.

2. **Previous / next navigation** — arrow buttons (← →) to cycle through all 52 provinces in alphabetical order when the panel is open, without needing to click on the map. Maintain the current CPRO state internally; clicking an arrow increments/decrements the province index in the sorted province list.

3. **Province aggregate stats box** — below the image, show a compact stats box: number of sections in this province, mean IP2021 (computed from `getCachedData()` filtered by `CPRO`), and the quintile breakdown as a small horizontal bar. Compute on province change (lazy, cache the result per province in a `useRef` map).

---

### 3.9 Citation / bibliography in `AboutPanel.jsx` `[LOWER PRIORITY]`

**What to add to the Atlas tab:**

1. A **"Citar / Cite"** section below the volume list with the full APA citation for the atlas (use a placeholder DOI until Zenodo is confirmed — mark clearly as `[DOI pendiente / DOI pending]`).

2. A **"Copiar BibTeX / Copy BibTeX"** button that copies a preformatted BibTeX entry to clipboard. Show a "¡Copiado! / Copied!" flash for 1.5 s.

3. When the Zenodo DOI is available, the researcher will provide it — leave a clearly marked `// TODO: REPLACE_DOI` comment in the code so it is easy to find.

---

### 3.10 Loader localisation `[LOWER PRIORITY]`

The 4 rotating fact sentences in `Loader.tsx` are currently hardcoded in Spanish. Move them to `translations.js` under a `loaderFacts` key (array of 4 strings, both `es` and `en`). The Loader needs access to the current language — either pass `lang` as a prop from `render.jsx`, or read it from `localStorage` (where AppContext persists it).

---

## 4. Demo version

### Goal
A lightweight, self-contained version of the app that can be shared with colleagues without requiring the 139 MB full dataset. Target size: ≤ 15 MB for the GeoJSON.

### Data subsetting
Create a demo subset by extracting features for **5 representative provinces** that cover geographic and deprivation diversity:
- **Madrid** (CPRO = "28") — large urban
- **Barcelona** (CPRO = "08") — large urban
- **Sevilla** (CPRO = "41") — Southern deprivation
- **Asturias** (CPRO = "33") — Northern industrial decline
- **Castellón** (CPRO = "12") — Mediterranean mid-size

Write a one-time Node.js script `scripts/make_demo.js` that reads `wwwroot/data/secciones_unified.geojson`, filters features where `CPRO` (first 2 chars of `CUSEC`) is in the set above, and writes `wwwroot/data/secciones_demo.geojson`. Run it once; commit the demo file to git (it will be under 15 MB).

```js
// scripts/make_demo.js
const fs   = require("fs");
const DEMO_PROVINCES = new Set(["08","12","28","33","41"]);
const src  = JSON.parse(fs.readFileSync("terria_frontend/wwwroot/data/secciones_unified.geojson","utf8"));
src.features = src.features.filter(f => DEMO_PROVINCES.has(String(f.properties.CUSEC).slice(0,2)));
fs.writeFileSync("terria_frontend/wwwroot/data/secciones_demo.geojson", JSON.stringify(src));
console.log(`Demo: ${src.features.length} features`);
```

### Demo config
Create `wwwroot/init/demo.json` — identical to `simple.json` but:
- `url` points to `data/secciones_demo.geojson` in all three catalog items.
- `homeCamera` zooms to Spain's bounding box (same as current).

Create `wwwroot/config_demo.json` — identical to `config.json` but with `"initializationUrls": ["init/demo.json"]` and a modified `appName`: `"Atlas de Privación · Demo (5 provincias)"`.

### Demo banner
In `UserInterface.jsx`, add a conditional demo-mode banner. Detect demo mode by checking `window.location.search.includes("demo=1")` OR by the presence of a `DEMO_MODE` constant exported from a new `buildConfig.js` file (set to `true` when building demo). The banner: a thin yellow strip at the top of the page reading "Versión de demostración · 5 provincias únicamente · Datos completos disponibles en la publicación / Demo version · 5 provinces only · Full data available in the publication". It should be dismissible (× button) with the dismissed state saved to `sessionStorage`.

### Static hosting (GitHub Pages)

**Your task: build `dist/` only — do NOT push to GitHub.**

Add a Gulp task `gulp build-demo-dist` to `gulpfile.js` (or a `build-demo` npm script in `package.json`) that:
1. Runs `npx gulp build-app` with the demo config active (set `DEMO_MODE = true` in `buildConfig.js` before building, restore after).
2. Creates a `dist/` folder at the project root (sibling of `terria_frontend/`).
3. Copies into `dist/`: `wwwroot/build/`, `wwwroot/data/secciones_demo.geojson`, `wwwroot/init/demo.json`, and `wwwroot/config_demo.json`.

Stop there. Do not install or use the `gh-pages` npm package. Do not run any `git push`. Commit the Gulp/npm task code to `master` but do **not** commit the `dist/` folder itself (add `dist/` to `.gitignore`).

> **The project owner will push to GitHub Pages herself** once work is complete and synced via Dropbox. She runs this single command from the project root:
> ```powershell
> npx gh-pages -d dist --dotfiles
> ```
> The app will then be accessible at `https://ordanovich.github.io/IndPriv2021_JS/?demo=1`.

**For testing the demo locally** (before the push), the colleague can serve `dist/` with any static server:
```powershell
npx serve dist
```

---

## 5. Technical constraints and notes

1. **No new npm dependencies** unless absolutely necessary. The codebase already includes: React 17, MobX, TerriaJS, xlsx, PropTypes. For charts use SVG or Canvas directly. For the `gh-pages` deploy task, `gh-pages` npm package is acceptable.

2. **All new components** follow the existing visual language: `LIGHT_THEME` token set, inline styles (no CSS modules for new files), `fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"`.

3. **All new text** goes through `translations.js`. Never hardcode user-visible strings.

4. **Colorblind toggle** must be respected by any new colour-coded element. Check `colorblind` from `useApp()` and switch between standard and CB palettes.

5. **Avoid touching TerriaJS internals.** All integration goes through the public API: `terria.workbench`, `terria.cesium`, `terria.leaflet`, `terria.selectedFeature`, `terria.currentViewer`, MobX `autorun`.

6. **GeoJSON is mutated in memory** (via `geoDataStore.js`) for derived columns. This is intentional — do not re-fetch the file.

7. **Windows / PowerShell** is the development environment. All shell commands in instructions should use PowerShell syntax. The dev server runs with `npx gulp dev`.

8. **Git:** never include the 139 MB GeoJSON in commits. It is in the root `.gitignore`. The demo file (< 15 MB) may be committed. Static atlas images are excluded via `.git/info/exclude` — do not change this.

9. **Commit style:** single focused commits per feature, present-tense imperative subject line, no Co-Authored-By lines.

---

## 6. Suggested implementation order

Work safe tasks first (no regression risk), risky tasks last (one branch each, full regression check before merging).

### Phase 1 — Safe, additive only (do in any order)

| Step | Task | Branch name | Effort |
|------|------|-------------|--------|
| 1 | Demo data script + demo config + demo banner | `feature/demo-version` | Small |
| 2 | Validation tab in AboutPanel | `feature/validation-tab` | Small |
| 3 | Citation / BibTeX in AboutPanel | `feature/citation` | Small |
| 4 | Loader localisation (facts → translations.js) | `feature/loader-i18n` | Small |
| 5 | Province panel enhancements (download, prev/next, stats) | `feature/province-panel` | Small |
| 6 | Export: CSV + stats snapshot + clipboard copy | `feature/export-csv` | Small |
| 7 | Search / jump-to panel | `feature/search` | Medium |
| 8 | Rankings table panel | `feature/rankings` | Medium |
| 9 | Build `dist/` for GitHub Pages (no push — project owner pushes separately) | `feature/gh-pages-deploy` | Small |

### Phase 2 — Risky, one branch each, full regression check (§0.3) before merging

| Step | Task | Branch name | Effort | What can break |
|------|------|-------------|--------|----------------|
| 10 | Permalink / shareable URL state | `feature/permalink` | Medium | App initialisation |
| 11 | IP scatterplot in ExtentChart | `feature/scatterplot` | Medium | ExtentChart + quintile highlight |
| 12 | Change / delta layer | `feature/delta-layer` | Medium | Map colours, geoDataStore, workbench |

---

## 7. Definition of done for each task

- The dev server (`npx gulp dev`) runs without errors.
- The feature works in both ES and EN language modes.
- The feature respects the colorblind toggle where applicable.
- All user-visible strings are in `translations.js`.
- No new TypeScript or lint errors introduced.
- The feature is consistent with `LIGHT_THEME` visual language.
- The production build (`npx gulp build-app`) completes successfully.
