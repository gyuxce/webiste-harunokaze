import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { AuthLayout } from "../components/PortalLayout";

export function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // The recovery link lands here before Supabase has finished exchanging its
    // token for a session — that exchange resolves asynchronously, after this
    // effect's first getSession() check already returned null. Only
    // onAuthStateChange sees the session once it actually lands.
    let settled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        settled = true;
        setReady(true);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        settled = true;
        setReady(true);
      }
    });

    const timeout = window.setTimeout(() => {
      if (!settled) setSessionExpired(true);
    }, 10000);

    return () => {
      listener.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) setError(authError.message);
    else setSuccess(true);
    setLoading(false);
  };

  if (!ready && !success && sessionExpired) {
    return (
      <AuthLayout>
        <div className="rounded-2xl border border-brand-navy/8 bg-white p-8 shadow-sm text-center">
          <h1 className="font-display font-extrabold text-xl text-brand-navy">Link sudah tidak berlaku</h1>
          <p className="mt-3 text-sm text-brand-navy/60 leading-relaxed">
            Link reset password ini sudah kedaluwarsa atau sudah pernah dipakai. Minta link baru
            lewat halaman lupa password.
          </p>
          <Link
            to="/forgot-password"
            className="mt-6 inline-block rounded-xl bg-brand-navy text-white font-bold px-6 py-3 text-sm"
          >
            Minta link baru
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (!ready && !success) {
    return (
      <AuthLayout>
        <div className="rounded-2xl border border-brand-navy/8 bg-white p-8 shadow-sm text-center text-sm text-brand-navy/60">
          Memuat sesi reset password...
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="rounded-2xl border border-brand-navy/8 bg-white p-8 shadow-sm text-center">
          <h1 className="font-display font-extrabold text-2xl text-brand-navy">Password diperbarui</h1>
          <Link to="/login" className="mt-6 inline-block rounded-xl bg-brand-navy text-white font-bold px-6 py-3 text-sm">
            Masuk sekarang
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="rounded-2xl border border-brand-navy/8 bg-white p-8 shadow-sm">
        <h1 className="font-display font-extrabold text-2xl text-brand-navy">Password Baru</h1>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password baru (min. 8 karakter)"
            className="rounded-xl border border-brand-navy/12 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
          />
          {error && <p className="text-sm text-brand-red bg-brand-red-soft rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-brand-red text-white font-bold py-3.5 text-sm disabled:opacity-60"
          >
            {loading ? "Menyimpan..." : "Simpan password"}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}
