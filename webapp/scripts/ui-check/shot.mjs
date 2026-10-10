// Usage: node shot.mjs <url> <out.png> [actions.json]
// Opens the page in headless Edge, waits for the map to settle, runs optional
// actions, saves a screenshot and prints console errors / failed requests.
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";

const [url, out, actionsFile] = process.argv.slice(2);
const actions = actionsFile ? JSON.parse(readFileSync(actionsFile, "utf8")) : [];

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: "new",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--window-size=1600,950"],
  defaultViewport: { width: 1600, height: 950 },
});
const page = await browser.newPage();
const problems = [];
page.on("console", m => { if (["error", "warning"].includes(m.type())) problems.push(`[console.${m.type()}] ${m.text()}`); });
page.on("pageerror", e => problems.push(`[pageerror] ${e.message}`));
page.on("requestfailed", r => problems.push(`[requestfailed] ${r.url().slice(0, 140)} ${r.failure()?.errorText}`));
page.on("response", r => { if (r.status() >= 400) problems.push(`[http ${r.status()}] ${r.url().slice(0, 140)}`); });

const dl = process.env.DL_DIR;
if (dl) {
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dl });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
await sleep(4000);
for (const a of actions) {
  if (a.click) await page.click(a.click);
  if (a.clickText) {
    const els = await page.$$(a.sel || "button");
    for (const el of els) {
      const txt = await el.evaluate(n => n.textContent);
      if (txt && txt.includes(a.clickText)) { await el.click(); break; }
    }
  }
  if (a.mouse) await page.mouse.click(a.mouse[0], a.mouse[1]);
  if (a.move) await page.mouse.move(a.move[0], a.move[1]);
  if (a.drag) {
    const [x0, y0, x1, y1] = a.drag;
    await page.mouse.move(x0, y0); await page.mouse.down();
    await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 5 });
    await page.mouse.move(x1, y1, { steps: 5 }); await page.mouse.up();
  }
  if (a.type) await page.type(a.type[0], a.type[1], { delay: 40 });
  if (a.key) await page.keyboard.press(a.key);
  if (a.select) await page.select(a.select[0], a.select[1]);
  if (a.eval) console.log("eval:", JSON.stringify(await page.evaluate(a.eval)));
  if (a.shot) await page.screenshot({ path: a.shot });
  await sleep(a.wait ?? 1500);
}
await page.screenshot({ path: out });
console.log(problems.length ? problems.join("\n") : "no console errors");
await browser.close();
