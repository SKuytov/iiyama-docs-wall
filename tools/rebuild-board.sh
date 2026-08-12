#!/usr/bin/env bash
# Rebuild web/assets/board.jpg from docs/board-layout.pdf.
# The PDF is expected to be a single 3840×2160 pt page.
# Requires: poppler-utils (pdftoppm) + ImageMagick (convert).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
src="$here/docs/board-layout.pdf"
dst="$here/web/assets/board.jpg"

test -f "$src" || { echo "missing $src"; exit 1; }

tmp="$(mktemp -d)"
# Render at 2× (144 DPI) then downsample+sharpen — matches how the repo was built
pdftoppm -r 144 -png -f 1 -l 1 "$src" "$tmp/board"
convert "$tmp/board-1.png" -resize 3840x2160 -quality 94 -sampling-factor 4:2:0 \
        -strip -unsharp 0x0.5 "$dst"
rm -rf "$tmp"
echo "✓ rebuilt $dst"
