import { supabase } from "./supabase";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function authEmailRedirectTo(): string {
  return `${window.location.origin}/dashboard`;
}

export function isUnconfirmedEmailError(message: string, code?: string): boolean {
  const normalized = message.toLowerCase();
  return (
    code === "email_not_confirmed" ||
    normalized.includes("email not confirmed") ||
    normalized.includes("email_not_confirmed")
  );
}

export function signupNeedsManualResend(user: { identities?: Array<unknown> | null } | null): boolean {
  return Boolean(user) && (user?.identities?.length ?? 0) === 0;
}

export async function resendSignupVerification(email: string) {
  return supabase.auth.resend({
    type: "signup",
    email: normalizeEmail(email),
    options: {
      emailRedirectTo: authEmailRedirectTo(),
    },
  });
}

export function friendlyAuthEmailError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("rate") || normalized.includes("after")) {
    return "Link baru baru saja diminta. Tunggu sekitar 1 menit, lalu kirim ulang.";
  }
  if (normalized.includes("already") && normalized.includes("registered")) {
    return "Email ini sudah terdaftar. Coba masuk, atau kirim ulang verifikasi jika belum dikonfirmasi.";
  }
  return message;
}
