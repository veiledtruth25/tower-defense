# Kolaborasi dua sesi Claude

Proyek ini dikerjakan dua sesi Claude Code dari dua akun berbeda. Kedua sesi tidak bisa saling mengirim pesan langsung, jadi **repo ini adalah tempat bertemunya**: kode, kontrak antarmuka di dokumen ini, dan catatan di folder `docs/`.

## Pembagian tugas

| Bagian | Pemilik | File |
|---|---|---|
| Logika: data menara, musuh, peta, level, gelombang, simulasi, multiplayer, progres (permata, toko, tantangan, hadiah, event), panel DOM di menu dan di samping papan | Sesi logika | `js/game.js` |
| Tampilan 3D: pulau per peta, suasana per level, model, animasi, efek, kamera, overlay di atas papan, ikon toko dan bestiary | Sesi desain | `js/view/*.js` |
| Efek suara dan musik | Sesi desain | `js/audio.js` |
| Jembatan event antara logika dan tampilan | Bersama, jarang diubah | `js/bus.js` |
| Struktur halaman dan CSS | Bersama: sesi desain memegang gaya, sesi logika boleh menambah elemen | `index.html` |
| Three.js r149 (lisensi MIT) | Pihak ketiga, jangan diubah | `vendor/` |

Urutan pemuatan skrip ada di akhir `index.html`: Three.js, `bus.js`, `audio.js`, `js/view/*.js`, lalu `game.js` (yang menyalakan semuanya).

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
| `geo(i)` | Geometri peta `i` (tanpa `i`: peta yang sedang dipakai): `WP`, `SEG`, `PLEN`, `PATH`, `EXIT` |
| `posIn(geo,d)` | Posisi (koordinat petak) setelah menempuh jarak `d` di jalan |
| `spd(e)` | Kecepatan musuh `e` saat ini, termasuk efek lambat |
| `canBuild(x,y)`, `towerAt(x,y)`, `mySlot()`, `myGold()` | Untuk pratinjau bangunan dan lingkar jangkauan |
| `S`, `selType`, `selXY`, `hover`, `selLevel`, `mode`, `isHost` | State permainan dan pilihan pemain saat ini |

Field state yang dibaca tampilan: `S.ph`, `S.L`, `S.w`, `S.mw`, `S.lv`, `S.sp`, `S.wm`, `S.rg`, `S.P[i].c`, `S.T[i].{x,y,t,l,o}`, `S.E[i].{id,t,d,hp,sl}`. Kalau sesi logika mengganti nama atau arti field ini, catat di `docs/catatan-logika.md` supaya tampilan bisa ikut diubah.

### Event dari logika (`BB.emit`)

Dikirim oleh host dari simulasi dan oleh klien dari event `F` di jaringan, jadi semua pemain melihat hal yang sama. Koordinat dalam satuan petak: x 0–20, y 0–12, pusat petak berada di +0,5.

| Event | Kapan | Data |
|---|---|---|
| `shot` | Menara menembak | `{t, x1, y1, x2, y2}`: jenis menara, pusat menara, titik sasaran |
| `death` | Musuh mati | `{t, x, y, gold}`: jenis musuh, posisi, emas yang didapat |
| `help` | Bantuan dipakai | `{k, slot, S}`: indeks di `HELP`, slot pemain, state saat itu |

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

- **Musuh baru**: tambahkan ke `EN`. Field opsional untuk tampilan: `model` (`"lendir"`, `"kilat"`, `"kura"`, `"raja"`), `boss: true` (bar HP besar dan aura), `ds` (deskripsi di "Kenali musuh"). Musuh tanpa `model` digambar sebagai bola berwarna `EN.col` sampai sesi desain membuat modelnya.
- **Menara baru** (indeks 4 ke atas): sementara memakai model Panah. Tulis permintaannya di catatanmu.
- **Peta baru**: tema mengikuti urutan peta (indeks % 4). Sesi desain bisa menambah tema.
- **Suasana** mengikuti nomor level: 1–25 pagi, 26–50 senja, 51–75 malam, 76–100 gerhana.
- **Format jaringan** (`encode`, `decode`, `F`) sepenuhnya milik logika. Tampilan tidak membacanya.

### Titik sambungan yang diubah sesi desain di `game.js`

Isi logika tidak diubah. Yang disentuh hanya:

- `buildGeo`, `GEO` dan `posIn` menggantikan isi `setMap`/`posAt` dengan hasil yang sama, supaya tampilan bisa membaca geometri peta mana pun.
- `shotFx`, `fxDeath` dan `helperFx` sekarang mengirim event `shot`, `death` dan `help`. Hitungan bos di profil tetap di `fxDeath`.
- `observe()` hanya menghitung progres (menara dibangun, kill, kemenangan). Semua efek visual pindah ke tampilan.
- Input papan memakai `BB.view.pick`, ikon toko memakai `BB.view.icon`, dan `showGame`/`leave` memanggil `BB.view.show`.
- `leave()` memanggil `setBanner("")`. Ini memperbaiki bug lama: banner menang/kalah tertinggal saat main lagi.
- `BB.game` ditambahkan di akhir file.

## Event internal tampilan untuk audio

Tampilan mengirim `v:fire`, `v:hit`, `v:die`, `v:build`, `v:upgrade`, `v:sell`, `v:spawn`, `v:wave`, `v:clear`, `v:win`, `v:lose`, `v:leak`, `v:help` dan `v:firework` pada saat efeknya terlihat, lalu `audio.js` memutar suaranya. Sesi logika tidak perlu memakai event ini.

## Menjalankan dan menerbitkan

- **Lokal**: buka `index.html` di browser. Semua skrip memakai `<script src>` biasa, jadi bisa jalan dari file lokal tanpa server.
- **Artifact claude.ai**: terbitkan `index.html` beserta `vendor/three.min.js`, `js/bus.js`, `js/audio.js`, `js/view/*.js` dan `js/game.js` sebagai file pendukung (path sama). Kemampuan yang dibutuhkan: `room` (topik `state` dan `cmd` dibuka untuk level `interact`), `user`, dan `db` (koleksi `events` hanya bisa ditulis admin).
