'use strict';
// Server Benteng Bersama: menyajikan file game dan menjadi "room" multiplayer lewat WebSocket.
// Bentuk pesannya meniru kemampuan `room` di claude.ai, supaya js/game.js tidak perlu tahu bedanya
// (penghubung di sisi browser: js/net-ws.js).
//
// Lingkungan: PORT (3000), ADMIN_KEY (kunci bot uji pemilik; kosong = fitur mati), WEB_ROOT (folder game).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve(process.env.WEB_ROOT || path.join(__dirname, '..'));
const ADMIN_KEY = process.env.ADMIN_KEY || '';

const MAX_MSG = 8192;          // satu pesan (byte)
const MAX_PRES = 4096;         // satu objek presence (karakter JSON)
const MAX_DATA = 4096;         // data satu event (karakter JSON)
const MAX_ROOMS_PER_CLIENT = 8;
const MAX_CONN_PER_IP = 20;
const GRACE_MS = 6000;         // koneksi putus: tetap dianggap ada selama ini, supaya putus-sambung sebentar tidak memicu pergantian host
const TOPIC_RE = /^[a-z][a-z0-9_.-]{0,47}$/;
const ROOM_RE = /^[a-z0-9][a-z0-9_.-]{0,47}$/;
const roomCap = (name) => (name === 'lobby' ? 500 : 16);

// ---------- file statis (hanya index.html, js/ dan vendor/) ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};
function resolveStatic(pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch { return null; }
  if (p === '/' || p === '/index.html') return path.join(ROOT, 'index.html');
  if (!/^\/(js|vendor)\/[A-Za-z0-9_\-./]+$/.test(p) || p.includes('..')) return null;
  const f = path.join(ROOT, p);
  return f.startsWith(ROOT + path.sep) ? f : null;
}
function serveStatic(req, res, pathname) {
  const file = resolveStatic(pathname);
  if (!file || (req.method !== 'GET' && req.method !== 'HEAD')) return false;
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Tidak ditemukan'); return; }
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'ETag': etag,
      'Cache-Control': pathname.startsWith('/vendor/') ? 'public, max-age=86400' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); res.end(); return; }
    headers['Content-Length'] = st.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
  return true;
}

// ---------- kunci admin (bot uji pemilik) ----------
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const adminTries = new Map(); // ip -> { n, reset }
function ipOf(req) {
  const h = req.headers;
  return String(h['cf-connecting-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?');
}
function adminCheck(req, res) {
  const ip = ipOf(req), now = Date.now();
  let t = adminTries.get(ip);
  if (!t || now > t.reset) { t = { n: 0, reset: now + 10 * 60 * 1000 }; adminTries.set(ip, t); }
  const reply = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
  if (t.n >= 10) return reply(429, { ok: false });
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 1024) req.destroy(); });
  req.on('end', () => {
    let key = '';
    try { key = String(JSON.parse(body).key || ''); } catch { /* kosong */ }
    const ok = !!ADMIN_KEY && key.length > 0 && crypto.timingSafeEqual(sha(key), sha(ADMIN_KEY));
    if (!ok) t.n++;
    reply(200, { ok });
  });
}

// ---------- HTTP ----------
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, clients: wss.clients.size, rooms: rooms.size }));
    return;
  }
  if (url.pathname === '/api/admin' && req.method === 'POST') { adminCheck(req, res); return; }
  if (serveStatic(req, res, url.pathname)) return;
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Tidak ditemukan');
});

// ---------- room ----------
// Satu "peer" = satu tab. Server memberi id dan token; token dipakai tab itu untuk mengambil id yang sama
// kalau koneksinya putus sebentar, supaya game melihatnya sebagai pemain yang sama.
const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG });
const sessions = new Map(); // token -> { peer, token, conn, lastSeen }
const rooms = new Map();    // nama -> Map(peer -> { conn, presence })
const perIp = new Map();

const rid = (n) => crypto.randomBytes(n).toString('base64url');
function send(conn, obj) {
  const ws = conn && conn.ws;
  if (!ws || ws.readyState !== 1) return;
  if (ws.bufferedAmount > 1 << 20) { ws.terminate(); return; }
  ws.send(JSON.stringify(obj));
}
function cleanPres(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  let s; try { s = JSON.stringify(p); } catch { return null; }
  if (s.length > MAX_PRES) return null;
  const out = {};
  for (const k of Object.keys(p)) if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') out[k] = p[k];
  return out;
}
function broadcast(name, exceptPeer, obj) {
  const room = rooms.get(name);
  if (!room) return;
  for (const [peer, m] of room) if (peer !== exceptPeer) send(m.conn, obj);
}
// keluar dari room dan kabari yang lain
function dropMember(name, peer) {
  const room = rooms.get(name);
  if (!room || !room.has(peer)) return;
  clearTimeout(room.get(peer).timer);
  room.delete(peer);
  if (!room.size) rooms.delete(name); else broadcast(name, peer, { t: 'left', room: name, peer });
}
// keluar atas kemauan sendiri (pesan "leave"): langsung
function leaveRoom(conn, name) {
  const room = rooms.get(name), peer = conn.sess && conn.sess.peer, mem = room && room.get(peer);
  conn.rooms.delete(name);
  if (mem && mem.conn === conn) dropMember(name, peer);
}

function onMessage(conn, raw) {
  // pembatas laju per koneksi: 100 pesan/detik, ledakan sampai 200
  const now = Date.now();
  conn.bucket.n = Math.min(200, conn.bucket.n + (now - conn.bucket.t) * 0.1);
  conn.bucket.t = now;
  if (conn.bucket.n < 1) { if (++conn.drops > 300) conn.ws.close(1008, 'terlalu cepat'); return; }
  conn.bucket.n -= 1;

  let m;
  try { m = JSON.parse(raw.toString()); } catch { return; }
  if (!m || typeof m !== 'object') return;

  if (m.t === 'hello') {
    if (conn.sess) return;
    const tab = typeof m.tab === 'string' ? m.tab.slice(0, 32) : '';
    let s = typeof m.token === 'string' ? sessions.get(m.token) : null;
    if (s && s.conn && s.conn !== conn) {
      // Halaman yang sama menyambung lagi sebelum server sadar koneksi lamanya mati: ambil alih identitasnya.
      // Tab hasil "duplikat" membawa token yang sama tapi id tab berbeda, jadi ia mendapat identitas baru.
      if (tab && s.tab === tab) s.conn.ws.terminate(); else s = null;
    }
    if (!s) s = { peer: 'p' + rid(6), token: rid(18), conn: null, lastSeen: now, tab };
    s.tab = tab; s.conn = conn; s.lastSeen = now; conn.sess = s; sessions.set(s.token, s);
    send(conn, { t: 'welcome', peer: s.peer, token: s.token });
    return;
  }
  if (!conn.sess) return;
  if (m.t === 'ping') { send(conn, { t: 'pong' }); return; }

  const name = typeof m.room === 'string' ? m.room : '';
  if (!ROOM_RE.test(name)) return;
  const peer = conn.sess.peer;

  if (m.t === 'join') {
    const pres = cleanPres(m.presence || {});
    if (!pres) { send(conn, { t: 'err', room: name, code: 'invalid_argument' }); return; }
    let room = rooms.get(name);
    const already = room && room.has(peer);
    if (!already) {
      if (conn.rooms.size >= MAX_ROOMS_PER_CLIENT || (room && room.size >= roomCap(name))) { send(conn, { t: 'err', room: name, code: 'limit_reached' }); return; }
      if (!room) { room = new Map(); rooms.set(name, room); }
      room.set(peer, { conn, presence: pres });
      conn.rooms.add(name);
    } else {   // menyambung lagi dalam masa tunggu: batalkan keluarnya, yang lain tidak melihat apa-apa
      const mem = room.get(peer);
      clearTimeout(mem.timer); mem.timer = null; mem.conn = conn; mem.presence = pres; conn.rooms.add(name);
    }
    const peers = [];
    for (const [p, mem] of room) if (p !== peer) peers.push({ peer: p, presence: mem.presence });
    send(conn, { t: 'joined', room: name, peers });
    broadcast(name, peer, { t: 'p', room: name, peer, presence: pres });
    return;
  }
  const room = rooms.get(name), mem = room && room.get(peer);
  if (!mem || mem.conn !== conn) return;
  if (m.t === 'pres') {
    const pres = cleanPres(m.presence);
    if (!pres) { send(conn, { t: 'err', room: name, code: 'invalid_argument' }); return; }
    mem.presence = pres;
    broadcast(name, peer, { t: 'p', room: name, peer, presence: pres });
  } else if (m.t === 'emit') {
    if (typeof m.topic !== 'string' || !TOPIC_RE.test(m.topic)) return;
    let s; try { s = JSON.stringify(m.data === undefined ? null : m.data); } catch { return; }
    if (s.length > MAX_DATA) return;
    broadcast(name, peer, { t: 'm', room: name, peer, topic: m.topic, data: m.data === undefined ? null : m.data });
  } else if (m.t === 'leave') {
    leaveRoom(conn, name);
  }
}

function onClose(conn) {
  const peer = conn.sess && conn.sess.peer;
  for (const name of [...conn.rooms]) {
    const room = rooms.get(name), mem = room && room.get(peer);
    if (mem && mem.conn === conn) { mem.conn = null; mem.timer = setTimeout(() => dropMember(name, peer), GRACE_MS); }
  }
  conn.rooms.clear();
  if (conn.sess && conn.sess.conn === conn) { conn.sess.conn = null; conn.sess.lastSeen = Date.now(); }
  const n = (perIp.get(conn.ip) || 1) - 1;
  if (n <= 0) perIp.delete(conn.ip); else perIp.set(conn.ip, n);
}

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/ws') { socket.destroy(); return; }
  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch { /* kosong */ }
    const mine = String(req.headers['x-forwarded-host'] || req.headers.host || '');
    if (host !== mine) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
  }
  const ip = ipOf(req);
  if ((perIp.get(ip) || 0) >= MAX_CONN_PER_IP) { socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const conn = { ws, ip, sess: null, rooms: new Set(), bucket: { t: Date.now(), n: 200 }, drops: 0 };
    perIp.set(ip, (perIp.get(ip) || 0) + 1);
    ws.on('message', (raw) => onMessage(conn, raw));
    ws.on('close', () => onClose(conn));
    ws.on('error', () => {});
  });
});

// detak: putus koneksi yang tidak membalas ping, dan hapus sesi lama yang tidak dipakai lagi
const beat = setInterval(() => {
  const now = Date.now();
  for (const s of sessions.values()) if (!s.conn && now - s.lastSeen > 120000) sessions.delete(s.token);
  for (const [ip, t] of adminTries) if (now > t.reset) adminTries.delete(ip);
}, 30000);
const pinger = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 20000);
wss.on('connection', (ws) => { ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; }); });

function stop() {
  clearInterval(beat); clearInterval(pinger);
  for (const ws of wss.clients) ws.close(1001, 'server berhenti');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);

server.listen(PORT, () => {
  console.log(`Benteng Bersama di port ${PORT}, folder ${ROOT}, admin ${ADMIN_KEY ? 'aktif' : 'mati'}`);
});
