// Guided tour for phones (Driver.js, MIT). Driver.js and its styles are loaded
// only when the tour runs, so the desktop bundle does not grow.
// Shown once: a flag in localStorage. If storage is blocked (private mode),
// the tour is not shown automatically; "Ver guía" in the Menú still works.
const KEY = "ip21.tour.v1";

// Elements highlighted, in the order of t.tour (i18n.js). ".tour-pin" is a
// marker added in the middle of the map for the "select a tract" step.
const TARGETS = [".m-search", ".m-year", ".tour-pin", ".sheet-grip", ".m-menu-btn"];

function seen() {
  try { return window.localStorage.getItem(KEY) === "1"; } catch (_) { return true; }
}
function markSeen() {
  try { window.localStorage.setItem(KEY, "1"); } catch (_) { /* storage blocked */ }
}

function addPin() {
  const wrap = document.querySelector(".map-wrap");
  if (!wrap || wrap.querySelector(".tour-pin")) return;
  const pin = document.createElement("div");
  pin.className = "tour-pin";
  pin.setAttribute("aria-hidden", "true");
  wrap.appendChild(pin);
}
const removePin = () => document.querySelectorAll(".tour-pin").forEach(p => p.remove());

export async function startTour(t) {
  const [{ driver }] = await Promise.all([import("driver.js"), import("driver.js/dist/driver.css")]);
  addPin();
  const steps = [
    {   // welcome, centred on the screen
      popover: {
        title: t.tourWelcome[0], description: t.tourWelcome[1], showProgress: false,
        showButtons: ["next"], nextBtnText: t.tourStart, popoverClass: "ip21-tour ip21-tour-welcome",
      },
    },
    ...TARGETS
      .map((element, k) => ({ element, popover: { title: t.tour[k][0], description: t.tour[k][1] } }))
      .filter(s => document.querySelector(s.element)),
  ];
  const d = driver({
    steps,
    showProgress: true,
    progressText: "{{current}} / {{total}}",
    nextBtnText: t.tourNext,
    prevBtnText: t.tourPrev,
    doneBtnText: t.tourDone,
    overlayColor: "#0b1220",
    overlayOpacity: 0.72,
    stagePadding: 6,
    stageRadius: 16,
    smoothScroll: false,
    popoverClass: "ip21-tour",
    // "Saltar la guía" on every step (closing in any way also counts as seen)
    onPopoverRender: (popover, { driver: drv, state }) => {
      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "ip21-tour-skip";
      skip.textContent = state.activeIndex ? t.tourSkipShort : t.tourSkip;
      skip.addEventListener("click", () => drv.destroy());
      popover.footerButtons.prepend(skip);
    },
    onDestroyed: () => { removePin(); markSeen(); },
  });
  d.drive();
}

// First visit: start once the map has loaded (the loader is gone), at most ~15 s
export function maybeStartTour(t) {
  if (seen()) return;
  let waited = 0;
  const go = () => {
    const busy = document.querySelector(".map-loader") || document.documentElement.dataset.intro;
    if (busy && waited < 15000) { waited += 300; setTimeout(go, 300); return; }
    setTimeout(() => startTour(t).catch(() => { removePin(); }), 500);
  };
  go();
}
