# Panduan isi .env (tanpa localhost)

Kalau laptop kantor **tidak bisa** `npm run dev` / localhost karena administrator, pakai **deploy online** (gratis) lalu isi `.env` dengan URL deploy.

---

## File yang perlu diisi

| File | Untuk apa |
|------|-----------|
| `portal/.env` | Portal calon siswa |
| `.env` (root) | Landing page → link ke portal |

Kedua file sudah dibuat dengan placeholder `ISI-...` — ganti dengan nilai asli kamu.

---

## 1. Isi `portal/.env`

Buka **Supabase** → **Settings** → **API**:

```env
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_LANDING_URL=https://www.harunokaze.id
```

---

## 2. Isi `.env` di root (landing)

```env
VITE_PORTAL_URL=https://nama-portal.vercel.app
```

---

## 3. Supabase Auth (pakai URL deploy, bukan localhost)

**Authentication** → **URL Configuration**:

| Field | Contoh |
|-------|--------|
| Site URL | `https://portal.harunokaze.id` |
| Redirect URLs | `https://portal.harunokaze.id/**` dan `/reset-password` |

**Email verifikasi:** jangan andalkan SMTP default Supabase ke Gmail. Aktifkan Custom SMTP
(Resend: `smtp.resend.com`, user `resend`, password API key).

**Email provider:** matikan **Confirm email** hanya untuk testing cepat. Production tetap
menyala, dengan SMTP custom.

---

## 4. Deploy tanpa localhost (gratis)

### Portal → Vercel

1. Push repo ke GitHub (sudah ada)
2. [vercel.com](https://vercel.com) → Import project `WEBSITEHNZ`
3. **Root Directory:** `portal`
4. **Environment Variables** — copy isi `portal/.env` (semua `VITE_*`)
5. Deploy → dapat URL mis. `https://harunokaze-portal.vercel.app`

### Landing → Vercel (project terpisah atau monorepo)

1. Import repo yang sama
2. **Root Directory:** `/` (root)
3. Env: `VITE_PORTAL_URL` = URL portal dari langkah atas
4. Deploy

Setelah deploy, **update** environment variable kedua project dengan URL domain yang asli.

Kredensial Pivot bukan environment variable Vercel. Simpan seluruh `PIVOT_*` di Supabase Edge
Functions Secrets sesuai daftar pada `README.md`, lalu gunakan endpoint production
`https://api.pivot-payment.com`.

---

## 5. Tes tanpa laptop (HP / browser kantor)

Buka di browser (tidak perlu localhost):

- Landing: `https://nama-landing.vercel.app`
- Portal daftar: `https://nama-portal.vercel.app/register`

Flow: Daftar → Login → Admin membuat tagihan → Bayar via Pivot → Tes → Sertifikat

---

## Ringkasan

```
Supabase ✅ (sudah)
    ↓
Isi portal/.env + .env root
    ↓
Deploy Vercel (portal + landing)
    ↓
Update Supabase Auth URL ke URL Vercel
    ↓
Buka dari HP / browser — tanpa localhost
```

Pembayaran portal hanya memakai Pivot production. Nominal dibuat per peserta dari menu admin dan
tidak diisi sendiri oleh peserta.
