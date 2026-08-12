/* iiyama-docs-wall — signage app
   - Injects each tile's PDF-page image as a CSS variable
   - Live Bulgarian clock/date
   - Click any tile for fullscreen zoom
   - Auto page-reload once per day to pick up new deployments
*/

const PAGES_DIR = "pages/"; // sibling folder to /web when deployed together

// ---------- Load doc images into each tile ----------
document.querySelectorAll(".tile").forEach(el => {
  const src = el.dataset.src;
  if (!src) return;
  el.style.setProperty("--doc", `url("${PAGES_DIR}${src}")`);
});

// ---------- Clock (Europe/Sofia) ----------
const clockEl = document.getElementById("clock");
const dateEl  = document.getElementById("date");
const fmtTime = new Intl.DateTimeFormat("bg-BG", {
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia", hour12: false
});
const fmtDate = new Intl.DateTimeFormat("bg-BG", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Sofia"
});
function tick() {
  const now = new Date();
  clockEl.textContent = fmtTime.format(now);
  dateEl.textContent  = fmtDate.format(now);
}
tick(); setInterval(tick, 15_000);

// ---------- Fullscreen zoom overlay ----------
const overlay      = document.getElementById("overlay");
const overlayImg   = document.getElementById("overlayImg");
const overlayTitle = document.getElementById("overlayTitle");

document.querySelectorAll(".tile").forEach(el => {
  el.addEventListener("click", () => {
    overlayImg.src        = PAGES_DIR + el.dataset.src;
    overlayTitle.textContent = el.dataset.title || "";
    overlay.hidden = false;
  });
});
overlay.addEventListener("click", () => { overlay.hidden = true; overlayImg.src = ""; });

// Esc to close (in case a keyboard is attached)
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { overlay.hidden = true; overlayImg.src = ""; }
});

// ---------- Daily auto-refresh at 03:30 Sofia so a redeploy always propagates ----------
function scheduleDailyRefresh() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(3, 30, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  setTimeout(() => location.reload(), target - now);
}
scheduleDailyRefresh();
