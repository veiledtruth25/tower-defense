# Desain tampilan 3D Benteng Bersama

Semua grafis dibangun dengan kode di atas Three.js (r149): tidak ada model, tekstur atau audio dari file. Tampilannya low-poly dan berbayang datar. Papan 20×12 berdiri di atas **pulau melayang**, jadi batas area main selalu jelas dan suasana langit terlihat di sekelilingnya.

## Peta dan suasana

Tiap peta logika mendapat tema sendiri. Tiap 25 level, waktu berganti, jadi naik level juga terasa dari tampilannya.

| Peta (logika) | Tema | Jalan | Dekorasi | Penanda di belakang | Cuaca |
|---|---|---|---|---|---|
| Lembah Hijau | Padang | Tanah cokelat bergaris | Pohon bulat, semak berbuah, batu, bunga, jamur | Kincir angin berputar dan pagar | Serbuk sari (siang), kunang-kunang (malam) |
| Bukit Kembar | Salju | Salju padat dengan jejak kereta | Pinus bersalju, batu bertopi salju, kristal es, manusia salju | Dua bukit salju dan pondok berasap | Salju turun |
| Rawa Berliku | Rawa | Jembatan papan kayu | Pohon dedalu, tunggul, batang tumbang, alang-alang, jamur menyala | Rumah panggung | Kabut rendah, kunang-kunang, air beriak |
| Ular Raksasa | Gurun | Pasir padat berbatu | Kaktus, batu pasir berlapis, tulang | Tengkorak dan rusuk ular raksasa | Debu tertiup angin |

| Level | Suasana | Cahaya |
|---|---|---|
| 1–25 | Pagi | Matahari hangat, bayangan tegas, langit biru |
| 26–50 | Senja | Matahari rendah oranye, bayangan panjang |
| 51–75 | Malam | Cahaya bulan biru, bintang, obor dan portal berpendar |
| 76–100 | Gerhana | Langit merah gelap, bara beterbangan |

Detail yang membuat pulau terasa hidup:

- Rumput, daun dan alang-alang bergoyang tertiup angin.
- Bendera berkibar dan kincir angin berputar.
- Portal berpusar dengan rune yang berdenyut.
- Burung (kelelawar saat malam) terbang berputar di atas pulau.
- Membangun menara di petak berdekorasi menyingkirkan pohon atau batunya dengan semburan daun, dan dekorasi tumbuh kembali saat menara dijual.

## Kastel dan portal

- **Kastel** berdiri di ujung kanan papan: tembok berbenteng, dua menara gerbang beratap, menara utama berbendera, dan obor di gerbang.
- Saat nyawa berkurang, gerbang berkedip merah, puing berjatuhan, dan layar bergetar.
- Di bawah 12 nyawa, menara utama berasap. Di bawah 6 nyawa, tembok terbakar. Saat kalah, jeruji gerbang jatuh.
- **Portal** batu di ujung kiri: musuh muncul dengan kilatan sewarna tema, dan bos muncul dengan gelombang kejut.

## Menara dan penjaganya

Tiap menara dijaga karakter chibi yang bajunya berwarna pemiliknya. Penjaga terus membidik musuh terdepan dalam jangkauan (aturan yang sama dengan logika), berbalik dengan halus, dan terdorong mundur saat menembak.

| Menara | Penjaga | Ciri saat menembak |
|---|---|---|
| Panah | Pemanah bertudung | Anak panah terpasang di busur saat siap |
| Meriam | Meriam beroda dan juru tembak berhelm | Obor menyala, asap di moncong |
| Es | Penyihir bertopi runcing | Kristal melayang berdenyut, serpihan mengorbit |
| Jitu | Penembak berbaret | Lensa teropong berkilat |

Alas dan senjata ikut berubah tiap level:

- **Level 1**: panggung kayu dengan panji.
- **Level 2**: menara batu dengan spanduk.
- **Level 3**: benteng putih bersabuk emas dengan lambang menyala dan aura sewarna menaranya.

Senjata level 3 juga lebih mewah: busur emas, meriam laras ganda, dan senapan berhias emas.

Menara baru jatuh dari atas lalu memantul. Saat ditingkatkan, menara membesar sesaat dengan spiral emas. Saat dijual, menara tenggelam dengan debu dan koin. Selama Genderang Perang aktif, semua menara memerah dan bercincin merah.

## Monster dan bos

| Musuh | Model | Gerak |
|---|---|---|
| Lendir | Gumpalan hijau mengilap bermata besar | Melompat, memipih saat mendarat, berkedip |
| Kilat | Tawon bergaris dengan sengat | Terbang dengan sayap transparan mengepak, meninggalkan jejak cahaya |
| Kura | Kura-kura bertempurung faset | Empat kaki melangkah bergantian, kepala bergoyang |
| Raja (bos) | Raja merah bertanduk, mahkota emas bertatah permata, jubah ungu, tongkat | Jubah berayun, langkah berat; bar HP besar di atas layar dan aura merah di tanah |

- **Reaksi kena tembak**: monster menggembung dan berkedip putih, tepat saat proyektil mendarat.
- **Efek lambat**: monster berwarna es, animasinya melambat, dan serpihan salju berjatuhan.
- **Kematian tiap jenis berbeda**: lendir muncrat dan meninggalkan genangan, tawon pecah jadi percikan, tempurung kura hancur jadi kepingan, dan Raja meledak beruntun disertai hujan koin.

Monster melangkah sedikit ke kiri atau ke kanan jalur, jadi rombongan tidak terlihat bertumpuk.

## Proyektil dan efek

- **Panah** terbang melengkung dengan jejak.
- **Peluru meriam** terbang melengkung tinggi dengan asap. Ledakannya berupa bola api, cahaya yang menerangi sekitar, cincin kejut, puing, dan bekas hangus.
- **Bola es** berputar dengan percikan. Benturannya berupa semburan salju, cincin es, dan bekas beku.
- **Sinar Jitu** menyala lalu memudar.

Efek bantuan:

| Bantuan | Efek |
|---|---|
| Hujan Meteor | Batu berapi jatuh ke tiap musuh dengan ledakan besar |
| Badai Es | Layar membiru, cincin beku di tiap musuh, salju lebat |
| Kantong Emas | Hujan koin |
| Tukang Benteng | Kastel bercahaya hijau dengan kilau penyembuh |
| Genderang Perang | Layar memerah, cincin di semua menara |

Overlay di atas papan:

- Angka emas melayang.
- Banner gelombang ("GELOMBANG 3", "GELOMBANG TERAKHIR", peringatan Raja).
- Bar HP bos dengan jejak kerusakan.
- Judul besar "LEVEL n TAMAT!" (dengan kembang api) atau "BENTENG RUNTUH".

## Kamera dan kelancaran

- Kamera meluncur masuk ke papan saat permainan dimulai, lalu diam dengan goyangan halus. Kamera bergetar saat ada ledakan, bos muncul, atau benteng runtuh.
- Di menu, kamera mengitari pulau perlahan sementara pertempuran mini berlangsung di atasnya.
- Di layar tegak (ponsel), kamera melihat sisi panjang papan, jadi petak cukup besar untuk diketuk.
- Semua gerak memakai interpolasi yang tidak bergantung frame rate. Posisi monster dihaluskan di antara langkah simulasi (30 Hz) dan kiriman jaringan (8 Hz), jadi tetap mulus di layar 60–120 Hz.
- Bagian yang sama digambar sekaligus (instancing), jadi ratusan musuh dan menara cukup puluhan draw call. Beban JavaScript tampilan sekitar 1 ms per frame.
- Resolusi turun otomatis kalau frame melambat, dan pembaruan bayangan dijarangkan di perangkat lemah.
- Pengaturan "kurangi gerakan" mematikan goyangan kamera, getaran, burung dan cuaca.

## Suara

Semua suara dibuat dengan WebAudio. Suara diposisikan kiri-kanan sesuai letak kejadian di peta, dan tiap suara dibatasi jedanya supaya gelombang ramai tidak berisik.

- **Tembakan**: tiap menara punya bunyi sendiri.
- **Benturan**: tik, ledakan, kretak es, percik listrik.
- **Kematian**: berbeda per jenis musuh, ditambah koin.
- **Bangunan dan gelombang**: bangun, tingkatkan, jual, terompet gelombang, jingle selesai, auman bos, dentum saat benteng terkena, fanfare menang, melodi kalah.
- **Bantuan**: tiap bantuan punya bunyi sendiri.

Musik latar berbeda per tema peta. Musik lebih pelan saat malam, lebih gelap saat gerhana, dan makin ramai saat gelombang berjalan atau bos muncul.
