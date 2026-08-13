#!/usr/bin/env bash
# Regenerate the offline snapshot bundled inside the APK.
# Run this whenever you change anything in /web/.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"

# 1. Refresh manifest.json with new SHA-256 hashes
python3 "$here/tools/build-manifest.py"

# 2. Copy /web into /apk/app/src/main/assets/web
dst="$here/apk/app/src/main/assets/web"
rm -rf "$dst"
mkdir -p "$dst"
cp -R "$here/web/." "$dst/"

# The content editor is a desk tool for a PC browser. It is deliberately NOT
# bundled into the APK and NOT listed in the manifest, so it never bloats the
# panel's download or its offline cache.
rm -f "$dst"/editor.html "$dst"/editor.js "$dst"/editor-schema.js \
      "$dst"/editor.css "$dst"/save.php

echo "✓ bundled snapshot rebuilt at $dst"
