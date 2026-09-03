import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { AuthLayout } from "../components/PortalLayout";
import {
  authEmailRedirectTo,
  friendlyAuthEmailError,
  normalizeEmail,
  resendSignupVerification,
  signupNeedsManualResend,
} from "../lib/authEmail";

const WHATSAPP_URL = "https://wa.me/message/DWVTJESHI2RQC1";

const PROGRAMS = [
  "Pelatihan Bahasa & Karakter",
  "Program Bidang Konstruksi",
  "Program Perawatan & Jasa (Kaigo)",
  "Program Driver Jepang",
  "Belum yakin — butuh konsultasi",
];

export function RegisterPage() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    whatsapp: "",
    birthDate: "",
    city: "",
    programInterest: PROGRAMS[0],
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendMessage, setResendMessage] = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!isSupabaseConfigured) {
      setError("Supabase belum dikonfigurasi. Isi file portal/.env terlebih dahulu.");
      setLoading(false);
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email: normalizeEmail(form.email),
      password: form.password,
      options: {
        emailRedirectTo: authEmailRedirectTo(),
        data: {
          full_name: form.fullName,
          whatsapp: form.whatsapp,
          birth_date: form.birthDate,
          city: form.city,
          program_interest: form.programInterest,
        },
      },
    });

    if (authError) {
      setError(friendlyAuthEmailError(authError.message));
    } else {
      setAlreadyRegistered(signupNeedsManualResend(data.user));
      setSuccess(true);
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setResendState("sending");
    setResendMessage("");
    const { error: resendError } = await resendSignupVerification(form.email);
    if (resendError) {
      setResendState("error");
      setResendMessage(friendlyAuthEmailError(resendError.message));
      return;
    }
    setResendState("sent");
    setResendMessage("Link verifikasi baru sudah diminta. Cek inbox dan folder spam.");
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="rounded-2xl border border-brand-navy/8 bg-white p-8 shadow-sm text-center">
          <h1 className="font-display font-extrabold text-2xl text-brand-navy">Cek email kamu</h1>
          <p className="mt-3 text-sm text-brand-navy/60 leading-relaxed">
            {alreadyRegistered ? (
              <>
                Email <strong>{form.email}</strong> sudah pernah didaftarkan, jadi link tidak dikirim
                otomatis lagi. Kalau akun belum terverifikasi, kirim ulang di bawah. Kalau sudah
                pernah verifikasi, langsung masuk.
              </>
            ) : (
              <>
                Kami sudah meminta link verifikasi ke <strong>{form.email}</strong>. Setelah
                verifikasi, kamu bisa masuk dan membayar biaya pemetaan Rp99.000.
              </>
            )}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-brand-navy/45">
            Cek folder <strong>Spam / Promosi / Updates</strong> juga. Email verifikasi kadang tidak
            masuk Primary Gmail.
          </p>

          {resendMessage ? (
            <p
              className={`mt-4 rounded-lg px-3 py-2 text-sm ${
                resendState === "error"
                  ? "bg-brand-red-soft text-brand-red"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {resendMessage}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resendState === "sending"}
            className="mt-5 w-full rounded-xl border border-brand-navy/12 bg-white px-6 py-3 text-sm font-bold text-brand-navy hover:border-brand-red/30 hover:text-brand-red disabled:opacity-60"
          >
            {resendState === "sending" ? "Mengirim ulang..." : "Kirim ulang email verifikasi"}
          </button>
          <Link
            to="/login"
            className="mt-3 inline-block rounded-xl bg-brand-navy px-6 py-3 text-sm font-bold text-white"
          >
            Ke halaman masuk
          </Link>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block text-sm font-semibold text-brand-red hover:underline"
          >
            Email tidak masuk? Hubungi admin WhatsApp
          </a>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="rounded-2xl border border-brand-navy/8 bg-white p-8 shadow-sm">
        <h1 className="font-display font-extrabold text-2xl text-brand-navy">Daftar</h1>
        <p className="mt-1 text-sm text-brand-navy/55">Buat akun untuk mulai pemetaan potensi</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/50">Nama lengkap</span>
            <input
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="rounded-xl border border-brand-navy/12 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/50">Email</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-xl border border-brand-navy/12 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/50">Password</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-xl border border-brand-navy/12 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-brand-navy/45 transition-colors hover:text-brand-red"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/50">WhatsApp</span>
            <input
              required
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="08xxxxxxxxxx"
              className="rounded-xl border border-brand-navy/12 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/50">Tanggal lahir</span>
            <input
              type="date"
              required
              value={form.birthDate}
              onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              className="rounded-xl border border-brand-navy/12 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/50">Kota</span>
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="rounded-xl border border-brand-navy/12 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/50">Program minat</span>
            <select
              value={form.programInterest}
              onChange={(e) => setForm({ ...form, programInterest: e.target.value })}
              className="rounded-xl border border-brand-navy/12 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
            >
              {PROGRAMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <p className="text-sm text-brand-red bg-brand-red-soft rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-xl bg-brand-red text-white font-bold py-3.5 text-sm hover:bg-brand-red-hover transition-colors disabled:opacity-60"
          >
            {loading ? "Mendaftar..." : "Daftar"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-brand-navy/55">
          Sudah punya akun?{" "}
          <Link to="/login" className="font-semibold text-brand-red hover:underline">
            Masuk
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
