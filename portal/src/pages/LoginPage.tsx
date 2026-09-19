import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { AuthLayout } from "../components/PortalLayout";
import {
  friendlyAuthEmailError,
  isUnconfirmedEmailError,
  resendSignupVerification,
} from "../lib/authEmail";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendMessage, setResendMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setResendMessage("");
    setLoading(true);

    if (!isSupabaseConfigured) {
      setError("Supabase belum dikonfigurasi. Isi file portal/.env terlebih dahulu.");
      setLoading(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (authError) {
      if (isUnconfirmedEmailError(authError.message, authError.code)) {
        setNeedsVerification(true);
        setError("Email belum diverifikasi. Cek inbox/spam, atau kirim ulang link di bawah.");
      } else {
        setError(authError.message);
      }
    } else if (authData.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .maybeSingle();
      navigate(profile?.role === "admin" ? "/dashboard" : "/payment", { replace: true });
    }
    setLoading(false);
  };

  return (
    <AuthLayout>
      <div className="rounded-2xl border border-brand-navy/8 bg-white p-8 shadow-sm">
        <h1 className="font-display font-extrabold text-2xl text-brand-navy">Masuk</h1>
        <p className="mt-1 text-sm text-brand-navy/55">Lanjutkan pemetaan potensimu</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/50">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-brand-navy/12 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
              placeholder="nama@email.com"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/50">Password</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-brand-navy/12 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                placeholder="••••••••"
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

          {error && (
            <p className="text-sm text-brand-red bg-brand-red-soft rounded-lg px-3 py-2">{error}</p>
          )}

          {needsVerification ? (
            <div className="rounded-xl border border-brand-navy/8 bg-brand-bg p-4 text-left">
              <p className="text-xs leading-relaxed text-brand-navy/55">
                Cek folder Spam / Promosi. Kalau masih kosong, kirim ulang verifikasi ke {email}.
              </p>
              {resendMessage ? (
                <p
                  className={`mt-2 text-xs ${
                    resendState === "error" ? "text-brand-red" : "text-emerald-700"
                  }`}
                >
                  {resendMessage}
                </p>
              ) : null}
              <button
                type="button"
                onClick={async () => {
                  setResendState("sending");
                  setResendMessage("");
                  const { error: resendError } = await resendSignupVerification(email);
                  if (resendError) {
                    setResendState("error");
                    setResendMessage(friendlyAuthEmailError(resendError.message));
                    return;
                  }
                  setResendState("sent");
                  setResendMessage("Link verifikasi baru sudah diminta. Cek inbox dan spam.");
                }}
                disabled={resendState === "sending" || !email}
                className="mt-3 w-full rounded-lg border border-brand-navy/12 bg-white py-2.5 text-xs font-bold text-brand-navy hover:border-brand-red/30 hover:text-brand-red disabled:opacity-60"
              >
                {resendState === "sending" ? "Mengirim ulang..." : "Kirim ulang email verifikasi"}
              </button>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-xl bg-brand-red text-white font-bold py-3.5 text-sm hover:bg-brand-red-hover transition-colors disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        <div className="mt-5 flex flex-col gap-2 text-center text-sm text-brand-navy/55">
          <Link to="/forgot-password" className="font-semibold text-brand-red hover:underline">
            Lupa password?
          </Link>
          <p>
            Belum punya akun?{" "}
            <Link to="/register" className="font-semibold text-brand-red hover:underline">
              Daftar sekarang
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
