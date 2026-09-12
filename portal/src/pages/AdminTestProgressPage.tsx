import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, PlayCircle, RefreshCw, RotateCcw, Search, X } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { formatAdminDateTime } from "../lib/adminTools";
import type { Database } from "../lib/database.types";
import { supabase } from "../lib/supabase";

type ProgressRow =
  Database["public"]["Functions"]["admin_list_participant_test_progress"]["Returns"][number];
type AssessmentType = "pimsleur" | "cfit" | "papikostik";
type TestStatus = "locked" | "available" | "in_progress" | "completed";
type ActionKind = "reset" | "continue";

const TEST_COLUMNS: Array<{ type: AssessmentType; label: string; statusKey: keyof ProgressRow }> = [
  { type: "pimsleur", label: "Pimsleur", statusKey: "language_test_status" },
  { type: "cfit", label: "CFIT", statusKey: "cfit_test_status" },
  { type: "papikostik", label: "PAPI Kostick", statusKey: "papikostik_test_status" },
];

export function AdminTestProgressPage() {
  const { profile, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<
    { row: ProgressRow; type: AssessmentType; label: string; action: ActionKind } | null
  >(null);
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadRows = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");

    const { data, error: responseError } = await supabase.rpc(
      "admin_list_participant_test_progress",
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

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) =>
      [row.full_name, row.email, row.whatsapp, row.city]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [query, rows]);

  const inProgressCount = rows.filter((row) =>
    TEST_COLUMNS.some((column) => row[column.statusKey] === "in_progress"),
  ).length;

  const openAction = (row: ProgressRow, type: AssessmentType, label: string, action: ActionKind) => {
    setActionTarget({ row, type, label, action });
    setActionError("");
  };

  const closeAction = () => {
    if (submitting) return;
    setActionTarget(null);
    setActionError("");
  };

  const handleConfirm = async () => {
    if (!actionTarget) return;
    setSubmitting(true);
    setActionError("");

    const { error: actionErrorResponse } =
      actionTarget.action === "continue"
        ? await supabase.rpc("admin_reopen_papikostik_attempt", {
            p_user_id: actionTarget.row.user_id,
          })
        : await supabase.rpc("admin_reset_assessment_attempt", {
            p_user_id: actionTarget.row.user_id,
            p_assessment_type: actionTarget.type,
          });

    if (actionErrorResponse) {
      setActionError(actionErrorResponse.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setNotice(
      actionTarget.action === "continue"
        ? `Tes ${actionTarget.label} untuk ${actionTarget.row.full_name} dibuka lagi, jawaban lama dipertahankan.`
        : `Tes ${actionTarget.label} untuk ${actionTarget.row.full_name} berhasil direset.`,
    );
    setActionTarget(null);
    await loadRows(false);
  };

  if (!authLoading && profile?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        to="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-brand-navy/50 hover:text-brand-red"
      >
        <ArrowLeft size={16} /> Panel admin
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-red">
            Progress tes
          </p>
          <h1 className="font-display text-2xl font-extrabold text-brand-navy">
            Progress tes peserta
          </h1>
          <p className="mt-1 text-sm text-brand-navy/50">
            Pantau status 3 tes tiap peserta. Reset tes yang macet di tengah jalan, atau lanjutkan
            PAPI Kostick yang auto-submit karena waktu habis.
          </p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
          Sedang mengerjakan {inProgressCount}
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-brand-navy/8 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <label className="relative block">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-navy/35"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari peserta..."
            className="w-full rounded-xl border border-brand-navy/12 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-red/40 sm:w-64"
          />
        </label>
        <div className="flex items-center gap-2">
          {lastUpdatedAt ? (
            <span className="text-xs text-brand-navy/40">
              Diperbarui {formatAdminDateTime(lastUpdatedAt)} WIB
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-navy/12 px-3 py-2.5 text-xs font-bold text-brand-navy hover:border-brand-red/40 hover:text-brand-red disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
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
        <p className="mt-6 rounded-2xl border border-dashed border-brand-navy/12 bg-white p-8 text-center text-sm text-brand-navy/50">
          {rows.length === 0 ? "Belum ada peserta terdaftar." : "Tidak ada peserta yang cocok."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-brand-navy/8 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-brand-navy/8 bg-brand-bg text-xs uppercase tracking-wide text-brand-navy/45">
              <tr>
                <th className="px-4 py-3 font-bold">Peserta</th>
                {TEST_COLUMNS.map((column) => (
                  <th key={column.type} className="px-4 py-3 font-bold">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.user_id} className="border-b border-brand-navy/5 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-brand-navy">{row.full_name || "-"}</p>
                    <p className="text-xs text-brand-navy/45">
                      {row.email ?? "-"}
                      {row.whatsapp ? ` · ${row.whatsapp}` : ""}
                    </p>
                  </td>
                  {TEST_COLUMNS.map((column) => {
                    const status = row[column.statusKey] as TestStatus;
                    const showContinue =
                      column.type === "papikostik" &&
                      status === "completed" &&
                      row.papikostik_is_complete_pattern === false;
                    return (
                      <td key={column.type} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={status} />
                          {status === "in_progress" ? (
                            <button
                              type="button"
                              onClick={() => openAction(row, column.type, column.label, "reset")}
                              className="inline-flex items-center gap-1 rounded-full border border-brand-navy/12 px-2.5 py-1 text-[11px] font-bold text-brand-navy/65 hover:border-brand-red/40 hover:text-brand-red"
                            >
                              <RotateCcw size={12} /> Reset
                            </button>
                          ) : null}
                          {showContinue ? (
                            <button
                              type="button"
                              onClick={() => openAction(row, column.type, column.label, "continue")}
                              className="inline-flex items-center gap-1 rounded-full border border-brand-navy/12 px-2.5 py-1 text-[11px] font-bold text-brand-navy/65 hover:border-brand-red/40 hover:text-brand-red"
                              title="Waktu habis sebelum semua soal terjawab"
                            >
                              <PlayCircle size={12} /> Lanjutkan tes
                            </button>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {actionTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="action-dialog-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-brand-red">
                  {actionTarget.action === "continue" ? "Lanjutkan tes" : "Reset tes"}
                </p>
                <h2 id="action-dialog-title" className="mt-1 font-display text-xl font-extrabold text-brand-navy">
                  {actionTarget.label}
                </h2>
                <p className="mt-1 text-sm text-brand-navy/60">{actionTarget.row.full_name}</p>
              </div>
              <button
                type="button"
                onClick={closeAction}
                disabled={submitting}
                title="Tutup"
                aria-label="Tutup"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-navy/45 hover:bg-brand-bg hover:text-brand-navy disabled:opacity-40"
              >
                <X size={19} />
              </button>
            </div>

            <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              {actionTarget.action === "continue"
                ? "Waktu habis sebelum peserta ini selesai. Jawaban yang sudah diisi tetap dipertahankan. Peserta bisa lanjut mengerjakan sisa soal kapan saja setelah ini — hitungan waktu baru baru mulai jalan saat dia benar-benar membuka soalnya lagi, bukan dari sekarang. Hasil lama yang belum lengkap akan dihapus supaya hasil barunya tersimpan bersih."
                : `Jawaban yang sudah diisi peserta ini untuk tes ${actionTarget.label} akan dihapus, dan peserta bisa mengerjakan tes ini dari awal dengan waktu baru.`}
            </p>

            {actionError ? (
              <p className="mt-3 rounded-lg bg-brand-red-soft px-3 py-2 text-sm text-brand-red">
                {actionError}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeAction}
                disabled={submitting}
                className="rounded-lg border border-brand-navy/12 px-4 py-2.5 text-sm font-bold text-brand-navy hover:bg-brand-bg disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={submitting}
                className="inline-flex min-w-28 items-center justify-center gap-2 rounded-lg bg-brand-red px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-red-hover disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : actionTarget.action === "continue" ? (
                  <PlayCircle size={16} />
                ) : (
                  <RotateCcw size={16} />
                )}
                {submitting
                  ? "Memproses..."
                  : actionTarget.action === "continue"
                    ? "Lanjutkan"
                    : "Reset"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: TestStatus }) {
  const styles: Record<TestStatus, string> = {
    locked: "bg-brand-bg text-brand-navy/40",
    available: "bg-sky-50 text-sky-700",
    in_progress: "bg-amber-50 text-amber-700",
    completed: "bg-emerald-50 text-emerald-700",
  };
  const labels: Record<TestStatus, string> = {
    locked: "Terkunci",
    available: "Bisa dimulai",
    in_progress: "Sedang dikerjakan",
    completed: "Selesai",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
