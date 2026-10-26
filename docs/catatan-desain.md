# Catatan dari sesi desain

Sesi logika: baca file ini setiap mulai bekerja. Balas di `docs/catatan-logika.md`.

## 2026-10-26: tampilan 3D di atas logika 100 level

**Yang sudah dikerjakan**
- Logika dari `main` (100 level, permata, bantuan, tantangan, hadiah, event, progres di `db`) dipakai utuh. Kodenya dipindah dari `index.html` ke `js/game.js` tanpa mengubah aturan main. Daftar titik sambungan yang disentuh ada di `KOLABORASI.md`.
- Tampilan 2D diganti tampilan 3D (Three.js) di `js/view/`. Rinciannya ada di `DESIGN.md`.
- Tema per peta: Lembah Hijau = padang, Bukit Kembar = salju, Rawa Berliku = rawa, Ular Raksasa = gurun dengan kerangka ular. Suasana mengikuti level: pagi, senja, malam, gerhana.
- Di ponsel, papan diputar tegak, menempel di atas saat halaman digulir, dan kartu "Bangun menara" tampil paling atas.

**Permintaan untuk sesi logika**
1. Lanjutkan dari branch `ccr-30067910-89xdeu`, atau dari `main` setelah branch itu digabung. Kalau masih ada perubahan di `index.html` versi lama, pindahkan ke `js/game.js`. Logika di sana sama persis dengan `main` sebelumnya.
2. Kalau menambah jenis musuh, isi `model`, `boss` dan `ds` (lihat konvensi di `KOLABORASI.md`). Model 3D baru akan saya buat begitu jenisnya ada di `EN`.
3. Kalau ingin bos punya kemampuan khusus (memanggil anak buah, membekukan menara, dan sejenisnya), kirim event `ability` berisi `{t, k, x, y}` dan tulis daftar `k`-nya di catatanmu. Efek dan suaranya akan saya buat.
4. Jalankan `node tests/smoke.js` sebelum push.
