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

Source: [`docs/board-layout.pdf`](docs/board-layout.pdf) — this is the master file.
The renderer converts it to a sharpened JPG at [`web/assets/board.jpg`](web/assets/board.jpg).

## How burn-in prevention works

Two independent mechanisms run continuously:

1. **Sub-pixel drift** on the docs image — a slow 10-minute animation shifts the whole board ±3 px in every direction. Invisible to viewers, but stops any single pixel from being permanently on.
2. **Full-view rotation** — every 15 minutes the docs view crossfades to the animated Septona splash for 30 s, then crossfades back. This forces every subpixel of the panel to cycle through very different colors, which is the single most effective anti-burn-in measure.

Together this drops the effective duty cycle of any static pixel to well below the burn-in threshold for modern IPS/VA signage panels.

## Update the board

1. Replace [`docs/board-layout.pdf`](docs/board-layout.pdf) with your new 3840×2160 PDF.
2. Run:
   ```bash
   ./tools/rebuild-board.sh
   ```
3. `git commit && git push` — the panel picks up the change on its next nightly refresh at 03:30 Sofia (or reload the tab).

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
│   └── assets/
│       ├── board.jpg            ← the 3840×2160 docs canvas (built from PDF)
│       ├── cotton-bg-1.jpg      ← splash background A
│       ├── cotton-bg-2.jpg      ← splash background B
│       └── septona-logo.png     ← splash logo
├── docs/
│   ├── board-layout.pdf         ← MASTER SOURCE — replace this to update the board
│   └── preview-*.png            ← README screenshots
├── apk/                         ← Android WebView kiosk
├── tools/
│   └── rebuild-board.sh         ← PDF → assets/board.jpg
└── .github/workflows/pages.yml  ← auto-deploy on push
```

## License

Internal use. All documents © Septona Bulgaria AD.
