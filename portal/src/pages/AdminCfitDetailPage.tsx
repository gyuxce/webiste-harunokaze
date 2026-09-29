import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  CFIT_ANSWER_KEYS,
  CFIT_SUBTESTS,
  CFIT_TOTAL_QUESTIONS,
  type CfitAnswerValue,
} from "../data/cfitQuestions";
import { calculateCfitIq, calculateCfitIqFromNorm } from "../data/cfitScoring";
import { supabase } from "../lib/supabase";
import { isAssessmentStaffRole, isPsychologistRole } from "../lib/access";
import { birthDateRangeMessage, getBirthDateInputBounds, isBirthDateInRange } from "../lib/birthDate";
import type { Json } from "../lib/database.types";

const birthDateBounds = getBirthDateInputBounds();

type CfitDetail = {
  id: string;
  user_id: string;
  answers: Json;
  raw_subtest1: number | null;
  raw_subtest2: number | null;
  raw_subtest3: number | null;
  raw_subtest4: number | null;
  raw_total: number | null;
  iq: number | null;
  category: string | null;
  age_years: number | null;
  age_months: number | null;
  norm_code: string | null;
  duration_seconds: number | null;
  completed_at: string;
  full_name: string;
  email: string | null;
  whatsapp: string | null;
  city: string | null;
  birth_date: string | null;
};

export function AdminCfitDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { profile, loading: authLoading } = useAuth();
  const [row, setRow] = useState<CfitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [correctedBirthDate, setCorrectedBirthDate] = useState("");
  const [recomputing, setRecomputing] = useState(false);
  const [recomputeError, setRecomputeError] = useState("");
  const [recomputeMessage, setRecomputeMessage] = useState("");
  const listPath = isPsychologistRole(profile?.role) ? "/psychologist/cfit" : "/admin/cfit";
  const canCorrectBirthDate = profile?.role === "admin";

  useEffect(() => {
    if (!userId || authLoading || !isAssessmentStaffRole(profile?.role)) return;

    async function load() {
      const { data, error: qError } = await supabase.rpc("admin_get_cfit_detail", {
        p_user_id: userId!,
      });

      if (qError) {
        setError(qError.message);
        setLoading(false);
        return;
      }

      const first = Array.isArray(data) ? data[0] : data;
      setRow((first as CfitDetail) ?? null);
      setCorrectedBirthDate((first as CfitDetail | undefined)?.birth_date ?? "");
      setLoading(false);
    }

    void load();
  }, [userId, authLoading, profile?.role]);

  async function correctBirthDateAndRecompute() {
    if (!row) return;
    setRecomputeError("");
    setRecomputeMessage("");

    if (!correctedBirthDate) {
      setRecomputeError("Isi tanggal lahir yang benar terlebih dahulu.");
      return;
    }
    if (!isBirthDateInRange(correctedBirthDate)) {
      setRecomputeError(birthDateRangeMessage());
      return;
    }

    setRecomputing(true);
    try {
      const { error: birthDateError } = await supabase.rpc("admin_update_participant_birth_date", {
        p_user_id: row.user_id,
        p_birth_date: correctedBirthDate,
      });
      if (birthDateError) throw new Error(birthDateError.message);

      const recomputed = calculateCfitIq(row.raw_total, correctedBirthDate, new Date(row.completed_at));
      if (recomputed.iq === null || !recomputed.normCode) {
        throw new Error(
          "Tanggal lahir baru masih menghasilkan usia di luar cakupan norma CFIT 3A (13-17+ tahun).",
        );
      }

      const { data, error: recomputeErr } = await supabase.rpc("admin_recompute_cfit_result", {
        p_user_id: row.user_id,
        p_iq: recomputed.iq,
        p_category: recomputed.category ?? "",
        p_norm_code: recomputed.normCode,
        p_age_years: recomputed.ageYears ?? 0,
        p_age_months: recomputed.ageMonths ?? 0,
      });
      if (recomputeErr) throw new Error(recomputeErr.message);

      const updated = Array.isArray(data) ? data[0] : data;
      setRow({
        ...row,
        birth_date: correctedBirthDate,
        iq: updated?.iq ?? recomputed.iq,
        category: updated?.category ?? recomputed.category,
        norm_code: updated?.norm_code ?? recomputed.normCode,
        age_years: updated?.age_years ?? recomputed.ageYears,
        age_months: updated?.age_months ?? recomputed.ageMonths,
      });
      setRecomputeMessage("Tanggal lahir dikoreksi dan IQ berhasil dihitung ulang.");
    } catch (recomputeException) {
      setRecomputeError(
        recomputeException instanceof Error ? recomputeException.message : "Gagal menghitung ulang IQ.",
      );
    } finally {
      setRecomputing(false);
    }
  }

  const answers = useMemo(
    () => ((row?.answers ?? {}) as Record<string, CfitAnswerValue>),
    [row?.answers],
  );
  const fallback = row ? calculateCfitIqFromNorm(row.raw_total, row.norm_code) : null;
  const displayIq = row?.iq ?? fallback?.iq ?? null;
  const displayCategory = row?.category ?? fallback?.category ?? null;

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

  if (error || !row) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <p className="text-sm text-brand-red">{error || "Hasil CFIT tidak ditemukan."}</p>
        <Link to={listPath} className="mt-4 inline-block text-sm font-semibold text-brand-red">
          Kembali
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to={listPath}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-brand-navy/50 hover:text-brand-red"
      >
        <ArrowLeft size={16} /> Daftar hasil CFIT
      </Link>

      <div>
        <h1 className="font-display text-2xl font-extrabold text-brand-navy">
          {row.full_name || "Peserta"}
        </h1>
        <p className="mt-1 text-sm text-brand-navy/50">
          {row.email ? `${row.email} · ` : ""}
          {row.whatsapp ? `${row.whatsapp} · ` : ""}
          Selesai {new Date(row.completed_at).toLocaleString("id-ID")}
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Raw Total" value={`${row.raw_total ?? 0}/${CFIT_TOTAL_QUESTIONS}`} />
        <Stat label="IQ" value={String(displayIq ?? "-")} />
        <Stat label="Norma" value={row.norm_code ?? "-"} />
        <Stat label="Usia" value={formatAge(row.age_years, row.age_months)} />
      </div>

      <p className="mt-4 rounded-xl bg-brand-bg p-4 text-sm font-semibold text-brand-navy/75">
        {displayCategory ?? "Kategori belum tersedia"}
      </p>

      {row.raw_total !== null && displayIq === null && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">
            IQ tidak bisa dihitung meski raw score ada. Ini biasanya karena tanggal lahir peserta salah
            (usia di luar 13–17+ tahun yang dicakup norma CFIT 3A: {row.birth_date ?? "-"}).
          </p>

          {canCorrectBirthDate ? (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wide text-amber-700/80">
                  Tanggal lahir yang benar
                </span>
                <input
                  type="date"
                  min={birthDateBounds.min}
                  max={birthDateBounds.max}
                  value={correctedBirthDate}
                  onChange={(e) => setCorrectedBirthDate(e.target.value)}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                />
              </label>
              <button
                type="button"
                onClick={() => void correctBirthDateAndRecompute()}
                disabled={recomputing}
                className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {recomputing ? "Menghitung ulang..." : "Koreksi & hitung ulang IQ"}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-amber-700/80">Hanya admin yang bisa mengoreksi tanggal lahir.</p>
          )}

          {recomputeError ? <p className="mt-2 text-xs font-semibold text-red-700">{recomputeError}</p> : null}
          {recomputeMessage ? (
            <p className="mt-2 text-xs font-semibold text-emerald-700">{recomputeMessage}</p>
          ) : null}
        </div>
      )}

      <div className="mt-8 space-y-8">
        {CFIT_SUBTESTS.map((subtest) => (
          <section key={subtest.id}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-brand-navy">{subtest.title}</h2>
                <p className="text-xs text-brand-navy/45">{subtest.instruction}</p>
              </div>
              <span className="rounded-full bg-brand-red-soft px-3 py-1 text-xs font-bold text-brand-red">
                Skor {getSubtestScore(row, subtest.id)}/{subtest.questions.length}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {subtest.questions.map((question) => {
                const actual = answers[question.id];
                const expected = CFIT_ANSWER_KEYS[question.id];
                const correct = normalizeAnswer(actual) === normalizeAnswer(expected);

                return (
                  <div
                    key={question.id}
                    className="rounded-2xl border border-brand-navy/8 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-bold text-brand-navy">Soal {question.number}</p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          correct ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {correct ? "Benar" : "Salah"}
                      </span>
                    </div>
                    <img
                      src={question.imageSrc}
                      alt={`CFIT subtes ${question.subtest} soal ${question.number}`}
                      className="mt-3 max-h-44 w-full object-contain"
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <AnswerBox label="Jawaban peserta" value={formatAnswer(actual)} />
                      <AnswerBox label="Kunci" value={formatAnswer(expected)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function getSubtestScore(row: CfitDetail, subtestId: number) {
  if (subtestId === 1) return row.raw_subtest1 ?? 0;
  if (subtestId === 2) return row.raw_subtest2 ?? 0;
  if (subtestId === 3) return row.raw_subtest3 ?? 0;
  return row.raw_subtest4 ?? 0;
}

function normalizeAnswer(value: CfitAnswerValue | undefined) {
  if (Array.isArray(value)) return [...value].map((item) => item.toUpperCase()).sort().join("|");
  return value?.toUpperCase() ?? "";
}

function formatAnswer(value: CfitAnswerValue | undefined) {
  if (Array.isArray(value)) return value.join(", ");
  return value ?? "-";
}

function formatAge(years: number | null, months: number | null) {
  if (years === null) return "-";
  return `${years} th ${months ?? 0} bln`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-navy/8 bg-white p-4 text-center">
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-navy/40">{label}</p>
      <p className="mt-1 font-display text-xl font-extrabold text-brand-navy">{value}</p>
    </div>
  );
}

function AnswerBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-brand-bg px-3 py-2">
      <p className="font-bold uppercase tracking-wide text-brand-navy/40">{label}</p>
      <p className="mt-1 text-sm font-bold text-brand-navy">{value}</p>
    </div>
  );
}
