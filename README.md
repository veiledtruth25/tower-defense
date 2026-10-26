# Benteng Bersama

Game tower defense co-op di browser untuk 1–4 pemain. Pemain membangun menara di rumput, meningkatkannya, dan menahan gelombang musuh yang berjalan ke benteng. Nyawa benteng dipakai bersama, tapi tiap pemain punya emas sendiri.

## Isi game

- **Menara:** Panah (cepat), Meriam (ledakan area), Es (memperlambat) dan Jitu (jarak jauh). Masing-masing bisa ditingkatkan sampai level 3.
- **Musuh:** Lendir, Kilat (cepat), Kura (tebal), dan boss Raja tiap 5 gelombang.
- **Level:** 100 level di 4 peta. Jumlah gelombang naik dari 5 sampai 29. Musuh makin kuat dan makin banyak, dan Raja selalu muncul di gelombang terakhir. Tamatkan level untuk 1–3 bintang (dari sisa nyawa) dan permata.
- **Bantuan:** Hujan Meteor, Badai Es, Kantong Emas, Tukang Benteng, Genderang Perang. Bisa dibeli dengan permata di Toko, atau didapat dari Tantangan, claim harian (siklus 7 hari), dan event.
- **Event:** Festival Akhir Pekan (Sabtu–Minggu, permata level 2×), Pesta Awal Bulan (tanggal 1–3), plus event yang ditulis pemilik artifact ke koleksi `events`.
- **Progres:** disimpan per akun lewat kemampuan `db` Artifact. Di luar claude.ai, progres disimpan di browser.
- **Kontrol:** tombol 1–4 pilih menara · Esc batal · U tingkatkan · S jual · Spasi mulai gelombang.

## Menjalankan

Buka `index.html` di browser untuk mode main sendiri.

Mode multiplayer memakai kemampuan `room` dari Claude Artifacts, jadi hanya berfungsi kalau halaman ini dibuka sebagai Artifact di claude.ai. Di luar itu (file lokal atau GitHub Pages), yang bisa dimainkan hanya mode main sendiri.
