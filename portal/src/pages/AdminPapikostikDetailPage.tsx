import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Pencil, PlayCircle, Save, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { isAssessmentStaffRole, isPsychologistRole } from "../lib/access";
import {
  PAPI_FACTORS,
  PAPI_QUESTIONS,
  getPapiAnalysis,
  type PapiAnswers,
  type PapiChoice,
  type PapiFactorCode,
} from "../data/papikostikQuestions";
import { supabase } from "../lib/supabase";
import type { Json } from "../lib/database.types";
import { PapiProfileChart } from "../components/PapiProfileChart";
import { formatAdminDateTime } from "../lib/adminTools";

type PapikostikDetail = {
  id: string;
  user_id: string;
  answers: Json;
  scores: Json;
  analyses: Json;
  total_top: number | null;
  total_bottom: number | null;
  total_all: number | null;
  is_complete_pattern: boolean | null;
  review_status: "pending" | "reviewed";
  psychologist_notes: string | null;
  final_summary: string | null;
  duration_seconds: number | null;
  completed_at: string;
  reviewed_at: string | null;
  full_name: string;
  email: string | null;
  whatsapp: string | null;
  city: string | null;
};

const ASPECTS = ["Arah kerja", "Kepemimpinan", "Aktivitas", "Pergaulan", "Gaya kerja", "Sifat", "Ketaatan"];

export function AdminPapikostikDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [row, setRow] = useState<PapikostikDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenError, setReopenError] = useState("");
  const [reopening, setReopening] = useState(false);
  const isAdmin = profile?.role === "admin";
  const listPath = isPsychologistRole(profile?.role)
    ? "/psychologist/papikostik"
    : "/admin/papikostik";

  useEffect(() => {
    if (!userId || authLoading || !isAssessmentStaffRole(profile?.role)) return;

    async function load() {
      const { data, error: qError } = await supabase.rpc("admin_get_papikostik_detail", {
        p_user_id: userId!,
      });

      if (qError) {
        setError(qError.message);
        setLoading(false);
        return;
      }

      const first = Array.isArray(data) ? data[0] : data;
      const detail = (first as PapikostikDetail) ?? null;
      setRow(detail);
      setNotes(detail?.psychologist_notes ?? "");
      setEditingNotes(!detail?.psychologist_notes?.trim());
      setLoading(false);
    }

    void load();
  }, [userId, authLoading, profile?.role]);

  const answers = useMemo(() => ((row?.answers ?? {}) as PapiAnswers), [row?.answers]);
  const scores = useMemo(
    () => ((row?.scores ?? {}) as Partial<Record<PapiFactorCode, number>>),
    [row?.scores],
  );

  async function saveReview() {
    if (!row) return;
    const cleanNotes = notes.trim();
    if (!cleanNotes) {
      setError("Isi interpretasi psikolog terlebih dahulu sebelum menyimpan review.");
      return;
    }

    setSaving(true);
    setError("");
    setSaveMessage("");

    const { data, error: updateError } = await supabase.rpc(
      "psychologist_save_papikostik_review",
      {
        p_user_id: row.user_id,
        p_notes: cleanNotes,
      },
    );

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    const saved = data?.[0];
    const reviewedAt = saved?.reviewed_at ?? new Date().toISOString();

    setRow({
      ...row,
      review_status: "reviewed",
      psychologist_notes: cleanNotes,
      reviewed_at: reviewedAt,
    });
    setNotes(cleanNotes);
    setEditingNotes(false);
    setSaveMessage(
      isPsychologistRole(profile?.role)
        ? "Interpretasi psikolog berhasil disimpan. Hasil menunggu QC admin."
        : "Interpretasi psikolog berhasil disimpan. Lanjutkan ke Review final untuk QC dan persetujuan admin.",
    );
    setSaving(false);
  }

  function startEditingNotes() {
    setEditingNotes(true);
    setError("");
    setSaveMessage("");
  }

  function cancelEditingNotes() {
    setNotes(row?.psychologist_notes ?? "");
    setEditingNotes(false);
    setError("");
    setSaveMessage("");
  }

  async function handleReopen() {
    if (!row) return;
    setReopening(true);
    setReopenError("");

    const { error: reopenErrorResponse } = await supabase.rpc("admin_reopen_papikostik_attempt", {
      p_user_id: row.user_id,
    });

    if (reopenErrorResponse) {
      setReopenError(reopenErrorResponse.message);
      setReopening(false);
      return;
    }

    navigate(listPath, {
      replace: true,
      state: { notice: `Tes PAPI Kostick untuk ${row.full_name} dibuka lagi, jawaban lama dipertahankan.` },
    });
  }

  if (!authLoading && !isAssessmentStaffRole(profile?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading || authLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-red border-t-transparent" />
      </div>
    );
  }

  if (error && !row) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <p className="text-sm text-brand-red">{error}</p>
        <Link to={listPath} className="mt-4 inline-block text-sm font-semibold text-brand-red">
          Kembali
        </Link>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <p className="text-sm text-brand-red">Hasil PAPI Kostick tidak ditemukan.</p>
        <Link to={listPath} className="mt-4 inline-block text-sm font-semibold text-brand-red">
          Kembali
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        to={listPath}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-brand-navy/50 hover:text-brand-red"
      >
        <ArrowLeft size={16} /> Daftar hasil PAPI
      </Link>

      <div>
        <h1 className="font-display text-2xl font-extrabold text-brand-navy">
          {row.full_name || "Peserta"}
        </h1>
        <p className="mt-1 text-sm text-brand-navy/50">
          {row.email ? `${row.email} · ` : ""}
          {row.whatsapp ? `${row.whatsapp} · ` : ""}
          Selesai {formatAdminDateTime(row.completed_at)} WIB
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-5">
        <Stat label="Total" value={`${row.total_all ?? 0}/90`} />
        <Stat label="Atas" value={String(row.total_top ?? 0)} />
        <Stat label="Bawah" value={String(row.total_bottom ?? 0)} />
        <Stat label="Durasi" value={formatDuration(row.duration_seconds)} />
        <Stat label="Review" value={row.review_status === "reviewed" ? "Reviewed" : "Pending"} />
      </div>

      {!row.is_complete_pattern ? (
        <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">
            Pola total tidak 45/45. Biasanya karena waktu habis sebelum peserta menjawab semua
            soal, bukan error data.
          </p>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => {
                setReopenOpen(true);
                setReopenError("");
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
            >
              <PlayCircle size={14} /> Lanjutkan tes
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8">
        <PapiProfileChart scores={scores} />
      </div>

      <div className="mt-8 space-y-6">
        {ASPECTS.map((aspect) => (
          <section key={aspect}>
            <h2 className="mb-3 font-display text-lg font-bold text-brand-navy">{aspect}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {PAPI_FACTORS.filter((factor) => factor.aspect === aspect).map((factor) => {
                const score = scores[factor.code] ?? 0;
                return (
                  <div key={factor.code} className="rounded-2xl border border-brand-navy/8 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-brand-red">
                          {factor.code}
                        </p>
                        <p className="mt-1 text-sm font-bold text-brand-navy">{factor.name}</p>
                      </div>
                      <span className="rounded-full bg-brand-red-soft px-3 py-1 text-sm font-extrabold text-brand-red">
                        {score}/9
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-brand-navy/60">
                      {getPapiAnalysis(factor.code, score)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border border-brand-navy/8 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-brand-navy">Review psikolog/admin</h2>
            <p className="mt-1 text-sm text-brand-navy/50">
              {editingNotes ? "Mode edit interpretasi" : "Mode baca interpretasi tersimpan"}
            </p>
          </div>
          {!editingNotes ? (
            <button
              type="button"
              onClick={startEditingNotes}
              className="inline-flex items-center gap-2 rounded-xl border border-brand-navy/15 px-4 py-2.5 text-sm font-bold text-brand-navy hover:border-brand-red/40 hover:text-brand-red"
            >
              <Pencil size={16} /> Edit interpretasi
            </button>
          ) : null}
        </div>

        <div className="mt-4">
          <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/45">
            Interpretasi psikolog
          </span>
          {editingNotes ? (
            <>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={8}
                autoFocus
                className="mt-1.5 w-full rounded-xl border border-brand-navy/12 px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                placeholder="Catatan detail untuk pembacaan psikolog/admin"
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void saveReview()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-red px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  <Save size={18} />
                  {saving ? "Menyimpan..." : "Simpan interpretasi"}
                </button>
                <button
                  type="button"
                  onClick={cancelEditingNotes}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl border border-brand-navy/15 px-5 py-3 text-sm font-bold text-brand-navy disabled:opacity-50"
                >
                  <X size={18} /> Batal
                </button>
              </div>
            </>
          ) : (
            <div className="mt-1.5 rounded-xl border border-brand-navy/8 bg-brand-bg/60 px-4 py-4">
              {notes.trim() ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-navy/75">{notes}</p>
              ) : (
                <p className="text-sm italic text-brand-navy/45">
                  Belum ada interpretasi psikolog yang disimpan.
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-brand-navy/8 pt-3 text-xs text-brand-navy/45">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 size={14} className={row.review_status === "reviewed" ? "text-emerald-600" : "text-brand-navy/35"} />
                  {row.review_status === "reviewed" ? "Review tersimpan" : "Belum direview"}
                </span>
                {row.reviewed_at ? (
                  <span>Terakhir disimpan {formatAdminDateTime(row.reviewed_at)} WIB</span>
                ) : null}
              </div>
            </div>
          )}
        </div>
        {error ? <p className="mt-4 text-sm text-brand-red">{error}</p> : null}
        {saveMessage ? <p className="mt-4 text-sm text-emerald-700">{saveMessage}</p> : null}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-bold text-brand-navy">Detail jawaban</h2>
        <div className="overflow-x-auto rounded-2xl border border-brand-navy/8 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-brand-navy/8 bg-brand-bg text-xs uppercase tracking-wide text-brand-navy/45">
              <tr>
                <th className="px-4 py-3 font-bold">No</th>
                <th className="px-4 py-3 font-bold">Pilihan</th>
                <th className="px-4 py-3 font-bold">Faktor</th>
                <th className="px-4 py-3 font-bold">Pernyataan dipilih</th>
              </tr>
            </thead>
            <tbody>
              {PAPI_QUESTIONS.map((question) => {
                const choice = answers[question.id] as PapiChoice | undefined;
                return (
                  <tr key={question.id} className="border-b border-brand-navy/5 last:border-0">
                    <td className="px-4 py-3 font-bold text-brand-navy">{question.number}</td>
                    <td className="px-4 py-3 text-brand-navy">{choice ?? "-"}</td>
                    <td className="px-4 py-3 text-brand-navy">
                      {choice === "A" ? question.factorA : choice === "B" ? question.factorB : "-"}
                    </td>
                    <td className="px-4 py-3 text-brand-navy/65">
                      {choice === "A" ? question.optionA : choice === "B" ? question.optionB : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {reopenOpen ? (
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
                <p className="mt-1 text-sm text-brand-navy/60">{row.full_name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (reopening) return;
                  setReopenOpen(false);
                  setReopenError("");
                }}
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
                onClick={() => {
                  setReopenOpen(false);
                  setReopenError("");
                }}
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

function formatDuration(seconds: number | null) {
  if (seconds === null) return "-";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-navy/8 bg-white p-4 text-center">
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-navy/40">{label}</p>
      <p className="mt-1 font-display text-lg font-extrabold text-brand-navy">{value}</p>
    </div>
  );
}
