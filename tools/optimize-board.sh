#!/usr/bin/env bash
# Produce the panel-ready board.jpg from a high-resolution master.
#
# Why this exists: the iiyama LH6560UHS-B2AG is a 3840x2160 panel. An image
# larger than that cannot show more detail -- the WebView just downscales it --
# but it DOES cost RAM: a decoded bitmap is width*height*4 bytes. A 16000x9000
# master needs ~576 MB just to decode, which a signage panel with ~2 GB of RAM
# will not survive. The result is a blank screen.
#
# So: keep the master in docs/ for archival and editing, ship a 3840x2160 JPEG.
#
# Usage:  ./tools/optimize-board.sh [path-to-master]
#         defaults to the newest docs/board-master-*.jpg
set -euo pipefail
cd "$(dirname "$0")/.."

PANEL_W=3840
PANEL_H=2160
OUT="web/assets/board.jpg"

if [[ $# -ge 1 ]]; then
  MASTER="$1"
else
  MASTER="$(ls -t docs/board-master-*.jpg docs/board-master-*.png 2>/dev/null | head -1 || true)"
fi

if [[ -z "${MASTER:-}" || ! -f "$MASTER" ]]; then
  echo "!! no master found. Pass one explicitly, or save it as docs/board-master-<W>x<H>.jpg" >&2
  exit 1
fi

# NOTE: `identify -format '%w %h'` emits no trailing newline, so a bare
# `read` returns non-zero at EOF and `set -e` would abort the script here.
# Read the two values separately instead.
MW=$(identify -format '%w' "${MASTER}[0]")
MH=$(identify -format '%h' "${MASTER}[0]")
echo "master : $MASTER  (${MW}x${MH}, $(du -h "$MASTER" | cut -f1))"

if (( MW < PANEL_W )); then
  echo "!! WARNING: master is only ${MW}px wide, narrower than the ${PANEL_W}px panel."
  echo "   It will be upscaled and look soft. Re-export the master at ${PANEL_W}x${PANEL_H} or larger."
fi

convert "$MASTER" \
  -colorspace RGB \
  -filter Lanczos -resize "${PANEL_W}x${PANEL_H}" \
  -colorspace sRGB \
  -unsharp 0x0.7+0.6+0.02 \
  -quality 92 -sampling-factor 1x1 \
  -interlace Plane \
  -strip \
  "$OUT"

OW=$(identify -format '%w' "${OUT}[0]")
OH=$(identify -format '%h' "${OUT}[0]")
BYTES=$(stat -c%s "$OUT")
RAM=$(( OW * OH * 4 / 1000000 ))
echo "output : $OUT  (${OW}x${OH}, $(du -h "$OUT" | cut -f1))"
echo "         decoded bitmap ~${RAM} MB  -- safe for the panel"

if (( BYTES > 6000000 )); then
  echo "!! WARNING: ${BYTES} bytes is large for a 5-minute-poll payload."
  echo "   Lower -quality if the panel is on a slow link."
fi

echo
echo "next   : ./tools/rebuild-bundle.sh   then commit + push"
