import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_BASE_URL = "https://api.pivot-payment.com";

type Invoice = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: "issued" | "paid" | "cancelled";
};

type Payment = {
  id: string;
  invoice_id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  provider_reference_id: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStringAtKeys(value: unknown, keys: string[]): string | null {
  if (!isRecord(value)) return null;
  for (const key of keys) {
    if (typeof value[key] === "string" && value[key]) return value[key] as string;
  }
  for (const child of Object.values(value)) {
    const found = getStringAtKeys(child, keys);
    if (found) return found;
  }
  return null;
}

function mapPaymentStatus(payload: unknown) {
  const status = (
    getStringAtKeys(payload, [
      "status",
      "paymentStatus",
      "payment_status",
      "transactionStatus",
      "transaction_status",
      "event",
      "eventType",
    ]) ?? ""
  ).toUpperCase();

  if (
    [
      "SUCCESS",
      "SUCCEEDED",
      "SETTLED",
      "COMPLETED",
      "PAID",
      "CAPTURED",
      "CONFIRMED",
      "AUTHORISED",
      "AUTHORIZED",
    ].some((value) => status.includes(value))
  ) {
    return "settlement";
  }
  if (status.includes("EXPIRE")) return "expire";
  if (status.includes("CANCEL")) return "cancel";
  if (["FAIL", "DENY", "REJECT"].some((value) => status.includes(value))) return "deny";
  return "pending";
}

function getPaymentAmount(payload: unknown): { value: number; currency: string } | null {
  if (!isRecord(payload)) return null;

  const candidate = payload.amount;
  if (isRecord(candidate)) {
    const value = Number(candidate.value ?? candidate.amount);
    const currency = typeof candidate.currency === "string" ? candidate.currency.toUpperCase() : "";
    if (Number.isInteger(value) && value > 0 && currency) return { value, currency };
  }

  for (const child of Object.values(payload)) {
    const amount = getPaymentAmount(child);
    if (amount) return amount;
  }
  return null;
}

function isProductionBaseUrl(baseUrl: string) {
  try {
    return new URL(baseUrl).hostname.toLowerCase() === "api.pivot-payment.com";
  } catch {
    return false;
  }
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function getAccessToken(baseUrl: string, clientId: string, clientSecret: string) {
  const response = await fetch(`${baseUrl}/v1/access-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-MERCHANT-ID": clientId,
      "X-MERCHANT-SECRET": clientSecret,
    },
    body: JSON.stringify({ grantType: "client_credentials" }),
  });
  const payload = await readResponsePayload(response);
  if (!response.ok) throw new Error(`Autentikasi Pivot gagal: ${JSON.stringify(payload)}`);

  const token = getStringAtKeys(payload, ["accessToken", "access_token", "token"]);
  if (!token) throw new Error("Pivot tidak mengembalikan access token");
  return token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) return jsonResponse({ error: profileError.message }, 500);
    if (profile?.role !== "admin") return jsonResponse({ error: "Admin access required" }, 403);

    let body: { invoice_id?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invoice wajib dipilih" }, 400);
    }
    const invoiceId = typeof body.invoice_id === "string" ? body.invoice_id.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(invoiceId)) {
      return jsonResponse({ error: "ID tagihan tidak valid" }, 400);
    }

    const { data: invoiceData, error: invoiceError } = await supabaseAdmin
      .from("assessment_invoices")
      .select("id,user_id,amount,currency,status")
      .eq("id", invoiceId)
      .maybeSingle();
    if (invoiceError) return jsonResponse({ error: invoiceError.message }, 500);

    const invoice = invoiceData as Invoice | null;
    if (!invoice) return jsonResponse({ error: "Tagihan peserta tidak ditemukan" }, 404);
    if (invoice.status === "paid") {
      return jsonResponse({ status: "settlement", already_paid: true });
    }

    // A participant can end up with several payment attempts for one invoice (an
    // earlier session expired in our own bookkeeping, a new one got created), and
    // the money can still land against an OLDER attempt if the transfer was already
    // in flight when the newer session was created. Checking only the most recent
    // attempt (the previous behavior here) permanently misses that case, so check
    // every unsettled attempt, oldest money first.
    const { data: paymentRows, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("id,invoice_id,user_id,amount,currency,status,provider_reference_id")
      .eq("invoice_id", invoice.id)
      .eq("user_id", invoice.user_id)
      .eq("provider", "pivot")
      .not("provider_reference_id", "is", null)
      .order("created_at", { ascending: false });
    if (paymentError) return jsonResponse({ error: paymentError.message }, 500);

    const payments = (paymentRows ?? []) as Payment[];
    if (payments.length === 0) {
      return jsonResponse({ status: "pending", message: "Sesi pembayaran Pivot belum ditemukan" });
    }
    const alreadySettled = payments.find((candidate) => candidate.status === "settlement");
    if (alreadySettled) {
      return jsonResponse({ status: "settlement", already_paid: true, payment_id: alreadySettled.id });
    }

    const baseUrl = (Deno.env.get("PIVOT_BASE_URL") || DEFAULT_BASE_URL).replace(/\/$/, "");
    const clientId = Deno.env.get("PIVOT_CLIENT_ID");
    const clientSecret = Deno.env.get("PIVOT_CLIENT_SECRET");
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !clientId || !clientSecret) {
      return jsonResponse({ error: "Konfigurasi server pembayaran belum lengkap" }, 500);
    }
    if (!isProductionBaseUrl(baseUrl)) {
      return jsonResponse({ error: "PIVOT_BASE_URL masih bukan endpoint production Pivot" }, 500);
    }

    const token = await getAccessToken(baseUrl, clientId, clientSecret);

    let lastStatus: string = payments[0].status;
    let lastMessage: string | undefined;

    for (const payment of payments) {
      if (!payment.provider_reference_id) continue;

      const response = await fetch(
        `${baseUrl}/v2/payments/${encodeURIComponent(payment.provider_reference_id)}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
      );
      const payload = await readResponsePayload(response);
      if (!response.ok) {
        console.error("pivot-reconcile rejected:", payment.id, JSON.stringify(payload));
        lastMessage = "Pivot belum dapat mengonfirmasi status salah satu transaksi";
        continue;
      }

      const status = mapPaymentStatus(payload);
      const providerAmount = getPaymentAmount(payload);

      if (status === "settlement") {
        const amountMatches = providerAmount?.value === payment.amount && payment.amount === invoice.amount;
        const currencyMatches =
          providerAmount?.currency === payment.currency && payment.currency === invoice.currency;
        if (!amountMatches || !currencyMatches) {
          console.error("pivot-reconcile settlement mismatch", {
            paymentId: payment.id,
            expectedAmount: payment.amount,
            expectedCurrency: payment.currency,
            providerAmount,
          });
          lastMessage = "Nominal transaksi Pivot tidak sesuai dengan tagihan";
          continue;
        }

        const { error: updateError } = await supabaseAdmin
          .from("payments")
          .update({ status, raw_payload: payload })
          .eq("id", payment.id);
        if (updateError) {
          console.error("pivot-reconcile update failed:", updateError.message);
          return jsonResponse({ error: updateError.message }, 500);
        }

        return jsonResponse({ status, payment_id: payment.id });
      }

      // Not this attempt — record its latest status and keep checking older ones.
      await supabaseAdmin.from("payments").update({ status, raw_payload: payload }).eq("id", payment.id);
      lastStatus = status;
    }

    return jsonResponse({ status: lastStatus, message: lastMessage });
  } catch (error) {
    console.error("pivot-reconcile error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
