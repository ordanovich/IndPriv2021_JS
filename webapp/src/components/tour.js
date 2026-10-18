// Guided tour (Driver.js, MIT) for phones and for the desktop layout.
// Driver.js and its styles are loaded only when the tour runs.
// Shown once per layout: a flag in localStorage. If storage is blocked
// (private mode) it is not shown automatically; "Ver guía" still works.
const KEYS = { mobile: "ip21.tour.v1", desktop: "ip21.tour.desktop.v1" };

// Elements highlighted, in the order of t.tour / t.tourDesktop (i18n.js).
// ".tour-pin" is a marker added in the middle of the map. Steps whose
// element is not on screen (e.g. a collapsed panel) are left out.
const TARGETS = {
  mobile: [".m-search", ".m-year", ".tour-pin", ".sheet-grip", ".m-menu-btn"],
  desktop: [".metabar .search", ".side.left .layers .segmented", ".side.left .section", ".tour-pin", ".bottom",
            ".side.right .legend", ".side.right .section:last-child", ".metabar .menus", ".header-actions"],
};
const layout = mobile => (mobile ? "mobile" : "desktop");

function seen(mobile) {
  try { return window.localStorage.getItem(KEYS[layout(mobile)]) === "1"; } catch (_) { return true; }
}
function markSeen(mobile) {
  try { window.localStorage.setItem(KEYS[layout(mobile)], "1"); } catch (_) { /* storage blocked */ }
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

export async function startTour(t, mobile = true) {
  const [{ driver }] = await Promise.all([import("driver.js"), import("driver.js/dist/driver.css")]);
  addPin();
  const steps = [
    {   // welcome, centred on the screen
      popover: {
        title: t.tourWelcome[0], description: t.tourWelcome[1], showProgress: false,
        showButtons: ["next"], nextBtnText: t.tourStart, popoverClass: "ip21-tour ip21-tour-welcome",
      },
    },
    ...TARGETS[layout(mobile)]
      .map((element, k) => {
        const [title, description] = (mobile ? t.tour : t.tourDesktop)[k];
        return { element, popover: { title: mobile ? title : `${k + 1} · ${title}`, description } };
      })
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
    onDestroyed: () => { removePin(); markSeen(mobile); },
  });
  d.drive();
}

// First visit: start once the map has loaded (the loader is gone), at most ~15 s
export function maybeStartTour(t, mobile = true) {
  if (seen(mobile)) return;
  let waited = 0;
  const go = () => {
    const busy = document.querySelector(".map-loader") || document.documentElement.dataset.intro;
    if (busy && waited < 15000) { waited += 300; setTimeout(go, 300); return; }
    setTimeout(() => startTour(t, mobile).catch(() => { removePin(); }), 500);
  };
  go();
}
