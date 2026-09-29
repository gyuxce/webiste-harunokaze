import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, FileCheck } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  CFIT_GENERAL_INSTRUCTIONS,
  CFIT_SUBTESTS,
  CFIT_SUBTEST_GUIDE,
  CFIT_TOTAL_DURATION_SECONDS,
  CFIT_TOTAL_QUESTIONS,
  calculateCfitRawScores,
  type CfitAnswers,
  type CfitQuestion,
} from "../data/cfitQuestions";
import { calculateCfitIq } from "../data/cfitScoring";
import { birthDateRangeMessage, getBirthDateInputBounds, isBirthDateInRange } from "../lib/birthDate";
import {
  advanceAssessmentAttempt,
  finishAssessmentAttempt,
  getJsonRecord,
  getRemainingSeconds,
  saveAssessmentAttempt,
  startAssessmentAttempt,
} from "../lib/assessmentAttempts";
import { supabase } from "../lib/supabase";
import type { Json } from "../lib/database.types";

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const birthDateBounds = getBirthDateInputBounds();

function hasAnswer(question: CfitQuestion, answers: CfitAnswers) {
  const value = answers[question.id];
  if (question.answerMode === "multiple") {
    return Array.isArray(value) && value.length === 2;
  }
  return typeof value === "string" && value.length > 0;
}

export function CfitTestPage() {
  const { user, profile, progress, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [subtestIndex, setSubtestIndex] = useState(0);
  const [answers, setAnswers] = useState<CfitAnswers>({});
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? "");
  const [remaining, setRemaining] = useState(CFIT_SUBTESTS[0].durationSeconds);
  const [submitting, setSubmitting] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [stepDeadlineAt, setStepDeadlineAt] = useState<string | null>(null);
  const [attemptLoading, setAttemptLoading] = useState(false);
  const [error, setError] = useState("");
  const startedAtRef = useRef<string | null>(null);
  const finishingRef = useRef(false);
  const resumeCheckedRef = useRef(false);

  const currentSubtest = CFIT_SUBTESTS[subtestIndex];
  const pimsleurDone = progress?.language_test_status === "completed";
  const alreadyDone = progress?.cfit_test_status === "completed";
  const canTake = Boolean(pimsleurDone && !alreadyDone);

  const answeredTotal = useMemo(
    () =>
      CFIT_SUBTESTS.reduce(
        (total, subtest) =>
          total + subtest.questions.filter((question) => hasAnswer(question, answers)).length,
        0,
      ),
    [answers],
  );

  const currentSubtestComplete = currentSubtest.questions.every((question) =>
    hasAnswer(question, answers),
  );

  const applyAttempt = useCallback((attempt: Awaited<ReturnType<typeof startAssessmentAttempt>>) => {
    resumeCheckedRef.current = true;
    const nextIndex = Math.min(Math.max(attempt.current_step, 0), CFIT_SUBTESTS.length - 1);
    setAttemptId(attempt.id);
    setDeadlineAt(attempt.deadline_at);
    setStepDeadlineAt(attempt.step_deadline_at);
    setSubtestIndex(nextIndex);
    setRemaining(getRemainingSeconds(attempt.step_deadline_at ?? attempt.deadline_at));
    setAnswers(getJsonRecord(attempt.answers) as CfitAnswers);
    startedAtRef.current = attempt.started_at;
    setStarted(true);
  }, []);

  useEffect(() => {
    if (
      !user ||
      !canTake ||
      progress?.cfit_test_status !== "in_progress" ||
      resumeCheckedRef.current
    ) {
      return;
    }

    resumeCheckedRef.current = true;
    setAttemptLoading(true);
    void startAssessmentAttempt(
      "cfit",
      CFIT_TOTAL_DURATION_SECONDS,
      CFIT_SUBTESTS[0].durationSeconds,
    )
      .then(applyAttempt)
      .catch((attemptError) => {
        setError(attemptError instanceof Error ? attemptError.message : "Sesi CFIT gagal dipulihkan.");
      })
      .finally(() => setAttemptLoading(false));
  }, [applyAttempt, canTake, progress?.cfit_test_status, user]);

  const finishCfit = useCallback(async () => {
    if (!user || finishingRef.current) return;
    finishingRef.current = true;
    setSubmitting(true);
    setError("");

    const completedAt = new Date();
    const duration = startedAtRef.current
      ? Math.max(0, Math.round((Date.now() - new Date(startedAtRef.current).getTime()) / 1000))
      : null;
    const rawScores = calculateCfitRawScores(answers);
    const iqResult = calculateCfitIq(rawScores.rawTotal, profile?.birth_date ?? birthDate, completedAt);

    const { error: insertError } = await supabase.from("cfit_results").insert({
      user_id: user.id,
      answers: answers as Json,
      raw_subtest1: rawScores.rawSubtest1,
      raw_subtest2: rawScores.rawSubtest2,
      raw_subtest3: rawScores.rawSubtest3,
      raw_subtest4: rawScores.rawSubtest4,
      raw_total: rawScores.rawTotal,
      iq: iqResult.iq,
      category: iqResult.category,
      age_years: iqResult.ageYears,
      age_months: iqResult.ageMonths,
      norm_code: iqResult.normCode,
      duration_seconds: duration,
      started_at: startedAtRef.current ?? new Date().toISOString(),
      completed_at: completedAt.toISOString(),
    });

    if (insertError && insertError.code !== "23505") {
      finishingRef.current = false;
      setSubmitting(false);
      setError(insertError.message);
      return;
    }

    if (attemptId) {
      try {
        await finishAssessmentAttempt(attemptId, answers as Json, subtestIndex);
      } catch (attemptError) {
        finishingRef.current = false;
        setSubmitting(false);
        setError(attemptError instanceof Error ? attemptError.message : "Sesi CFIT belum berhasil ditutup.");
        return;
      }
    }

    const { error: progressError } = await supabase
      .from("user_progress")
      .update({
        cfit_test_status: "completed",
        papikostik_test_status: "available",
      })
      .eq("user_id", user.id);

    if (progressError) {
      finishingRef.current = false;
      setSubmitting(false);
      setError(progressError.message);
      return;
    }

    await refreshProfile();
    setSubmitting(false);
    navigate("/result/cfit", { replace: true });
  }, [answers, attemptId, birthDate, navigate, profile?.birth_date, refreshProfile, subtestIndex, user]);

  const goNextSubtest = useCallback(
    async (force = false) => {
      if (!force && !currentSubtestComplete) {
        setError(
          currentSubtest.answerMode === "multiple"
            ? "Setiap soal pada subtes ini harus memilih tepat dua jawaban."
            : "Lengkapi semua jawaban pada subtes ini terlebih dahulu.",
        );
        return;
      }

      setError("");
      if (subtestIndex < CFIT_SUBTESTS.length - 1) {
        const nextIndex = subtestIndex + 1;
        if (!attemptId) {
          setError("Sesi CFIT belum tersedia. Silakan muat ulang halaman.");
          return;
        }

        setSubmitting(true);
        try {
          await saveAssessmentAttempt(attemptId, answers as Json, subtestIndex);
          const attempt = await advanceAssessmentAttempt(
            attemptId,
            nextIndex,
            CFIT_SUBTESTS[nextIndex].durationSeconds,
          );
          setSubtestIndex(nextIndex);
          setDeadlineAt(attempt.deadline_at);
          setStepDeadlineAt(attempt.step_deadline_at);
          setRemaining(getRemainingSeconds(attempt.step_deadline_at ?? attempt.deadline_at));
          setError("");
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (advanceError) {
          setError(
            advanceError instanceof Error
              ? advanceError.message
              : "Subtes berikutnya belum berhasil dibuka.",
          );
        } finally {
          setSubmitting(false);
        }
        return;
      }

      void finishCfit();
    },
    [answers, attemptId, currentSubtest.answerMode, currentSubtestComplete, finishCfit, subtestIndex],
  );

  useEffect(() => {
    if (!started || submitting) return;

    const tick = () => {
      const nextRemaining = getRemainingSeconds(stepDeadlineAt ?? deadlineAt);
      setRemaining(nextRemaining);
      if (nextRemaining <= 0) void goNextSubtest(true);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadlineAt, goNextSubtest, started, stepDeadlineAt, submitting]);

  useEffect(() => {
    if (!started || !attemptId || submitting || attemptLoading) return;

    const timer = window.setTimeout(() => {
      void saveAssessmentAttempt(attemptId, answers as Json, subtestIndex).catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : "Jawaban belum tersimpan.");
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [answers, attemptId, attemptLoading, started, subtestIndex, submitting]);

  async function handleStart() {
    if (!user) return;
    if (!birthDate) {
      setError("Isi tanggal lahir terlebih dahulu agar scoring IQ CFIT bisa dihitung.");
      return;
    }

    if (!isBirthDateInRange(birthDate)) {
      setError(birthDateRangeMessage());
      return;
    }

    setSubmitting(true);
    setAttemptLoading(true);
    setError("");

    try {
      if (birthDate !== profile?.birth_date) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ birth_date: birthDate })
          .eq("id", user.id);

        if (profileError) throw profileError;
      }

      const attempt = await startAssessmentAttempt(
        "cfit",
        CFIT_TOTAL_DURATION_SECONDS,
        CFIT_SUBTESTS[0].durationSeconds,
      );
      const { error: progressError } = await supabase
        .from("user_progress")
        .update({ cfit_test_status: "in_progress" })
        .eq("user_id", user.id);

      if (progressError) throw progressError;

      applyAttempt(attempt);
      await refreshProfile();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Sesi CFIT belum berhasil dibuat.");
    } finally {
      setAttemptLoading(false);
      setSubmitting(false);
    }
  }

  function selectSingle(questionId: string, value: string) {
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
  }

  function toggleMultiple(questionId: string, value: string) {
    setAnswers((previous) => {
      const current = Array.isArray(previous[questionId]) ? (previous[questionId] as string[]) : [];
      if (current.includes(value)) {
        return { ...previous, [questionId]: current.filter((item) => item !== value) };
      }
      if (current.length >= 2) {
        return { ...previous, [questionId]: [current[1], value] };
      }
      return { ...previous, [questionId]: [...current, value] };
    });
  }

  if (alreadyDone) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <FileCheck className="mx-auto text-brand-red" size={32} />
        <p className="mt-4 font-bold text-brand-navy">CFIT sudah selesai.</p>
        <Link to="/test/papikostik" className="mt-4 inline-block text-sm font-semibold text-brand-red">
          Lanjut ke PAPI Kostick
        </Link>
      </div>
    );
  }

  if (!canTake) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <p className="text-sm text-brand-navy/60">
          Selesaikan tes Pimsleur terlebih dahulu untuk membuka CFIT.
        </p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm font-semibold text-brand-red">
          Kembali ke dashboard
        </Link>
      </div>
    );
  }

  if (attemptLoading) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <p className="text-sm text-brand-navy/60">Memulihkan sesi CFIT...</p>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link
          to="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-brand-navy/50 hover:text-brand-red"
        >
          <ArrowLeft size={16} /> Dashboard
        </Link>
        <div className="rounded-2xl border border-brand-navy/8 bg-white p-8 shadow-sm">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-red">
            Pemetaan Potensi
          </p>
          <h1 className="font-display text-2xl font-extrabold text-brand-navy md:text-3xl">
            CFIT
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-brand-navy/55">
            CFIT terdiri dari 4 subtes berurutan. Baca instruksi berikut sebelum mulai
            mengerjakan.
          </p>
          <div className="mt-6 rounded-xl bg-brand-bg p-4">
            <p className="text-sm font-bold text-brand-navy">Instruksi Umum</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-brand-navy/60">
              {CFIT_GENERAL_INSTRUCTIONS.map((instruction) => (
                <li key={instruction} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-brand-red" />
                  <span>{instruction}</span>
                </li>
              ))}
            </ul>
          </div>
          <label className="mt-6 flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/50">
              Tanggal lahir
            </span>
            <input
              type="date"
              required
              min={birthDateBounds.min}
              max={birthDateBounds.max}
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              className="rounded-xl border border-brand-navy/12 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
            />
            <span className="text-xs text-brand-navy/45">
              Dipakai untuk memilih norma usia CFIT saat raw score dikonversi ke IQ.
            </span>
          </label>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {CFIT_SUBTESTS.map((subtest) => (
              <div key={subtest.id} className="rounded-xl bg-brand-bg p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-navy/40">
                  {subtest.title}
                </p>
                <p className="mt-1 text-sm font-bold text-brand-navy">
                  {subtest.questions.length} soal - {formatTime(subtest.durationSeconds)}
                </p>
                <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-brand-navy/55">
                  {CFIT_SUBTEST_GUIDE[subtest.id].map((instruction) => (
                    <li key={instruction}>{instruction}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {error ? (
            <p className="mt-4 rounded-lg bg-brand-red-soft px-3 py-2 text-sm text-brand-red">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={submitting}
            className="mt-8 w-full rounded-xl bg-brand-red py-3.5 text-sm font-bold text-white hover:bg-brand-red-hover disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {submitting ? "Menyiapkan..." : "Mulai CFIT"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-brand-navy/50 hover:text-brand-red"
        >
          <ArrowLeft size={16} /> Dashboard
        </Link>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${
            remaining <= 30 ? "bg-red-100 text-red-700" : "bg-brand-red-soft text-brand-red"
          }`}
        >
          <Clock size={16} />
          {formatTime(Math.max(remaining, 0))}
        </span>
      </div>

      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-navy/40">
          {currentSubtest.title} - {subtestIndex + 1}/{CFIT_SUBTESTS.length}
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-brand-navy">
          {currentSubtest.title}
        </h1>
        <p className="mt-2 text-sm text-brand-navy/55">{currentSubtest.instruction}</p>
        <ul className="mt-3 space-y-1 text-sm text-brand-navy/50">
          {CFIT_SUBTEST_GUIDE[currentSubtest.id].map((instruction) => (
            <li key={instruction}>{instruction}</li>
          ))}
        </ul>
        <p className="mt-1 text-sm text-brand-navy/45">
          Terjawab {answeredTotal}/{CFIT_TOTAL_QUESTIONS}
        </p>
      </div>

      <div className="space-y-4">
        {currentSubtest.questions.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            value={answers[question.id]}
            onSingle={selectSingle}
            onMultiple={toggleMultiple}
          />
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-brand-red-soft px-3 py-2 text-sm text-brand-red">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={submitting || !currentSubtestComplete}
          onClick={() => goNextSubtest(false)}
          className="rounded-xl bg-brand-red px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting
            ? "Menyimpan..."
            : subtestIndex < CFIT_SUBTESTS.length - 1
              ? "Lanjut subtes berikutnya"
              : "Selesai CFIT"}
        </button>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  value,
  onSingle,
  onMultiple,
}: {
  question: CfitQuestion;
  value?: string | string[];
  onSingle: (questionId: string, value: string) => void;
  onMultiple: (questionId: string, value: string) => void;
}) {
  const selectedValues = Array.isArray(value) ? value : [];

  return (
    <div className="rounded-2xl border border-brand-navy/8 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-brand-navy">Soal {question.number}</p>
        {question.answerMode === "multiple" ? (
          <span className="text-xs font-semibold text-brand-navy/45">Pilih 2 jawaban</span>
        ) : null}
      </div>
      <div className="mt-4 rounded-xl bg-white p-2">
        <img
          src={question.imageSrc}
          alt={`CFIT subtes ${question.subtest} soal ${question.number}`}
          className="mx-auto max-h-[240px] w-full object-contain"
        />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {question.options.map((option) => {
          const selected =
            question.answerMode === "multiple" ? selectedValues.includes(option) : value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() =>
                question.answerMode === "multiple"
                  ? onMultiple(question.id, option)
                  : onSingle(question.id, option)
              }
              className={`rounded-xl border px-3 py-3 text-center text-sm font-bold transition-all ${
                selected
                  ? "border-brand-red bg-brand-red-soft text-brand-red"
                  : "border-brand-navy/10 text-brand-navy/70 hover:border-brand-navy/25"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
