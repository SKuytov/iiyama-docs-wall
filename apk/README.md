# iiyama-docs-wall · Android APK (v2 — robust offline)

A self-healing WebView kiosk for the **iiyama LH6560UHS-B2AG** signage panel.

## What makes it robust

### 1 · Offline-first — never shows a blank screen
- The entire web app (HTML/CSS/JS + bundled woff2 fonts + splash assets) is **bundled inside the APK** under `app/src/main/assets/web/`.
- On first boot, `App.onCreate()` copies the snapshot into `filesDir/web/`.
- The WebView **always loads `file://…/web/index.html`** — never a remote URL.
- ⇒ The panel works with zero internet, forever.

### 2 · Silent background sync — every 5 minutes
- While the kiosk is running, `MainActivity` polls the server **every 5 minutes** (first check 20 s after launch).
- A `WorkManager` job also runs every **15 minutes** as a backstop for when the activity has been killed. WorkManager silently clamps any periodic interval below 15 min, which is exactly why the fast cadence is driven from the activity instead.
- It downloads `https://skuytov.eu/ii/manifest.json` with `If-None-Match` / `If-Modified-Since`, so an unchanged server replies **304 with no body** — a 5-minute poll costs a few hundred bytes.
- The manifest lists every file with its **local path** (what the WebView loads), the **remote name** on the server (defaults to the local path), a SHA-256 hash, and an overall `version`.
- If the version changed, it downloads only the files whose hash changed, verifies each SHA-256, writes them atomically (`.part` → `rename`), and finally saves the manifest.
- Then it broadcasts `RELOAD` → the WebView reloads the new content.
- If any download or checksum fails, the previous snapshot is left untouched → the screen keeps working.

> Note: the entry page is `1.html` on the server but `index.html` on the panel. The manifest's `remote` field handles this mapping.

### 3 · Watchdog + self-healing
- `MainActivity` writes a heartbeat every 60 s.
- A `WatchdogWorker` runs every 15 min. If the heartbeat is older than 20 min or the process died, it cold-starts `MainActivity`.
- `BootReceiver` also relaunches after boot, app updates, and locked-boot completion.

### 4 · Kiosk hardening
- Fullscreen immersive (status/nav bars hidden), `screenOrientation="landscape"`.
- Keeps the screen on (`FLAG_KEEP_SCREEN_ON`).
- Back / Home / Menu / Recent-apps keys are swallowed.
- Registered as an alternative `HOME` app so the panel can auto-launch it on boot.
- On any render error, retries in 5 s.

### 5 · Auto-build via CI
- Every push to `main` triggers `.github/workflows/apk.yml`.
- CI regenerates `manifest.json`, re-bundles assets, and produces `iiyama-docs-wall-latest.apk`.
- The APK is attached to the rolling **[latest release](../../releases/tag/latest)** — just download and `adb install`.

## Build locally

```bash
cd apk
./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

Requirements: JDK 17, Android SDK. Nothing else — the Gradle wrapper handles everything.

## Install on the panel

Option A — ADB over USB:
```bash
adb install -r iiyama-docs-wall-latest.apk
```

Option B — sideload from a USB stick using the panel's file-manager APK installer.

After install, open once from the launcher. Because it registers as a HOME app, on the next boot the signage panel will offer it as a launcher option — pick "Always" and it will auto-run on every boot.

## Change the target URL (optional)

If you host the web app somewhere other than GitHub Pages:

```groovy
// apk/app/build.gradle
buildConfigField "String", "SIGNAGE_ORIGIN",
        "\"https://my-server.example/signage\""
```

The bundled snapshot still runs offline; only the sync target changes.

## Updating the content on the server

Upload these files to `https://skuytov.eu/ii/`:

| Local path on panel     | File on server            |
| ----------------------- | ------------------------- |
| `index.html`            | **`1.html`**              |
| `style.css`             | `style.css`               |
| `app.js`                | `app.js`                  |
| `sw.js`                 | `sw.js`                   |
| `assets/fonts/*.woff2`  | `assets/fonts/*.woff2`    |
| `assets/cotton-bg-1.jpg`| `assets/cotton-bg-1.jpg`  |
| `assets/cotton-bg-2.jpg`| `assets/cotton-bg-2.jpg`  |
| `assets/septona-logo.png`| `assets/septona-logo.png`|
| `manifest.json`         | `manifest.json`           |

When you change any file, regenerate the manifest so the panels pick it up:

```bash
python3 tools/build-manifest.py
```

Then upload the changed files **and** `manifest.json` to `https://skuytov.eu/ii/`. **Within 5 minutes** every panel fetches, verifies, and applies the update on its own, then reloads the display — no reboot, no touching the panel.

### Order of upload matters

Upload the **content files first**, then `manifest.json` last. The manifest is the trigger: panels only act once its `version` changes. Uploading it last guarantees a panel never sees a new manifest pointing at files that aren't on the server yet. (Even if that happens, the sync aborts safely and retries 5 minutes later — the screen keeps showing the previous content.)

### Verifying the sync on the panel

Attach a USB keyboard and press **`i`** to toggle the diagnostic overlay. The `apk sync` line shows the current content version, the last poll result (`UPDATED` / `UNCHANGED` / `FAILED`), how long ago it ran, the interval, and the origin URL.

Or over ADB:

```bash
adb logcat -s ContentSync:I MainActivity:I
```

You should see a `5-min poll → UNCHANGED` line every five minutes.

## Signing for production

The current setup signs with the debug key so builds are simple. For long-term production installs:

1. Generate a release keystore.
2. Add signing config to `app/build.gradle` and reference it from `buildTypes.release`.
3. Store keystore secrets in GitHub Actions secrets and inject them in the workflow.
