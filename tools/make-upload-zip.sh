#!/usr/bin/env bash
# ============================================================================
#  Build the zip that gets uploaded to https://skuytov.eu/ii/
#
#  The production server serves the board as 1.html, while the repo and the APK
#  call it index.html. That rename is the only difference between this zip and
#  the /web directory, and it is driven by the "remote" field in manifest.json
#  so the two can never drift apart.
#
#  Usage:  ./tools/make-upload-zip.sh [output.zip]
# ============================================================================
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$here/../skuytov.eu-ii-upload.zip}"

# Always regenerate the manifest first: uploading a stale manifest means the
# panel either misses the update or fails its checksum verification.
python3 "$here/tools/build-manifest.py"

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

# Copy every tracked file to its production name, straight from the manifest.
python3 - "$here" "$stage" <<'PY'
import json, shutil, sys
from pathlib import Path
repo, stage = Path(sys.argv[1]), Path(sys.argv[2])
man = json.loads((repo / "web" / "manifest.json").read_text())
for f in man["files"]:
    src = repo / "web" / f["path"]
    dst = stage / f.get("remote", f["path"])
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
shutil.copy2(repo / "web" / "manifest.json", stage / "manifest.json")
print(f"  staged {len(man['files'])} tracked files (manifest {man['version']})")
PY

# The editor is not part of the signage payload — the panel never loads it — but
# it belongs on the server so staff can open it in a browser and edit content.
for f in editor.html editor.css editor.js editor-schema.js save.php; do
  cp "$here/web/$f" "$stage/$f"
done
# The editor previews the real board, which on the server is 1.html. Ship
# index.html as well so the preview works under either name.
cp "$here/web/index.html" "$stage/index.html"

cp "$here/docs/UPLOAD-README.txt" "$stage/UPLOAD-README.txt"

rm -f "$out"
(cd "$stage" && zip -qr "$out" .)
echo "✓ $out"
unzip -l "$out" | tail -3
