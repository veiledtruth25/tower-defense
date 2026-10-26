# Benteng Bersama

Game tower defense co-op 3D di browser untuk 1–4 pemain. Pemain membangun menara di tanah kosong, meningkatkannya, dan menahan gelombang musuh yang berjalan ke benteng. Nyawa benteng dipakai bersama, tapi tiap pemain punya emas sendiri.

## Isi game

- **Tampilan:** 3D low-poly di atas pulau melayang. Tiap peta punya tema sendiri (padang, salju, rawa, gurun), dan suasananya berganti tiap 25 level (pagi, senja, malam, gerhana). Saat bermain, game memenuhi layar dengan panel mengambang, di ponsel tegak maupun mendatar. Rinciannya ada di [DESIGN.md](DESIGN.md).
- **Menara:** Panah (cepat), Meriam (ledakan area), Es (memperlambat) dan Jitu (jarak jauh). Masing-masing bisa ditingkatkan sampai level 3, dan dijaga karakter berwarna pemiliknya.
- **Musuh:** Lendir, Kilat (cepat), Kura (tebal), dan bos Raja tiap 5 gelombang. Model 3D untuk Hantu, Perisai, dan bos Raja Lendir, Kalajengking, Yeti dan Naga Api sudah siap, dan bisa dilihat di galeri (`index.html#galeri` atau tombol "Galeri 3D" di menu) sampai ditambahkan ke logika.
- **Level:** 100 level di 4 peta. Jumlah gelombang naik dari 5 sampai 29. Musuh makin kuat dan makin banyak, dan Raja selalu muncul di gelombang terakhir. Tamatkan level untuk 1–3 bintang (dari sisa nyawa) dan permata.
- **Bantuan:** Hujan Meteor, Badai Es, Kantong Emas, Tukang Benteng, Genderang Perang. Bisa dibeli dengan permata di Toko, atau didapat dari Tantangan, claim harian (siklus 7 hari), dan event.
- **Event:** Festival Akhir Pekan (Sabtu–Minggu, permata level 2×), Pesta Awal Bulan (tanggal 1–3), plus event yang ditulis pemilik artifact ke koleksi `events`.
- **Progres:** disimpan per akun lewat kemampuan `db` Artifact. Di luar claude.ai, progres disimpan di browser.
- **Suara:** efek dan musik dibuat dengan WebAudio. Matikan atau nyalakan lewat tombol Suara/Musik.
- **Kontrol:** tombol 1–4 pilih menara · Esc batal · U tingkatkan · S jual · Spasi mulai gelombang. Di ponsel, ketuk kartu menara, ketuk petak untuk melihat jangkauannya, lalu ketuk sekali lagi untuk membangun.

## Menjalankan

Buka `index.html` di browser untuk mode main sendiri. Tidak perlu server, karena semua skrip dimuat dari folder `js/` dan `vendor/`. Butuh browser yang mendukung WebGL.

Mode multiplayer memakai kemampuan `room` dari Claude Artifacts, jadi hanya berfungsi kalau halaman ini dibuka sebagai Artifact di claude.ai. Di luar itu (file lokal atau GitHub Pages), yang bisa dimainkan hanya mode main sendiri.

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
