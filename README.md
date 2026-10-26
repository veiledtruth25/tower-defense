# Benteng Bersama

Game tower defense co-op di browser untuk 1–4 pemain. Pemain membangun menara di tanah kosong, meningkatkannya, dan menahan gelombang musuh yang berjalan ke benteng. Nyawa benteng dipakai bersama, tapi tiap pemain punya emas sendiri.

## Isi game

- **Level:** Padang Hijau, Gurun Pasir, Puncak Salju dan Kawah Api. Masing-masing punya jalan, latar, rintangan, cuaca dan musik sendiri. Tahan semua gelombang untuk menang.
- **Menara:** Panah (cepat), Meriam (ledakan area), Es (memperlambat) dan Jitu (jarak jauh, tembus zirah). Tiap menara dijaga karakter berwarna pemiliknya, dan bisa ditingkatkan sampai level 3.
- **Musuh:** Lendir, Kilat (tawon cepat), Kura (tebal), Hantu (kebal es) dan Perisai (berzirah).
- **Bos:** Raja Lendir (memanggil lendir), Kalajengking (menggali), Yeti (membekukan menara) dan Naga Api (membakar menara, mengamuk).
- **Suara:** efek suara dan musik dibuat dengan WebAudio, dan bisa dimatikan lewat tombol Suara/Musik.
- **Kontrol:** tombol 1–4 pilih menara · Esc batal · U tingkatkan · S jual · Spasi mulai gelombang.

Rincian desainnya ada di [DESIGN.md](DESIGN.md).

## Menjalankan

Buka `index.html` di browser untuk mode main sendiri.

Mode multiplayer memakai kemampuan `room` dari Claude Artifacts, jadi hanya berfungsi kalau halaman ini dibuka sebagai Artifact di claude.ai. Di luar itu (file lokal atau GitHub Pages), yang bisa dimainkan hanya mode main sendiri.
