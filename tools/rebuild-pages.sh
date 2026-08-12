#!/usr/bin/env bash
# Regenerate /web/pages/*.png from /docs/*.pdf at 200 DPI.
# Requires: poppler-utils (pdftoppm).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
src="$here/docs"
dst="$here/web/pages"
mkdir -p "$dst"
rm -f "$dst"/*.png
for f in "$src"/*.pdf; do
  base="$(basename "${f%.pdf}")"
  echo "→ $base"
  pdftoppm -r 200 -png "$f" "$dst/$base"
done
echo "✓ rebuilt $(ls "$dst"/*.png | wc -l) pages into $dst"
