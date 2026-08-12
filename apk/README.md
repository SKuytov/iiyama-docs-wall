# APK · iiyama-docs-wall kiosk

A minimal Android WebView wrapper that opens the signage web app in fullscreen kiosk mode.

## Features
- Fullscreen immersive (hides status/nav bars)
- Auto-starts on device boot
- Keeps the screen awake
- Configurable URL (default: your GitHub Pages URL)
- Handles connection loss with an auto-retry

## Build
```
cd apk
./gradlew assembleRelease
```
Output: `apk/app/build/outputs/apk/release/app-release.apk`

## Install on the iiyama panel
1. Enable Developer Options on the panel (settings depend on the SoC firmware).
2. Connect via USB and enable ADB, or copy the APK to a USB stick.
3. Install:
   ```
   adb install app-release.apk
   ```
4. Set as home launcher (Settings → Home / Signage app) so it auto-starts on boot.

## Change the URL
Edit `app/src/main/res/values/strings.xml` → `<string name="signage_url">…</string>`.
