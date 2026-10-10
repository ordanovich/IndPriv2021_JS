#!/usr/bin/env bash
# Publish the v2 viewer to GitHub Pages under /v2/:
#   https://ordanovich.github.io/IndPriv2021_JS/v2/
#
# Usage (Git Bash, from anywhere):
#   bash webapp/scripts/publish-preview.sh          # app code only (fast)
#   bash webapp/scripts/publish-preview.sh --data   # also replace data/ (after regenerating it)
#
# - Builds outside Dropbox: Dropbox locks webapp/dist while syncing and the
#   build fails intermittently.
# - The per-province exact GeoJSON (data/ct/geo, ~340 MB) is never published:
#   the Pages site is limited to 1 GB. meta.json gets geojson_export=false so
#   the viewer hides that export button.
# - Waits until the new build is actually being served.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${TMPDIR:-${TEMP:-/tmp}}/indpriv-publish-$$"
DIST="$WORK/dist"
PAGES="$WORK/gh-pages"
WITH_DATA=0
[ "${1:-}" = "--data" ] && WITH_DATA=1
mkdir -p "$WORK"
trap 'cd "$REPO"; git worktree remove --force "$PAGES" 2>/dev/null || true; git worktree prune; rm -rf "$WORK"' EXIT

echo "== build"
(cd "$REPO/webapp" && npx vite build --outDir "$DIST" --emptyOutDir --logLevel warn)
NEWJS=$(ls "$DIST/assets" | grep '^index-.*\.js$')
[ -n "$NEWJS" ] || { echo "build produced no index-*.js"; exit 1; }

echo "== gh-pages checkout"
cd "$REPO"
git fetch -q origin gh-pages
for k in 1 2 3; do
  git worktree add -f -B gh-pages "$PAGES" origin/gh-pages >/dev/null 2>&1 && break
  echo "  retry $k (Dropbox lock?)"; git worktree prune; sleep 5
done
cd "$PAGES"

echo "== copy"
git rm -rq --ignore-unmatch v2/assets v2/index.html
mkdir -p v2/assets
cp -r "$DIST/assets/." v2/assets/
cp "$DIST/index.html" v2/
if [ "$WITH_DATA" = 1 ]; then
  git rm -rq --ignore-unmatch v2/data
  mkdir -p v2/data
  (cd "$DIST/data" && tar --exclude='./ct/geo' -cf - .) | (cd v2/data && tar -xf -)
  python - v2/data/ct/meta.json <<'EOF'
import json, sys
p = sys.argv[1]; d = json.load(open(p, encoding="utf-8")); d["geojson_export"] = False
json.dump(d, open(p, "w", encoding="utf-8"), indent=2)
EOF
  for d in atlas images favicon.ico; do [ -e "$DIST/$d" ] && rm -rf "v2/$d" && cp -r "$DIST/$d" "v2/$d"; done
fi
git add -A v2
if git diff --cached --quiet; then echo "nothing changed"; exit 0; fi
git commit -q -m "v2 preview: update ($(cd "$REPO" && git rev-parse --short HEAD))"
git push -q origin gh-pages 2>&1 | grep -v "GH001\|git-lfs" || true

echo "== waiting for GitHub Pages to serve $NEWJS"
for i in $(seq 1 40); do
  if curl -s https://ordanovich.github.io/IndPriv2021_JS/v2/index.html | grep -q "$NEWJS"; then
    echo "live: https://ordanovich.github.io/IndPriv2021_JS/v2/"; exit 0
  fi
  sleep 15
done
echo "pushed, but not live after 10 min - check the repository's Pages / Actions tab"
