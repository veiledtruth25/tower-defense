# Rencana: banyak portal dan jalan bercabang

Disetujui pemilik proyek pada 2026-10-27:
- **Jenis peta:** semua jenis.
- **Jumlah portal:** sampai 3, tergantung level.
- **Peta:** 8 peta, yaitu 4 peta lama ditambah 4 peta baru.

## Jenis peta

Benteng tetap satu. Semua jalan menyatu sebelum gerbang, jadi pemain tetap bisa membangun pertahanan bersama di dekat benteng.

| Jenis | Bentuk | Peta |
|---|---|---|
| A | 1 portal, 1 jalan | Lembah Hijau, Bukit Kembar, Rawa Berliku, Ular Raksasa (0–3) |
| B | 1 portal, jalan terbelah dua lalu menyatu lagi | Padang Bercabang (4) |
| C | 2 portal, jalannya bertemu sebelum benteng | Salju Dua Gerbang (5) |
| D | 2 portal, salah satunya bercabang | Rawa Simpang (6) |
| D3 | 3 portal | Gurun Tiga Gerbang (7) |

Tema tampilan mengikuti `indeks % 4`, jadi peta 4–7 otomatis mendapat tema padang, salju, rawa, gurun.

## Usulan jadwal (langkah 4)

| Level | Peta |
|---|---|
| 1–10 | A saja |
| 11–25 | A dan B bergantian |
| 26–50 | A, B, C |
| 51–75 | B, C, D, dengan sesekali A |
| 76–100 | C, D, dan D3 (3 portal) |

## Aturan main

- **Asal musuh per gelombang** (`wavePortals(n,L)`):
  - Gelombang 1 hanya dari portal pertama.
  - Setelah itu bergantian: satu portal, dua portal, lalu semua portal.
  - Portal yang bercabang membagi musuhnya bergantian ke tiap cabang.
- **Bos** keluar dari portal gelombang itu. Lendir yang dipanggil Raja Lendir muncul di jalan yang sama dengan bosnya.
- **Teks gelombang** menyebut sisi asalnya, misalnya "dari Barat & Utara". Info level di menu menyebut jumlah portal dan apakah jalannya bercabang.
- **Emas awal di peta B/C/D** naik sekitar 15%. Angkanya disetel lewat bot uji di langkah 4.
- **Bot uji** menghitung cakupan menara dari semua jalan.

## Kontrak untuk tampilan (sudah ada di `game.js` sejak langkah 1)

| Nama | Isi |
|---|---|
| `geo.routes[r]` | `{WPI, WP, SEG, PLEN, portal}` untuk tiap jalan. `geo.WPI/WP/SEG/PLEN` sama dengan jalan 0, jadi kode lama tetap jalan. |
| `geo.portals[p]` | `{key, WP0, side, routes}`: titik muncul (`WP0`), sisi (`"Barat"`, `"Utara"`, `"Selatan"`), dan jalan-jalan yang berangkat dari portal itu |
| `geo.PATH` | Semua petak jalan dari semua jalan |
| `geo.EXIT` | Baris gerbang. Sama untuk semua jalan. |
| `posIn(geo, d, r)` | Posisi setelah jarak `d` di jalan `r` (tanpa `r`: jalan 0) |
| `posE(e)` | Posisi musuh `e` di peta yang sedang dipakai |
| `S.E[i].r` | Indeks jalan musuh (0 kalau tidak ada) |
| `wavePortals(n, L)` | Indeks portal gelombang `n` di level `L` |
| `waveList(n, L)` | Isinya sekarang `[t, jeda, r]`. Elemen ketiga boleh diabaikan. |

Pratinjau untuk pemilik dan uji lokal: buka `index.html#peta5` sampai `#peta8` (atau `#peta1`–`#peta4`). Semua level lalu memakai peta itu. Hanya untuk main sendiri.

## Langkah

1. **Logika (selesai):** dukungan banyak jalan, 4 peta baru (belum masuk jadwal), field `r` ikut jaringan, teks portal, bot membaca semua jalan.
2. **Tampilan (sesi desain):** menggambar semua jalan dan portal dari `geo.routes`/`geo.portals`, menaruh musuh dengan `posIn(g, d, e.r)`, dan menjaga dekorasi agar tidak menutupi jalan mana pun.
3. **Logika:** menguji peta 4–7 dengan bot, lalu menyetel emas awal dan jarak antarmusuh.
4. **Logika:** menyalakan jadwal di atas untuk semua pemain, lalu menerbitkan. Langkah ini menunggu langkah 2 selesai.
