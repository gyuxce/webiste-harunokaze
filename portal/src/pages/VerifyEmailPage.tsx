import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { AuthLayout } from "../components/PortalLayout";

const RESEND_COOLDOWN_SECONDS = 30;

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  if (!email) {
    return <Navigate to="/register" replace />;
  }

  async function resend() {
    setResending(true);
    setError("");
    setMessage("");
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setMessage("Email verifikasi baru sudah dikirim.");
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <AuthLayout>
      <div className="rounded-2xl border border-brand-navy/8 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-red-soft text-brand-red">
          <MailCheck size={28} />
        </div>
        <h1 className="mt-4 font-display font-extrabold text-2xl text-brand-navy">Cek email kamu</h1>
        <p className="mt-3 text-sm text-brand-navy/60 leading-relaxed">
          Kami sudah mengirim link verifikasi ke <strong>{email}</strong>. Klik link di email itu dulu,
          baru kamu bisa masuk dan lanjut membayar biaya pemetaan.
        </p>
        <p className="mt-3 text-xs text-brand-navy/45 leading-relaxed">
          Tidak muncul di kotak masuk? Cek folder <strong>Spam</strong> atau <strong>Promosi</strong>.
          Halaman ini aman untuk di-refresh atau dibuka lagi nanti — tidak perlu daftar ulang.
        </p>

        {error ? (
          <p className="mt-4 rounded-lg bg-brand-red-soft px-3 py-2 text-sm text-brand-red">{error}</p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
        ) : null}

        <button
          type="button"
          onClick={() => void resend()}
          disabled={resending || cooldown > 0}
          className="mt-5 w-full rounded-xl border border-brand-navy/15 px-6 py-3 text-sm font-bold text-brand-navy disabled:opacity-50"
        >
          {resending
            ? "Mengirim..."
            : cooldown > 0
              ? `Kirim ulang lagi dalam ${cooldown}s`
              : "Kirim ulang email verifikasi"}
        </button>

        <Link
          to="/login"
          className="mt-3 inline-block w-full rounded-xl bg-brand-navy text-white font-bold px-6 py-3 text-sm"
        >
          Sudah verifikasi? Ke halaman masuk
        </Link>
      </div>
    </AuthLayout>
  );
}
