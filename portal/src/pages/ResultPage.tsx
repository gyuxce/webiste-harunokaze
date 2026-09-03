import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Award, Download } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { gradeFromTotal, getPimsleurResultMeta } from "../lib/pimsleurScoring";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type Certificate = Database["public"]["Tables"]["certificates"]["Row"];

function getRecommendation(languageScore: number, programInterest?: string | null): string {
  if (languageScore >= 80) {
    return "Kesiapan bahasa sangat baik. Direkomendasikan melanjutkan ke program intensif dan jalur SSW sesuai minat bidangmu.";
  }
  if (languageScore >= 60) {
    return `Kesiapan bahasa cukup baik. Direkomendasikan program pelatihan bahasa terstruktur sebelum job matching${
      programInterest ? ` — fokus: ${programInterest}` : ""
    }.`;
  }
  return "Perlu penguatan dasar bahasa Jepang terlebih dahulu. Direkomendasikan kelas persiapan bahasa sebelum melangkah ke tahap matching.";
}

function generateCertificateCode(): string {
  const part = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `HNZ-${new Date().getFullYear()}-${part}`;
}

export function ResultPage() {
  const { user, profile, progress, refreshProfile } = useAuth();
  const [languageScore, setLanguageScore] = useState<number | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);

  const canView = progress?.character_test_status === "completed";

  useEffect(() => {
    if (!user || !canView) {
      setLoading(false);
      return;
    }

    async function load() {
      const { data: sessions } = await supabase
        .from("test_sessions")
        .select("score, test_type")
        .eq("user_id", user!.id)
        .eq("test_type", "language")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(1);

      const score = sessions?.[0]?.score ?? 0;
      setLanguageScore(score);

      const { data: existing } = await supabase
        .from("certificates")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (existing) {
        setCertificate(existing);
      } else {
        const recommendation = getRecommendation(score, profile?.program_interest);
        const { data: created } = await supabase
          .from("certificates")
          .insert({
            user_id: user!.id,
            certificate_code: generateCertificateCode(),
            score,
            recommendation,
          })
          .select("*")
          .single();

        if (created) {
          setCertificate(created);
          await supabase
            .from("user_progress")
            .update({ result_status: "completed" })
            .eq("user_id", user!.id);
          await refreshProfile();
        }
      }

      setLoading(false);
    }

    load();
  }, [user, canView, profile?.program_interest, refreshProfile]);

  const handleDownload = async () => {
    if (!certificate || !profile) return;

    const { downloadCertificatePdf } = await import("../lib/certificatePdf");
    const pimsleurGrade = gradeFromTotal(certificate.score);
    const pimsleurMeta = getPimsleurResultMeta(pimsleurGrade);
    await downloadCertificatePdf(
      {
        fullName: profile.full_name,
        certificateCode: certificate.certificate_code,
        issuedAt: certificate.issued_at,
        cfitRawTotal: null,
        cfitIq: null,
        cfitCategory: null,
        papiHasil: null,
        papiCatatan: certificate.recommendation,
        pimsleurScore: certificate.score,
        pimsleurGrade,
        pimsleurLevelLabel: pimsleurMeta?.label ?? null,
        pimsleurStatusLabel: pimsleurMeta?.status ?? null,
        pimsleurRecommendation: pimsleurMeta?.recommendation ?? certificate.recommendation,
      },
      `sertifikat-pemetaan-${certificate.certificate_code}.pdf`,
    );
  };

  if (!canView) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <p className="text-brand-navy/60 text-sm">Selesaikan semua tes terlebih dahulu.</p>
        <Link to="/dashboard" className="mt-4 inline-block text-brand-red font-semibold text-sm">
          Kembali ke dashboard
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-brand-red border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-brand-navy/50 hover:text-brand-red mb-6">
        <ArrowLeft size={16} /> Dashboard
      </Link>

      <div className="rounded-2xl border border-brand-navy/8 bg-white p-8 shadow-sm text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-red-soft text-brand-red mb-4">
          <Award size={32} />
        </div>
        <h1 className="font-display font-extrabold text-2xl text-brand-navy">Hasil Pemetaan Potensi</h1>
        <p className="text-sm text-brand-navy/50 mt-1">{profile?.full_name}</p>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-brand-bg p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-navy/40">Skor Bahasa</p>
            <p className="font-display font-extrabold text-3xl text-brand-navy mt-1">{languageScore ?? 0}</p>
          </div>
          <div className="rounded-xl bg-brand-bg p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-navy/40">Kode Sertifikat</p>
            <p className="font-mono text-sm font-bold text-brand-navy mt-2">{certificate?.certificate_code}</p>
          </div>
        </div>

        {certificate && (
          <div className="mt-6 text-left rounded-xl border border-brand-navy/8 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-navy/40 mb-2">Rekomendasi</p>
            <p className="text-sm text-brand-navy/70 leading-relaxed">{certificate.recommendation}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleDownload()}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-navy text-white font-bold px-6 py-3.5 text-sm hover:bg-brand-navy-light transition-colors"
        >
          <Download size={18} />
          Unduh Sertifikat PDF
        </button>
      </div>
    </div>
  );
}
