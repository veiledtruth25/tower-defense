// Uji putus-sambung: dua pemain, lalu koneksi salah satunya diputus (WebSocket ditutup dari sisi halaman).
//  1. tamu putus sebentar: tetap duduk, host tidak menandainya keluar
//  2. host putus sebentar: tamu tidak boleh mengambil alih
//  3. host hilang lama (lewat masa tunggu): tamu mengambil alih; saat host kembali tersisa tepat satu host
//   docker run --rm --network host -e NODE_PATH=/usr/src/app/node_modules -v "$PWD":/app:ro \
//     zenika/alpine-chrome:with-puppeteer node /app/tests/reconnect.js http://127.0.0.1:7472
const puppeteer = require("puppeteer");
const BASE = process.argv[2] || "http://127.0.0.1:7472";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [], results = [];
const check = (name, ok, info) => { results.push({ name, ok, info }); console.log((ok ? "LULUS " : "GAGAL ") + name + (info ? "  " + JSON.stringify(info) : "")); };

async function player(browser, name) {
  const ctx = browser.createBrowserContext ? await browser.createBrowserContext() : await browser.createIncognitoBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 720, height: 520 });
  await page.evaluateOnNewDocument(() => {   // catat WebSocket supaya uji bisa memutusnya, dan menolak sambungan baru saat __block
    const O = window.WebSocket; window.__ws = []; window.__block = false;
    function W(...a) { if (window.__block) throw new Error("diblokir uji"); const w = new O(...a); window.__ws.push(w); return w; }
    W.prototype = O.prototype; for (const k of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) W[k] = O[k];
    window.WebSocket = W;
  });
  page.on("pageerror", (e) => errors.push(name + ": " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/diblokir uji/.test(m.text())) errors.push(name + ": " + m.text()); });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction("window.BB&&BB.V&&BB.V.ok&&BB.game", { timeout: 180000 });
  await page.click("#nameIn", { clickCount: 3 }); await page.type("#nameIn", name);
  await page.$eval("#nameIn", (el) => el.dispatchEvent(new Event("change")));
  return page;
}
const snap = (p) => p.evaluate(() => { const g = BB.game, S = g.S; return S ? { host: g.isHost, slot: g.mySlot(), h: S.h, L: S.L, w: S.w,
  active: S.P.filter((x) => !x.off).length, gold: S.P.map((x) => x.g), names: S.P.map((x) => x.n + (x.off ? "(off)" : "")) } : null; });
const drop = (p) => p.evaluate(() => { const w = window.__ws[window.__ws.length - 1]; if (w) w.close(); });
async function watch(fn, ms, every = 300) { const seen = []; const t0 = Date.now(); while (Date.now() - t0 < ms) { seen.push(await fn()); await sleep(every); } return seen; }

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, headless: "new",
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"] });
  const host = await player(browser, "Tuan Rumah"), guest = await player(browser, "Tamu Satu");
  await host.click("#btnHost");
  await host.waitForFunction("document.querySelector('#hRoom').textContent.length>0", { timeout: 120000 });
  const code = await host.$eval("#hRoom", (e) => e.textContent);
  await sleep(2500);
  await guest.type("#codeIn", code); await guest.click("#btnJoin");
  const two = "BB.game.S&&BB.game.S.P.filter(p=>!p.off).length>=2&&BB.game.mySlot()>=0";
  await host.waitForFunction(two, { timeout: 120000 }); await guest.waitForFunction(two, { timeout: 120000 });
  await host.click("#bGo"); await guest.waitForFunction("BB.game.S.ph!=='lobby'", { timeout: 60000 });
  const base = { host: await snap(host), guest: await snap(guest) };
  check("awal: dua pemain, satu host", base.host.host && !base.guest.host && base.host.active === 2 && base.guest.slot === 1, { names: base.host.names });
  const hostPeer = base.host.h;

  // 1. tamu putus sebentar
  await drop(guest);
  const s1 = await watch(async () => (await snap(host)).names, 5000);
  const offSeen = s1.some((n) => n.some((x) => x.includes("(off)")));
  await sleep(1500);
  const a1 = { host: await snap(host), guest: await snap(guest) };
  check("1. tamu putus sebentar: host tidak pernah menandainya keluar", !offSeen, { offSeen });
  check("1. tamu tetap duduk di slot yang sama dan host tetap satu", a1.guest && a1.guest.slot === 1 && a1.host.host && !a1.guest.host && a1.host.active === 2, { slot: a1.guest && a1.guest.slot });

  // 2. host putus sebentar
  await drop(host);
  const s2 = await watch(async () => (await snap(guest)).host, 6000);
  await sleep(1500);
  const a2 = { host: await snap(host), guest: await snap(guest) };
  check("2. host putus sebentar: tamu tidak mengambil alih", !s2.some(Boolean) && !a2.guest.host && a2.host.host, { guestPernahHost: s2.some(Boolean) });
  check("2. host masih memegang permainan yang sama", a2.host.h === hostPeer && a2.guest.h === hostPeer && a2.guest.active === 2, { h: a2.guest.h === hostPeer });

  // 3. host hilang lama: tidak bisa menyambung selama 14 detik
  await host.evaluate(() => { window.__block = true; window.__ws[window.__ws.length - 1].close(); });
  const s3 = await watch(async () => (await snap(guest)).host, 14000, 500);
  check("3. host hilang lama: tamu mengambil alih", s3.some(Boolean), { diambilAlih: s3.some(Boolean) });
  await host.evaluate(() => { window.__block = false; });
  await sleep(25000);
  const a3 = { host: await snap(host), guest: await snap(guest) };
  const hosts = [a3.host.host, a3.guest.host].filter(Boolean).length;
  check("3. setelah host kembali: tepat satu host", hosts === 1, { hostDiHost: a3.host.host, hostDiTamu: a3.guest.host });
  check("3. keduanya melihat permainan yang sama dan tetap berdua", a3.host.L === a3.guest.L && a3.host.h === a3.guest.h && a3.host.active === 2 && a3.guest.active === 2 && a3.host.slot >= 0 && a3.guest.slot >= 0,
    { hostH: a3.host.h === a3.guest.h, aktif: [a3.host.active, a3.guest.active], slot: [a3.host.slot, a3.guest.slot] });
  // pengamat ketiga membaca lobi: berapa pemain yang masih mengiklankan diri sebagai host room ini?
  const obs = await (browser.createBrowserContext ? await browser.createBrowserContext() : await browser.createIncognitoBrowserContext()).newPage();
  await obs.goto(BASE + "/healthz");
  const ads = await obs.evaluate((base, code) => new Promise((res) => {
    const ws = new WebSocket(base.replace(/^http/, "ws") + "/ws"), peers = new Map();
    ws.onopen = () => ws.send(JSON.stringify({ t: "hello" }));
    ws.onmessage = (e) => { const m = JSON.parse(e.data);
      if (m.t === "welcome") ws.send(JSON.stringify({ t: "join", room: "lobby", presence: {} }));
      else if (m.t === "joined") m.peers.forEach((p) => peers.set(p.peer, p.presence));
      else if (m.t === "p") peers.set(m.peer, m.presence); else if (m.t === "left") peers.delete(m.peer); };
    setTimeout(() => { ws.close(); res([...peers.values()].filter((p) => p.g && p.g.c === code).map((p) => p.nm)); }, 4000);
  }), BASE, code);
  check("lobi: tepat satu pemain mengiklankan diri sebagai host room ini", ads.length === 1, { pengiklan: ads });
  check("tanpa error JavaScript", errors.length === 0, errors.slice(0, 3));
  console.log(results.every((r) => r.ok) ? "SEMUA LULUS" : "ADA YANG GAGAL");
  await browser.close();
  process.exit(results.every((r) => r.ok) ? 0 : 2);
})().catch((e) => { console.error("GAGAL:", e.message); process.exit(1); });
