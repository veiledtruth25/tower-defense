// Uji pengaman bot uji: panel bot hanya muncul untuk pemilik (kunci benar di #admin=KUNCI).
//   docker run --rm --network host -e NODE_PATH=/usr/src/app/node_modules -v "$PWD":/app:ro \
//     zenika/alpine-chrome:with-puppeteer node /app/tests/admin.js http://127.0.0.1:7472 KUNCI
const puppeteer = require("puppeteer");
const BASE = process.argv[2], KEY = process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, headless: "new",
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"] });
  const out = {};
  for (const [name, hash] of [["pemilik (kunci benar)", "#admin=" + KEY], ["tanpa kunci", ""], ["kunci salah", "#admin=kunci-yang-salah-123"]]) {
    const ctx = b.createBrowserContext ? await b.createBrowserContext() : await b.createIncognitoBrowserContext();
    const p = await ctx.newPage(); await p.setViewport({ width: 720, height: 520 });
    await p.goto(BASE + "/" + hash, { waitUntil: "domcontentloaded", timeout: 180000 });
    await p.waitForFunction("window.BB&&BB.V&&BB.V.ok&&BB.game", { timeout: 180000 });
    await sleep(1500);
    const menu = await p.evaluate(() => ({ lockNote: !document.querySelector("#ownerNote").hidden, urlHash: location.hash,
      lvl50: (() => { const x = document.querySelector('.lv[data-l="50"]'); return x ? (x.disabled ? "terkunci" : "bisa dipilih") : "?"; })() }));
    await p.click("#btnSolo"); await sleep(2500);
    await p.click("#btnMenu"); await sleep(400);
    out[name] = Object.assign(menu, { panelBot: await p.evaluate(() => !document.querySelector("#botBox").hidden) });
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})().catch((e) => { console.error("GAGAL:", e.message); process.exit(1); });
