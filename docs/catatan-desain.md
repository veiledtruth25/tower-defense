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

## 2026-10-27: delapan karakter baru dan pasukan per bab

Terima kasih, enam musuh, kemampuan bos dan bot ujinya sudah saya tarik dan cek. Semuanya cocok dengan tampilan, dan `node tests/smoke.js` tetap lolos. Pemilik proyek minta supaya **makin lama bermain, musuhnya makin berganti**. Bagian tampilan sudah saya kerjakan. Susunan gelombangnya ada di `game.js`, jadi saya kirim usulannya di sini.

**Yang sudah dikerjakan di tampilan**
- **Delapan model baru**, lengkap dengan animasi, kematian dan suara: Goblin, Serigala, Tengkorak, Kelelawar, Mumi, Iblis, Anjing Api, Golem Lava (model `goblin`, `serigala`, `tengkorak`, `kelelawar`, `mumi`, `iblis`, `anjingapi`, `golemlava`). Selama belum ada di `EN`, semuanya tampil di galeri.
- **Menu**: deretan potret "Musuh di level N" di bawah `#lvInfo` (elemen baru `#lvFoes`). Musuh yang pertama kali muncul di level itu bertanda "Baru". Pertempuran mini di menu memakai musuh level yang dipilih.
- **"Kenali musuh"** diurutkan menurut level pertama munculnya, dengan label "Mulai level N".
- **Kartu "Musuh baru"** muncul saat pemain pertama kali bertemu suatu jenis.
- Semua di atas dihitung dari `waveList`/`levelWaves`, jadi tidak ada API baru.
- **Efek tembakan memantul** sekarang membaca `EN[t].res` (kurang dari 0,6 untuk Panah atau Jitu), jadi tidak lagi khusus Perisai.
- **Gaya panel bot uji** (`#botBox`, `#botSpeeds`, `#botLog`), `#ownerNote` dan `.lv.lock` sudah saya rapikan, sesuai permintaanmu.
- Perbaikan: urutan menu di ponsel (level dan tombol main di bawah pulau) sebelumnya tertimpa aturan CSS lain, dan sekarang sudah benar.

**Usulan untuk sesi logika: satu pasukan tiap 25 level**

| Bab | Level | Pasukan | Dasar | Cepat | Tebal | Selingan A (lv 8+) | Selingan B (lv 15+) |
|---|---|---|---|---|---|---|---|
| 1 | 1–25 | Makhluk Lembah | Lendir | Kilat | Kura | Hantu | Perisai |
| 2 | 26–50 | Pasukan Goblin | Goblin | Serigala | Perisai | Kura | Hantu |
| 3 | 51–75 | Pasukan Arwah | Tengkorak | Kelelawar | Mumi | Hantu | Goblin |
| 4 | 76–100 | Pasukan Api | Iblis | Anjing Api | Golem Lava | Kelelawar | Mumi |

Bab 1 sama persis dengan susunanmu sekarang, dan jadwal bos tetap seperti punyamu. Usulan ini sudah saya coba di salinan sementara. Hasilnya: level 26 diserang goblin dan serigala, level 51 oleh pasukan arwah, level 76 oleh pasukan api. Tampilan, kartu "Musuh baru" dan deretan musuh di menu berjalan tanpa error.

1. Tambahkan ke `EN` (indeks 10–17). Angka dan `res` silakan disesuaikan:
   ```js
   {n:"Goblin",hp:48,spd:1.35,rw:5,r:.26,col:"#6f9a4a",leak:1,model:"goblin",ds:"Goblin berpentungan, datang bergerombol"},
   {n:"Serigala",hp:30,spd:2.5,rw:5,r:.27,col:"#7d8794",leak:1,model:"serigala",ds:"Berlari sangat cepat dalam kawanan"},
   {n:"Tengkorak",hp:55,spd:1.25,rw:6,r:.26,col:"#e8e2cf",leak:1,model:"tengkorak",res:{3:.5},ds:"Prajurit tulang. Peluru Jitu menembus rongganya, hanya 50% kena"},
   {n:"Kelelawar",hp:26,spd:2.8,rw:5,r:.23,col:"#4a3a5e",leak:1,model:"kelelawar",res:{1:.4},ds:"Terbang zig-zag. Ledakan Meriam hanya 40% kena"},
   {n:"Mumi",hp:220,spd:.75,rw:14,r:.34,col:"#d9cfb0",leak:2,model:"mumi",ds:"Lambat dan sangat tahan pukulan"},
   {n:"Iblis",hp:60,spd:1.5,rw:6,r:.25,col:"#c8382c",leak:1,model:"iblis",res:{2:.5},ds:"Setan kecil bergarpu. Serangan Es hanya 50% kena"},
   {n:"Anjing Api",hp:36,spd:2.7,rw:6,r:.29,col:"#2e2628",leak:1,model:"anjingapi",ds:"Anjing neraka yang meninggalkan jejak bara"},
   {n:"Golem Lava",hp:260,spd:.7,rw:16,r:.37,col:"#3a302c",leak:2,model:"golemlava",res:{0:.3},ds:"Batu dan magma. Panah hanya 30% kena"}
   ```
2. Di `waveList`, peran tiap slot (dasar, cepat, tebal, selingan A, selingan B) diambil dari pasukan bab level itu:
   ```js
   // one army per 25 levels: [basic, fast, tank, extra A (from level 8), extra B (from level 15)]
   const ARMY=[[0,1,2,4,5],[10,11,5,2,4],[12,13,14,4,10],[15,16,17,13,14]];
   const armyOf=L=>ARMY[Math.min(3,Math.floor((L-1)/25))];
   // di dalam waveList, mengganti perulangan yang sekarang:
   const A=armyOf(L);
   for(let i=0;i<cnt;i++){let r=0;if(e>=3&&i%3===1)r=1;if(e>=5&&i%5===4)r=2;if(e>=12&&i%4===2)r=2;
     if(L>=8&&i%6===3)r=3;if(L>=15&&i%7===5)r=4;
     const t=A[r];list.push([t,(r===1?.45:EN[t].spd<1?1.1:.7)*g])}
   ```
3. Format jaringan tidak perlu diubah, karena indeks `EN` baru ditambahkan di belakang.

## 2026-10-27 (lanjutan): pasukan per bab sudah jalan di `game.js`

Pemilik proyek menggabungkan usulan di atas ke main, lalu meminta saya langsung mengerjakannya. Jadi kali ini saya yang mengubah `game.js`, dan hanya di tiga tempat:
- `EN` indeks 10–17 (Goblin sampai Golem Lava), ditambahkan di belakang.
- `ARMY` dan `armyOf` (baru), tepat di atas `waveList`.
- Perulangan di `waveList`: jenis tiap peran sekarang diambil dari pasukan bab level itu. Pola perannya sama persis dengan punyamu, jadi bab 1 tidak berubah sama sekali.

File itu tetap milikmu, jadi silakan setel ulang angkanya. Kalau susunan gelombang berubah, menu, "Kenali musuh" dan kartu "Musuh baru" ikut menyesuaikan sendiri. `node tests/smoke.js` lolos.

**Susunan akhir** (angka = HP dasar; kecepatan, hadiah, `leak` dan `res` sama seperti usulan)

| Bab | Level | Dasar | Cepat | Tebal | Selingan A (lv 8+) | Selingan B (lv 15+) |
|---|---|---|---|---|---|---|
| 1 | 1–25 | Lendir | Kilat | Kura | Hantu | Perisai |
| 2 | 26–50 | Goblin 45 | Serigala 28 | Kura | Hantu | Perisai |
| 3 | 51–75 | Tengkorak 48 | Kelelawar 26 | Mumi 190 | Hantu | Perisai |
| 4 | 76–100 | Iblis 52 | Anjing Api 32 | Golem Lava 200 | Tengkorak | Perisai |

**Bedanya dengan usulan, dan alasannya**

Usulan pertama hanya menjaga total HP. Waktu diuji dengan bot ujimu, ternyata itu tidak cukup.
- **Cara uji.** Bot memainkan level 26–100 dua kali: sekali dengan susunan lama (bab 1 diteruskan), sekali dengan pasukan baru. Ujinya di salinan sementara dengan jam dipercepat dan tanpa tampilan 3D, dan bot baru jalan setelah benar-benar menyala. Hasil tiap level deterministik.
- **Versi awal tidak seimbang.** Di versi awal, Perisai naik ke selingan A di bab 2 dan tidak ada di bab 3–4. Dibanding susunan lama, bot menang 16 vs 23 level di bab 2, 21 vs 14 di bab 3, dan 24 vs 14 di bab 4.
- **Penyebabnya Perisai.** Panah memantul darinya, dan dua menara pertama yang dibangun bot selalu Panah. Begitu Perisai lebih sering muncul, bab itu jadi berat. Begitu Perisai hilang, bab itu jadi ringan, walaupun total HP-nya naik.
- **Perbaikannya.** Perisai saya pertahankan sebagai selingan B di semua bab. Selingan A bab 4 diganti Tengkorak, dan HP Tengkorak dan Mumi diturunkan sampai hasil bot setara.

Hasil akhir bot (skor rata-rata: menang = 20 + sisa nyawa, kalah = bagian level yang sempat dilalui × 20):

| Bab | Susunan lama | Pasukan baru |
|---|---|---|
| 2 | menang 23 dari 25, skor 31,1 | menang 22 dari 25, skor 30,8 |
| 3 | menang 14 dari 25, skor 17,8 | menang 14 dari 25, skor 17,9 |
| 4 | menang 14 dari 25, skor 16,3 | menang 16 dari 25, skor 18,4 |

Hasil per level juga hampir sama: bot kalah di level yang sama, dan tidak ada lonjakan di level 26, 51 atau 76.

Sebagai pembanding, ini perubahan total HP musuh non-bos per bab 2/3/4 (tiap gelombang diberi bobot pengali HP-nya):
- HP mentah: +2%, +9%, +13%.
- HP efektif dengan bobot kerusakan Panah 30%, Meriam 35%, Es 5%, Jitu 30%: +2%, +11%, +27%.

Angka HP efektif bab 4 tinggi karena Golem Lava tahan Panah. Bot tetap menang sedikit lebih sering, kemungkinan karena Golem lambat dan karena Hantu, yang tahan Meriam, tidak ada di bab 4. Kalau menurutmu bab 4 terlalu berat untuk pemain yang mengandalkan Panah, HP Golem Lava bisa diturunkan.

**Catatan tentang bot uji.** Di level tinggi bot sering kalah di gelombang 2 dengan 3–4 menara, karena ia langsung memulai gelombang begitu emasnya tidak cukup untuk pilihan terbaiknya. Akibatnya hasil satu level bisa berbalik karena selisih HP 2%, jadi yang saya bandingkan jumlah per bab. Kalau bot mau dipakai untuk menilai keseimbangan, mungkin hasilnya lebih stabil kalau ia menunggu hitung mundur selesai. Ini hanya saran.

**Batas format jaringan.** Kode kematian `-1-t` dan kode bantuan `-20-k` dibaca lewat `int(f[0],-30,119)` di `onState`. Indeks `EN` sampai 18 masih aman. Jenis ke-20 (indeks 19) akan bentrok dengan bantuan pertama, jadi geser dulu kode bantuannya sebelum menambah musuh lagi.

**Perbaikan tampilan sekalian**
- Kartu "Musuh baru" yang belum sempat tampil dulu terbawa ke permainan berikutnya (misalnya kartu Kura muncul di level 76). Sekarang antrean dikosongkan saat level berganti atau keluar ke menu. Jenis musuh baru juga baru dianggap dikenal setelah kartunya benar-benar tampil.
- Di peta malam, satu bintang bisa tampil sebagai kotak putih besar saat kamera menukik di awal permainan. Bintang sekarang berukuran tetap di layar.
- `A.EXTRA` (model tanpa tipe `EN`, khusus galeri) sekarang kosong, karena kedelapan model sudah punya tipe.

## 2026-10-27 (lanjutan): banyak portal dan jalan bercabang, langkah 2 selesai

Rencanamu di `docs/rencana-banyak-jalan.md` sudah saya baca. Bagian tampilan (langkah 2) sudah selesai, jadi langkah 3 bisa jalan. Semua permintaanmu di catatan logika sudah dikerjakan:
1. **Jalan:** semua `geo.routes` digambar. `V.roadDist` (cekungan jalan, rumput, dekorasi) memeriksa SEG semua jalan. Lapisan jalan dicat bersamaan untuk semua jalan, jadi pertigaan dan pertemuan jalan menyatu rapi. Detail permukaan (papan, batu kerikil, garis putus-putus) digambar sekali saja di ruas yang dipakai bersama.
2. **Portal:** satu di tiap `geo.portals[p].WP0`, diputar menghadap arah jalannya (barat, utara, selatan). Portal selatan berdiri sedikit lebih jauh dan tanpa batu besar, supaya tidak menutupi baris bawah papan dari kamera. Kalau ada portal selatan, pulau diperlebar ke selatan (`V.Z1`).
3. **Musuh:** posisinya dari `posIn(g, d, e.r)`. Ini berlaku untuk arah hadap, tubuh naga, kebocoran (`PLEN` jalannya sendiri), target Hujan Meteor, sasaran cadangan semburan naga, dan lendir panggilan Raja Lendir. Kilatan muncul dan gelombang kejut bos keluar dari portal jalan musuh itu.
4. **Dekorasi:** di papan sudah memakai `geo.PATH`. Di tepi pulau, dekorasi menjauhi semua jalan dan semua portal.

Tambahan dari tampilan:
- **Portal aktif:** portal yang dipakai gelombang berjalan (`wavePortals`) berpusar terang, yang lain meredup. Selama hitung mundur, portal asal gelombang berikutnya memancarkan cincin berdenyut.
- **Teks gelombang:** `#waveTxt` sekarang boleh dua baris. Sebelumnya "dari Barat & Utara & Selatan" terpotong jadi "dari B…".
- **Kamera:** semua portal masuk bingkai, termasuk di ponsel tegak dan mendatar.
- **Pertempuran mini di menu:** monster bergantian memakai semua jalan, dan menaranya tersebar di semua jalan.
- Sudah diuji di `#peta5` sampai `#peta8` (desktop, ponsel tegak, ponsel mendatar), dan `node tests/smoke.js` lolos. Peta lama tampil sama seperti sebelumnya.

**Bug yang perlu kamu perbaiki di `game.js`** (sengaja tidak saya ubah karena kamu sedang mengerjakan langkah 3):
- `themedBoss` mengindeks tabel empat entri dengan `mapOf(L)`: `[L>=40?9:3,8,6,7][mapOf(L)]`. Di peta 4–7 hasilnya `undefined` untuk level 10 ke atas.
- Akibatnya `renderMeta` error saat level 10+ dipilih di `#peta5`–`#peta8`, karena `EN[undefined].n`. Info level di menu jadi tidak diperbarui.
- `bossType` juga mengembalikan `undefined`, jadi sim akan error saat bos gelombang ke-5 muncul.
- Usulan perbaikan: `[...][mapOf(L)%4]`, sesuai tema yang juga mengikuti `indeks % 4`. Atau beri peta 4–7 bos khasnya sendiri. Langkah 3 dengan bot di level 10+ pasti akan menemukan ini.
