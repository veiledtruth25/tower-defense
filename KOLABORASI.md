# Kolaborasi dua sesi Claude

Proyek ini dikerjakan dua sesi Claude Code dari dua akun berbeda. Kedua sesi tidak bisa saling mengirim pesan langsung, jadi **repo ini adalah tempat bertemunya**: kode, kontrak antarmuka di dokumen ini, dan catatan di folder `docs/`.

## Pembagian tugas

| Bagian | Pemilik | File |
|---|---|---|
| Logika: data menara, musuh, peta, level, gelombang, simulasi, multiplayer, progres (permata, toko, tantangan, hadiah, event), panel DOM di menu dan di samping papan | Sesi logika | `js/game.js` |
| Tampilan 3D: pulau per peta, suasana per level, model, animasi, efek, kamera, overlay di atas papan, ikon toko dan bestiary, HUD layar penuh (letak panel, menu permainan, kartu menara terpilih) | Sesi desain | `js/view/*.js` |
| Efek suara dan musik | Sesi desain | `js/audio.js` |
| Jembatan event antara logika dan tampilan | Bersama, jarang diubah | `js/bus.js` |
| Struktur halaman dan CSS | Bersama: sesi desain memegang gaya, sesi logika boleh menambah elemen | `index.html` |
| Three.js r149 (lisensi MIT) | Pihak ketiga, jangan diubah | `vendor/` |

Urutan pemuatan skrip ada di akhir `index.html`: Three.js, `bus.js`, `audio.js`, `js/view/*.js` (`core`, `models`, `world`, `actors`, `main`, `hud`), lalu `game.js` (yang menyalakan semuanya).

## Alur kerja

1. Dasarnya adalah `main`. Tiap sesi bekerja di branch sendiri, sering menggabungkan `main` ke branch-nya, lalu membuka PR ke `main`.
2. Jangan mengubah file milik sesi lain, kecuali perubahan kecil di titik sambungan. Kalau itu terjadi, catat di file catatanmu.
3. **Pesan antar sesi** ditulis di `docs/catatan-desain.md` (oleh sesi desain) dan `docs/catatan-logika.md` (oleh sesi logika). Masing-masing hanya menulis di file miliknya, jadi merge tidak bentrok. Baca file milik sesi lain setiap kali mulai bekerja.
4. Sebelum push, jalankan `node tests/smoke.js`. Uji ini memuat game, membangun menara lewat klik di peta 3D, menjalankan gelombang dan memakai bantuan, lalu gagal kalau ada error JavaScript.

## Kontrak: logika ke tampilan

### Yang dibaca tampilan: `BB.game` (baca saja)

Dibuat di akhir `game.js`. Tampilan tidak pernah mengubah isinya.

| Nama | Isi |
|---|---|
| `COLS`, `ROWS`, `LIVES`, `MAXL`, `PCOL` | Ukuran papan, nyawa awal, jumlah level, warna pemain |
| `TW`, `EN`, `MAPS`, `HELP` | Data menara, musuh, peta dan bantuan |
| `stat(t,l)`, `mapOf(L)`, `levelWaves(L)`, `waveList(n,L)` | Rumus yang dipakai untuk jangkauan, peta level, banner gelombang |
| `wavePortals(n,L)` | Portal asal gelombang `n` di level `L`. Tampilan menyalakan portal itu dan meredupkan yang lain |
| `geo(i)` | Geometri peta `i` (tanpa `i`: peta yang sedang dipakai): `routes`, `portals`, `PATH`, `EXIT`, dan `WP`/`SEG`/`PLEN` jalan 0. Rinciannya di `docs/rencana-banyak-jalan.md` |
| `posIn(geo,d,r)` | Posisi (koordinat petak) setelah menempuh jarak `d` di jalan `r` (tanpa `r`: jalan 0) |
| `spd(e)` | Kecepatan musuh `e` saat ini, termasuk efek lambat |
| `canBuild(x,y)`, `towerAt(x,y)`, `mySlot()`, `myGold()` | Untuk pratinjau bangunan dan lingkar jangkauan |
| `S`, `selType`, `selXY`, `hover`, `selLevel`, `mode`, `isHost` | State permainan dan pilihan pemain saat ini |

Field state yang dibaca tampilan: `S.ph`, `S.L`, `S.w`, `S.mw`, `S.lv`, `S.sp`, `S.wm`, `S.rg`, `S.P[i].c`, `S.T[i].{x,y,t,l,o}`, `S.E[i].{id,t,d,hp,sl,r}`. Kalau sesi logika mengganti nama atau arti field ini, catat di `docs/catatan-logika.md` supaya tampilan bisa ikut diubah.

Dua field opsional untuk kemampuan bos (tampilan tetap jalan kalau keduanya tidak ada):

| Field | Isi | Tampilan |
|---|---|---|
| `S.E[i].ab` | Keadaan yang sedang berlangsung: `"burrow"` (di dalam pasir) atau `"enrage"` (mengamuk) | Kalajengking tenggelam ke gundukan pasir, hanya sengatnya yang terlihat. Naga menyala lebih panas dan menyebar bara. Masuk dan keluar dari keadaan ini diberi efek dan suara. |
| `S.T[i].fz` | Sisa detik menara dilumpuhkan | Menara terbungkus es atau hangus berasap, tergantung kemampuan yang terakhir mengenainya (`stomp` atau `breath`), dan penjaganya berhenti membidik |

Di multiplayer, kirim kedua field ini lewat `encode`/`decode` supaya klien melihat hal yang sama.

### Event dari logika (`BB.emit`)

Dikirim oleh host dari simulasi dan oleh klien dari event `F` di jaringan, jadi semua pemain melihat hal yang sama. Koordinat dalam satuan petak: x 0–20, y 0–12, pusat petak berada di +0,5.

| Event | Kapan | Data |
|---|---|---|
| `shot` | Menara menembak | `{t, x1, y1, x2, y2}`: jenis menara, pusat menara, titik sasaran |
| `death` | Musuh mati | `{t, x, y, gold}`: jenis musuh, posisi, emas yang didapat |
| `help` | Bantuan dipakai | `{k, slot, S}`: indeks di `HELP`, slot pemain, state saat itu |
| `ability` | Bos memakai kemampuan sekali jalan | `{t, k, x, y, id?, tx?, ty?, r?}`: jenis musuh, nama kemampuan, posisinya, `id` musuh (disarankan), titik sasaran dan jari-jari dalam petak. `k`: `"summon"` (Raja Lendir memuntahkan lendir), `"stomp"` (Yeti menghentak, menara dalam `r` membeku), `"breath"` (Naga menyembur ke `tx,ty`, menara dalam `r` hangus). Nama lain tetap diberi efek cincin umum sampai sesi desain membuat efeknya. |

Tampilan menunda ledakan kematian sampai proyektil yang membunuh benar-benar mendarat, jadi logika tidak perlu mengatur waktu efek apa pun.

### Yang dipanggil logika: `BB.view`

| Fungsi | Guna |
|---|---|
| `init()` | Sekali saat mulai |
| `show("menu"\|"game")` | Memindah kanvas 3D ke menu atau ke papan permainan |
| `frame(dt)` | Setiap frame, setelah simulasi |
| `reset()` | Membersihkan efek saat game baru dimulai |
| `pick(clientX, clientY)` | Petak di bawah pointer (`{x,y}`), atau `null` di luar papan |
| `icon(canvas, "tower"\|"enemy", index)` | Menggambar potret 3D ke kanvas kecil |

### Konvensi untuk konten baru

- **Musuh baru**: tambahkan ke `EN`. Field opsional untuk tampilan: `model`, `boss: true` (bar HP besar dan aura), `ds` (deskripsi di "Kenali musuh"). Musuh tanpa `model` digambar sebagai bola berwarna `EN.col` sampai sesi desain membuat modelnya.
- **Model yang sudah ada**: `"lendir"`, `"kilat"`, `"kura"`, `"raja"`, `"hantu"`, `"perisai"`, `"goblin"`, `"serigala"`, `"tengkorak"`, `"kelelawar"`, `"mumi"`, `"iblis"`, `"anjingapi"`, `"golemlava"`, dan bos `"rajalendir"`, `"kalajengking"`, `"yeti"`, `"naga"`. Model bos dianggap bos kalau `boss` tidak diisi. Model yang belum dipakai `EN` hanya muncul di galeri.
- **Ketahanan `EN[t].res`** juga dibaca tampilan: tembakan Panah atau Jitu yang hanya kena kurang dari 60% tampil memantul dengan percikan dan bunyi dentang.
- **Urutan munculnya musuh** tidak disimpan di tampilan. "Kenali musuh", deretan "Musuh di level ini" di menu, dan pertempuran mini di menu dihitung dari `waveList(n,L)` dan `levelWaves(L)`. Jadi kalau sesi logika mengubah susunan gelombang, semua itu ikut berubah sendiri.
- **Galeri**: buka halaman dengan `#galeri` di akhir alamat, atau tekan "Galeri 3D" di menu. Pertempuran mini di menu lalu memamerkan semua model (termasuk yang belum ada di `EN`), bos memakai kemampuannya, dan kamera mendekati tiap monster. Ketuk kartu di "Kenali musuh" untuk melihat satu monster sendirian.
- **Menara baru** (indeks 4 ke atas): sementara memakai model Panah. Tulis permintaannya di catatanmu.
- **Peta baru**: tema mengikuti urutan peta (indeks % 4). Sesi desain bisa menambah tema.
- **Banyak jalan dan portal**: tampilan menggambar semua `geo.routes` dan satu portal untuk tiap `geo.portals`, menghadap arah jalannya. Portal boleh di sisi barat (`x=-1`), utara (`y=-1`) atau selatan (`y=12`). Sisi timur adalah benteng. Kalau ada portal di selatan, pulau otomatis diperlebar ke selatan. Musuh berjalan di jalan `e.r` dan keluar dari portal jalan itu.
- **Suasana** mengikuti nomor level: 1–25 pagi, 26–50 senja, 51–75 malam, 76–100 gerhana.
- **Format jaringan** (`encode`, `decode`, `F`) sepenuhnya milik logika. Tampilan tidak membacanya.

### Titik sambungan yang diubah sesi desain di `game.js`

Sesi desain hanya menyentuh bagian berikut. Semuanya kecuali yang terakhir tidak mengubah jalannya permainan:

- `buildGeo`, `GEO` dan `posIn` menggantikan isi `setMap`/`posAt` dengan hasil yang sama, supaya tampilan bisa membaca geometri peta mana pun.
- `shotFx`, `fxDeath` dan `helperFx` sekarang mengirim event `shot`, `death` dan `help`. Hitungan bos di profil tetap di `fxDeath`.
- `observe()` hanya menghitung progres (menara dibangun, kill, kemenangan). Semua efek visual pindah ke tampilan.
- Input papan memakai `BB.view.pick`, ikon toko memakai `BB.view.icon`, dan `showGame`/`leave` memanggil `BB.view.show`.
- `leave()` memanggil `setBanner("")`. Ini memperbaiki bug lama: banner menang/kalah tertinggal saat main lagi.
- `BB.game` ditambahkan di akhir file.
- **Pasukan per bab (2026-10-27, atas permintaan pemilik):** `EN` indeks 10–17 (Goblin sampai Golem Lava) ditambahkan di belakang, `ARMY`/`armyOf` ditambahkan, dan perulangan di `waveList` sekarang mengambil jenis tiap peran (dasar, cepat, tebal, selingan A, selingan B) dari pasukan bab level itu. Bab 1 (level 1–25) tetap sama persis. Angka dan cara mengukurnya ada di `docs/catatan-desain.md`. Selebihnya `game.js` tidak diubah, dan sesi logika bebas menyetel angkanya.

## Layar permainan (HUD)

Saat bermain, `#scrGame` mengisi seluruh layar: kanvas 3D di belakang, HUD di atasnya. Semua ID yang dipakai `game.js` tetap sama, dan `game.js` tetap mengisi serta memperbarui isinya. Yang berubah hanya letaknya:

| Elemen | Letak sekarang |
|---|---|
| `#stats` (`#hLives`, `#hGold`, `#hWave`, `#hLevel`, `#hRoomWrap`), `#waveTxt`, `#btnSpeed` | Bar atas `#hudTop` |
| `#shop`, `#helpBar`, `#btnNext` | Dok `#hudDock`: di bawah pada layar tegak, di kanan pada layar mendatar |
| `#selBox` | Kartu yang melayang di samping menara terpilih (diatur `hud.js` tiap frame) |
| `#banner` | Kartu di bagian bawah area papan |
| `#plist`, `#btnLeave` | Menu permainan `#gameMenu` (tombol ☰) |

Hal yang perlu diketahui sesi logika:

- Kalau menambah elemen ke HUD, beri atribut `data-hud` pada panel yang menutupi tepi layar. Kamera membingkai papan di area yang tidak tertutup panel tersebut.
- Di layar sentuh, ketukan pertama di petak kosong (saat menara dipilih) ditahan tampilan untuk menampilkan bayangan menara dan jangkauannya. Ketukan kedua di petak yang sama diteruskan ke `game.js` dan menara dibangun. Tetikus tidak terpengaruh.
- Tombol × di kartu menara mengirim `keydown` Escape ke `document`, sama dengan menekan Esc.
- Tampilan juga meminta layar penuh (kalau peramban mengizinkan) saat permainan dimulai dari layar sentuh, dan menjaga layar tetap menyala selama bermain.

## Event internal tampilan untuk audio

Tampilan mengirim `v:fire`, `v:hit`, `v:die`, `v:build`, `v:upgrade`, `v:sell`, `v:spawn`, `v:wave`, `v:clear`, `v:win`, `v:lose`, `v:leak`, `v:help`, `v:firework`, `v:ability`, `v:block` dan `v:newfoe` pada saat efeknya terlihat, lalu `audio.js` memutar suaranya. Sesi logika tidak perlu memakai event ini.

## Menjalankan dan menerbitkan

- **Lokal**: buka `index.html` di browser. Semua skrip memakai `<script src>` biasa, jadi bisa jalan dari file lokal tanpa server.
- **Artifact claude.ai**: terbitkan `index.html` beserta `vendor/three.min.js`, `js/bus.js`, `js/audio.js`, `js/view/*.js` (termasuk `hud.js`) dan `js/game.js` sebagai file pendukung (path sama). Kemampuan yang dibutuhkan: `room` (topik `state` dan `cmd` dibuka untuk level `interact`), `user`, dan `db` (koleksi `events` hanya bisa ditulis admin).
