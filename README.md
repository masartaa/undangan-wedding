# Website Undangan Pernikahan (Vercel)

Project ini disiapkan untuk deployment di Vercel dengan struktur sederhana: halaman statis di `public/` dan API serverless di `api/`.

## 1. Persiapan awal

Pastikan Node.js sudah terpasang di mesin Anda:

```bash
node -v
npm -v
```

Install Vercel CLI:

```bash
npm install -g vercel
```

Login ke Vercel:

```bash
vercel login
```

## 2. Buat database PostgreSQL

Untuk Vercel, gunakan salah satu opsi berikut:

- Vercel Postgres
- Neon
- Supabase/Postgres eksternal

Contoh dengan Vercel Postgres:

1. Buka dashboard Vercel
2. Pilih project
3. Masuk ke Storage > Postgres
4. Buat database baru
5. Salin `DATABASE_URL`

## 3. Jalankan migrasi SQL

Setelah database siap, jalankan file migrasi:

```bash
psql "$DATABASE_URL" -f ./migrations/001_init.sql
```

Jika Anda memakai Neon atau Postgres lokal, gunakan command yang sesuai:

```bash
psql postgresql://user:password@host:5432/dbname -f ./migrations/001_init.sql
```

## 4. Preview lokal

Jalankan preview Vercel di local:

```bash
vercel dev
```

Lalu cek endpoint:

```bash
curl http://localhost:3000/api/health
```

Hasil yang diharapkan:

```json
{"ok":true}
```

## 5. Deploy ke Vercel

Deploy ke preview:

```bash
vercel
```

Deploy ke production:

```bash
vercel --prod
```

Setelah deploy, Vercel akan memberikan URL seperti:

```text
https://nama-project.vercel.app
```

## 6. Atur environment secret

Di dashboard Vercel, buka Project > Settings > Environment Variables, lalu tambahkan variabel berikut:

- `DATABASE_URL`
- `SESSION_SECRET`
- variabel tambahan nanti seperti `ADMIN_USERNAME`, `ADMIN_PASSWORD`

Pastikan semua secret tidak disimpan di repo.

## 7. Struktur proyek

```text
.
├── api/
│   └── health.js
├── migrations/
│   └── 001_init.sql
├── public/
│   └── index.html
├── README.md
├── vercel.json
├── .gitignore
└── package.json (opsional)
```

## 8. Catatan keamanan

- Jangan menaruh secret di dalam repository.
- Gunakan `DATABASE_URL` dan `SESSION_SECRET` via environment variables.
- Semua input dan output harus divalidasi dan di-escape saat fitur mulai ditambahkan.

## 9. Verifikasi fase 0

Setelah konfigurasi selesai, cek hal berikut:

1. `public/index.html` menampilkan teks "Undangan segera hadir".
2. `GET /api/health` mengembalikan `{"ok":true}`.
3. Migrasi SQL berhasil dijalankan di database PostgreSQL tanpa error.

Jika semua langkah di atas berhasil, fase 0 selesai dan siap dilanjutkan ke Fase 1.
