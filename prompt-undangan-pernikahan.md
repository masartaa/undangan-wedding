# Paket Prompt Pengembangan Website Undangan Pernikahan

Turunan dari PRD Website Undangan Pernikahan. Dipakai untuk vibe coding per fase supaya tiap sesi muat dalam satu konteks.

## Cara pakai

1. Kerjakan **satu fase per sesi**. Jangan mencampur dua fase.
2. Awali setiap sesi dengan menempelkan **Konteks Proyek** (di bawah), lalu **prompt fasenya**.
3. Mulai Fase 1 dst. dengan menambahkan ringkasan 5-10 baris kondisi kode terakhir (struktur folder, apa yang sudah jalan).
4. Setelah fase selesai: uji sesuai bagian "Selesai jika", lalu **commit** sebelum lanjut.
5. Setelah **Fase 2** undangan sudah bisa dibagikan, walaupun dashboard belum jadi. Target bagikan paling lambat **12 Desember 2026**.

Catatan: pilihan stack (HTML/CSS/JS biasa tanpa framework di atas Cloudflare Pages) adalah usulan agar sederhana dan mudah dirawat. Ganti di Konteks Proyek jika Anda ingin framework lain.

---

## Konteks Proyek (tempel di awal setiap sesi)

```
Saya membangun website undangan pernikahan sendiri. Bantu saya per fase, jangan mengerjakan fase lain.

DATA ACARA
- Jenis acara: resepsi pernikahan (tanpa sesi akad di undangan)
- Tanggal dan waktu: 3 Januari 2027, 09.00-14.00 WIB (zona waktu Asia/Jakarta)
- Lokasi: Koffie Goen Tuntang
- Tautan Google Maps: https://maps.app.goo.gl/E8JC392ENFyyGNjJA
- Perkiraan tamu: 400 orang (tidak semua diundang online)
- Nama mempelai, nama orang tua, teks sambutan, foto: [ISI NANTI / pakai placeholder dulu]

STACK
- Cloudflare Pages (halaman statis) + Pages Functions (API di folder /functions) + D1 (database)
- Frontend: HTML, CSS, JavaScript biasa, tanpa framework dan tanpa build step
- Tautan gratis (*.pages.dev), tanpa domain sendiri

PRINSIP
- Mobile-first, ringan (target halaman awal < 2 MB, terbuka < 3 detik di 4G)
- Sederhana dan aman: validasi semua input, escape semua output (jangan pakai innerHTML untuk data tamu), rahasia lewat environment secret, bukan di kode
- Tema: putih dan emas, nuansa klasik dan formal, aksen emas tipis agar teks tetap terbaca. Warna lewat CSS variables supaya bisa diubah.
- Bahasa antarmuka: Indonesia
- JANGAN menambah fitur di luar PRD: tidak ada amplop digital/rekening, live streaming, QR check-in, multi-bahasa, atau multi-pengguna.

FASE SAAT INI: [Fase 0]
```

---

## Fase 0 - Fondasi

```
FASE 0 - FONDASI

Tugas:
1. Buat struktur proyek: public/ (halaman statis), functions/api/ (endpoint), migrations/ (SQL D1), wrangler.toml, README.md.
2. Rancang skema D1 dan tulis sebagai file migrasi SQL:
   - event_config: satu baris konfigurasi acara (JSON): tanggal-waktu, nama tempat, alamat, tautan Maps, tema, teks, foto, musik
   - rsvp: id, name, status (hadir/tidak), guests, created_at
   - wishes: id, name, message, hidden (0/1), created_at
   - admin: satu akun (username, password_hash, salt, created_at)
   - rate_limit: key, count, window_start (untuk pembatasan kiriman)
3. Buat endpoint GET /api/health yang mengembalikan {"ok": true}.
4. Buat halaman awal public/index.html bertuliskan "Undangan segera hadir".
5. Tulis README langkah demi langkah: login wrangler, membuat database D1, menjalankan migrasi (lokal dan produksi), deploy ke Cloudflare Pages, mengatur environment secret. Sertakan perintah persisnya.

Jangan membuat tampilan undangan atau fitur lain di fase ini.
```

**Selesai jika:** halaman "Undangan segera hadir" terbuka di tautan *.pages.dev, `/api/health` mengembalikan ok, dan migrasi berjalan tanpa error.

---

## Fase 1 - Halaman publik

```
FASE 1 - HALAMAN PUBLIK

Bangun halaman undangan lengkap di public/. Data acara dibaca dari satu berkas konfigurasi (public/config/event.json) agar nanti mudah dialihkan ke database di Fase 3.

Bagian halaman (satu halaman panjang, navigasi bawah: Home, Mempelai, Acara, Galeri, Ucapan):
1. Sampul: sapaan dengan nama tamu dari query ?to=Nama (tampilkan dengan textContent, wajib aman dari XSS; jika tidak ada ?to= tampilkan sapaan umum) dan tombol "Buka Undangan".
2. Profil mempelai dan orang tua (placeholder dulu).
3. Detail acara: resepsi 3 Januari 2027, 09.00-14.00 WIB, Koffie Goen Tuntang, tombol "Buka di Google Maps", tombol "Tambah ke Kalender" (buat file .ics di sisi klien).
4. Hitung mundur menuju 3 Januari 2027 pukul 09.00 WIB (gunakan offset +07:00).
5. Galeri foto: tampilkan kerangka dulu dengan lazy loading (isi di Fase 5).
6. Bagian Ucapan: kerangka saja (diisi di Fase 2).
7. Musik latar: tombol putar/jeda, mati secara default sampai tamu menekan tombol.

Teknis:
- Warna dan font lewat CSS variables (--warna-latar, --warna-utama, --warna-aksen, --warna-teks, --font-judul, --font-isi) karena nanti diatur dari dashboard.
- Tema putih-emas, serif untuk judul dan sans-serif untuk isi, mobile-first, mode terang/gelap mengikuti perangkat.
- Tag Open Graph dan Twitter Card (judul, deskripsi, gambar dengan URL absolut) agar pratinjau tautan di WhatsApp bagus.
- <meta name="robots" content="noindex, nofollow"> dan public/robots.txt yang melarang indeks.
- Teks alternatif pada foto, kontras teks memadai.

Jangan membuat RSVP, API, atau dashboard di fase ini.
```

**Selesai jika:** undangan lengkap tampil rapi di HP, `?to=Budi` menampilkan nama dengan aman, hitung mundur dan tombol Maps/kalender berfungsi, pratinjau WhatsApp muncul.

---

## Fase 2 - RSVP dan ucapan

```
FASE 2 - RSVP DAN UCAPAN

Tambahkan fitur untuk tamu mengirim konfirmasi kehadiran dan ucapan.

Frontend:
- Formulir RSVP: nama, status (hadir / tidak hadir), jumlah orang (1-5, hanya jika hadir).
- Formulir ucapan: nama dan pesan (maksimal 300 karakter).
- Daftar ucapan di halaman publik (hanya yang hidden = 0), terbaru di atas, dengan "muat lebih banyak".
- Pesan sukses/gagal yang jelas dalam bahasa Indonesia; nama tamu otomatis terisi dari ?to= bila ada.

Backend (Pages Functions + D1):
- POST /api/rsvp, POST /api/wishes, GET /api/wishes?page=N.
- Validasi sisi server: panjang, tipe, nilai yang diperbolehkan; tolak input kosong atau berlebihan.
- Perlindungan spam: field honeypot tersembunyi, pembatasan kiriman per IP (mis. 5 kiriman per 10 menit memakai tabel rate_limit), dan kembalikan 429 bila terlampaui.
- Escape semua output saat ditampilkan; jangan pernah memakai innerHTML untuk teks dari tamu.
- Jangan mengumpulkan email atau nomor telepon.

Jangan membuat dashboard di fase ini.
```

**Selesai jika:** tamu bisa mengirim RSVP dan ucapan, data masuk ke D1, ucapan tampil di halaman, kiriman beruntun ditolak, dan teks seperti `<script>alert(1)</script>` tampil sebagai teks biasa.

> Setelah fase ini undangan sudah layak dibagikan ke tamu online.

---

## Fase 3 - Dashboard inti (login, tanggal, tempat, waktu)

```
FASE 3 - DASHBOARD INTI

Bangun dashboard admin di /admin dengan satu akun, dan pindahkan konfigurasi acara dari event.json ke database.

Keamanan (prioritas utama):
- Hash kata sandi dengan PBKDF2 (Web Crypto) memakai salt acak dan iterasi tinggi; jangan simpan kata sandi polos.
- Skrip/instruksi satu kali untuk membuat akun admin dan mengatur kata sandi (jangan ada halaman registrasi publik).
- Sesi lewat cookie HttpOnly, Secure, SameSite=Strict, kedaluwarsa 8 jam; tanda tangan sesi dengan secret dari environment.
- Batasi percobaan login (mis. 5 gagal per 15 menit per IP).
- Lindungi semua endpoint /api/admin/* (wajib sesi valid) dan periksa header Origin pada permintaan yang mengubah data.
- Halaman /admin dan respons API admin tidak boleh di-cache; tambahkan noindex.

Fitur:
- Login dan logout.
- Formulir edit: tanggal, jam mulai dan selesai, nama tempat, alamat, tautan Google Maps. Validasi format, simpan ke tabel event_config.
- GET /api/config (publik, hanya data yang aman ditampilkan) dan halaman publik membaca konfigurasi dari sini, termasuk hitung mundur, tombol kalender, dan tautan Maps.
- Tombol "Lihat undangan" yang membuka halaman publik di tab baru.

Jangan membuat pengaturan tema/konten atau rekap RSVP di fase ini.
```

**Selesai jika:** login berhasil dan salah kata sandi ditolak, tanggal/tempat/waktu diubah di dashboard lalu halaman publik ikut berubah, `/api/admin/*` tanpa login mengembalikan 401.

---

## Fase 4 - Dashboard: tema dan konten

```
FASE 4 - TEMA DAN KONTEN DI DASHBOARD

Tambahkan pengaturan tampilan dan konten ke dashboard admin yang sudah ada. Semua disimpan di event_config dan dibaca halaman publik lewat GET /api/config.

Tema:
- Pilihan jenis tema (3 preset): Klasik (serif, ornamen garis tipis), Modern minimalis, Elegan (ornamen emas lebih kaya). Default: Klasik putih-emas.
- Pengaturan warna: warna latar, utama, aksen, teks (color picker). Validasi format hex dan beri peringatan jika kontras teks terhadap latar terlalu rendah.
- Pratinjau langsung di dashboard sebelum disimpan, dan tombol "Kembalikan ke default".
- Halaman publik menerapkan tema lewat CSS variables.

Konten:
- Edit teks: nama mempelai, nama orang tua, teks sambutan, kutipan/ayat, judul dan deskripsi pratinjau WhatsApp.
- Foto: unggah foto sampul, foto mempelai, dan foto galeri. Usulkan penyimpanan paling sederhana (mis. Cloudflare R2) dan jelaskan langkah aktivasinya; jika menyulitkan, sediakan opsi memasukkan URL gambar. Batasi ukuran dan tipe file, kompres ke WebP bila memungkinkan.
- Musik: unggah atau tautkan satu berkas musik latar dan pilihan aktif/nonaktif.
- Semua teks yang disimpan harus di-escape saat ditampilkan di halaman publik.

Jangan membuat rekap RSVP/ucapan di fase ini.
```

**Selesai jika:** mengganti jenis tema dan warna di dashboard langsung mengubah tampilan publik, teks dan foto berubah tanpa menyentuh kode, dan warna dengan kontras buruk memicu peringatan.

---

## Fase 5 - Rekap dan finalisasi

```
FASE 5 - REKAP DAN FINALISASI

Dashboard:
- Halaman RSVP: tabel daftar RSVP, ringkasan (jumlah hadir, tidak hadir, total orang), pencarian dan filter.
- Halaman ucapan: daftar ucapan, tombol sembunyikan/tampilkan dan hapus.
- Ekspor RSVP dan ucapan ke CSV (pastikan terbuka benar di Excel, UTF-8 dengan BOM).

Halaman publik:
- Selesaikan galeri foto: grid responsif, lazy loading, tampilan besar (lightbox) yang bisa ditutup dengan tombol dan geser.
- Optimasi performa: gambar WebP dengan ukuran sesuai layar, font tidak memblokir render, total halaman awal < 2 MB. Ukur dengan Lighthouse mobile dan perbaiki temuan utama.

Tinjauan akhir keamanan (laporkan hasilnya sebagai daftar periksa):
- Semua endpoint admin butuh sesi, semua input divalidasi, semua output di-escape.
- Tidak ada rahasia di repositori; semua lewat environment secret.
- Header keamanan dasar (Content-Security-Policy, X-Content-Type-Options, Referrer-Policy) lewat berkas _headers.
- Rate limit dan honeypot aktif; noindex terpasang.

Siapkan juga catatan "cara mengelola setelah acara": ekspor data, dan cara menonaktifkan formulir RSVP/ucapan setelah hari acara.
```

**Selesai jika:** rekap RSVP dan ekspor CSV benar, moderasi ucapan berfungsi, skor performa mobile memadai, daftar periksa keamanan lolos, lalu uji dengan 5-10 tamu sebelum dibagikan ke semua tamu online.

---

## Daftar data yang perlu Anda siapkan

| Data | Dipakai di |
| --- | --- |
| Nama lengkap mempelai dan orang tua | Fase 1 / Fase 4 |
| Teks sambutan dan kutipan/ayat | Fase 1 / Fase 4 |
| Foto sampul, mempelai, dan galeri | Fase 1 / Fase 4 / Fase 5 |
| Lagu latar (berkas atau tautan) | Fase 1 / Fase 4 |
| Daftar nama tamu untuk tautan `?to=Nama` | Saat penyebaran |
