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

## 2026-10-26 (lanjutan): layar penuh, enam model baru, kemampuan bos

**Yang sudah dikerjakan**
- **Layar permainan sekarang layar penuh**, seperti game ponsel. Kanvas 3D mengisi layar, dan HUD mengambang di atasnya. Semua ID yang dipakai `game.js` tetap sama, dan `game.js` tidak diubah. Hanya letaknya yang pindah, dan daftarnya ada di bagian "Layar permainan (HUD)" di `KOLABORASI.md`. `#stats` dan `#btnLeave` tidak lagi ada di header halaman, jadi kalau kamu punya perubahan di header versi lama, pindahkan ke `#hudTop` atau ke menu permainan.
- Di layar sentuh, ketukan pertama di petak kosong hanya menampilkan pratinjau, dan ketukan kedua membangun. Ini diatur `js/view/hud.js` dengan menahan `pointerdown` pertama, jadi `game.js` tidak perlu berubah. Kalau kamu ingin aturan ini pindah ke logika, kabari di catatanmu.
- `index.html` sekarang punya meta viewport sendiri, sama dengan yang ditambahkan Artifact, supaya uji lokal di ponsel sama dengan versi terbit.
- **Model 3D baru**: Hantu, Perisai, dan bos Raja Lendir, Kalajengking, Yeti, Naga Api, lengkap dengan animasi jalan, reaksi kena tembak, kematian dan suara. Selama belum ada di `EN`, semuanya tampil di galeri (`#galeri` atau tombol "Galeri 3D").
- Tampilan sekarang mendengar event `ability` dan membaca field opsional `S.E[i].ab` dan `S.T[i].fz`. Kontraknya ada di `KOLABORASI.md`.

**Permintaan untuk sesi logika**
1. Kalau ingin memakai musuh baru, ini usulan baris `EN` (angkanya bebas kamu ubah, `model` dan `boss` yang penting untuk tampilan):
   ```js
   {n:"Hantu",hp:55,spd:1.5,rw:6,r:.27,col:"#c6bff6",leak:1,model:"hantu",ds:"Melayang tembus pandang di atas jalan"},
   {n:"Perisai",hp:160,spd:.95,rw:10,r:.3,col:"#9aa6bd",leak:1,model:"perisai",ds:"Goblin berzirah, panah memantul di perisainya"},
   {n:"Raja Lendir",hp:900,spd:.6,rw:80,r:.45,col:"#8fd16a",leak:5,model:"rajalendir",boss:true,ds:"Bos: memuntahkan lendir kecil"},
   {n:"Kalajengking",hp:1200,spd:.75,rw:100,r:.45,col:"#c97b35",leak:5,model:"kalajengking",boss:true,ds:"Bos: menyelam ke pasir dan lolos dari tembakan"},
   {n:"Yeti",hp:1500,spd:.5,rw:110,r:.45,col:"#eef3f8",leak:5,model:"yeti",boss:true,ds:"Bos: hentakannya membekukan menara"},
   {n:"Naga Api",hp:2000,spd:.62,rw:140,r:.45,col:"#d84a30",leak:6,model:"naga",boss:true,ds:"Bos: semburan apinya menghanguskan menara"}
   ```
   Beberapa tempat di `game.js` masih menganggap bos adalah jenis 3: `waveList` (menambah `[3,2.5]`), `fxDeath` (hitungan bos di profil), dan Hujan Meteor (`e.t===3`). Kalau bos lain ditambahkan, tempat-tempat itu sebaiknya memakai `EN[t].boss`. Tampilan sudah memakai `boss` di semua tempat.
2. Usulan kemampuan bos, dengan efek yang sudah siap di tampilan:
   - **Raja Lendir**: tiap sekitar 6 detik kirim `ability` `{t,k:"summon",x,y,id}`, lalu tambahkan 3 Lendir di sekitar `d`-nya. Lendir yang muncul di tengah jalan diberi efek percikan.
   - **Kalajengking**: bergantian isi `e.ab="burrow"` sekitar 2,5 detik (tidak bisa ditembak), lalu kosongkan lagi sekitar 4 detik.
   - **Yeti**: tiap sekitar 8 detik kirim `{t,k:"stomp",x,y,id,r:1.8}`, lalu isi `tw.fz=3` untuk menara dalam jarak `r`. Menara dengan `fz>0` tidak menembak.
   - **Naga Api**: tiap sekitar 6 detik kirim `{t,k:"breath",x,y,id,tx,ty,r:.8}` ke menara terdekat dalam 3 petak, lalu isi `fz=3` untuk menara itu. Di bawah 50% HP, isi `e.ab="enrage"` (misalnya sambil menambah kecepatan).
   Di multiplayer, sertakan `ab` dan `fz` di `encode`/`decode`, dan kirim `ability` lewat event `F` seperti `shot`.
3. Jalankan `node tests/smoke.js` sebelum push.
