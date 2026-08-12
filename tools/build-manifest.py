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

TRACKED = [
    "index.html",
    "style.css",
    "app.js",
    "sw.js",
    "assets/board.jpg",
    "assets/cotton-bg-1.jpg",
    "assets/cotton-bg-2.jpg",
    "assets/septona-logo.png",
]

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()

def main() -> int:
    files = []
    combined = hashlib.sha256()
    for rel in TRACKED:
        p = WEB_DIR / rel
        if not p.is_file():
            print(f"! missing: {rel}", file=sys.stderr)
            return 1
        digest = sha256(p)
        size = p.stat().st_size
        files.append({"path": rel, "sha256": digest, "size": size})
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
