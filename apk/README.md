# iiyama-docs-wall · Android APK (v2 — robust offline)

A self-healing WebView kiosk for the **iiyama LH6560UHS-B2AG** signage panel.

## What makes it robust

### 1 · Offline-first — never shows a blank screen
- The entire web app (HTML/CSS/JS + `board.jpg` + splash assets) is **bundled inside the APK** under `app/src/main/assets/web/`.
- On first boot, `App.onCreate()` copies the snapshot into `filesDir/web/`.
- The WebView **always loads `file://…/web/index.html`** — never a remote URL.
- ⇒ The panel works with zero internet, forever.

### 2 · Silent background sync
- A `WorkManager` job runs every **6 hours** (only when the network is up).
- It downloads `https://skuytov.github.io/iiyama-docs-wall/web/manifest.json`.
- The manifest lists every file with a SHA-256 hash and an overall `version`.
- If the version changed, it downloads only the files whose hash changed, verifies each SHA-256, writes them atomically (`.part` → `rename`), and finally saves the manifest.
- Then it broadcasts `RELOAD` → the WebView reloads the new content.
- If any download or checksum fails, the previous snapshot is left untouched → the screen keeps working.

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
        "\"https://my-server.example/signage/web\""
```

The bundled snapshot still runs offline; only the sync target changes.

## Signing for production

The current setup signs with the debug key so builds are simple. For long-term production installs:

1. Generate a release keystore.
2. Add signing config to `app/build.gradle` and reference it from `buildTypes.release`.
3. Store keystore secrets in GitHub Actions secrets and inject them in the workflow.
