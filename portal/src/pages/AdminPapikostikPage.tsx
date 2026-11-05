import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock3, Loader2, PlayCircle, RefreshCw, Search, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { isAssessmentStaffRole, isPsychologistRole } from "../lib/access";
import { formatAdminDateTime } from "../lib/adminTools";
import { notifyPapikostikCompleted } from "../lib/papiNotifications";

type AdminPapikostikRow = {
  id: string;
  user_id: string;
  total_top: number | null;
  total_bottom: number | null;
  total_all: number | null;
  is_complete_pattern: boolean | null;
  review_status: "pending" | "reviewed";
  completed_at: string;
  reviewed_at: string | null;
  final_review_status?: string | null;
  full_name: string;
  email: string | null;
  whatsapp: string | null;
  city: string | null;
};

type QueueFilter = "all" | "pending" | "reviewed";

export function AdminPapikostikPage() {
  const location = useLocation();
  const { profile, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<AdminPapikostikRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [reopenTarget, setReopenTarget] = useState<AdminPapikostikRow | null>(null);
  const [reopenError, setReopenError] = useState("");
  const [reopening, setReopening] = useState(false);
  const [notice, setNotice] = useState("");
  const isPsychologist = isPsychologistRole(profile?.role);
  const detailBasePath = isPsychologist
    ? "/psychologist/papikostik"
    : "/admin/papikostik";

  const loadRows = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");

    const result = isPsychologist
      ? await supabase.rpc("psychologist_list_review_queue")
      : await supabase.rpc("admin_list_papikostik_results");

    if (result.error) {
      setError(result.error.message);
    } else {
      setRows((result.data as AdminPapikostikRow[]) ?? []);
      setLastUpdatedAt(new Date().toISOString());
      void notifyPapikostikCompleted({ backfill: true });
    }
    if (showLoader) setLoading(false);
  }, [isPsychologist]);

  useEffect(() => {
    if (authLoading || !isAssessmentStaffRole(profile?.role)) return;
    if (isPsychologist) setQueueFilter("pending");
    void loadRows();
  }, [authLoading, isPsychologist, loadRows, profile?.role]);

  useEffect(() => {
    const state = location.state as { notice?: string } | null;
    if (state?.notice) {
      setNotice(state.notice);
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRows(false);
    setRefreshing(false);
  };

  const closeReopen = () => {
    if (reopening) return;
    setReopenTarget(null);
    setReopenError("");
  };

  const handleReopen = async () => {
    if (!reopenTarget) return;
    setReopening(true);
    setReopenError("");

    const { error: reopenErrorResponse } = await supabase.rpc("admin_reopen_papikostik_attempt", {
      p_user_id: reopenTarget.user_id,
    });

    if (reopenErrorResponse) {
      setReopenError(reopenErrorResponse.message);
      setReopening(false);
      return;
    }

    setReopening(false);
    setNotice(`Tes PAPI Kostick untuk ${reopenTarget.full_name} dibuka lagi, jawaban lama dipertahankan.`);
    setReopenTarget(null);
    await loadRows(false);
  };

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows
      .filter((row) => queueFilter === "all" || row.review_status === queueFilter)
      .filter((row) =>
        [row.full_name, row.email, row.whatsapp, row.city]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized)),
      )
      .sort((left, right) => {
        if (left.review_status !== right.review_status) {
          return left.review_status === "pending" ? -1 : 1;
        }
        const leftDate = new Date(
          left.review_status === "reviewed" ? left.reviewed_at ?? left.completed_at : left.completed_at,
        ).getTime();
        const rightDate = new Date(
          right.review_status === "reviewed" ? right.reviewed_at ?? right.completed_at : right.completed_at,
        ).getTime();
        return rightDate - leftDate;
      });
  }, [query, queueFilter, rows]);

  const pendingCount = rows.filter((row) => row.review_status === "pending").length;
  const reviewedCount = rows.filter((row) => row.review_status === "reviewed").length;
  const latestPending = rows
    .filter((row) => row.review_status === "pending")
    .sort((left, right) => new Date(right.completed_at).getTime() - new Date(left.completed_at).getTime())[0];

  if (!authLoading && !isAssessmentStaffRole(profile?.role)) {
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

      <h1 className="font-display text-2xl font-extrabold text-brand-navy">
        Hasil PAPI Kostick peserta
      </h1>
      <p className="mt-1 text-sm text-brand-navy/50">
        {isPsychologist
          ? "Prioritaskan peserta yang menunggu pembacaan PAPI Kostick, lalu simpan interpretasi untuk diteruskan ke QC admin."
          : "Daftar skor faktor dan status review psikolog/admin. Gunakan filter untuk memantau antrean kerja."}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <QueueStat icon={<Clock3 size={18} />} label="Menunggu review" value={pendingCount} tone="amber" />
        <QueueStat icon={<CheckCircle2 size={18} />} label="Sudah direview" value={reviewedCount} tone="green" />
        <QueueStat
          icon={<Clock3 size={18} />}
          label="Peserta pending terakhir"
          value={latestPending ? formatAdminDateTime(latestPending.completed_at) : "-"}
          tone="blue"
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-brand-navy/8 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {([
            ["pending", "Menunggu review", pendingCount],
            ["reviewed", "Sudah direview", reviewedCount],
            ["all", "Semua", rows.length],
          ] as const).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setQueueFilter(value)}
              className={`rounded-full px-3 py-2 text-xs font-bold transition-colors ${
                queueFilter === value
                  ? "bg-brand-red text-white"
                  : "bg-brand-bg text-brand-navy/60 hover:bg-brand-red-soft hover:text-brand-red"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-navy/35"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari peserta..."
              className="w-full rounded-xl border border-brand-navy/12 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-red/40 sm:w-56"
            />
          </label>
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
      {lastUpdatedAt ? (
        <p className="mt-2 text-right text-xs text-brand-navy/40">
          Data diperbarui {formatAdminDateTime(lastUpdatedAt)} WIB
        </p>
      ) : null}

      {notice ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={18} /> {notice}
        </div>
      ) : null}

      {loading || authLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-red border-t-transparent" />
        </div>
      ) : error ? (
        <div className="mt-6 space-y-2">
          <p className="text-sm text-brand-red">{error}</p>
          <p className="text-xs text-brand-navy/50">
            Jika error fungsi tidak ditemukan, jalankan migration PAPI Kostick terbaru di Supabase
            SQL Editor.
          </p>
        </div>
      ) : filteredRows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-brand-navy/12 bg-white p-8 text-center text-sm text-brand-navy/50">
          {rows.length === 0
            ? "Belum ada hasil PAPI Kostick."
            : isPsychologist && queueFilter === "pending"
              ? "Belum ada peserta yang menunggu review."
              : "Tidak ada peserta yang cocok dengan filter ini."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-brand-navy/8 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-brand-navy/8 bg-brand-bg text-xs uppercase tracking-wide text-brand-navy/45">
              <tr>
                <th className="px-4 py-3 font-bold">Peserta</th>
                <th className="px-4 py-3 font-bold">Total</th>
                <th className="px-4 py-3 font-bold">Validasi</th>
                <th className="px-4 py-3 font-bold">Review</th>
                <th className="px-4 py-3 font-bold">Selesai</th>
                <th className="px-4 py-3 font-bold" />
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-brand-navy/5 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-brand-navy">{row.full_name || "-"}</p>
                    <p className="text-xs text-brand-navy/45">
                      {row.email ?? "-"}
                      {row.whatsapp ? ` · ${row.whatsapp}` : ""}
                      {row.city ? ` · ${row.city}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-bold text-brand-navy">
                    {row.total_all ?? 0}/90
                    <p className="text-xs font-normal text-brand-navy/45">
                      Atas {row.total_top ?? 0} · Bawah {row.total_bottom ?? 0}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          row.is_complete_pattern
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {row.is_complete_pattern ? "Lengkap" : "Cek jawaban"}
                      </span>
                      {!row.is_complete_pattern && !isPsychologist ? (
                        <button
                          type="button"
                          onClick={() => {
                            setReopenTarget(row);
                            setReopenError("");
                          }}
                          title="Waktu habis sebelum semua soal terjawab"
                          className="inline-flex items-center gap-1 rounded-full border border-brand-navy/12 px-2.5 py-1 text-[11px] font-bold text-brand-navy/65 hover:border-brand-red/40 hover:text-brand-red"
                        >
                          <PlayCircle size={12} /> Lanjutkan tes
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        row.review_status === "reviewed"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {row.review_status === "reviewed" ? "Sudah direview" : "Menunggu review"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-navy/50">
                    <div>{formatAdminDateTime(row.completed_at)}</div>
                    {row.review_status === "reviewed" && row.reviewed_at ? (
                      <div className="mt-1 text-[11px] text-emerald-700/70">
                        Direview {formatAdminDateTime(row.reviewed_at)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`${detailBasePath}/${row.user_id}`}
                      className="text-xs font-bold text-brand-red hover:underline"
                    >
                      {isPsychologist && row.review_status === "pending" ? "Mulai review" : "Detail"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reopenTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reopen-dialog-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-brand-red">Lanjutkan tes</p>
                <h2 id="reopen-dialog-title" className="mt-1 font-display text-xl font-extrabold text-brand-navy">
                  PAPI Kostick
                </h2>
                <p className="mt-1 text-sm text-brand-navy/60">{reopenTarget.full_name}</p>
              </div>
              <button
                type="button"
                onClick={closeReopen}
                disabled={reopening}
                title="Tutup"
                aria-label="Tutup"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-navy/45 hover:bg-brand-bg hover:text-brand-navy disabled:opacity-40"
              >
                <X size={19} />
              </button>
            </div>

            <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              Waktu habis sebelum peserta ini selesai. Jawaban yang sudah diisi tetap dipertahankan.
              Peserta bisa lanjut mengerjakan sisa soal kapan saja setelah ini — hitungan waktu baru
              mulai jalan saat dia benar-benar membuka soalnya lagi, bukan dari sekarang. Hasil lama
              yang belum lengkap akan dihapus supaya hasil barunya tersimpan bersih.
            </p>

            {reopenError ? (
              <p className="mt-3 rounded-lg bg-brand-red-soft px-3 py-2 text-sm text-brand-red">
                {reopenError}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeReopen}
                disabled={reopening}
                className="rounded-lg border border-brand-navy/12 px-4 py-2.5 text-sm font-bold text-brand-navy hover:bg-brand-bg disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleReopen()}
                disabled={reopening}
                className="inline-flex min-w-28 items-center justify-center gap-2 rounded-lg bg-brand-red px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-red-hover disabled:opacity-50"
              >
                {reopening ? <Loader2 className="animate-spin" size={16} /> : <PlayCircle size={16} />}
                {reopening ? "Memproses..." : "Lanjutkan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QueueStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  tone: "amber" | "green" | "blue";
}) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
  }[tone];

  return (
    <div className="rounded-2xl border border-brand-navy/8 bg-white p-4">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}>{icon}</div>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-navy/45">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-brand-navy">{value}</p>
    </div>
  );
}
