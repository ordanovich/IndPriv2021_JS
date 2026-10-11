// Desktop stress test: random year / curtain / map actions, fails on any page error.
// node stress.mjs <url> <steps> desktop <seed>   (BROWSER=firefox|chrome, GPU=1 optional)
import { open, alive, sleep } from "./lib.mjs";
const [url, n = "60", mob, seedArg] = process.argv.slice(2);
const mobile = mob === "mobile";
let seed = Number(seedArg ?? 1);
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const { browser, page, errors } = await open(url, { mobile });
const vp = page.viewport();
const click = (sel, text) => page.evaluate((sel, text) => {
  const el = [...document.querySelectorAll(sel)].find(n => n.getClientRects().length > 0 && (!text || n.textContent.includes(text)));
  if (el) el.click(); return !!el;
}, sel, text);
const pt = () => [Math.round(vp.width * (0.25 + 0.5 * rnd())), Math.round(vp.height * (0.3 + 0.4 * rnd()))];
const actions = {
  compare: () => click(".layers label.check", "⇔"),
  y2011: () => click(".layers .segmented button", "2011"),
  y2021: () => click(".layers .segmented button", "2021"),
  hover: async () => { const [x, y] = pt(); await page.mouse.move(x, y, { steps: 3 }); return true; },
  clickMap: async () => { const [x, y] = pt(); await page.mouse.click(x, y); return true; },
  zoomIn: () => page.evaluate(() => { const m = window.__map; if (m) m.zoomIn({ duration: 200 }); return !!m; }),
  zoomOut: () => page.evaluate(() => { const m = window.__map; if (m) m.zoomOut({ duration: 200 }); return !!m; }),
  wheel: async () => { const [x, y] = pt(); await page.mouse.move(x, y); await page.mouse.wheel({ deltaY: rnd() < 0.5 ? -300 : 300 }); return true; },
  esc: async () => { await page.keyboard.press("Escape"); return true; },
};
const names = Object.keys(actions);
const weights = { compare: 3, y2011: 3, y2021: 3, hover: 2, clickMap: 2, zoomIn: 1, zoomOut: 1, wheel: 1, esc: 1 };
const bag = names.flatMap(k => Array(weights[k]).fill(k));
const hist = [];
let dead = false;
for (let i = 0; i < Number(n); i++) {
  const a = bag[Math.floor(rnd() * bag.length)];
  let ok;
  try { ok = await actions[a](); } catch (e) { ok = "ERR " + e.message.slice(0, 80); }
  hist.push(a + (ok === true ? "" : ok === false ? "(n/a)" : "(" + ok + ")"));
  await sleep(rnd() < 0.5 ? 60 + rnd() * 200 : 400 + rnd() * 1500);
  const st = await alive(page);
  if (errors.length || st.rootChildren === 0 || !st.map) {
    console.log(`FAIL at step ${i}:`, JSON.stringify(st)); console.log(errors.join("\n")); console.log("history:", hist.slice(-12).join(" > "));
    dead = true; break;
  }
}
if (!dead) console.log(`OK ${n} steps`, hist.filter(h => h.includes("(")).length, "steps not applicable/err", JSON.stringify(await alive(page)));
await page.screenshot({ path: `stress_${mobile ? "m" : "d"}_${seedArg ?? 1}.png` });
await browser.close();
