/* iiyama-docs-wall · signage controller
 *
 *  DOCS view  – live HTML board, authored at 3840×2160 in rem units
 *  SPLASH view – Septona animated splash (crossfade cotton bg + logo + particles + clock)
 *
 *  Cycle: DOCS 15 min → SPLASH 30 s → DOCS 15 min → ...
 *
 *  URL overrides for testing:  ?docs=60&splash=10   (seconds)
 *  Press "s" to force splash, "d" to force docs (during testing).
 */

(function () {
  'use strict';

  // -------- Config (query-string overridable for QA) --------
  const params = new URLSearchParams(location.search);
  const DOCS_MS   = (Number(params.get('docs'))   || 15 * 60) * 1000; //  15 min
  const SPLASH_MS = (Number(params.get('splash')) || 30)      * 1000; //  30 s
  const BG_SWAP_MS = 25_000;                                          //  cotton crossfade
  const PARTICLE_COUNT = 55;

  // -------- Proportional scaling root --------
  //   The board is authored against a 3840px canvas in rem units, so 1rem must
  //   equal 10px when the viewport is 3840 CSS px wide. The CSS fallback uses
  //   calc(100vw/384); this is more exact because clientWidth excludes any
  //   scrollbar. Recomputed on resize/orientation so a panel that reports its
  //   size late still lands on an exact layout.
  const DESIGN_W = 3840;
  function setRootScale() {
    const w = document.documentElement.clientWidth || window.innerWidth || DESIGN_W;
    document.documentElement.style.fontSize = (w / (DESIGN_W / 10)) + 'px';
  }
  setRootScale();
  window.addEventListener('resize', setRootScale);
  window.addEventListener('orientationchange', setRootScale);
  // Fonts loading can change metrics; re-assert once they settle.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(setRootScale).catch(function () {});
  }

  // -------- View switcher --------
  const docsView   = document.getElementById('docsView');
  const splashView = document.getElementById('splashView');

  function showView(name) {
    const showDocs = name === 'docs';
    docsView.classList.toggle('is-active',   showDocs);
    splashView.classList.toggle('is-active', !showDocs);
    docsView.setAttribute('aria-hidden',   String(!showDocs));
    splashView.setAttribute('aria-hidden', String(showDocs));
  }

  // -------- Burn-in drift (whole-pixel, layout-based) --------
  //   Static pixels are what burn a panel in, so the board shifts slightly
  //   every few minutes. This used to be a CSS `transform: translate()`
  //   animation, and that was the cause of the residual text blur: a
  //   transformed element becomes its own composited layer, and a fractional
  //   translate makes the compositor RESAMPLE that layer — every glyph in it
  //   is smeared across pixel boundaries.
  //
  //   Instead the offset is applied as whole-pixel padding. Padding forces a
  //   real reflow, so glyphs are re-laid-out and re-rasterised at integer
  //   positions on the panel's pixel grid: pin-sharp at every drift step.
  //   Cost is a layout pass once every few minutes, which is free here.
  const DRIFT_MS   = 4 * 60 * 1000;
  const DRIFT_STEP = 6;               // px of travel — invisible, still effective
  const DRIFT_SEQ  = [[0, 0], [DRIFT_STEP, 0], [DRIFT_STEP, DRIFT_STEP], [0, DRIFT_STEP],
                      [-DRIFT_STEP, DRIFT_STEP], [-DRIFT_STEP, 0], [-DRIFT_STEP, -DRIFT_STEP],
                      [0, -DRIFT_STEP], [DRIFT_STEP, -DRIFT_STEP]];
  let driftIdx = 0;
  let driftNow = [0, 0];
  function applyDrift() {
    const bd = document.getElementById('board');
    if (!bd) return;
    const d = DRIFT_SEQ[driftIdx % DRIFT_SEQ.length];
    driftNow = d;
    // Whole integers only. Adjust opposite edges so the board keeps its size.
    bd.style.paddingLeft   = 'calc(2.4rem + ' + d[0] + 'px)';
    bd.style.paddingRight  = 'calc(2.4rem - ' + d[0] + 'px)';
    bd.style.paddingTop    = 'calc(2rem + '   + d[1] + 'px)';
    bd.style.paddingBottom = 'calc(1.8rem - ' + d[1] + 'px)';
    driftIdx++;
  }
  applyDrift();
  setInterval(applyDrift, DRIFT_MS);

  let mode = 'docs';
  function cycle() {
    mode = mode === 'docs' ? 'splash' : 'docs';
    showView(mode);
    setTimeout(cycle, mode === 'docs' ? DOCS_MS : SPLASH_MS);
  }
  showView('docs');
  setTimeout(cycle, DOCS_MS);

  // -------- Live clock (Europe/Sofia) --------
  const DAYS = ['Неделя','Понеделник','Вторник','Сряда','Четвъртък','Петък','Събота'];
  const MONTHS = ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември'];
  const timeEl = document.getElementById('clockTime');
  const dateEl = document.getElementById('clockDate');
  const bTimeEl = document.getElementById('boardTime');
  const bDateEl = document.getElementById('boardDate');
  function tick() {
    const n = new Date();
    const p = v => String(v).padStart(2, '0');
    const hm = `${p(n.getHours())}:${p(n.getMinutes())}`;
    const dateStr = `${DAYS[n.getDay()]}, ${n.getDate()} ${MONTHS[n.getMonth()]} ${n.getFullYear()}`;
    timeEl.textContent = `${hm}:${p(n.getSeconds())}`;
    dateEl.textContent = dateStr;
    // Board header shows HH:MM only — a ticking seconds digit on a 15-minute
    // static view is just an extra pixel burning in one spot.
    if (bTimeEl) bTimeEl.textContent = hm;
    if (bDateEl) bDateEl.textContent = dateStr;
  }
  tick();
  setInterval(tick, 1000);

  // -------- Cotton background crossfade --------
  const slides = [document.getElementById('bgSlide1'), document.getElementById('bgSlide2')];
  let cur = 0;
  setInterval(() => {
    slides[cur].classList.remove('is-active');
    cur = (cur + 1) % slides.length;
    slides[cur].classList.add('is-active');
  }, BG_SWAP_MS);

  // -------- Floating particles --------
  const pc = document.getElementById('particles');
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const el  = document.createElement('div');
    el.className = 'particle';
    const sz  = 1.2 + Math.random() * 4;
    const dur = 16   + Math.random() * 22;
    const del = -(Math.random() * 22);
    const lft = Math.random() * 100;
    const op  = 0.10 + Math.random() * 0.45;
    el.style.cssText =
      `width:${sz}px;height:${sz}px;left:${lft}%;bottom:-8px;` +
      `opacity:${op};animation-duration:${dur}s;animation-delay:${del}s`;
    pc.appendChild(el);
  }

  // -------- Debug shortcuts (harmless on kiosk with no keyboard) --------
  document.addEventListener('keydown', (e) => {
    if (e.key === 's' || e.key === 'S') { mode = 'splash'; showView('splash'); }
    if (e.key === 'd' || e.key === 'D') { mode = 'docs';   showView('docs');   }
    if (e.key === 'i' || e.key === 'I') { toggleDiag(); }
  });

  // -------- Viewport diagnostic overlay --------
  //   Open with ?diag=1 (or press "i"). Shows exactly what the panel reports so a
  //   scaling problem can be identified without a debugger attached.
  let diagEl = null, diagTimer = null;
  function apkStatus() {
    try {
      return (window.DocsWall && DocsWall.status) ? DocsWall.status() : 'n/a (browser)';
    } catch (e) {
      return 'error: ' + e;
    }
  }
  function toggleDiag() {
    if (diagEl) {
      clearInterval(diagTimer); diagTimer = null;
      diagEl.remove(); diagEl = null;
      return;
    }
    diagEl = document.createElement('div');
    diagEl.style.cssText =
      'position:fixed;left:0;top:0;z-index:99999;padding:14px 18px;' +
      'background:rgba(0,0,0,.82);color:#0f0;font:600 20px/1.5 monospace;' +
      'white-space:pre;pointer-events:none;border:2px solid #0f0';
    document.body.appendChild(diagEl);
    const paint = () => {
      const bd = document.getElementById('board');
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
      diagEl.textContent =
        'window.inner   : ' + window.innerWidth + ' x ' + window.innerHeight + '\n' +
        'screen         : ' + screen.width + ' x ' + screen.height + '\n' +
        'devicePixelRatio: ' + window.devicePixelRatio + '\n' +
        'CSS px total   : ' + Math.round(window.innerWidth * window.devicePixelRatio) +
                        ' x ' + Math.round(window.innerHeight * window.devicePixelRatio) + '\n' +
        'doc scrollWH   : ' + document.documentElement.scrollWidth +
                        ' x ' + document.documentElement.scrollHeight + '\n' +
        'root font-size : ' + rootPx.toFixed(3) + 'px  (1rem)\n' +
        'board rendered : ' + (bd ? Math.round(bd.getBoundingClientRect().width) +
                                ' x ' + Math.round(bd.getBoundingClientRect().height) : 'n/a') + '\n' +
        'fonts loaded   : ' + (document.fonts ? document.fonts.status : 'n/a') + '\n' +
        'burn-in drift  : ' + driftNow[0] + ', ' + driftNow[1] + ' px\n' +
        'content.js     : ' + (window.BOARD ? 'loaded (' + (window.BOARD.rules ?
                                window.BOARD.rules.items.length : '?') + ' rules)' : 'MISSING') + '\n' +
        'protocol       : ' + location.protocol + '\n' +
        'apk sync       : ' + apkStatus();
    };
    paint();
    diagTimer = setInterval(paint, 1000);
  }
  if (params.get('diag') === '1') toggleDiag();

  // -------- Nightly reload at 03:30 Sofia so redeploys propagate --------
  (function scheduleNightlyReload() {
    const now = new Date();
    const target = new Date(now);
    target.setHours(3, 30, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    setTimeout(() => location.reload(true), target - now);
  })();

  // -------- Service Worker (browser offline cache) --------
  //   Skipped when running inside the APK (file://), which manages its own cache.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* ignore */ });
    });
  }
})();
