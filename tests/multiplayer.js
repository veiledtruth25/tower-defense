// Uji multiplayer sungguhan: dua pemain (dua browser terpisah) lewat server/server.js.
// Host membuat room, tamu bergabung dengan kode, host memulai, keduanya membangun menara dan gelombang berjalan.
// Jalankan (server sudah hidup di port 7472):
// Argumen ke-3: "nopresence" meniru presence tamu yang tidak pernah sampai ke host (uji singkat, tanpa gelombang).
//   docker run --rm --network host -e NODE_PATH=/usr/src/app/node_modules -v "$PWD":/app:ro -v "$PWD/test-out":/out zenika/alpine-chrome:with-puppeteer \
//     node /app/tests/multiplayer.js http://127.0.0.1:7472 /out
const puppeteer = require("puppeteer");
const BASE = process.argv[2] || "http://127.0.0.1:7472", OUT = process.argv[3] || "/tmp", NOPRES = process.argv[4] === "nopresence";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

async function player(browser, name) {
  const ctx = browser.createBrowserContext ? await browser.createBrowserContext() : await browser.createIncognitoBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 720, height: 520 });
  page.on("pageerror", (e) => errors.push(name + ": " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(name + ": " + m.text()); });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction("window.BB&&BB.V&&BB.V.ok&&BB.game", { timeout: 180000 });
  await page.click("#nameIn", { clickCount: 3 });
  await page.type("#nameIn", name);
  await page.$eval("#nameIn", (el) => el.dispatchEvent(new Event("change")));
  return page;
}
const look = (p) => p.evaluate(() => {
  const g = BB.game, S = g.S;
  if (!S) return "belum ada state";
  return { ph: S.ph, L: S.L, w: S.w, slot: g.mySlot(), host: g.isHost,
    P: S.P.map((x) => x.n + (x.off ? "(off)" : "") + " " + x.g + "emas " + x.k + "kill"),
    T: S.T.map((t) => "o" + t.o), banner: ((document.querySelector("#banner") || {}).textContent || "").replace(/\s+/g, " ").slice(0, 110) };
});
async function buildAt(p, type, minX) {
  const pt = await p.evaluate((t, mx) => {
    const g = BB.game, geo = g.geo(), V = BB.V; let s = null;
    for (const k of geo.PATH) { const [x, y] = k.split(",").map(Number); if (x > mx && g.canBuild(x, y + 1)) { s = [x, y + 1]; break; } }
    if (!s) return null;
    const v = new THREE.Vector3(s[0] + .5 - V.HX, V.groundAt(s[0] + .5, s[1] + .5), s[1] + .5 - V.HZ).project(V.cam);
    const r = document.querySelector("#cvWrap canvas").getBoundingClientRect();
    return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
  }, type, minX);
  if (!pt) return false;
  await p.keyboard.press(String(type + 1)); await p.mouse.click(pt[0], pt[1]); await sleep(500); await p.keyboard.press("Escape");
  return true;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, headless: "new",
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
  });
  const host = await player(browser, "Tuan Rumah"), guest = await player(browser, "Tamu Satu");
  await host.click("#btnHost");
  await host.waitForFunction("document.querySelector('#hRoom').textContent.length>0", { timeout: 15000 });
  const code = await host.$eval("#hRoom", (e) => e.textContent);
  await sleep(1200);
  const listed = await guest.evaluate(() => [...document.querySelectorAll("#openList li")].map((l) => l.textContent.trim()));
  if (NOPRES) await guest.evaluate(async () => {   // tamu tidak pernah mengirim presence di room permainan
    const r = await window.claude.use("room"), join = r.join;
    r.join = async (n) => { const g = await join(n); g.presence = () => Promise.resolve(); return g; };
  });
  await guest.type("#codeIn", code); await guest.click("#btnJoin");
  await sleep(4000);
  const lobby = { host: await look(host), guest: await look(guest) };
  await host.screenshot({ path: OUT + "/mp-lobby-host.png" });
  await host.click("#bGo").catch(() => {});
  await sleep(1500);
  if (NOPRES) {
    await sleep(3000);
    const res = { host: await look(host), guest: await look(guest) };
    console.log(JSON.stringify({ mode: "nopresence", code, lobby, afterStart: res }, null, 1));
    console.log("errors", JSON.stringify(errors));
    await browser.close(); return;
  }
  const okG = await buildAt(guest, 0, 2), okH = await buildAt(host, 1, 6);
  await guest.keyboard.press("Space");
  // Chrome tanpa GPU menggambar lewat CPU dan lambat, jadi tunggu sampai ada pembunuhan, bukan hitungan detik
  for (let i = 0; i < 40; i++) { await sleep(3000); const k = await guest.evaluate(() => BB.game.S.P.reduce((a, p) => a + p.k, 0)); if (k > 0 && i > 3) break; }
  const play = { host: await look(host), guest: await look(guest), built: { guest: okG, host: okH } };
  await guest.screenshot({ path: OUT + "/mp-play-guest.png" });
  console.log(JSON.stringify({ code, listedForGuest: listed, lobby, play }, null, 1));
  console.log("errors", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error("GAGAL:", e.message); process.exit(1); });
