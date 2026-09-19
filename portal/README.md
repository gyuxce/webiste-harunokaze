# Harunokaze Portal — Pemetaan Potensi

Portal web calon siswa untuk daftar, bayar, tes, dan unduh sertifikat pemetaan potensi.

**Stack:** React 19 + Vite + TypeScript + Tailwind v4 + Supabase + Pivot Payment

## Fitur MVP

- Register / login / logout / lupa password
- Dashboard progress pemetaan
- Tagihan per peserta dan pembayaran melalui Pivot Payment
- **Tes Pimsleur** (aptitude bahasa, seksi 2–6, timer 25 menit, grade A–F)
- Hasil Pimsleur + admin daftar/detail skor
- CFIT: 4 subtes, instruksi dari PPTX, timer per subtes, gambar soal, penyimpanan jawaban, raw score per subtes, raw total, IQ, kategori, halaman hasil peserta, dan admin detail jawaban berdasarkan norma CFIT 3A
- PAPI Kostick: 90 soal forced-choice, scoring 20 faktor, status hasil peserta, dan admin detail + review psikolog/admin
- Review final admin: interpretasi psikolog, narasi peserta hasil QC, persetujuan final, dan penerbitan sertifikat
- AI refine draft: membuat draft narasi peserta dari interpretasi psikolog dan data tiga tes melalui OpenRouter. Draft tetap harus diperiksa dan disetujui admin.
- Legacy sertifikat HTML masih ada di `/result/legacy`

## Setup

### 1. Supabase

1. Buat project di [supabase.com](https://supabase.com)
2. **Pastikan project tidak paused** — kalau ada banner "Project is paused", klik **Restore project** dulu
3. Buka **SQL Editor** → paste & jalankan isi file (berurutan):
   - `supabase/migrations/20260720000000_initial_schema.sql`
   - `supabase/migrations/20260721000000_pimsleur_results.sql`
   - `supabase/migrations/20260722000000_cfit_papikostik_progress.sql`
   - `supabase/migrations/20260723000000_cfit_low_score_floor.sql`
   - `supabase/migrations/20260724000000_papikostik_results.sql`
   - `supabase/migrations/20260730000000_pivot_payment.sql`
   - `supabase/migrations/20260731000000_certificate_admin_unlock.sql`
   - `supabase/migrations/20260803000000_final_review_workflow.sql`
   - `supabase/migrations/20260803000001_final_review_guardrails.sql`
   - `supabase/migrations/20260803000002_unify_papi_final_review.sql`
   - `supabase/migrations/20260803000003_final_review_narrative_source.sql`
   - `supabase/migrations/20260805000000_assessment_invoices.sql`
   - `supabase/migrations/20260818000000_fixed_assessment_invoice_amount.sql`
   - `supabase/migrations/20260818000001_fix_ensure_own_assessment_invoice_ambiguity.sql`
   - `supabase/migrations/20260818000002_admin_payment_timestamps.sql`
   - `supabase/migrations/20260818000003_psychologist_role_access.sql`
   - `supabase/migrations/20260819000000_assessment_attempts.sql`
   - `supabase/migrations/20260819000001_psychologist_review_queue.sql`
   - `supabase/migrations/20260819000002_security_hardening.sql`
   - `supabase/migrations/20260819000003_pivot_custom_invoice_amount.sql`
   - `supabase/migrations/20260819000004_fix_assessment_attempt_start.sql`
   - `supabase/migrations/20260819000005_fix_assessment_attempt_completion.sql`
   - `supabase/migrations/20260819000006_fix_psychologist_review_save.sql`
   - `supabase/migrations/20260819000007_psychologist_papi_notifications.sql`
   - `supabase/migrations/20260819000008_admin_program_interest.sql`
   - `supabase/migrations/20260820000000_psychologist_notification_email.sql`
   - `supabase/migrations/20260903000000_certificate_quality_and_visibility.sql`

Untuk admin: set `profiles.role = 'admin'` pada user staf.

### OpenRouter AI refine

Fungsi `supabase/functions/refine-final-review` memanggil model OpenRouter dari server Supabase.
API key tidak boleh diletakkan di frontend/Vercel. Di Supabase Dashboard buka **Edge Functions > Secrets** lalu tambahkan:

- `OPENROUTER_API_KEY`: API key dari OpenRouter
- `OPENROUTER_MODEL`: opsional, default `deepseek/deepseek-v4-flash-0731`
- `OPENROUTER_SITE_URL`: opsional, default `https://www.harunokaze.id`
- `OPENROUTER_APP_TITLE`: opsional, default `Harunokaze Portal`

Admin mengisi interpretasi psikolog di halaman **Review final**, klik **Refine dengan AI**, memeriksa hasil, lalu menyimpan draft. AI tidak menerbitkan sertifikat dan tidak menggantikan persetujuan admin.

#### Error `cannot execute CREATE TABLE in a read-only transaction`?

Jalankan **query ini dulu** (Run terpisah), lalu ulangi migration:

```sql
SELECT pg_is_in_recovery() AS database_readonly;
SHOW default_transaction_read_only;
SET default_transaction_read_only = off;
```

| Hasil | Arti | Solusi |
|-------|------|--------|
| `pg_is_in_recovery = true` | DB read-only | Project paused → **Restore** di dashboard |
| Project paused / sleep | Free tier tidak aktif | Dashboard → **Restore project** |
| Masih error | Branch/pooler issue | Buat **project Supabase baru**, ulangi migration |

4. Di **Authentication → URL Configuration**, tambahkan:
   - Site URL: `https://portal.harunokaze.id` (lokal: `http://localhost:5174`)
   - Redirect URLs:
     - `https://portal.harunokaze.id/**`
     - `https://portal.harunokaze.id/dashboard`
     - `https://portal.harunokaze.id/reset-password`
     - (lokal) `http://localhost:5174/**`

5. **Email verifikasi pendaftaran** memakai SMTP Supabase Auth, bukan tombol UI saja.
   Email default `noreply@mail.app.supabase.co` sering tidak masuk Gmail / masuk Spam.
   Pakai Custom SMTP (Resend sudah dipakai untuk notifikasi PAPI):
   - Authentication → SMTP Settings → Enable custom SMTP
   - Host: `smtp.resend.com`
   - Port: `465`
   - User: `resend`
   - Pass: `RESEND_API_KEY`
   - Sender: alamat domain yang sudah diverifikasi di Resend, misalnya `noreply@harunokaze.id`

Kalau SMTP belum custom, tombol **Kirim ulang** tetap memanggil Auth, tetapi Gmail bisa menolak
emailnya. Cek juga Authentication → Users: status `Waiting for verification` vs sudah confirmed.

#### Format soal legacy

Tes Pimsleur, CFIT, dan PAPI Kostick sudah memakai data lokal di source code. Tabel
`test_questions` hanya tersisa untuk flow legacy/generic.

Contoh struktur data:

```sql
insert into public.test_questions
  (test_type, question_text, options, correct_answer, order_index, active)
values
  (
    'cfit',
    'ISI_SOAL_RESMI_DI_SINI',
    '[{"label":"A","value":"a"},{"label":"B","value":"b"},{"label":"C","value":"c"},{"label":"D","value":"d"}]'::jsonb,
    'a',
    1,
    true
  );
```

Untuk PAPI Kostick, sistem menyimpan jawaban, skor faktor, interpretasi dasar, dan status review
ke tabel `papikostik_results`.

### 2. Environment

```bash
cp .env.example .env
```

Isi `.env`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_LANDING_URL=http://localhost:5173
```

### 3. Pivot Payment Edge Functions

Deploy ke Supabase:

```bash
supabase functions deploy pivot-create
supabase functions deploy pivot-status
supabase functions deploy pivot-reconcile
supabase functions deploy pivot-webhook --no-verify-jwt
supabase functions deploy notify-papikostik-completed
```

Set secrets di Supabase Dashboard → Edge Functions:

- `PIVOT_BASE_URL=https://api.pivot-payment.com`
- `PIVOT_CLIENT_ID`
- `PIVOT_CLIENT_SECRET`
- `PIVOT_CALLBACK_API_KEY`
- `PIVOT_SUCCESS_URL`
- `PIVOT_FAILURE_URL`
- `PIVOT_EXPIRATION_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Callback URL Pivot: `https://xxxx.supabase.co/functions/v1/pivot-webhook`

Gunakan kredensial dan Callback API Key production setelah akun Pivot live diaktifkan.
Endpoint production wajib memakai `https://api.pivot-payment.com`. Fungsi akan menolak endpoint
atau checkout URL sandbox agar transaksi uji tidak tercampur dengan pembayaran peserta.
Webhook dideploy dengan `--no-verify-jwt` karena dipanggil server Pivot, bukan user Supabase;
permintaan tetap wajib lolos validasi `PIVOT_CALLBACK_API_KEY` di dalam function.

### 4. Database payment metadata

Portal menggunakan Pivot Payment Session mode `REDIRECT`. Jalankan migration berikut di Supabase SQL
Editor:

```text
supabase/migrations/20260730000000_pivot_payment.sql
supabase/migrations/20260805000000_assessment_invoices.sql
```

Admin membuat tagihan dari `/admin/payments`. Peserta hanya melihat nominal yang sudah ditetapkan;
nominal tidak dikirim dari input browser. Callback baru membuka tes jika referensi, pemilik invoice,
nominal, dan mata uang cocok dengan data server.

Deploy functions:

```bash
supabase functions deploy pivot-create
supabase functions deploy pivot-status
supabase functions deploy pivot-reconcile
supabase functions deploy pivot-webhook --no-verify-jwt
```

Set secrets di Supabase Edge Functions:

```text
PIVOT_BASE_URL=https://api.pivot-payment.com
PIVOT_CLIENT_ID=<Client ID Production>
PIVOT_CLIENT_SECRET=<Client Secret Production>
PIVOT_CALLBACK_API_KEY=<Callback API Key Production>
PIVOT_SUCCESS_URL=https://portal.harunokaze.id/payment?payment=success
PIVOT_FAILURE_URL=https://portal.harunokaze.id/payment?payment=failure
PIVOT_EXPIRATION_URL=https://portal.harunokaze.id/payment?payment=expired
RESEND_API_KEY=<Resend API Key>
RESEND_FROM_EMAIL=Harunokaze <notifikasi@harunokaze.id>
# Optional extra address. Accounts with role psychologist are emailed automatically.
PSYCHOLOGIST_NOTIFICATION_EMAIL=psikolog@harunokaze.id
# Optional (default sudah https://portal.harunokaze.id)
PORTAL_URL=https://portal.harunokaze.id
```

SMTP Custom di **Authentication** hanya untuk verifikasi daftar/login. Email “PAPI selesai”
ke psikolog dikirim oleh Edge Function `notify-papikostik-completed`, jadi API Resend
harus diisi di **Project Settings → Edge Functions → Secrets**, lalu function di-deploy:

```bash
supabase functions deploy notify-papikostik-completed
```

Tujuan email, urutan:
1. `profiles.notification_email` pada akun **psikolog** dan **admin** (bisa beberapa alamat, dipisah koma)
2. email login psikolog kalau kolom itu kosong
3. `PSYCHOLOGIST_NOTIFICATION_EMAIL` sebagai alamat tambahan

Jalankan migration `20260820000000_psychologist_notification_email.sql`, lalu set inbox:

```sql
-- Gmail psikolog + Gmail tester, dipisah koma
update public.profiles
set notification_email = 'gmail.psikolog@gmail.com, tester@gmail.com'
where role = 'psychologist';

-- atau isi Gmail tester di akun admin:
update public.profiles
set notification_email = 'tester@gmail.com'
where role = 'admin';
```

Tes tanpa mengulang Pimsleur/CFIT/PAPI: login admin atau psikolog, isi **Email notifikasi PAPI**, lalu klik **Kirim email tes**.

Callback URL yang didaftarkan di Pivot Dashboard → Settings → Developer Settings → Callbacks:

```text
https://<PROJECT_REF>.supabase.co/functions/v1/pivot-webhook
```

### 5. Jalankan

```bash
cd portal
npm install
npm run dev
```

Buka http://localhost:5174

Landing page (terminal terpisah):

```bash
cd ..
npm run dev
```

Buka http://localhost:5173 — tombol "Mulai Pemetaan" mengarah ke portal.

## Struktur

```
portal/
  src/
    pages/          Login, Register, Dashboard, Payment, Tests, Result, Admin Review
    components/     Layout, ProgressSteps, ProtectedRoute
    contexts/       AuthContext
    lib/            Supabase client + types
  supabase/
    migrations/     Schema SQL
    functions/      Pivot create + webhook
```

## Production

- Deploy portal ke Vercel/Netlify (build: `npm run build`, output: `dist/`)
- Set env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Di landing, set `VITE_PORTAL_URL=https://portal.harunokaze.id`
