import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, Award, CheckCircle2, Download, Save, Sparkles } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { formatAdminDateTime } from "../lib/adminTools";
import type { CertificateData } from "../lib/certificateHtml";
import { getPimsleurResultMeta } from "../lib/pimsleurScoring";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type FinalAssessment =
  Database["public"]["Functions"]["admin_get_final_assessment"]["Returns"][number];
type CertificateRecord = Pick<
  Database["public"]["Tables"]["certificates"]["Row"],
  "certificate_code" | "issued_at"
>;

async function readEdgeFunctionError(error: { message?: string; context?: unknown }) {
  if (error.context instanceof Response) {
    try {
      const body: unknown = await error.context.clone().json();
      if (body && typeof body === "object" && "error" in body) {
        const detail = (body as { error?: unknown }).error;
        if (typeof detail === "string" && detail) return detail;
      }
    } catch {
      // Keep the SDK message when the function response is not JSON.
    }
  }
  return error.message || "Gagal menjalankan refine AI.";
}

export function AdminFinalReviewPage() {
  const { userId } = useParams<{ userId: string }>();
  const { profile, loading: authLoading, refreshProfile } = useAuth();
  const [assessment, setAssessment] = useState<FinalAssessment | null>(null);
  const [certificate, setCertificate] = useState<CertificateRecord | null>(null);
  const [psychologistInterpretation, setPsychologistInterpretation] = useState("");
  const [participantSummary, setParticipantSummary] = useState("");
  const [qcNotes, setQcNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refining, setRefining] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [downloadingCertificate, setDownloadingCertificate] = useState(false);
  const [publishConfirmationOpen, setPublishConfirmationOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!userId || authLoading || profile?.role !== "admin") return;

    async function load() {
      const [assessmentResponse, certificateResponse] = await Promise.all([
        supabase.rpc("admin_get_final_assessment", { p_user_id: userId! }),
        supabase
          .from("certificates")
          .select("certificate_code, issued_at")
          .eq("user_id", userId!)
          .maybeSingle(),
      ]);
      const { data, error: queryError } = assessmentResponse;
      const first = data?.[0] ?? null;

      if (queryError || certificateResponse.error || !first) {
        setError(
          queryError?.message ??
            certificateResponse.error?.message ??
            "Data asesmen final tidak ditemukan.",
        );
        setLoading(false);
        return;
      }

      setAssessment(first);
      setCertificate(certificateResponse.data);
      setPsychologistInterpretation(first.psychologist_interpretation ?? "");
      setParticipantSummary(first.participant_summary ?? "");
      setQcNotes(first.qc_notes ?? "");
      setLoading(false);
    }

    void load();
  }, [userId, authLoading, profile?.role]);

  const allTestsComplete = useMemo(
    () =>
      assessment?.pimsleur_score_total !== null &&
      assessment?.cfit_raw_total !== null &&
      assessment?.papi_total_all !== null,
    [assessment],
  );
  const approved = assessment?.final_review_status === "approved";

  async function refineWithAi() {
    if (!userId || !assessment) return;
    if (!allTestsComplete) {
      setError("Selesaikan semua hasil tes sebelum menjalankan refine AI.");
      return;
    }
    if (!psychologistInterpretation.trim()) {
      setError("Isi interpretasi psikolog terlebih dahulu.");
      return;
    }

    setRefining(true);
    setError("");
    setMessage("");
    const { data, error: functionError } = await supabase.functions.invoke("refine-final-review", {
      body: {
        user_id: userId,
        psychologist_interpretation: psychologistInterpretation,
        participant_summary: participantSummary,
        qc_notes: qcNotes,
      },
    });

    if (functionError) {
      setError(await readEdgeFunctionError(functionError));
      setRefining(false);
      return;
    }
    if (!data?.participant_summary) {
      setError(data?.error || "AI tidak mengembalikan narasi.");
      setRefining(false);
      return;
    }

    setParticipantSummary(data.participant_summary);
    const flags = Array.isArray(data.qc_flags) ? data.qc_flags : [];
    setMessage(
      flags.length > 0
        ? `Draft AI dibuat. Periksa kembali: ${flags.join("; ")}`
        : "Draft AI dibuat. Periksa narasi, lalu simpan sebagai draft QC.",
    );
    setRefining(false);
  }

  async function saveDraft() {
    if (!userId || !assessment) return;
    setSaving(true);
    setError("");
    setMessage("");

    const { data, error: saveError } = await supabase.rpc("admin_upsert_final_review", {
      p_user_id: userId,
      p_psychologist_interpretation: psychologistInterpretation,
      p_participant_summary: participantSummary,
      p_qc_notes: qcNotes,
    });

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setAssessment({
      ...assessment,
      review_id: data.id,
      psychologist_interpretation: data.psychologist_interpretation,
      participant_summary: data.participant_summary,
      qc_notes: data.qc_notes,
      final_review_status: data.status,
      approved_at: data.approved_at,
    });
    setMessage("Draft review berhasil disimpan.");
    setSaving(false);
  }

  function requestPublish() {
    if (!userId || !assessment) return;
    if (!psychologistInterpretation.trim() || !participantSummary.trim()) {
      setError("Isi interpretasi psikolog dan narasi peserta sebelum menerbitkan sertifikat.");
      return;
    }
    setError("");
    setPublishConfirmationOpen(true);
  }

  async function publishAssessment() {
    if (!userId || !assessment) return;

    setPublishing(true);
    setError("");
    setMessage("");

    const { error: draftError } = await supabase.rpc("admin_upsert_final_review", {
      p_user_id: userId,
      p_psychologist_interpretation: psychologistInterpretation,
      p_participant_summary: participantSummary,
      p_qc_notes: qcNotes,
    });
    if (draftError) {
      setError(draftError.message);
      setPublishing(false);
      setPublishConfirmationOpen(false);
      return;
    }

    const { data, error: publishError } = await supabase.rpc("admin_publish_assessment", {
      p_user_id: userId,
    });

    if (publishError) {
      setError(publishError.message);
      setPublishing(false);
      setPublishConfirmationOpen(false);
      return;
    }

    setAssessment({
      ...assessment,
      final_review_status: "approved",
      approved_at: new Date().toISOString(),
      certificate_code: data?.[0]?.certificate_code ?? assessment.certificate_code,
    });
    if (data?.[0]?.certificate_code) {
      setCertificate({
        certificate_code: data[0].certificate_code,
        issued_at: new Date().toISOString(),
      });
    }
    setMessage(`Sertifikat berhasil diterbitkan: ${data?.[0]?.certificate_code ?? "-"}`);
    await refreshProfile();
    setPublishing(false);
    setPublishConfirmationOpen(false);
  }

  async function downloadCertificate() {
    if (!assessment || !certificate || downloadingCertificate) return;

    setDownloadingCertificate(true);
    setError("");
    try {
      const { downloadCertificatePdf } = await import("../lib/certificatePdf");
      const participantSummary = assessment.participant_summary ?? "";
      const pimsleurMeta = getPimsleurResultMeta(assessment.pimsleur_grade);
      const payload: CertificateData = {
        fullName: assessment.full_name,
        certificateCode: certificate.certificate_code,
        issuedAt: certificate.issued_at,
        cfitRawTotal: assessment.cfit_raw_total,
        cfitIq: assessment.cfit_iq,
        cfitCategory: assessment.cfit_category,
        papiHasil: participantSummary
          ? participantSummary
          : "Telah direview psikolog dan disetujui admin",
        papiCatatan: participantSummary || null,
        pimsleurScore: assessment.pimsleur_score_total,
        pimsleurGrade: assessment.pimsleur_grade,
        pimsleurLevelLabel: pimsleurMeta?.label ?? null,
        pimsleurStatusLabel: pimsleurMeta?.status ?? null,
        pimsleurRecommendation: pimsleurMeta?.recommendation ?? null,
      };
      await downloadCertificatePdf(
        payload,
        `sertifikat-pemetaan-${certificate.certificate_code}.pdf`,
      );
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Gagal mengunduh sertifikat PDF.",
      );
    } finally {
      setDownloadingCertificate(false);
    }
  }

  if (!authLoading && profile?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading || authLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-red border-t-transparent" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <p className="text-sm text-brand-red">{error || "Data tidak ditemukan."}</p>
        <Link to="/admin/recap" className="mt-4 inline-block text-sm font-semibold text-brand-red">
          Kembali ke rekap
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to="/admin/recap"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-brand-navy/50 hover:text-brand-red"
      >
        <ArrowLeft size={16} /> Rekap asesmen
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-red">
            Review final admin
          </p>
          <h1 className="font-display text-2xl font-extrabold text-brand-navy">
            {assessment.full_name}
          </h1>
          <p className="mt-1 text-sm text-brand-navy/50">{assessment.email ?? "-"}</p>
        </div>
        <StatusBadge status={assessment.final_review_status} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Score label="Pimsleur" value={`${assessment.pimsleur_score_total ?? "-"} · Grade ${assessment.pimsleur_grade ?? "-"}`} />
        <Score label="CFIT" value={`Raw ${assessment.cfit_raw_total ?? "-"} · IQ ${assessment.cfit_iq ?? "-"}`} />
        <Score label="PAPI Kostick" value={`${assessment.papi_total_all ?? "-"}/90 · ${assessment.papi_review_status ?? "-"}`} />
      </div>

      {!allTestsComplete ? (
        <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Sertifikat belum dapat diterbitkan karena belum semua tes memiliki hasil.
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ReviewField
          label="Interpretasi psikolog (dari PAPI)"
          value={psychologistInterpretation}
          onChange={setPsychologistInterpretation}
          placeholder="Isi interpretasi psikolog melalui detail PAPI terlebih dahulu."
          disabled
          action={
            !approved ? (
              <Link
                to={`/admin/papikostik/${assessment.user_id}`}
                className="text-[11px] font-bold normal-case text-brand-red hover:underline"
              >
                Edit di PAPI
              </Link>
            ) : null
          }
        />
        <ReviewField
          label="Narasi untuk peserta / hasil refined"
          value={participantSummary}
          onChange={setParticipantSummary}
          placeholder="Tulis ulang dengan bahasa yang konsultatif, jelas, dan sesuai untuk peserta."
          disabled={approved}
          action={
            !approved ? (
              <button
                type="button"
                onClick={() => void refineWithAi()}
                disabled={refining || saving || publishing || !allTestsComplete}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-[11px] font-bold text-white hover:bg-brand-navy-light disabled:opacity-50"
              >
                <Sparkles size={14} />
                {refining ? "Menyusun..." : "Refine dengan AI"}
              </button>
            ) : null
          }
        />
      </div>

      <div className="mt-6">
        <ReviewField
          label="Catatan QC internal"
          value={qcNotes}
          onChange={setQcNotes}
          placeholder="Catatan perubahan, pengecekan, atau alasan persetujuan internal."
          disabled={approved}
        />
      </div>

      {error ? <p className="mt-5 rounded-lg bg-brand-red-soft px-3 py-2 text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="mt-5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {!approved ? (
          <>
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={saving || refining || publishing || !allTestsComplete}
              className="inline-flex items-center gap-2 rounded-xl border border-brand-navy/15 px-5 py-3 text-sm font-bold text-brand-navy disabled:opacity-50"
            >
              <Save size={18} /> {saving ? "Menyimpan..." : "Simpan draft review"}
            </button>
            <button
              type="button"
              onClick={requestPublish}
              disabled={saving || refining || publishing || !allTestsComplete}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-red px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              <CheckCircle2 size={18} />
              {publishing ? "Menerbitkan..." : "Setujui & terbitkan sertifikat"}
            </button>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
            <div>
              <p className="inline-flex items-center gap-2 font-bold text-emerald-700">
                <Award size={18} /> Sertifikat {certificate?.certificate_code ?? assessment.certificate_code ?? "sudah diterbitkan"}
              </p>
              {certificate ? (
                <p className="mt-1 text-xs text-emerald-700/75">
                  Diterbitkan {formatAdminDateTime(certificate.issued_at)} WIB
                </p>
              ) : null}
            </div>
            {certificate ? (
              <button
                type="button"
                onClick={() => void downloadCertificate()}
                disabled={downloadingCertificate}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-700/25 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
              >
                <Download size={15} />
                {downloadingCertificate ? "Menyiapkan PDF..." : "Unduh PDF"}
              </button>
            ) : null}
          </div>
        )}
      </div>

      {publishConfirmationOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-certificate-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-red">Konfirmasi penerbitan</p>
            <h2 id="publish-certificate-title" className="mt-2 font-display text-xl font-extrabold text-brand-navy">
              Terbitkan sertifikat peserta?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-navy/60">
              Hasil final akan disetujui dan sertifikat untuk <strong className="text-brand-navy">{assessment.full_name}</strong> akan diterbitkan.
              Tindakan ini tidak dapat dibatalkan dari halaman ini.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setPublishConfirmationOpen(false)}
                disabled={publishing}
                className="rounded-xl border border-brand-navy/15 px-4 py-2.5 text-sm font-bold text-brand-navy disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void publishAssessment()}
                disabled={publishing}
                className="rounded-xl bg-brand-red px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-red-hover disabled:opacity-50"
              >
                {publishing ? "Menerbitkan..." : "Ya, terbitkan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReviewField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  action,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
  action?: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wide text-brand-navy/45">
        <span>{label}</span>
        {action}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={10}
        placeholder={placeholder}
        className="rounded-xl border border-brand-navy/12 bg-white px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-red/30 disabled:bg-brand-bg disabled:text-brand-navy/60"
      />
    </label>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-navy/8 bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-navy/40">{label}</p>
      <p className="mt-1 text-sm font-extrabold text-brand-navy">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: FinalAssessment["final_review_status"] }) {
  const config = {
    locked: ["Belum siap", "bg-brand-bg text-brand-navy/50"],
    pending_psychologist: ["Menunggu interpretasi psikolog", "bg-amber-50 text-amber-700"],
    pending_qc: ["Menunggu QC / persetujuan", "bg-brand-red-soft text-brand-red"],
    approved: ["Disetujui & terbit", "bg-emerald-50 text-emerald-700"],
  }[status];

  return <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${config[1]}`}>{config[0]}</span>;
}
