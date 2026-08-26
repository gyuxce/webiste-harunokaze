import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  X,
} from "lucide-react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  downloadCsv,
  formatAdminDateTime,
  isAdminToday,
  isWithinAdminDateRange,
} from "../lib/adminTools";
import type { Database } from "../lib/database.types";
import { supabase } from "../lib/supabase";

type InvoiceAdminRow =
  Database["public"]["Functions"]["admin_list_assessment_invoices"]["Returns"][number];
type PaymentFilter = "all" | "new" | "pending" | "paid" | "paid_today";

const FILTER_OPTIONS: Array<{ value: PaymentFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "new", label: "Daftar 24 jam" },
  { value: "pending", label: "Menunggu" },
  { value: "paid", label: "Lunas" },
  { value: "paid_today", label: "Lunas hari ini" },
];

const DEFAULT_DESCRIPTION = "Pemetaan Potensi Harunokaze";
const DEFAULT_ASSESSMENT_AMOUNT = 99000;
const PROGRAM_OPTIONS = [
  "Pelatihan Bahasa & Karakter",
  "Program Bidang Konstruksi",
  "Program Perawatan & Jasa (Kaigo)",
  "Program Driver Jepang",
  "Belum yakin — butuh konsultasi",
];

const formatPrice = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const isWithinLastHours = (value: string | null, hours: number) => {
  if (!value) return false;
  const elapsed = Date.now() - new Date(value).getTime();
  return elapsed >= 0 && elapsed <= hours * 60 * 60 * 1000;
};

const isPaidRow = (row: InvoiceAdminRow) =>
  row.invoice_status === "paid" || ["paid", "verified"].includes(row.progress_payment_status);

export function AdminPaymentsPage() {
  const { profile, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<InvoiceAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [editing, setEditing] = useState<InvoiceAdminRow | null>(null);
  const [amount, setAmount] = useState(String(DEFAULT_ASSESSMENT_AMOUNT));
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [dueDate, setDueDate] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [programEditing, setProgramEditing] = useState<InvoiceAdminRow | null>(null);
  const [programInterest, setProgramInterest] = useState(PROGRAM_OPTIONS[0]);
  const [programError, setProgramError] = useState("");
  const [programSaving, setProgramSaving] = useState(false);
  const [reconcilingInvoiceId, setReconcilingInvoiceId] = useState<string | null>(null);

  const loadRows = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");

    const { data, error: responseError } = await supabase.rpc(
      "admin_list_assessment_invoices",
    );
    if (responseError) {
      setError(responseError.message);
    } else {
      setRows(data ?? []);
      setLastUpdatedAt(new Date().toISOString());
    }
    if (showLoader) setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading || profile?.role !== "admin") return;
    void loadRows();
  }, [authLoading, loadRows, profile?.role]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRows(false);
    setRefreshing(false);
  };

  const handleExport = () => {
    downloadCsv(
      `harunokaze-pembayaran-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Nama",
        "Email",
        "WhatsApp",
        "Program Minat",
        "Terdaftar",
        "Nomor Tagihan",
        "Nominal",
        "Status Tagihan",
        "Status Pembayaran",
        "Waktu Pembayaran",
      ],
      filteredRows.map((row) => [
        row.full_name,
        row.email ?? "",
        row.whatsapp ?? "",
        row.program_interest ?? "",
        formatAdminDateTime(row.registered_at),
        row.invoice_number ?? "",
        row.amount ? formatPrice(row.amount) : "",
        row.invoice_status ?? "Belum dibuat",
        row.last_payment_status ?? (isPaidRow(row) ? "settlement" : ""),
        formatAdminDateTime(row.paid_at),
      ]),
    );
    setNotice(`${filteredRows.length} data pembayaran berhasil diekspor.`);
  };

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (filter === "new") return isWithinLastHours(row.registered_at, 24);
        if (filter === "pending") return row.invoice_status === "issued";
        if (filter === "paid") return isPaidRow(row);
         if (filter === "paid_today") return isPaidRow(row) && isAdminToday(row.paid_at);
        return true;
      })
      .filter((row) =>
        isWithinAdminDateRange(
          row.paid_at ?? row.last_payment_at ?? row.registered_at,
          fromDate,
          toDate,
        ),
      )
      .filter((row) =>
        [row.full_name, row.email, row.whatsapp, row.invoice_number]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized)),
      )
      .sort((left, right) => {
        const leftDate = new Date(
          left.paid_at ?? left.last_payment_at ?? left.registered_at,
        ).getTime();
        const rightDate = new Date(
          right.paid_at ?? right.last_payment_at ?? right.registered_at,
        ).getTime();
        return rightDate - leftDate;
      });
  }, [filter, fromDate, query, rows, toDate]);

  const totals = useMemo(
    () => ({
      registeredToday: rows.filter((row) => isAdminToday(row.registered_at)).length,
      issued: rows.filter((row) => row.invoice_status === "issued").length,
      paidToday: rows.filter((row) => isPaidRow(row) && isAdminToday(row.paid_at)).length,
      paid: rows.filter((row) => isPaidRow(row)).length,
      legacy: rows.filter((row) => hasLegacyPaymentAccess(row)).length,
      missing: rows.filter(
        (row) => !row.invoice_id && row.progress_payment_status === "pending",
      ).length,
    }),
    [rows],
  );

  const openEditor = (row: InvoiceAdminRow) => {
    setEditing(row);
    setAmount(String(row.amount ?? DEFAULT_ASSESSMENT_AMOUNT));
    setDescription(row.description || DEFAULT_DESCRIPTION);
    setDueDate(row.due_date || "");
    setFormError("");
    setNotice("");
  };

  const closeEditor = () => {
    if (saving) return;
    setEditing(null);
    setFormError("");
  };

  const openProgramEditor = (row: InvoiceAdminRow) => {
    setProgramEditing(row);
    setProgramInterest(
      PROGRAM_OPTIONS.includes(row.program_interest ?? "")
        ? row.program_interest ?? PROGRAM_OPTIONS[0]
        : PROGRAM_OPTIONS[0],
    );
    setProgramError("");
    setNotice("");
  };

  const closeProgramEditor = () => {
    if (programSaving) return;
    setProgramEditing(null);
    setProgramError("");
  };

  const handleSave = async () => {
    if (!editing) return;
    const amountValue = Number.parseInt(amount, 10);
    if (!Number.isInteger(amountValue) || amountValue < 1000 || amountValue > 100000000) {
      setFormError("Nominal harus berupa angka antara Rp1.000 dan Rp100.000.000.");
      return;
    }

    setSaving(true);
    setFormError("");
    const { error: saveError } = await supabase.rpc("admin_upsert_assessment_invoice", {
      p_user_id: editing.user_id,
      p_amount: amountValue,
      p_description: description.trim() || DEFAULT_DESCRIPTION,
      p_due_date: dueDate || null,
    });

    if (saveError) {
      setFormError(saveError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditing(null);
    setNotice(`Tagihan ${editing.full_name} berhasil disimpan.`);
    await loadRows(false);
  };

  const handleProgramSave = async () => {
    if (!programEditing) return;

    setProgramSaving(true);
    setProgramError("");
    const { error: saveError } = await supabase.rpc(
      "admin_update_participant_program_interest",
      {
        p_user_id: programEditing.user_id,
        p_program_interest: programInterest,
      },
    );

    if (saveError) {
      setProgramError(saveError.message);
      setProgramSaving(false);
      return;
    }

    setProgramSaving(false);
    setProgramEditing(null);
    setNotice(`Program minat ${programEditing.full_name} berhasil diperbarui.`);
    await loadRows(false);
  };

  const handleReconcilePayment = async (row: InvoiceAdminRow) => {
    if (!row.invoice_id || isPaidRow(row)) return;

    setReconcilingInvoiceId(row.invoice_id);
    setError("");
    setNotice("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("pivot-reconcile", {
        body: { invoice_id: row.invoice_id },
      });

      if (fnError instanceof FunctionsHttpError) {
        let serverMessage = "Status Pivot belum dapat diperiksa";
        try {
          const body = await fnError.context.json();
          serverMessage = body?.error ?? serverMessage;
        } catch {
          // The function may return an empty or already-consumed response body.
        }
        throw new Error(serverMessage);
      }
      if (fnError) throw fnError;

      const status = String(data?.status ?? "pending");
      if (status === "settlement") {
        setNotice(`Pembayaran ${row.full_name} sudah dikonfirmasi Pivot dan portal diperbarui.`);
      } else {
        setNotice(`Status Pivot ${row.full_name} masih ${paymentStatusLabel(status)}.`);
      }
      await loadRows(false);
    } catch (reconcileError) {
      setError(
        reconcileError instanceof Error
          ? reconcileError.message
          : "Status Pivot belum dapat diperiksa",
      );
    } finally {
      setReconcilingInvoiceId(null);
    }
  };

  if (!authLoading && profile?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        to="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-brand-navy/50 hover:text-brand-red"
      >
        <ArrowLeft size={16} /> Panel staf
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-red">
            Pembayaran
          </p>
          <h1 className="font-display text-2xl font-extrabold text-brand-navy">
            Tagihan peserta
          </h1>
          <p className="mt-1 text-sm text-brand-navy/50">
            Pantau peserta, status, waktu daftar, dan waktu pembayaran otomatis.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-brand-bg px-3 py-2 text-brand-navy/55">
            Daftar hari ini {totals.registeredToday}
          </span>
          <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">
            Menunggu {totals.issued}
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">
            Lunas hari ini {totals.paidToday}
          </span>
          <span className="rounded-full bg-sky-50 px-3 py-2 text-sky-700">
            Total lunas {totals.paid}
          </span>
          {totals.missing > 0 ? (
            <span className="rounded-full bg-brand-bg px-3 py-2 text-brand-navy/55">
              Belum dibuat {totals.missing}
            </span>
          ) : null}
          {totals.legacy > 0 ? (
            <span className="rounded-full bg-sky-50 px-3 py-2 text-sky-700">
              Akses lama {totals.legacy}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-navy/12 bg-white px-3 py-2 text-xs font-bold text-brand-navy transition-colors hover:border-brand-red/30 hover:text-brand-red disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Memuat" : "Refresh"}
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={filteredRows.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-navy/12 bg-white px-3 py-2 text-xs font-bold text-brand-navy transition-colors hover:border-brand-red/30 hover:text-brand-red disabled:opacity-50"
        >
          <Download size={15} /> Export CSV
        </button>
        <span className="text-xs text-brand-navy/40">
          {lastUpdatedAt ? `Diperbarui ${formatAdminDateTime(lastUpdatedAt)} WIB` : "Belum dimuat"}
        </span>
      </div>

      <div className="relative mt-6">
        <Search
          size={17}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-navy/35"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari nama, email, WhatsApp, atau nomor tagihan"
          className="w-full rounded-xl border border-brand-navy/10 bg-white py-3 pl-10 pr-4 text-sm text-brand-navy outline-none transition focus:border-brand-red/40 focus:ring-2 focus:ring-brand-red/10"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`rounded-full px-3 py-2 text-xs font-bold transition-colors ${
              filter === option.value
                ? "bg-brand-navy text-white"
                : "bg-white text-brand-navy/55 hover:bg-brand-bg hover:text-brand-navy"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-brand-navy/8 bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/45">
            Aktivitas dari
          </span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-brand-navy/12 px-3 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-red/40 focus:ring-2 focus:ring-brand-red/10"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/45">
            Aktivitas sampai
          </span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-brand-navy/12 px-3 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-red/40 focus:ring-2 focus:ring-brand-red/10"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setFromDate("");
            setToDate("");
          }}
          disabled={!fromDate && !toDate}
          className="rounded-lg border border-brand-navy/12 px-3 py-2.5 text-xs font-bold text-brand-navy/65 hover:bg-brand-bg disabled:opacity-40"
        >
          Hapus tanggal
        </button>
      </div>

      {notice ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={18} /> {notice}
        </div>
      ) : null}

      {loading || authLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-brand-red" size={30} />
        </div>
      ) : error ? (
        <div className="mt-6 rounded-xl bg-brand-red-soft px-4 py-3 text-sm text-brand-red">
          {error}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-brand-navy/8 bg-white py-12 text-center">
          <ReceiptText className="mx-auto text-brand-navy/25" size={34} />
          <p className="mt-3 text-sm font-semibold text-brand-navy/50">
            {rows.length === 0 ? "Belum ada peserta terdaftar." : "Peserta tidak ditemukan."}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-3 md:hidden">
            {filteredRows.map((row) => (
              <article
                key={row.user_id}
                className={`rounded-xl border bg-white p-4 ${
                  isWithinLastHours(row.paid_at, 1)
                    ? "border-emerald-300 ring-2 ring-emerald-100"
                    : "border-brand-navy/8"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-brand-navy">{row.full_name}</p>
                    <p className="mt-1 break-all text-xs text-brand-navy/45">{row.email ?? "-"}</p>
                    {row.whatsapp ? (
                      <p className="mt-0.5 text-xs text-brand-navy/45">{row.whatsapp}</p>
                    ) : null}
                    <ProgramInterestControl row={row} onOpen={openProgramEditor} />
                    <p className="mt-0.5 text-xs text-brand-navy/45">
                      Terdaftar {formatAdminDateTime(row.registered_at)}
                    </p>
                  </div>
                  <InvoiceStatus
                    status={row.invoice_status}
                    legacyVerified={hasLegacyPaymentAccess(row)}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-brand-navy/8 pt-3 text-xs">
                  <div>
                    <p className="font-bold uppercase text-brand-navy/40">Tagihan</p>
                    <p className="mt-1 break-all font-mono font-semibold text-brand-navy/70">
                      {row.invoice_number ?? "Belum dibuat"}
                    </p>
                  </div>
                  <div>
                    <p className="font-bold uppercase text-brand-navy/40">Nominal</p>
                    <p className="mt-1 font-bold text-brand-navy">
                      {row.amount ? formatPrice(row.amount) : "-"}
                    </p>
                  </div>
                </div>
                {row.due_date ? (
                  <p className="mt-3 text-xs text-brand-navy/45">
                    Jatuh tempo {formatDate(`${row.due_date}T00:00:00`)}
                  </p>
                ) : null}
                <PaymentTiming row={row} />
                <div className="mt-4 space-y-2">
                  <ReconcilePaymentButton
                    row={row}
                    reconcilingInvoiceId={reconcilingInvoiceId}
                    onReconcile={handleReconcilePayment}
                    fullWidth
                  />
                  <InvoiceActionButton row={row} onOpen={openEditor} fullWidth />
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 hidden overflow-x-auto rounded-xl border border-brand-navy/8 bg-white md:block">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="border-b border-brand-navy/8 bg-brand-bg text-xs uppercase text-brand-navy/45">
                <tr>
                  <th className="px-4 py-3 font-bold">Peserta</th>
                  <th className="px-4 py-3 font-bold">Terdaftar</th>
                  <th className="px-4 py-3 font-bold">Tagihan</th>
                  <th className="px-4 py-3 font-bold">Nominal</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Pembayaran</th>
                  <th className="px-4 py-3 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.user_id}
                    className={`border-b border-brand-navy/5 align-top last:border-0 ${
                      isWithinLastHours(row.paid_at, 1) ? "bg-emerald-50/60" : ""
                    }`}
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold text-brand-navy">{row.full_name}</p>
                      <p className="mt-1 text-xs text-brand-navy/45">{row.email ?? "-"}</p>
                      {row.whatsapp ? (
                        <p className="mt-0.5 text-xs text-brand-navy/45">{row.whatsapp}</p>
                      ) : null}
                      <ProgramInterestControl row={row} onOpen={openProgramEditor} />
                    </td>
                    <td className="px-4 py-4 text-xs text-brand-navy/55">
                      {formatAdminDateTime(row.registered_at)}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-mono text-xs font-semibold text-brand-navy/70">
                        {row.invoice_number ?? "Belum dibuat"}
                      </p>
                      {row.due_date ? (
                        <p className="mt-2 text-xs text-brand-navy/45">
                          Jatuh tempo {formatDate(`${row.due_date}T00:00:00`)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 font-bold text-brand-navy">
                      {row.amount ? formatPrice(row.amount) : "-"}
                    </td>
                    <td className="px-4 py-4">
                      <InvoiceStatus
                        status={row.invoice_status}
                        legacyVerified={hasLegacyPaymentAccess(row)}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <PaymentTiming row={row} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end gap-2">
                        <ReconcilePaymentButton
                          row={row}
                          reconcilingInvoiceId={reconcilingInvoiceId}
                          onReconcile={handleReconcilePayment}
                        />
                        <InvoiceActionButton row={row} onOpen={openEditor} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invoice-dialog-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-brand-red">Tagihan peserta</p>
                <h2
                  id="invoice-dialog-title"
                  className="mt-1 font-display text-xl font-extrabold text-brand-navy"
                >
                  {editing.full_name}
                </h2>
                <p className="mt-1 text-xs text-brand-navy/45">{editing.email}</p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                disabled={saving}
                title="Tutup"
                aria-label="Tutup"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-navy/45 hover:bg-brand-bg hover:text-brand-navy disabled:opacity-40"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-xs font-bold uppercase text-brand-navy/45">Nominal event</span>
                <div className="mt-1.5 flex items-center rounded-lg border border-brand-navy/12 px-3 focus-within:border-brand-red/40 focus-within:ring-2 focus-within:ring-brand-red/10">
                  <span className="text-sm font-bold text-brand-navy/45">Rp</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1000}
                    max={100000000}
                    step={1000}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    aria-describedby="custom-assessment-amount"
                    className="w-full bg-transparent px-2 py-3 text-sm font-bold text-brand-navy outline-none"
                  />
                </div>
                <span id="custom-assessment-amount" className="mt-1.5 block text-xs text-brand-navy/45">
                  Default {formatPrice(DEFAULT_ASSESSMENT_AMOUNT)}. Bisa disesuaikan admin untuk event atau promo tertentu.
                </span>
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase text-brand-navy/45">Deskripsi</span>
                <input
                  type="text"
                  maxLength={120}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-brand-navy/12 px-3 py-3 text-sm text-brand-navy outline-none focus:border-brand-red/40 focus:ring-2 focus:ring-brand-red/10"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase text-brand-navy/45">
                  Jatuh tempo (opsional)
                </span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-brand-navy/12 px-3 py-3 text-sm text-brand-navy outline-none focus:border-brand-red/40 focus:ring-2 focus:ring-brand-red/10"
                />
              </label>

              {formError ? (
                <p className="rounded-lg bg-brand-red-soft px-3 py-2 text-sm text-brand-red">
                  {formError}
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                disabled={saving}
                className="rounded-lg border border-brand-navy/12 px-4 py-2.5 text-sm font-bold text-brand-navy hover:bg-brand-bg disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex min-w-28 items-center justify-center gap-2 rounded-lg bg-brand-red px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-red-hover disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {saving ? "Menyimpan" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {programEditing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="program-dialog-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-brand-red">Data peserta</p>
                <h2
                  id="program-dialog-title"
                  className="mt-1 font-display text-xl font-extrabold text-brand-navy"
                >
                  Ubah program minat
                </h2>
                <p className="mt-2 text-sm font-semibold text-brand-navy">
                  {programEditing.full_name}
                </p>
                <p className="mt-1 text-xs text-brand-navy/45">{programEditing.email}</p>
              </div>
              <button
                type="button"
                onClick={closeProgramEditor}
                disabled={programSaving}
                title="Tutup"
                aria-label="Tutup"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-navy/45 hover:bg-brand-bg hover:text-brand-navy disabled:opacity-40"
              >
                <X size={19} />
              </button>
            </div>

            <label className="mt-6 block">
              <span className="text-xs font-bold uppercase text-brand-navy/45">Program minat</span>
              <select
                value={programInterest}
                onChange={(event) => setProgramInterest(event.target.value)}
                disabled={programSaving}
                className="mt-1.5 w-full rounded-lg border border-brand-navy/12 bg-white px-3 py-3 text-sm text-brand-navy outline-none focus:border-brand-red/40 focus:ring-2 focus:ring-brand-red/10 disabled:opacity-50"
              >
                {PROGRAM_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            {programError ? (
              <p className="mt-4 rounded-lg bg-brand-red-soft px-3 py-2 text-sm text-brand-red">
                {programError}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeProgramEditor}
                disabled={programSaving}
                className="rounded-lg border border-brand-navy/12 px-4 py-2.5 text-sm font-bold text-brand-navy hover:bg-brand-bg disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleProgramSave()}
                disabled={programSaving}
                className="inline-flex min-w-28 items-center justify-center gap-2 rounded-lg bg-brand-red px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-red-hover disabled:opacity-50"
              >
                {programSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {programSaving ? "Menyimpan" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProgramInterestControl({
  row,
  onOpen,
}: {
  row: InvoiceAdminRow;
  onOpen: (row: InvoiceAdminRow) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
      <span className="font-semibold text-brand-navy/65">
        {row.program_interest ?? "Program belum dipilih"}
      </span>
      <button
        type="button"
        onClick={() => onOpen(row)}
        className="inline-flex items-center gap-1 font-bold text-brand-red hover:text-brand-red-hover"
      >
        <Pencil size={12} /> Ubah
      </button>
    </div>
  );
}

function hasLegacyPaymentAccess(row: InvoiceAdminRow) {
  return !row.invoice_id && ["paid", "verified"].includes(row.progress_payment_status);
}

function PaymentTiming({ row }: { row: InvoiceAdminRow }) {
  if (isPaidRow(row)) {
    if (!row.paid_at) {
      return <p className="text-xs font-semibold text-emerald-700">Akses aktif</p>;
    }

    const recent = isWithinLastHours(row.paid_at, 1);
    return (
      <div>
        {recent ? (
          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700">
            Baru saja
          </span>
        ) : (
          <p className="text-xs font-semibold text-emerald-700">Berhasil</p>
        )}
        <p className="mt-1 text-xs text-brand-navy/55">{formatAdminDateTime(row.paid_at)}</p>
      </div>
    );
  }

  if (row.last_payment_status) {
    return (
      <div>
        <p className="text-xs font-semibold text-brand-navy/65">
          {paymentStatusLabel(row.last_payment_status)}
        </p>
        {row.last_payment_at ? (
          <p className="mt-1 text-xs text-brand-navy/45">
            Dibuat {formatAdminDateTime(row.last_payment_at)}
          </p>
        ) : null}
      </div>
    );
  }

  return <p className="text-xs text-brand-navy/45">Belum ada transaksi</p>;
}

function isInvoiceLocked(row: InvoiceAdminRow) {
  return row.invoice_status === "paid" || hasLegacyPaymentAccess(row);
}

function InvoiceActionButton({
  row,
  onOpen,
  fullWidth = false,
}: {
  row: InvoiceAdminRow;
  onOpen: (row: InvoiceAdminRow) => void;
  fullWidth?: boolean;
}) {
  const locked = isInvoiceLocked(row);
  const label = locked ? "Sudah aktif" : row.invoice_id ? "Edit" : "Buat tagihan";

  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      disabled={locked}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-brand-navy/12 px-3 py-2 text-xs font-bold text-brand-navy transition-colors hover:border-brand-red/30 hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-35 ${
        fullWidth ? "mt-4 w-full justify-center py-2.5" : ""
      }`}
    >
      {locked ? <CheckCircle2 size={14} /> : row.invoice_id ? <Pencil size={14} /> : <Plus size={14} />}
      {label}
    </button>
  );
}

function ReconcilePaymentButton({
  row,
  reconcilingInvoiceId,
  onReconcile,
  fullWidth = false,
}: {
  row: InvoiceAdminRow;
  reconcilingInvoiceId: string | null;
  onReconcile: (row: InvoiceAdminRow) => void;
  fullWidth?: boolean;
}) {
  if (!row.invoice_id || isPaidRow(row)) return null;

  const loading = reconcilingInvoiceId === row.invoice_id;
  return (
    <button
      type="button"
      onClick={() => void onReconcile(row)}
      disabled={reconcilingInvoiceId !== null}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 ${
        fullWidth ? "w-full justify-center py-2.5" : ""
      }`}
    >
      <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
      {loading ? "Mengecek Pivot..." : "Cek status Pivot"}
    </button>
  );
}

function InvoiceStatus({
  status,
  legacyVerified,
}: {
  status: InvoiceAdminRow["invoice_status"];
  legacyVerified: boolean;
}) {
  const styles = {
    paid: "bg-emerald-50 text-emerald-700",
    issued: "bg-amber-50 text-amber-700",
    cancelled: "bg-brand-red-soft text-brand-red",
    missing: "bg-brand-bg text-brand-navy/45",
  };
  const key = legacyVerified ? "paid" : status ?? "missing";
  const label = legacyVerified
    ? "Akses aktif"
    : status === "paid"
    ? "Lunas"
    : status === "issued"
      ? "Menunggu"
      : status === "cancelled"
        ? "Dibatalkan"
        : "Belum dibuat";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[key]}`}>
      {label}
    </span>
  );
}

function paymentStatusLabel(status: string) {
  if (status === "settlement") return "berhasil";
  if (status === "pending") return "menunggu";
  if (status === "expire") return "kedaluwarsa";
  if (status === "cancel") return "dibatalkan";
  if (status === "deny") return "gagal";
  return status;
}
