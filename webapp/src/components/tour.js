// Guided tour for phones (Driver.js, MIT). Driver.js and its styles are loaded
// only when the tour runs, so the desktop bundle does not grow.
// Shown once: a flag in localStorage. If storage is blocked (private mode),
// the tour is not shown automatically; "Ver guía" in the Menú still works.
const KEY = "ip21.tour.v1";

// Elements highlighted, in the order of t.tour (i18n.js)
const TARGETS = [".m-search", ".m-year", ".map", ".sheet-handle", ".m-menu-btn"];

function seen() {
  try { return window.localStorage.getItem(KEY) === "1"; } catch (_) { return true; }
}
function markSeen() {
  try { window.localStorage.setItem(KEY, "1"); } catch (_) { /* storage blocked */ }
}

export async function startTour(t) {
  const [{ driver }] = await Promise.all([import("driver.js"), import("driver.js/dist/driver.css")]);
  const steps = TARGETS
    .map((element, k) => ({ element, popover: { title: t.tour[k][0], description: t.tour[k][1] } }))
    .filter(s => document.querySelector(s.element));
  if (!steps.length) return;
  const d = driver({
    steps,
    showProgress: true,
    progressText: "{{current}} / {{total}}",
    nextBtnText: t.tourNext,
    prevBtnText: t.tourPrev,
    doneBtnText: t.tourDone,
    overlayOpacity: 0.5,
    stagePadding: 4,
    stageRadius: 14,
    popoverClass: "ip21-tour",
    // "Saltar" on every step (closing in any way also counts as seen)
    onPopoverRender: (popover, { driver: drv }) => {
      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "ip21-tour-skip";
      skip.textContent = t.tourSkip;
      skip.addEventListener("click", () => drv.destroy());
      popover.footerButtons.prepend(skip);
    },
    onDestroyed: markSeen,
  });
  d.drive();
}

export function maybeStartTour(t) {
  if (seen()) return;
  setTimeout(() => startTour(t).catch(() => { /* the app works without the tour */ }), 1200);
}
