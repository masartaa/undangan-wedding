# Website Undangan Pernikahan

Undangan dibuat dengan HTML, CSS, dan JavaScript tanpa framework atau build step. Halaman publik berada di `public/` dan ditujukan untuk Cloudflare Pages.

## Pratinjau lokal

Pastikan Node.js dan npm tersedia, lalu ikuti langkah penyiapan database D1 di bawah ini. Dari direktori proyek jalankan:

```bash
npx wrangler pages dev public
```

Buka URL yang ditampilkan Wrangler, biasanya `http://localhost:8788`.

## Mengatur detail undangan

Ubah `public/config/event.json` untuk memperbarui:

- Nama mempelai dan nama orang tua.
- Tanggal dan waktu mulai serta selesai. Sertakan offset WIB `+07:00`, contohnya `2027-01-03T09:00:00+07:00`.
- Zona waktu, nama dan alamat tempat acara, serta tautan Google Maps HTTPS.
- Teks sambutan dan metadata pratinjau WhatsApp.
- Tautan HTTPS musik latar. Nilai `null` menonaktifkan musik sampai tamu menekan tombol putar.

Nama tamu pada sampul bisa dikirim melalui tautan seperti `https://undangan-wedding.pages.dev/?to=Budi`. Nama ditampilkan sebagai teks, bukan sebagai HTML.

Ucapan dan doa tamu disimpan di Cloudflare D1. RSVP sengaja ditiadakan. Galeri masih berupa kerangka, dan dashboard admin belum termasuk fase ini.

## Database D1 dan ucapan

1. Login ke Cloudflare dan buat database D1:

   ```bash
   npx wrangler login
   npx wrangler d1 create undangan-wedding-dev
   ```

2. Salin ID database dari hasil perintah, lalu ganti `database_id = "change-me"` di `wrangler.toml` dengan ID tersebut. Jangan mengubah nama binding `DB`; Pages Functions menggunakan binding ini.

3. Terapkan migrasi D1 lokal untuk pratinjau:

   ```bash
   npx wrangler d1 migrations apply undangan-wedding-dev --local
   npx wrangler pages dev public
   ```

   Buka URL yang ditampilkan Wrangler, biasanya `http://localhost:8788`.

4. Terapkan migrasi pada database Cloudflare:

   ```bash
   npx wrangler d1 migrations apply undangan-wedding-dev --remote
   ```

5. Di pengaturan Cloudflare Pages, pastikan binding D1 bernama `DB` tersedia pada environment Production dan menunjuk ke database dengan ID yang sama. Binding `DB` diperlukan untuk membaca dan menyimpan ucapan.

API ucapan menerima nama maksimal 80 karakter dan pesan maksimal 300 karakter. Daftar menampilkan 10 ucapan terbaru per halaman. Pengiriman dibatasi 5 kali per alamat IP tiap 10 menit; IP di-hash sebelum disimpan sebagai kunci rate limit. Formulir menggunakan honeypot, dan ucapan tamu ditampilkan sebagai teks, bukan HTML.

## Deploy ke Cloudflare Pages

1. Pastikan Node.js sudah terpasang dan autentikasi ke Cloudflare jika belum:

   ```bash
   npx wrangler login
   ```

2. Buat proyek Pages bernama `undangan-wedding` melalui dashboard Cloudflare atau CLI satu kali:

   ```bash
   npx wrangler pages project create undangan-wedding
   ```

3. Dari direktori proyek, deploy folder halaman publik:

   ```bash
   npx wrangler pages deploy public --project-name=undangan-wedding
   ```

4. Buka URL `*.pages.dev` yang diberikan Cloudflare. Jika alamat proyek berbeda dari `undangan-wedding.pages.dev`, perbarui nilai `seo.url` dan `seo.image` di `public/config/event.json`, serta alamat absolut dalam tag Open Graph dan canonical di `public/index.html`, lalu deploy ulang. Perbarui juga teks placeholder pada gambar pratinjau `public/images/og-image.png` dan sumbernya `public/images/og-image.svg` saat nama mempelai sudah tersedia.

## Struktur halaman

```text
public/
├── config/event.json
├── images/
├── scripts/app.js
├── styles.css
├── index.html
└── robots.txt
functions/
└── api/
    ├── health.js
    └── wishes.js
migrations/
└── 001_init.sql
wrangler.toml
```

Halaman menggunakan `Asia/Jakarta` untuk tanggal dan hitung mundur. Acara kalender `.ics` dibuat di browser dalam waktu UTC yang sama, tanpa mengirim data tamu ke server.

Tag robots dan `robots.txt` meminta mesin pencari untuk tidak mengindeks undangan. Kebijakan tersebut tidak mencegah orang yang memiliki tautan untuk membukanya.
