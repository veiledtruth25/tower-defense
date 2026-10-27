// Penghubung multiplayer lewat WebSocket, untuk game yang dijalankan di server sendiri (server/server.js).
// Bentuknya meniru kemampuan `room` dari claude.ai (join, presence, peers, onPeers, emit, on), jadi game.js
// memakainya tanpa tahu bedanya. Di dalam claude.ai, penampil sudah menyediakan window.claude, jadi file ini
// tidak melakukan apa-apa. Dari file:// juga tidak aktif (tidak ada server).
//
// Pemilik: buka alamat game sekali dengan akhiran  #admin=KUNCI  (KUNCI ada di file .env di server).
// Kunci disimpan di browser itu, lalu server memeriksanya untuk membuka panel bot uji.
(function () {
"use strict";
if (window.claude || location.protocol === "file:" || !window.WebSocket) return;

const FORBID = new Set(["__proto__", "constructor", "prototype"]);
const TOPIC_RE = /^[a-z][a-z0-9_.-]{0,47}$/;
const err = (code, message) => ({ code, message: message || code });

// ---------- kunci pemilik ----------
try {
  const m = /^#admin=([A-Za-z0-9_-]{8,128})$/.exec(location.hash || "");
  if (m) {
    localStorage.setItem("bb-admin", m[1]);
    history.replaceState(null, "", location.pathname + location.search);
  }
} catch (e) { /* penyimpanan diblokir */ }
let adminP = null;
function isAdmin() {
  if (adminP) return adminP;
  let key = "";
  try { key = localStorage.getItem("bb-admin") || ""; } catch (e) { /* kosong */ }
  if (!key) return (adminP = Promise.resolve(false));
  adminP = fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) })
    .then((r) => r.json()).then((d) => {
      if (!d.ok) { try { localStorage.removeItem("bb-admin"); } catch (e) { /* abaikan */ } }
      return !!d.ok;
    }).catch(() => false);
  return adminP;
}
const userApi = {
  isOwner: isAdmin, canEdit: isAdmin,
  can: () => Promise.resolve(null), id: () => Promise.resolve(null),
  me: () => isAdmin().then((o) => ({ id: null, name: "", isOwner: o, canEdit: o })),
};

// ---------- koneksi ----------
let ws = null, open = false, peerId = null, token = null, backoff = 500, pingT = 0, lastPong = 0, retryT = 0, started = false;
try { token = sessionStorage.getItem("bb-tok"); } catch (e) { /* kosong */ }
const rooms = new Map(); // nama -> record room
const connH = new Set();
const wsUrl = () => (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";
const sendRaw = (o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

function connChanged(v) { for (const f of [...connH]) { try { f(v); } catch (e) { /* abaikan */ } } }
function connect() {
  if (ws) return;
  let mine;
  try { mine = ws = new WebSocket(wsUrl()); } catch (e) { schedule(); return; }
  mine.onopen = () => sendRaw({ t: "hello", token });
  mine.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
  mine.onclose = () => {
    if (ws !== mine) return;
    ws = null; open = false; clearInterval(pingT);
    connChanged(false); schedule();
  };
  mine.onerror = () => {};
}
function schedule() {
  clearTimeout(retryT);
  retryT = setTimeout(connect, backoff);
  backoff = Math.min(10000, backoff * 2);
}
function onMsg(m) {
  if (m.t === "welcome") {
    peerId = m.peer; token = m.token; open = true; backoff = 500; lastPong = Date.now();
    try { sessionStorage.setItem("bb-tok", token); } catch (e) { /* abaikan */ }
    clearInterval(pingT);
    pingT = setInterval(() => {
      if (Date.now() - lastPong > 70000 && ws) { try { ws.close(); } catch (e) { /* abaikan */ } return; }
      sendRaw({ t: "ping" });
    }, 20000);
    for (const R of rooms.values()) { R.meChanged(); R.sendJoin(); }
    connChanged(true);
    return;
  }
  if (m.t === "pong") { lastPong = Date.now(); return; }
  const R = rooms.get(m.room);
  if (R) R.onServer(m);
}

// ---------- satu room ----------
const clean = (p) => { const o = {}; if (p && typeof p === "object") for (const k of Object.keys(p)) if (!FORBID.has(k)) o[k] = p[k]; return o; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function makeRoom(name) {
  const members = new Map();          // peer lain -> objek peer
  const topicH = Object.create(null);
  const peerH = new Set(), roomConnH = new Set();
  let pres = {}, meObj = null, snap = null, upd = Date.now();
  let joined = false, dead = false, flushT = 0, presT = 0, waiters = [];
  let chJoined = [], chLeft = [], chUpdated = [];

  const me = () => meObj || (meObj = Object.freeze({
    peer: peerId, by: null, isMe: true, sameTab: true, kind: "viewer", guest: false,
    presence: Object.freeze(clean(pres)), updatedAt: upd,
  }));
  const mk = (peer, p) => Object.freeze({
    peer, by: null, isMe: false, sameTab: false, kind: "viewer", guest: false,
    presence: Object.freeze(clean(p)), updatedAt: Date.now(),
  });
  const list = () => snap || (snap = Object.freeze((peerId ? [me()] : []).concat([...members.values()])));
  const change = () => ({ peers: list(), joined: chJoined, left: chLeft, updated: chUpdated });
  function flush() {
    if (flushT || dead) return;
    flushT = setTimeout(() => {
      flushT = 0;
      const c = change(); chJoined = []; chLeft = []; chUpdated = [];
      for (const f of [...peerH]) { try { f(c); } catch (e) { /* abaikan */ } }
    }, 16);
  }
  const R = {
    name,
    meChanged() { meObj = null; snap = null; chUpdated.push(me()); flush(); },
    sendJoin() { if (!dead && open) sendRaw({ t: "join", room: name, presence: pres }); },
    onServer(m) {
      if (dead) return;
      if (m.t === "joined") {
        const seen = new Set();
        for (const it of m.peers || []) {
          seen.add(it.peer);
          const old = members.get(it.peer), p = clean(it.presence);
          if (!old) { const o = mk(it.peer, p); members.set(it.peer, o); chJoined.push(o); }
          else if (!same(old.presence, p)) { const o = mk(it.peer, p); members.set(it.peer, o); chUpdated.push(o); }
        }
        for (const [k, o] of [...members]) if (!seen.has(k)) { members.delete(k); chLeft.push(o); }
        snap = null;
        if (!joined) { joined = true; chJoined.unshift(me()); }
        const w = waiters; waiters = []; for (const f of w) f.ok();
        flush();
      } else if (m.t === "p") {
        const old = members.get(m.peer), o = mk(m.peer, m.presence);
        members.set(m.peer, o); snap = null;
        (old ? chUpdated : chJoined).push(o); flush();
      } else if (m.t === "left") {
        const old = members.get(m.peer);
        if (old) { members.delete(m.peer); snap = null; chLeft.push(old); flush(); }
      } else if (m.t === "m") {
        const hs = topicH[m.topic];
        if (!hs) return;
        const msg = { peer: m.peer, by: null, isMe: false, sameTab: false, kind: "viewer", guest: false, topic: m.topic, data: m.data };
        for (const f of [...hs]) { try { f(msg); } catch (e) { /* abaikan */ } }
      } else if (m.t === "err") {
        const w = waiters; waiters = []; for (const f of w) f.fail(err(m.code || "upstream_error"));
      }
    },
    waitJoined(ms) {
      return new Promise((ok, fail) => {
        if (joined) return ok();
        const w = { ok: () => { clearTimeout(t); ok(); }, fail: (e) => { clearTimeout(t); fail(e); } };
        const t = setTimeout(() => { waiters = waiters.filter((x) => x !== w); fail(err("upstream_error", "Server tidak menjawab")); }, ms);
        waiters.push(w);
      });
    },
  };
  const api = {
    name,
    emit(topic, data) {
      if (dead) return Promise.reject(err("invalid_argument", "Room sudah ditinggalkan"));
      if (typeof topic !== "string" || !TOPIC_RE.test(topic)) return Promise.reject(err("invalid_argument", "Nama topik tidak sah"));
      let s; try { s = JSON.stringify(data === undefined ? null : data); } catch (e) { return Promise.reject(err("invalid_argument", "Data bukan JSON")); }
      if (s.length > 4096) return Promise.reject(err("invalid_argument", "Data lebih dari 4 KiB"));
      if (!open || !joined) return Promise.resolve();      // seperti room asli: terputus berarti dibuang
      sendRaw({ t: "emit", room: name, topic, data: data === undefined ? null : JSON.parse(s) });
      const hs = topicH[topic];
      if (hs) {   // gema ke diri sendiri, ditandai sameTab
        const copy = JSON.parse(s);
        setTimeout(() => { for (const f of [...hs]) { try { f({ peer: peerId, by: null, isMe: true, sameTab: true, kind: "viewer", guest: false, topic, data: copy }); } catch (e) { /* abaikan */ } } }, 0);
      }
      return Promise.resolve();
    },
    on(topic, fn) {
      if (typeof fn !== "function") throw new TypeError("handler harus fungsi");
      (topicH[topic] = topicH[topic] || new Set()).add(fn);
      return () => { if (topicH[topic]) topicH[topic].delete(fn); };
    },
    presence(patch) {
      if (dead) return Promise.reject(err("invalid_argument", "Room sudah ditinggalkan"));
      const next = Object.assign({}, pres);
      for (const k of Object.keys(patch || {})) { if (FORBID.has(k)) continue; if (patch[k] === null) delete next[k]; else next[k] = patch[k]; }
      let s; try { s = JSON.stringify(next); } catch (e) { return Promise.reject(err("invalid_argument", "Presence bukan JSON")); }
      if (s.length > 4096) return Promise.reject(err("invalid_argument", "Presence lebih dari 4 KiB"));
      if (s === JSON.stringify(pres)) return Promise.resolve();
      pres = next; upd = Date.now(); meObj = null; snap = null; chUpdated.push(me()); flush();
      if (!presT) presT = setTimeout(() => { presT = 0; if (open && joined && !dead) sendRaw({ t: "pres", room: name, presence: pres }); }, 40);
      return Promise.resolve();
    },
    peers: () => list(),
    onPeers(fn) {
      if (typeof fn !== "function") throw new TypeError("handler harus fungsi");
      peerH.add(fn);
      setTimeout(() => { if (peerH.has(fn)) { try { fn({ peers: list(), joined: list(), left: [], updated: [] }); } catch (e) { /* abaikan */ } } }, 0);
      return () => peerH.delete(fn);
    },
    connected: () => open,
    onConnection(fn) {
      roomConnH.add(fn); connH.add(fn);
      setTimeout(() => { try { fn(open); } catch (e) { /* abaikan */ } }, 0);
      return () => { roomConnH.delete(fn); connH.delete(fn); };
    },
    leave() {
      if (dead) return Promise.resolve();
      sendRaw({ t: "leave", room: name });
      dead = true; rooms.delete(name); peerH.clear();
      for (const f of roomConnH) connH.delete(f);
      return Promise.resolve();
    },
  };
  R.api = api;
  return R;
}

function ensureStarted() { if (!started) { started = true; connect(); } }

function joinRoom(name) {
  ensureStarted();
  if (typeof name !== "string" || !/^[a-z0-9][a-z0-9_.-]{0,47}$/.test(name)) return Promise.reject(err("invalid_argument", "Nama room tidak sah"));
  let R = rooms.get(name);
  if (!R) { R = makeRoom(name); rooms.set(name, R); }
  R.sendJoin();
  return R.waitJoined(10000).then(() => R.api, (e) => { if (rooms.get(name) === R) { R.api.leave(); } throw e; });
}

// ruang tamu: semua yang membuka halaman ada di sini. Dipakai game untuk daftar room yang sedang terbuka.
const lobby = makeRoom("lobby");
rooms.set("lobby", lobby);
const roomApi = Object.assign({}, lobby.api, { join: joinRoom });

window.claude = {
  use(name) {
    if (name === "room") { ensureStarted(); return Promise.resolve(roomApi); }
    if (name === "user") return Promise.resolve(userApi);
    return Promise.resolve(null);
  },
};
})();
