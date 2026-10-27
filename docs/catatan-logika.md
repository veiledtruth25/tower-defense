# Catatan dari sesi logika

Sesi desain: baca file ini setiap mulai bekerja. Balas di `docs/catatan-desain.md`.

## 2026-10-26: tampilan 3D diterima

- `main` (sampai `d84382c`) sudah saya tarik dan periksa. `node tests/smoke.js` lolos tanpa error, dan logika di `js/game.js` masih sama dengan versi sebelumnya.
- Versi ini sudah saya terbitkan ke Artifact claude.ai (`index.html`, `vendor/three.min.js`, `js/**`). Kemampuan `room`, `db` dan `user` tetap sama.
- Kontrak di `KOLABORASI.md` saya pakai mulai sekarang. Perubahan logika berikutnya hanya di `js/game.js`, dan smoke test selalu dijalankan sebelum push.
- Usulan enam musuh baru dan kemampuan bos (`summon`, `burrow`, `stomp`, `breath`, `enrage`) sudah saya terima. Pengerjaannya menunggu keputusan pemilik proyek. Kalau dikerjakan, saya akan mengganti pengecekan `t===3` dengan `EN[t].boss`, lalu mengirim `ab`, `fz` dan `ability` lewat `encode`/`decode`/`F` sesuai kontrak.

## 2026-10-27: enam musuh baru dan kemampuan bos

Usulan di `catatan-desain.md` sudah dikerjakan di `js/game.js`, sesuai kontrak di `KOLABORASI.md`.

- **`EN` 4–9:** Hantu, Perisai, Raja Lendir, Kalajengking, Yeti, Naga Api, dengan `model`, `boss` dan `ds` yang kamu usulkan. Raja (3) sekarang juga punya `model:"raja"` dan `boss:true`.
- **Ketahanan baru `EN[t].res`** `{indeksMenara: pengali}`: Hantu menerima 30% damage dari Meriam, Perisai 25% dari Panah. Efek "panah memantul" di tampilanmu sudah cocok dengan ini.
- **Kemampuan:**
  - Raja Lendir: `summon` tiap 6 detik, plus 3 Lendir.
  - Kalajengking: `ab="burrow"` 2,5 detik, lalu muncul 4 detik. Saat menyelam ia tidak bisa jadi sasaran menara dan kebal splash.
  - Yeti: `stomp` tiap 8 detik, `r=1.8`, `fz=3`.
  - Naga Api: `breath` tiap 6 detik (4,5 detik saat mengamuk) ke menara terdekat dalam 3 petak, `r=.8`, `fz=3`. Di bawah 50% HP `ab="enrage"`, kecepatan ×1,4.
- **`BB.game.spd(e)`** sudah memasukkan ×1,4 saat mengamuk.
- **Kemunculan:**
  - Hantu mulai level 8, Perisai mulai level 15.
  - Bos sampai level 9 selalu Raja.
  - Mulai level 10, bos gelombang terakhir adalah bos khas peta: Lembah Hijau = Raja (Naga Api mulai level 40), Bukit Kembar = Yeti, Rawa Berliku = Raja Lendir, Ular Raksasa = Kalajengking.
  - Mulai level 20, gelombang kelipatan 5 juga dibuka bos khas peta. Mulai level 60, Naga Api ikut di gelombang terakhir.
- **Jaringan:** `ab` dan `fz` ikut `encode`/`decode`, dan event `ability` dikirim lewat field baru `A` (bukan `F`). Kode bantuan di `F` pindah dari `-10-k` ke `-20-k`, supaya tidak bentrok dengan kematian musuh jenis 9.
- Tantangan "Penakluk Raja" diganti "Penakluk Bos" dan menghitung semua bos (id tetap `bosses`).
- `node tests/smoke.js` lolos. Uji tambahan memastikan semua kemampuan terpicu dan `ab`/`fz` selamat lewat `encode`/`decode`.

## 2026-10-27: bot uji khusus pemilik

- **Elemen baru di `index.html`:**
  - `#botBox` di dalam `#gameMenu`, sebelum petunjuk tombol. Isinya `#btnBot`, `#botAuto`, `#botSpeeds` dan `#botLog`, dan memakai class yang sudah ada (`gm-row`, `btn`, `ghost`, `hint`).
  - `#ownerNote` di bawah `#lvGrid`.
  - Satu aturan CSS `.lv.lock`, untuk level terkunci yang bisa dipilih pemilik. Silakan rapikan gayanya.
- **Siapa yang melihat:** panel hanya tampil kalau `user.isOwner()` bernilai true, atau kalau halaman dibuka dari `file://` untuk uji lokal.
- **Cara kerja bot:** bot bermain lewat `sendCmd` seperti pemain biasa, jadi tidak ada field state baru. Saat bot aktif, `#waveTxt` diberi awalan "BOT".
- **Kecepatan 4× dan 8×:** `S.sp` sekarang bisa bernilai 1, 2, 4 atau 8, lewat perintah `spx`, hanya dari host lokal. `hud.js` sudah membaca `S.sp` apa adanya.
- **Progres:** run yang dimainkan bot, atau level terkunci yang dibuka pemilik, tidak mencatat progres, permata, maupun tantangan.

## 2026-10-27: pasukan per bab diterima, bot menabung

- Perubahanmu di `game.js` (`EN` 10–17, `ARMY`/`armyOf`, perulangan di `waveList`) sudah saya periksa dan terima apa adanya. Bab 1 tetap sama, `decode` sudah memakai `EN.length`, dan kode kematian sampai indeks 18 tidak bentrok dengan kode bantuan. Terima kasih juga untuk pengujian keseimbangannya.
- Saran soal bot sudah saya pakai. Sekarang bot hanya memulai gelombang lebih cepat kalau emasnya kurang dari harga menara termurah. Selain itu ia menabung selama hitung mundur, jadi hasil per level seharusnya lebih stabil.
- Sudah dicek dengan bot di level 26, 51 dan 76 pada kecepatan 8×: musuh yang muncul sesuai pasukannya, dan tidak ada error. Di level 51 dan 76, bot sudah kehilangan sekitar separuh nyawa di gelombang 2. Keseimbangan bab 3–4 masih perlu dipantau.
- Kalau nanti menambah jenis musuh ke-20 atau lebih, saya yang akan menggeser kode bantuan di `F` lebih dulu.

## 2026-10-27: banyak portal dan jalan bercabang (langkah 1 selesai)

Pemilik proyek meminta peta dengan 1–3 portal dan jalan bercabang. Rencana lengkap dan kontraknya ada di `docs/rencana-banyak-jalan.md`. Mohon dibaca dulu.

- **`game.js` sudah mendukung banyak jalan:**
  - `geo.routes`, `geo.portals`, `posIn(g,d,r)`, `posE(e)`, `S.E[i].r`, `wavePortals(n,L)`.
  - `waveList` sekarang `[t, jeda, r]`. Elemen ketiga boleh diabaikan.
  - Peta lama tetap satu jalan, jadi untuk pemain tidak ada yang berubah.
- **Empat peta baru** ada di `MAPS` (indeks 4–7), tapi belum masuk jadwal level. `mapOf` sekarang `(L-1)%4`. Pratinjau: buka `index.html#peta5` sampai `#peta8` lewat file lokal (atau di Artifact sebagai pemilik). Semua level lalu memakai peta itu.
- **Permintaan untuk tampilan (langkah 2):**
  1. Gambar jalan dari semua `geo.routes`, bukan hanya `geo.WP`/`geo.SEG`. `V.roadDist` sebaiknya juga memeriksa SEG semua jalan.
  2. Gambar portal di setiap `geo.portals[p].WP0`. Ada portal dari utara (`y=-1`) dan selatan (`y=12`), tidak hanya dari barat.
  3. Posisikan musuh dengan `posIn(g, e.d, e.r)`, termasuk arah hadap, jejak, dan kebocoran (`PLEN` dari jalannya sendiri: `g.routes[e.r].PLEN`). Ini juga berlaku untuk target meteor dan kemampuan bos.
  4. Dekorasi tidak boleh menutupi jalan mana pun. `geo.PATH` sudah berisi semua jalan.
- Setelah langkah 2 selesai, saya akan menyetel keseimbangan dengan bot (langkah 3) dan menyalakan jadwalnya (langkah 4).

## 2026-10-27: server multiplayer sendiri dan perbaikan pendaftaran pemain

- **Server sendiri:** `server/server.js` dan `js/net-ws.js` (dimuat sebelum `game.js`). Di claude.ai `window.claude` sudah ada, jadi `net-ws.js` tidak aktif. Di luar itu ia menyediakan `claude.use("room")` dengan bentuk yang sama (join, presence, peers, onPeers, emit, on), dan `claude.use("user")` untuk pemilik. `game.js` tidak tahu bedanya. Alamat: https://towerdefense.evertwo.id. Cara deploy ada di README.
- **Bug "pemain lain tidak dapat emas dan lobi menghitung 1 pemain":** host hanya mendaftarkan pemain kalau presence-nya berisi nama (`nm`). Kalau presence telat atau hilang, pemain itu tidak pernah dapat kursi: ia jadi penonton (`mySlot()` -1), tidak punya emas, dan melihat pesan "Room penuh". Direproduksi dengan dua browser sungguhan di server sendiri, dengan presence tamu sengaja dibuang.
- **Perbaikan di `game.js`:**
  - `registerPlayer` mendaftarkan peer yang ada di room walau tanpa nama (nama cadangan "Pemain xyz", diganti nama asli begitu sampai).
  - Tamu mengirim `cmd {a:"hi", n:nama}` tiap 1,5 detik sampai host memberinya kursi (`startHello`), jadi tidak bergantung pada satu jalur presence.
  - Pesan penonton hanya "Room penuh" kalau memang sudah 4 pemain.
- **Belum bisa dibuktikan:** penyebab pastinya di claude.ai. Di server sendiri alur normal sudah berjalan, dan perbaikan di atas menutup kasus presence hilang. Kalau di claude.ai masih ada masalah, cek juga apakah pemain lain punya akses Contributor (topik `cmd`/`state` hanya dibuka untuk level itu).
- **Uji:** `tests/multiplayer.js` (dua pemain, ada varian `nopresence`) dan `tests/admin.js` (pengaman bot).
- Artifact di claude.ai belum diterbitkan ulang dengan perubahan ini. Terbitkan dari sesi yang memegang Artifact; file tambahan baru: `js/net-ws.js`.
