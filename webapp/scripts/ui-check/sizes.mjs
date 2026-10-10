// Usage: node sizes.mjs http://localhost:5173/   (dev server: needs window.__map)
// At several screen sizes: zoom and number of drawn sections at the start view,
// 'Península y Baleares', 'Canarias' and fully zoomed out.
import puppeteer from "puppeteer-core";
const url = process.argv[2];
const sizes = [[1024, 700], [1280, 720], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440], [820, 1180]];
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const probe = page => page.evaluate(() => {
  const m = window.__map || null;
  return m ? { z: +m.getZoom().toFixed(2), n: m.queryRenderedFeatures({ layers: ["units-fill"] }).length } : null;
});
for (const [w, h] of sizes) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
  await sleep(6000);
  const out = { start: await probe(page) };
  for (const label of ["Península", "Canarias"]) {
    await page.evaluate(l => [...document.querySelectorAll(".map-views button")].find(b => b.textContent.includes(l))?.click(), label);
    await sleep(5000);
    out[label] = await probe(page);
  }
  // zoom out as far as the map allows
  await page.evaluate(() => window.__map && window.__map.zoomTo(0, { duration: 0 }));
  await sleep(5000);
  out.minZoom = await probe(page);
  console.log(`${w}x${h}`, JSON.stringify(out));
  await page.close();
}
await browser.close();
