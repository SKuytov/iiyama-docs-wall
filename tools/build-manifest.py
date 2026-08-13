#!/usr/bin/env python3
"""Build web/manifest.json with per-file SHA-256 hashes.

Layout produced:

{
  "version":     "<8-hex chars of combined hash>",
  "generatedAt": "<ISO-8601 UTC>",
  "files": [
    { "path": "index.html", "sha256": "...", "size": 1234 },
    ...
  ]
}

The APK downloads this file every N hours. If `version` differs from the
locally cached one, it pulls only the files whose sha256 changed.
"""
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

WEB_DIR = Path(__file__).resolve().parent.parent / "web"

# Each entry: (local_path, remote_name_on_server)
# The remote_name is what will be appended to SIGNAGE_ORIGIN when downloading.
# `1.html` is the entry page on skuytov.eu/ii/, but stored locally as index.html
# so the WebView can just load file://.../web/index.html.
TRACKED = [
    ("index.html",              "1.html"),
    ("style.css",               "style.css"),
    ("content.js",              "content.js"),
    ("render.js",               "render.js"),
    ("app.js",                  "app.js"),
    ("sw.js",                   "sw.js"),
    ("assets/cotton-bg-1.jpg",  "assets/cotton-bg-1.jpg"),
    ("assets/cotton-bg-2.jpg",  "assets/cotton-bg-2.jpg"),
    ("assets/septona-logo.png", "assets/septona-logo.png"),
    # Bundled webfonts. The docs view is now live HTML text rather than a
    # rasterised image, so these must ship or the panel falls back to a
    # system face and the carefully fitted layout reflows.
    ("assets/fonts/golos-cyrillic.woff2",     "assets/fonts/golos-cyrillic.woff2"),
    ("assets/fonts/golos-cyrillic-ext.woff2", "assets/fonts/golos-cyrillic-ext.woff2"),
    ("assets/fonts/golos-latin.woff2",        "assets/fonts/golos-latin.woff2"),
    ("assets/fonts/golos-latin-ext.woff2",    "assets/fonts/golos-latin-ext.woff2"),
    ("assets/fonts/inter-cyrillic.woff2",     "assets/fonts/inter-cyrillic.woff2"),
    ("assets/fonts/inter-cyrillic-ext.woff2", "assets/fonts/inter-cyrillic-ext.woff2"),
    ("assets/fonts/inter-latin.woff2",        "assets/fonts/inter-latin.woff2"),
    ("assets/fonts/inter-latin-ext.woff2",    "assets/fonts/inter-latin-ext.woff2"),
]

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()

# --- panel safety guard -------------------------------------------------
# The panel is 3840x2160. A larger board.jpg shows no extra detail but costs
# width*height*4 bytes of RAM to decode, which will OOM a signage device and
# blank the screen. Refuse to build a manifest that would ship one.
PANEL_MAX_PIXELS = 3840 * 2160


def _check_board_size():
    board = WEB_DIR / "assets" / "board.jpg"
    if not board.is_file():
        return
    try:
        import struct
        data = board.read_bytes()
        i, w, h = 2, None, None
        while i < len(data) - 9:
            if data[i] != 0xFF:
                i += 1
                continue
            m = data[i + 1]
            if m in (0xC0, 0xC1, 0xC2, 0xC3):
                h, w = struct.unpack(">HH", data[i + 5:i + 9])
                break
            if m in (0xD8, 0xD9) or 0xD0 <= m <= 0xD7:
                i += 2
                continue
            i += 2 + struct.unpack(">H", data[i + 2:i + 4])[0]
        if not w or not h:
            return
    except Exception:
        return
    if w * h > PANEL_MAX_PIXELS * 1.05:
        ram = w * h * 4 // 1_000_000
        raise SystemExit(
            f"\n!! REFUSING TO BUILD: web/assets/board.jpg is {w}x{h}.\n"
            f"   The panel is 3840x2160, so the extra pixels are invisible, but\n"
            f"   decoding this image needs ~{ram} MB of RAM and will blank a\n"
            f"   signage panel.\n\n"
            f"   Fix: move it to docs/board-master-{w}x{h}.jpg and run\n"
            f"        ./tools/optimize-board.sh\n"
        )


def main() -> int:
    _check_board_size()
    files = []
    combined = hashlib.sha256()
    for rel, remote in TRACKED:
        p = WEB_DIR / rel
        if not p.is_file():
            print(f"! missing: {rel}", file=sys.stderr)
            return 1
        digest = sha256(p)
        size = p.stat().st_size
        entry = {"path": rel, "sha256": digest, "size": size}
        if remote != rel:
            entry["remote"] = remote
        files.append(entry)
        combined.update(rel.encode())
        combined.update(digest.encode())

    manifest = {
        "version": combined.hexdigest()[:12],
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "files": files,
    }
    out = WEB_DIR / "manifest.json"
    out.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"✓ wrote {out.relative_to(WEB_DIR.parent)}  version={manifest['version']}  files={len(files)}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
