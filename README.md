# Website Undangan Pernikahan

Undangan dibuat dengan HTML, CSS, dan JavaScript tanpa framework atau build step. Halaman publik dan dashboard berada di `public/`, API berjalan sebagai Vercel Functions di `api/`, dan konfigurasi acara serta ucapan disimpan di Supabase.

## Menyiapkan Supabase

1. Buat proyek di [Supabase](https://supabase.com/).
2. Buka **SQL Editor**, lalu jalankan isi file migrasi dalam urutan nama: `20261112000000_initial_schema.sql`, kemudian `20261112100000_rate_limit_rpc.sql`. Jika skema awal sudah pernah dijalankan, jalankan migrasi kedua untuk menambahkan RPC rate limit yang dipakai Fase 3.
3. Dari **Project Settings > API Keys**, gunakan Project URL dan Secret API key untuk server. Jangan gunakan Publishable API key untuk endpoint admin, dan jangan pernah menaruh Secret API key di frontend atau repositori.

### Menghubungkan Supabase CLI (opsional)

`supabase/config.toml` sudah dibuat untuk proyek ini. Untuk menghubungkan CLI ke proyek hosted:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
```

`supabase login` memerlukan Personal Access Token dari pengaturan akun Supabase. Secret API key proyek bukan token CLI dan tidak dapat menggantikannya. Perintah `link` hanya menghubungkan konfigurasi lokal; migrasi SQL tetap perlu dijalankan sesuai langkah di atas.

## Menyiapkan akun admin

Buat secret sesi yang acak (minimal 32 byte):

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Atur `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, dan `APP_ORIGIN` sebagai environment variables. Gunakan Secret API key Supabase hanya di server. Untuk lokal, `APP_ORIGIN` biasanya `http://localhost:3000`. Setelah menghubungkan proyek dengan Vercel dan mengatur environment Development, ambil nilainya:

```bash
npx vercel link
npx vercel env pull .env.local
```

Jalankan skrip satu kali untuk membuat akun admin. Username ditampilkan saat diketik, sedangkan kata sandi diminta tanpa ditampilkan dan tidak ditulis ke file:

```bash
node --env-file=.env.local scripts/create-admin.mjs
```

Skrip dapat dijalankan kembali untuk mengganti username atau kata sandi akun tunggal tersebut. Jangan membuat halaman registrasi publik.

## Menjalankan lokal

```bash
npx vercel dev
```

Buka URL yang ditampilkan Vercel CLI. Berkas `.env.local` sudah diabaikan Git.

## Dashboard inti

Buka `/admin`, lalu masuk menggunakan akun yang dibuat sebelumnya. Dashboard mengubah tanggal, jam, tempat, alamat, dan tautan Maps. Perubahan disimpan ke `event_config` di Supabase dan halaman publik membacanya melalui `GET /api/config`.

Konfigurasi acara awal yang digunakan untuk mengisi database ada pada migrasi Supabase. `public/config/event.json` tidak lagi digunakan atau dipublikasikan.

## Data undangan

- Tanggal dan waktu disimpan dengan offset WIB `+07:00`; zona waktu acara `Asia/Jakarta`.
- Ucapan dan doa disimpan di Supabase. RSVP sengaja ditiadakan.
- Musik, galeri, nama mempelai, dan teks sambutan tetap memakai nilai awal dalam konfigurasi database sampai pengaturan terkait dikerjakan pada fase berikutnya.
- Nama tamu pada sampul bisa dikirim melalui tautan seperti `https://undangan-wedding.vercel.app/?to=Budi`. Nama ditampilkan sebagai teks, bukan sebagai HTML.

## API dan keamanan

- `GET /api/config` hanya mengembalikan kolom konfigurasi publik yang diizinkan.
- `api/admin/login.js`, `logout.js`, `session.js`, dan `config.js` menangani sesi dan konfigurasi dashboard.
- Kata sandi admin di-hash dengan PBKDF2-HMAC-SHA256 (600.000 iterasi) dan salt acak; sesi berupa cookie bertanda tangan HMAC, `HttpOnly`, `Secure`, `SameSite=Strict`, dan berumur 8 jam.
- Percobaan login dibatasi 5 kali per 15 menit per alamat IP; IP mentah tidak disimpan.
- Permintaan yang mengubah data memeriksa `Origin`. Atur `APP_ORIGIN` ke origin Vercel untuk Production dan Preview; saat pengujian preview, origin deployment juga diverifikasi melalui `VERCEL_URL`.
- `SUPABASE_SECRET_KEY` hanya digunakan oleh server. RLS aktif dan akses tabel dibatasi ke role server.
- Halaman dan endpoint admin memakai `no-store` dan `noindex`.

## Deploy ke Vercel

1. Impor repositori di Vercel, atau tautkan dari direktori proyek:

   ```bash
   npx vercel link
   ```

2. Tambahkan `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, dan `SESSION_SECRET` di **Project Settings > Environment Variables**. Atur `APP_ORIGIN` sesuai domain Vercel. Terapkan nilainya ke environment yang digunakan.
3. Deploy:

   ```bash
   npx vercel --prod
   ```

4. Sesuaikan URL di metadata Open Graph, canonical, konfigurasi `seo` pada tabel `event_config`, dan UID kalender dengan domain Vercel sebenarnya. Perbarui juga teks placeholder pada gambar pratinjau `public/images/og-image.png` dan sumbernya `public/images/og-image.svg` saat nama mempelai sudah tersedia.

## Struktur halaman

```text
api/
├── admin/
│   ├── config.js
│   ├── login.js
│   ├── logout.js
│   └── session.js
├── config.js
├── health.js
└── wishes.js
lib/
├── admin-auth.js
└── supabase.js
public/
├── admin/
│   ├── admin.css
│   ├── admin.js
│   └── index.html
├── images/
├── scripts/app.js
├── styles.css
├── index.html
└── robots.txt
scripts/
└── create-admin.mjs
supabase/
└── migrations/
    ├── 20261112000000_initial_schema.sql
    └── 20261112100000_rate_limit_rpc.sql
vercel.json
```

Halaman menggunakan `Asia/Jakarta` untuk tanggal dan hitung mundur. Acara kalender `.ics` dibuat di browser dalam waktu UTC yang sama, tanpa mengirim data tamu ke server.

Tag robots dan `robots.txt` meminta mesin pencari untuk tidak mengindeks undangan. Kebijakan tersebut tidak mencegah orang yang memiliki tautan untuk membukanya.
