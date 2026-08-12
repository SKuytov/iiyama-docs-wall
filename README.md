# iiyama-docs-wall

Digital signage dashboard for a **iiyama LH6560UHS-B2AG** (65" 4K UHD landscape panel, no touch).

- **Docs view** — displays the hand-optimized 3840×2160 board layout (all 11 documents visible at once, no slideshow, no scrolling).
- **Splash view** — every 15 minutes the screen switches to an animated Septona splash (crossfading cotton backgrounds, floating particles, pulsing logo, live clock) for 30 seconds to prevent LED burn-in.

![docs view](docs/preview-docs.png)
![splash view](docs/preview-splash.png)

## Live URL

```
https://skuytov.github.io/iiyama-docs-wall/web/
```

Open that on the iiyama panel's built-in browser (or any 4K display). No touch, no interaction — it runs itself.

### Optional URL parameters (for QA)
| Param     | Meaning                        | Default |
|-----------|--------------------------------|---------|
| `?docs=N`   | Docs-view duration, **seconds** | 900 (15 min) |
| `?splash=N` | Splash-view duration, **seconds** | 30 |

Example — fast cycle for testing:
```
https://skuytov.github.io/iiyama-docs-wall/web/?docs=20&splash=10
```

## Documents shown

The board layout combines these documents on a single 3840×2160 canvas
(headers/footers cropped, phone numbers rendered as live text for maximum readability):

1. Програма за обучения 2026
2. Списък за почистване и дезинфекции 2026
3. Заповед № 17 (BG) — правила за вътрешен ред и безопасни условия на труд
4. Order No. 17 (EN) — internal work order and safe working conditions
5. Заповед № 16 — несмесване на отпадъци (2024)
6. Програма за вътрешни инспекции — 2024/2025
7. Служебни телефони
8. Служители, преминали обучение по пожарна безопасност + Състав на КУТ
9. Телефони за връзка при извънредни ситуации (външни)
10. Вътрешни телефони за връзка при извънредни ситуации

### The board is live HTML, not an image

Earlier revisions rendered the board as a single 3840×2160 `board.jpg`. That
looked correct on a desktop but soft on the panel: a JPG is a *picture of
text*, so the panel resamples it and every glyph edge lands between pixels.

The board is now real HTML text. It is authored against a 3840 px canvas
entirely in `rem`, with the root font size derived from the viewport
(`html { font-size: calc(100vw / 384) }`, refined in `app.js` from
`clientWidth`) so that **1rem = 10px at 3840 px wide**. The layout therefore
*reflows* proportionally to whatever resolution the panel reports, and glyphs
are always rasterised at their true final size — sharp at any scale. This is
deliberately not `transform: scale()`, which rasterises once and then stretches.

Pictograms are an inline SVG `<symbol>` sprite (stroke-based, ISO-7010
inspired, `currentColor`), so they are resolution-independent too.

Content is distilled to the *core* of each order and programme; the footer
directs readers to the touch kiosk for the original signed and stamped
documents. The source PDFs remain the legal record, archived in
[`docs/`](docs/).

**Typography:** Golos Text (Cyrillic-native, Paratype) for display, Inter for
body and data, both subset and bundled as woff2 under
[`web/assets/fonts/`](web/assets/fonts) — nothing is fetched from a CDN, so
the board renders identically with no network.

## How burn-in prevention works

Two independent mechanisms run continuously:

1. **Sub-pixel drift** on the docs view — a slow 10-minute animation shifts the whole board ±3 px in every direction. Invisible to viewers, but stops any single pixel from being permanently on.
2. **Full-view rotation** — every 15 minutes the docs view crossfades to the animated Septona splash for 30 s, then crossfades back. This forces every subpixel of the panel to cycle through very different colors, which is the single most effective anti-burn-in measure.

Together this drops the effective duty cycle of any static pixel to well below the burn-in threshold for modern IPS/VA signage panels.

## Update the board

Edit the markup directly — the board is HTML now.

1. Edit [`web/index.html`](web/index.html) (content) and/or
   [`web/style.css`](web/style.css) (layout).
2. Verify at true panel resolution before shipping. Anything that overflows a
   card is a bug you will only see at 4K:
   ```bash
   cd web && python3 -m http.server 8899
   # then screenshot at 3840x2160, device_scale_factor=1
   ```
3. Regenerate the manifest and the APK's bundled copy:
   ```bash
   ./tools/rebuild-bundle.sh
   ```
4. `git commit && git push`.

**Deploying to production (`skuytov.eu/ii`):** upload the changed content files
first and `manifest.json` **last** — the APK treats the manifest as the commit
point, so uploading it early makes the panel fetch files that are not there yet.
Panels poll every 5 minutes and apply the change atomically.

## Run in an Android APK (kiosk mode)

See [`apk/`](apk/) — a WebView kiosk wrapper that fullscreens the hosted URL, auto-starts on boot, and re-loads on connection loss.

```
cd apk && ./gradlew assembleRelease
adb install app/build/outputs/apk/release/app-release.apk
```

## Repo layout

```
iiyama-docs-wall/
├── web/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── sw.js                    ← offline service worker (browser path)
│   └── assets/
│       ├── fonts/               ← subset woff2 (Golos Text + Inter), bundled
│       ├── cotton-bg-1.jpg      ← splash background A
│       ├── cotton-bg-2.jpg      ← splash background B
│       └── septona-logo.png     ← splash logo
├── docs/                        ← archived source PDFs (the legal record)
├── apk/                         ← Android WebView kiosk (offline-first)
├── tools/
│   ├── build-manifest.py        ← hashes tracked files → web/manifest.json
│   └── rebuild-bundle.sh        ← manifest + refresh the APK's bundled copy
└── .github/workflows/
    ├── pages.yml                ← auto-deploy on push
    └── apk.yml                  ← build + release the signed APK
```

## License

Internal use. All documents © Septona Bulgaria AD.
