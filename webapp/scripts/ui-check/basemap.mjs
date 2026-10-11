// node basemap.mjs <url> <scenario> [mobile]
// Simulates IGN behaviour by intercepting tile requests to www.ign.es.
import { open, alive, sleep, clickText } from "./lib.mjs";
const [url, scenario, mob] = process.argv.slice(2);
const { browser, page, errors } = await open("about:blank", { mobile: mob === "mobile" });
let mode = scenario;            // normal | outage | partial | slow | notfound
const seen = new Map();         // tile url -> attempts
let fails = 0, oks = 0;
await page.setRequestInterception(true);
page.on("request", req => {
  const u = req.url();
  if (!/www\.ign\.es\/wmts/.test(u)) return req.continue();
  seen.set(u, (seen.get(u) || 0) + 1);
  const fail = status => { fails++; req.respond({ status, contentType: "text/plain", headers: { "access-control-allow-origin": "*" }, body: "x" }); };
  if (mode === "outage") return fail(503);
  if (mode === "notfound") return fail(404);
  if (mode === "partial" && Math.random() < 0.15) return fail(503);
  if (mode === "partial40" && Math.random() < 0.40) return fail(503);
  if (mode === "slow") return setTimeout(() => { oks++; req.continue(); }, 4000);
  oks++; req.continue();
});
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
const state = async () => {
  const a = await alive(page);
  const n = await page.evaluate(() => ({ notice: document.querySelector(".notice")?.innerText.replace(/\s+/g, " "), base: new URLSearchParams(location.hash.slice(1)).get("base") || "ign-gris(default)" }));
  return `base=${n.base} notice=${JSON.stringify(n.notice ?? null)} root=${a.rootChildren} reqs=${[...seen.values()].reduce((a, b) => a + b, 0)} uniq=${seen.size} fails=${fails} errors=${errors.length}`;
};
const pan = async k => { for (let i = 0; i < k; i++) { await page.evaluate(i => { const m = window.__map; m && m.panBy([i % 2 ? 300 : -300, 120], { duration: 0 }); }, i); await sleep(1500); } };
const t0 = Date.now(); const T = () => ((Date.now() - t0) / 1000).toFixed(0) + "s";
await sleep(6000);
console.log(T(), "after load:", await state());
if (scenario === "outage") {
  for (let i = 0; i < 20 && !(await state()).includes("base=osm"); i++) await sleep(1000);
  console.log(T(), "fallback?:", await state());
  const att = [...seen.values()]; console.log("   attempts per tile (max/median):", Math.max(...att), att.sort((a, b) => a - b)[att.length >> 1]);
  await page.screenshot({ path: `bm_outage_${mob || "d"}.png` });
  await clickText(page, ".notice-action", "");
  await sleep(1000); console.log(T(), "after 'Volver':", await state());
  for (let i = 0; i < 25 && !(await state()).includes("base=osm"); i++) await sleep(1000);
  console.log(T(), "fails again ->", await state());
  mode = "normal"; console.log(T(), "IGN back up; waiting for auto-restore (probe every 60 s, 2 good answers)");
  for (let i = 0; i < 200 && (await state()).includes("base=osm"); i++) await sleep(1000);
  console.log(T(), "restored?:", await state());
  await sleep(4000); await page.screenshot({ path: `bm_restored_${mob || "d"}.png` });
} else {
  await pan(12);
  console.log(T(), "after panning 12x:", await state());
  await page.screenshot({ path: `bm_${scenario}_${mob || "d"}.png` });
}
console.log(errors.slice(0, 5).join("\n"));
await browser.close();
