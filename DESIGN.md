# Desain game Benteng Bersama

Semua aset digambar dengan kode (canvas 2D), dan semua suara dibuat dengan WebAudio. Tidak ada file gambar atau audio, jadi game tetap berupa satu file `index.html`.

## Level

Tiap level punya jalan, tema, bos, jumlah gelombang dan tingkat kesulitan sendiri. Level dipilih di menu. Setelah menang atau kalah, pemain bisa lanjut ke level berikutnya atau memilih level lain. Level yang sudah dimenangkan ditandai "Selesai" (disimpan di browser).

| # | Level | Gelombang | Bos | HP musuh | Emas awal | Karakter jalan |
|---|-------|-----------|-----|----------|-----------|----------------|
| 1 | Padang Hijau | 10 | Raja Lendir | ×1,00 | +0 | Panjang, banyak tikungan. Untuk belajar. |
| 2 | Gurun Pasir | 15 | Kalajengking | ×1,08 | +20 | Jalan ular paling panjang dengan kolom bangunan yang sempit. |
| 3 | Puncak Salju | 15 | Yeti | ×1,16 | +40 | Musuh masuk dari atas, dengan dua jalur lurus panjang yang sejajar. |
| 4 | Kawah Api | 20 | Naga Api | ×1,25 | +60 | Jalan terpendek, berbentuk huruf U. |

- Bos muncul tiap 5 gelombang. Gelombang terakhir membawa satu bos tambahan, dan banner-nya bertuliskan "GELOMBANG TERAKHIR".
- Hantu dan Perisai mulai muncul lebih awal di level yang lebih sulit.
- Menahan gelombang terakhir = menang ("BENTENG SELAMAT!" dengan kembang api).

## Latar (background)

Peta 20×12 petak digambar sekali per level ke canvas cadangan. Bagian yang bergerak digambar tiap frame.

| Tema | Tanah | Jalan | Rintangan (tidak bisa dibangun) | Cuaca/animasi |
|------|-------|-------|---------------------------------|---------------|
| Padang | Rumput hijau, rumput kecil, bunga | Tanah cokelat | Pohon, batu, semak berbuah | Kunang-kunang |
| Gurun | Pasir dengan riak bukit | Tanah padat gelap | Kaktus, batu pasir, tengkorak | Debu tertiup angin |
| Salju | Salju dengan gundukan dan kilau | Batu es biru-abu, tepi salju | Pinus bersalju, batu es, manusia salju | Salju turun |
| Kawah | Batu basal dengan retakan menyala | Batu hitam dengan pinggir lava | Menara obsidian, kolam lava, pohon mati | Bara naik, kolam lava berdenyut |

Rintangan hanya ditempatkan minimal 2 petak dari jalan, jadi petak bagus di dekat jalan tetap bisa dibangun. Pintu masuk berupa portal berputar yang warnanya mengikuti tema, dan jalan berakhir di benteng batu dengan gerbang dan bendera berkibar.

## Karakter (menara)

Tiap menara dijaga satu karakter kecil berwarna pemiliknya. Karakter ini berputar menghadap target dan terdorong mundur saat menembak.

| Menara | Karakter | Detail |
|--------|----------|--------|
| Panah | Pemanah bertudung | Busur panjang, tali ditarik, anak panah terpasang saat siap |
| Meriam | Meriam beroda + juru tembak berhelm | Laras mundur saat menembak, asap di moncong |
| Es | Penyihir es | Kristal melayang dan tiga serpihan yang mengorbit |
| Jitu | Penembak jitu berbaret | Senapan panjang dengan teropong berkilau |

Alas menara berubah tiap level: **Lv1** papan kayu, **Lv2** batu bata, **Lv3** benteng batu dengan paku emas dan cahaya berdenyut. Saat dibekukan Yeti, menara tertutup balok es. Saat dibakar Naga, menara menghitam dan berasap.

## Monster

| Monster | Bentuk | Gerak | Sifat |
|---------|--------|-------|-------|
| Lendir | Gumpalan hijau berkilau | Melompat, memipih dan memanjang, meneteskan lendir | Dasar |
| Kilat | Tawon kuning bergaris | Terbang dengan sayap mengepak dan bayangan jejak | Sangat cepat |
| Kura | Kura-kura bertempurung segi enam | Kaki melangkah bergantian, kepala bergoyang | HP tebal, bocor 2 nyawa |
| Hantu | Kain putih bergelombang | Melayang, transparansinya berkedip | **Kebal efek lambat** |
| Perisai | Goblin berhelm dengan perisai layang | Berjalan, jambul bergoyang, perisai menghadap arah jalan | **Zirah 6**: damage dikurangi 6 (minimal 30%), jadi Jitu dan Meriam lebih efektif |

## Bos

Bos punya bar HP besar di atas layar, auman saat muncul, dan aura.

| Bos | Level | Kemampuan |
|-----|-------|-----------|
| Raja Lendir | Padang | Tiap 4,5 detik memanggil 2 Lendir di belakangnya |
| Kalajengking | Gurun | Tiap 6,5 detik menggali ke pasir selama 2 detik: damage masuk ×0,25 dan bergerak ×1,5 |
| Yeti | Salju | Tiap 5,5 detik menghentak: menara dalam radius 2,3 petak membeku 2,2 detik |
| Naga Api | Kawah | Tiap 6,5 detik menyemburkan api (radius 1,9, menara mati 2 detik). Saat HP di bawah 50%: **mengamuk** sekali, pulih 15% HP, bergerak ×1,5 dan menyembur tiap 4,5 detik |

Kemampuan bos dihitung oleh host lalu dikirim ke semua pemain sebagai event, jadi semua pemain melihat dan mendengar efek yang sama.

## Animasi

- Monster: siklus jalan/terbang per jenis, mata mengikuti arah gerak, kilat putih saat terkena, lapisan es saat diperlambat, hancur dengan cara berbeda per jenis (lendir muncrat, tempurung pecah, hantu menguap, besi berpercikan).
- Menara: membal saat dibangun dan ditingkatkan, hentakan mundur, debu saat dijual.
- Proyektil: panah dengan jejak, peluru meriam melengkung dengan bayangan, bola es, sinar jitu.
- Layar: guncangan saat ledakan atau hentakan, vinyet merah saat nyawa berkurang, banner gelombang, bar HP bos, kembang api saat menang.
- Menu: peta level terpilih ditampilkan hidup dengan parade monster dan menara yang membidik. Daftar "Kenali musuh" juga bergerak.
- `prefers-reduced-motion` mematikan guncangan dan partikel cuaca.

## Efek suara dan musik

Semua suara disintesis dengan oscillator dan noise yang difilter. Tiap suara dibatasi jedanya, jadi banyak menara tidak membuat suara pecah.

| Kejadian | Suara |
|----------|-------|
| Panah / Meriam / Es / Jitu menembak | Desis tali / dentum rendah / denting naik / zap sinar |
| Kena sasaran | Tik / ledakan / kretak es / percik listrik |
| Monster mati | Lendir "splat", tawon dengung, tempurung retak, hantu merintih, besi berdenting + koin |
| Bangun / tingkatkan / jual | Ketukan kayu / arpeggio naik / koin turun |
| Gelombang mulai / selesai | Terompet / jingle pendek |
| Bos muncul / mati | Auman / ledakan + fanfare |
| Kemampuan bos | Gelembung panggilan, gemuruh pasir, hentakan berat, semburan api, auman amukan |
| Nyawa berkurang, menang, kalah | Dentum rendah, fanfare, melodi turun |

Musik latar adalah sequencer kecil per tema: pentatonik ceria (Padang), tangga nada timur (Gurun), lidian pelan seperti lonceng (Salju), minor cepat (Kawah). Saat gelombang berjalan, musik menambah hi-hat dan kick, lalu kick ganda saat bos ada. Tombol **Suara** dan **Musik** di kanan atas menyala/mematikan masing-masing, dan pilihannya diingat di browser.
