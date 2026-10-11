// Mobile (iPhone-sized) stress test: same idea, using the ☰ panel and taps.
// node stress_m.mjs <url> <steps> <seed>
import { open, alive, sleep } from "./lib.mjs";
const [url, n = "60", seedArg = "1"] = process.argv.slice(2);
let seed = Number(seedArg);
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const { browser, page, errors } = await open(url, { mobile: true });
const tap = async (sel, text) => {
  const h = await page.evaluateHandle((sel, text) => [...document.querySelectorAll(sel)].find(n => n.getClientRects().length && n.textContent.includes(text)), sel, text);
  const el = h.asElement(); if (!el) return false;
  await el.tap(); return true;
};
const panelOpen = () => page.evaluate(() => [...document.querySelectorAll(".layers")].some(n => n.getClientRects().length));
const openPanel = async () => (await panelOpen()) || (await tap(".menu-toggle", "☰"));
const actions = {
  compare: async () => (await openPanel()) && tap(".layers label.check", "⇔"),
  y2011: async () => (await openPanel()) && tap(".layers .segmented button", "2011"),
  y2021: async () => (await openPanel()) && tap(".layers .segmented button", "2021"),
  quint: async () => (await openPanel()) && tap(".filters button, .quintile-buttons button, button", "Q" + (1 + Math.floor(rnd() * 5))),
  close: async () => (await panelOpen()) ? tap("button.collapse", "✕") : true,
  tapMap: async () => { if (await panelOpen()) await tap("button.collapse", "✕"); await page.touchscreen.tap(60 + rnd() * 270, 200 + rnd() * 250); return true; },
  zoom: () => tap(".maplibregl-ctrl-zoom-in", ""),
  unzoom: () => tap(".maplibregl-ctrl-zoom-out", ""),
};
const w = { compare: 3, y2011: 3, y2021: 3, quint: 1, close: 2, tapMap: 2, zoom: 1, unzoom: 1 };
const bag = Object.keys(w).flatMap(k => Array(w[k]).fill(k));
const hist = []; let dead = false;
for (let i = 0; i < Number(n); i++) {
  const a = bag[Math.floor(rnd() * bag.length)];
  let ok; try { ok = await actions[a](); } catch (e) { ok = "ERR " + e.message.slice(0, 60); }
  hist.push(a + (ok === true ? "" : `(${ok})`));
  await sleep(rnd() < 0.5 ? 80 + rnd() * 200 : 500 + rnd() * 1500);
  const st = await alive(page);
  if (errors.length || st.rootChildren === 0 || !st.map) {
    console.log(`FAIL at step ${i}`, JSON.stringify(st)); console.log(errors.join("\n")); console.log(hist.slice(-12).join(" > "));
    dead = true; break;
  }
}
if (!dead) console.log(`OK ${n} mobile steps; n/a: ${hist.filter(h => h.includes("(")).length};`, JSON.stringify(await alive(page)), "| compare toggles:", hist.filter(h => h === "compare").length);
await page.screenshot({ path: `stress_m_${seedArg}.png` });
await browser.close();
