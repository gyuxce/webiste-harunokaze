# Project Status

Tanggal audit: 2026-07-28

> **Catatan (2026-09-29):** dokumen ini adalah snapshot Juli 2026 dan sudah basi di
> beberapa bagian — paling penting, pembayaran sudah pindah dari **Midtrans ke Pivot
> Payment** sejak migration `20260730000000_pivot_payment.sql`. Untuk setup dan status
> yang akurat sekarang, pakai [`portal/README.md`](portal/README.md). Bagian di bawah
> ini dibiarkan apa adanya sebagai catatan sejarah, bukan instruksi yang masih berlaku.

## Keputusan Database

Pakai Supabase untuk fase ini.

Alasannya: portal sudah memakai Supabase Auth, RLS, RPC, `auth.uid()`, dan Edge Functions untuk Midtrans. Neon hanya mengganti Postgres, sehingga pindah ke Neon akan membutuhkan backend auth dan API baru. Migrasi ke Neon baru masuk akal kalau project diubah ke arsitektur backend sendiri dengan Prisma/Drizzle.

## Yang Sudah Jalan

- Landing page React/Vite di root project.
- Portal React/Vite di `portal/`.
- Register, login, logout, forgot password, reset password via Supabase Auth.
- Auto-create `profiles` dan `user_progress` saat signup lewat trigger Supabase.
- Pembayaran pemetaan via Midtrans Edge Function.
- Mode sandbox pembayaran lokal untuk testing tanpa Midtrans.
- Tes Pimsleur tahap 2-6.
- Penyimpanan hasil Pimsleur di `pimsleur_results`.
- Halaman hasil Pimsleur peserta.
- Halaman admin daftar/detail hasil Pimsleur.
- Route CFIT di `/test/cfit` dengan 4 subtes, instruksi dari PPTX, timer per subtes, dan gambar soal dari lampiran Google Forms.
- PAPI Kostick di `/test/papikostik` dengan 90 soal forced-choice dari file klien, timer estimasi 20 menit, scoring 20 faktor, dan penyimpanan hasil.
- Halaman status PAPI peserta di `/result/papikostik`.
- Halaman admin daftar/detail PAPI di `/admin/papikostik` dan `/admin/papikostik/:userId`, termasuk catatan review psikolog/admin.
- Progress dan penyimpanan session/jawaban untuk CFIT dan PAPI Kostick.

## Yang Belum Final

- Env Supabase production belum diisi di `portal/.env` / Vercel Environment Variables.
- Migration Supabase harus dijalankan di project Supabase aktif.
- Midtrans production perlu deploy Edge Functions dan set secrets.
- CFIT sudah berisi soal dari PDF. Kunci jawaban subtes 1-4, raw score per subtes, raw total, konversi IQ, dan kategori sudah masuk. Norma memakai tabel `Skoring CFIT (3A)` dengan `A1-A6`; usia 17 tahun ke atas memakai `A6` sesuai header `>17`.
- Hasil CFIT peserta tersedia di `/result/cfit`; admin tersedia di `/admin/cfit` dan detail jawaban per peserta di `/admin/cfit/:userId`.
- PAPI Kostick sudah memakai materi dari file klien. Interpretasi otomatis mengikuti teks pada file skoring, tetapi pembacaan final tetap perlu psikolog/admin.
- Audio Pimsleur perlu dipastikan hak penggunaan/lisensinya sebelum production.
- `npm audit` portal masih menandai vulnerability `react-router@7.18.1`; tunggu rilis kompatibel dari `react-router-dom` atau evaluasi upgrade mayor saat tersedia.

## Cara Jalan Lokal

Landing:

```bash
npm install
npm run dev
```

Portal:

```bash
cd portal
npm install
npm run dev
```

URL default:

- Landing: `http://localhost:5173`
- Portal: `http://localhost:5174`

## Checklist Supabase

1. Buat project Supabase baru atau restore project lama kalau paused.
2. Jalankan migration di `portal/supabase/migrations/` berurutan.
3. Ambil `Project URL` dan `anon public key`.
4. Isi `portal/.env`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_MIDTRANS_CLIENT_KEY=
VITE_PEMETAAN_PRICE=150000
VITE_LANDING_URL=http://localhost:5173
```

5. Di Supabase Authentication URL Configuration:
   - Site URL lokal: `http://localhost:5174`
   - Redirect URL lokal: `http://localhost:5174/reset-password`
   - Tambahkan URL production setelah deploy.

## Checklist Midtrans

Untuk testing lokal, pakai mode sandbox di halaman pembayaran.

Untuk production:

1. Deploy Supabase Edge Functions:

```bash
cd portal
supabase functions deploy midtrans-create
supabase functions deploy midtrans-webhook
```

2. Set secrets:

```env
MIDTRANS_SERVER_KEY=...
MIDTRANS_IS_PRODUCTION=true
SUPABASE_SERVICE_ROLE_KEY=...
```

3. Set webhook Midtrans ke:

```text
https://xxxx.supabase.co/functions/v1/midtrans-webhook
```

## Next Step Teknis

Urutan paling aman:

1. Setup Supabase production dan jalankan migration.
2. Test flow register -> login -> sandbox payment -> Pimsleur -> hasil.
3. Jadikan satu user admin dengan SQL:

```sql
update public.profiles
set role = 'admin'
where id = 'USER_UUID_ADMIN';
```

4. Jalankan migration Supabase terbaru agar kolom `birth_date`, `age_years`, `age_months`, dan `norm_code` tersedia di database.
5. Test halaman `/test/cfit`, `/result/cfit`, `/test/papikostik`, dan `/result/papikostik`.
6. Test halaman admin `/admin/pimsleur`, `/admin/cfit`, dan `/admin/papikostik`.
7. Buat halaman rekap final gabungan Pimsleur + CFIT + PAPI Kostick setelah format output final disepakati.
8. Deploy landing dan portal sebagai dua project Vercel, atau satu project dengan routing yang disepakati.
