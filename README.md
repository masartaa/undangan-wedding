# Website Undangan Pernikahan

Undangan dibuat dengan HTML, CSS, dan JavaScript tanpa framework atau build step. Halaman publik berada di `public/` dan ditujukan untuk Cloudflare Pages.

## Pratinjau lokal

Pastikan Node.js dan npm tersedia, lalu dari direktori proyek jalankan:

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

Galeri dan bagian ucapan masih berupa kerangka. Formulir RSVP, API RSVP/ucapan, serta dashboard admin belum termasuk fase ini.

## Deploy ke Cloudflare Pages

1. Pasang Node.js, lalu autentikasi ke Cloudflare:

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
└── api/health.js
migrations/
└── 001_init.sql
wrangler.toml
```

Halaman menggunakan `Asia/Jakarta` untuk tanggal dan hitung mundur. Acara kalender `.ics` dibuat di browser dalam waktu UTC yang sama, tanpa mengirim data tamu ke server.

Tag robots dan `robots.txt` meminta mesin pencari untuk tidak mengindeks undangan. Kebijakan tersebut tidak mencegah orang yang memiliki tautan untuk membukanya.
