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
