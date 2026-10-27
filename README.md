# Benteng Bersama

Game tower defense co-op 3D di browser untuk 1–4 pemain. Pemain membangun menara di tanah kosong, meningkatkannya, dan menahan gelombang musuh yang berjalan ke benteng. Nyawa benteng dipakai bersama, tapi tiap pemain punya emas sendiri.

## Isi game

- **Tampilan:** 3D low-poly di atas pulau melayang. Tiap peta punya tema sendiri (padang, salju, rawa, gurun), dan suasananya berganti tiap 25 level (pagi, senja, malam, gerhana). Saat bermain, game memenuhi layar dengan panel mengambang, di ponsel tegak maupun mendatar. Rinciannya ada di [DESIGN.md](DESIGN.md).
- **Menara:** Panah (cepat), Meriam (ledakan area), Es (memperlambat) dan Jitu (jarak jauh). Masing-masing bisa ditingkatkan sampai level 3, dan dijaga karakter berwarna pemiliknya.
- **Musuh:** berganti tiap 25 level.
  - Level 1–25: Lendir, Kilat (cepat), Kura (tebal), Hantu (mulai level 8, tahan ledakan Meriam) dan Perisai (mulai level 15, tahan Panah).
  - Level 26–50: pasukan goblin (Goblin, Serigala).
  - Level 51–75: pasukan arwah (Tengkorak, Kelelawar, Mumi).
  - Level 76–100: pasukan api (Iblis, Anjing Api, Golem Lava).
  - Perisai tetap ikut sebagai pengawal elite di semua bab.
  - Bos: Raja sampai level 9, lalu bos khas tiap peta. Yeti (Bukit Kembar) membekukan menara, Raja Lendir (Rawa Berliku) memanggil lendir, Kalajengking (Ular Raksasa) menyelam ke pasir, dan Naga Api (Lembah Hijau mulai level 40, ikut di gelombang terakhir mulai level 60) melumpuhkan menara dan mengamuk.
  - Menu menampilkan musuh tiap level, dan musuh yang baru pertama kali ditemui diperkenalkan dengan kartu saat bermain. Semua model bisa dilihat dari dekat di galeri (`index.html#galeri` atau tombol "Galeri 3D").
- **Level:** 100 level di 4 peta. Jumlah gelombang naik dari 5 sampai 29. Musuh makin kuat dan makin banyak, dan Raja selalu muncul di gelombang terakhir. Tamatkan level untuk 1–3 bintang (dari sisa nyawa) dan permata.
- **Bantuan:** Hujan Meteor, Badai Es, Kantong Emas, Tukang Benteng, Genderang Perang. Bisa dibeli dengan permata di Toko, atau didapat dari Tantangan, claim harian (siklus 7 hari), dan event.
- **Event:** Festival Akhir Pekan (Sabtu–Minggu, permata level 2×), Pesta Awal Bulan (tanggal 1–3), plus event yang ditulis pemilik artifact ke koleksi `events`.
- **Progres:** disimpan per akun lewat kemampuan `db` Artifact. Di luar claude.ai, progres disimpan di browser.
- **Suara:** efek dan musik dibuat dengan WebAudio. Matikan atau nyalakan lewat tombol Suara/Musik.
- **Bot uji (khusus pemilik artifact):** di menu permainan (☰), bot bisa dinyalakan untuk memainkan level secara otomatis dengan kecepatan sampai 8×, lanjut ke level berikutnya saat menang, dan mencatat hasilnya. Pemilik juga bisa membuka level yang belum terbuka. Run seperti ini tidak mengubah progres.
- **Kontrol:** tombol 1–4 pilih menara · Esc batal · U tingkatkan · S jual · Spasi mulai gelombang. Di ponsel, ketuk kartu menara, ketuk petak untuk melihat jangkauannya, lalu ketuk sekali lagi untuk membangun.

## Menjalankan

Buka `index.html` di browser untuk mode main sendiri. Tidak perlu server, karena semua skrip dimuat dari folder `js/` dan `vendor/`. Butuh browser yang mendukung WebGL.

Multiplayer butuh server room. Ada dua cara:
- **Server sendiri (VPS):** `server/server.js` menyajikan game dan menjadi room lewat WebSocket. Alamat yang sedang berjalan: https://towerdefense.evertwo.id. Lihat "Deploy di VPS" di bawah.
- **Artifact claude.ai:** memakai kemampuan `room` bawaan penampil.

Dari file lokal atau GitHub Pages, yang bisa dimainkan hanya mode main sendiri.

## Struktur kode

| File | Isi |
|---|---|
| `js/game.js` | Logika: data, simulasi, multiplayer, progres, panel menu |
| `js/view/` | Tampilan 3D: inti, model, dunia, aktor dan efek, kamera dan overlay, HUD layar penuh |
| `js/audio.js` | Efek suara dan musik |
| `js/bus.js` | Event yang menghubungkan logika dan tampilan |
| `vendor/three.min.js` | Three.js r149 (MIT, lisensinya di `vendor/THREE-LICENSE.txt`) |
| `tests/smoke.js` | Uji otomatis: `node tests/smoke.js` (butuh Playwright) |

Proyek ini dikerjakan dua sesi Claude: satu untuk logika, satu untuk desain. Aturan kerja samanya ada di [KOLABORASI.md](KOLABORASI.md).

## Deploy di VPS

Server: Node 24 dengan satu dependensi (`ws`), dibungkus Docker. Jalur masuknya sama seperti `candymatch`:
Cloudflare Tunnel (`*.evertwo.id`) → Nginx Proxy Manager (`evertwo-npm`, proxy host `towerdefense.evertwo.id`, WebSocket aktif) → container `towerdefense:3000` di jaringan `evertwo-network`.

```bash
cd tower-defense
cp .env.example .env          # isi ADMIN_KEY (lihat di bawah); .env tidak ikut git
docker compose up -d --build  # bangun dan jalankan; restart otomatis
curl localhost:7471/healthz    # cek lokal
```

Update: `git pull && docker compose up -d --build`. Game sedang berjalan di room akan terputus saat restart.

- **Alias `td-test`:** proxy host di NPM meneruskan ke `td-test:3000`. `docker-compose.yml` memberi alias itu ke container ini. Kalau Forward Hostname di NPM diganti menjadi `towerdefense`, alias boleh dihapus.
- **Kunci pemilik (bot uji):** `ADMIN_KEY` di `.env`. Buka `https://towerdefense.evertwo.id/#admin=KUNCI` sekali di browser; kunci disimpan di browser itu, dihapus dari alamat, dan diperiksa server. Tanpa kunci, panel bot dan level terkunci tidak muncul.
- **Progres pemain** disimpan di browser masing-masing (belum ada akun).
- **Keamanan dasar:** hanya `index.html`, `js/`, `vendor/` yang disajikan; room dibatasi ukuran pesan, jumlah, dan laju; percobaan kunci dibatasi 10 kali per 10 menit per alamat.

## Uji dua pemain

```bash
docker run -d --name towerdefense-test -p 127.0.0.1:7472:3000 -e ADMIN_KEY=kunci-uji towerdefense:latest
mkdir -p test-out && chmod 777 test-out
docker run --rm --network host -e NODE_PATH=/usr/src/app/node_modules -v "$PWD":/app:ro -v "$PWD/test-out":/out \
  zenika/alpine-chrome:with-puppeteer node /app/tests/multiplayer.js http://127.0.0.1:7472 /out
# argumen ke-4 "nopresence" meniru presence tamu yang hilang; tests/admin.js menguji pengaman bot
```

Chrome di server ini menggambar 3D lewat CPU, jadi memuat satu halaman butuh sekitar 25 detik.

