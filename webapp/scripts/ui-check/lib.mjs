import puppeteer from "puppeteer-core";
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function open(url, { mobile = false } = {}) {
  const ff = process.env.BROWSER === "firefox";
  const browser = await puppeteer.launch(ff
    ? { browser: "firefox", executablePath: "C:/Program Files/Mozilla Firefox/firefox.exe", headless: true }
    : { executablePath: process.env.BROWSER === "chrome" ? "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe" : "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        headless: "new", args: process.env.GPU ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage();
  if (mobile) {
    if (!ff) await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  } else await page.setViewport({ width: 1600, height: 950 });
  const errors = [];
  page.on("pageerror", e => errors.push(`[pageerror] ${e.message}`));
  page.on("console", async m => {
    if (m.type() === "warning" && /^(compare )?map:/.test(m.text())) { console.log("    WARN", m.text().slice(0, 160)); return; }
    if (m.type() !== "error") return; if (m.text().startsWith("DBG")) { console.log("   ", m.text()); return; }
    let txt = m.text();
    if (txt.includes("JSHandle")) txt = (await Promise.all(m.args().map(h => h.evaluate(v => v instanceof Error ? v.message : (v?.error?.message ?? (typeof v === "object" ? JSON.stringify(v).slice(0, 200) : String(v)))).catch(() => "?")))).join(" ");
    errors.push(`[console.error] ${txt.slice(0, 300)}`);
  });
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
  await sleep(3000);
  return { browser, page, errors };
}
export async function clickText(page, sel, text) {
  const ok = await page.evaluate((sel, text) => {
    const el = [...document.querySelectorAll(sel)].find(n => n.getClientRects().length > 0 && n.textContent.includes(text));
    if (el) el.click();
    return !!el;
  }, sel, text);
  if (!ok) throw new Error(`no visible ${sel} with "${text}"`);
}
export const alive = page => page.evaluate(() => ({
  rootChildren: document.getElementById("root")?.children.length ?? 0,
  map: !!document.querySelector(".maplibregl-canvas"),
  compareMap: !!document.querySelector(".compare-map"),
  yearOn: document.querySelector(".layers .segmented button.on")?.textContent,
  hash: location.hash.replace(/&bbox.*/, ""),
}));
