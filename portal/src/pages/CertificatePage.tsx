import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Award, Download, ExternalLink } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import type { CertificateData } from "../lib/certificateHtml";
import { getPimsleurResultMeta } from "../lib/pimsleurScoring";
import { LANDING_URL, supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type Certificate = Database["public"]["Tables"]["certificates"]["Row"];
type PimsleurResult = Database["public"]["Tables"]["pimsleur_results"]["Row"];
type CfitResult = Database["public"]["Tables"]["cfit_results"]["Row"];
type PapikostikStatus = {
  total_all: number | null;
  completed_at: string;
  review_status: "pending" | "reviewed" | "approved";
  final_summary: string | null;
};

export function CertificatePage() {
  const { user, profile, progress } = useAuth();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [pimsleur, setPimsleur] = useState<PimsleurResult | null>(null);
  const [cfit, setCfit] = useState<CfitResult | null>(null);
  const [papi, setPapi] = useState<PapikostikStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notReady, setNotReady] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const approved = progress?.result_status === "completed";

  useEffect(() => {
    if (!user || !approved) {
      setLoading(false);
      return;
    }

    async function load() {
      setNotReady(false);
      const [certificateRes, pimsleurRes, cfitRes, papiRes] = await Promise.all([
        supabase.from("certificates").select("*").eq("user_id", user!.id).maybeSingle(),
        supabase
          .from("pimsleur_results")
          .select("*")
          .eq("user_id", user!.id)
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("cfit_results")
          .select("*")
          .eq("user_id", user!.id)
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.rpc("get_own_papikostik_status"),
      ]);

      const queryError =
        certificateRes.error || pimsleurRes.error || cfitRes.error || papiRes.error;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      const papiData = (papiRes.data?.[0] as PapikostikStatus | undefined) ?? null;
      const certificateDataReady = Boolean(
        certificateRes.data &&
          pimsleurRes.data &&
          pimsleurRes.data.score_total !== null &&
          cfitRes.data &&
          cfitRes.data.raw_total !== null &&
          papiData?.total_all !== null &&
          papiData?.review_status === "approved" &&
          papiData.final_summary?.trim(),
      );

      if (!certificateDataReady) {
        setCertificate(null);
        setPimsleur(null);
        setCfit(null);
        setPapi(null);
        setNotReady(true);
        setLoading(false);
        return;
      }

      setCertificate(certificateRes.data);
      setPimsleur(pimsleurRes.data);
      setCfit(cfitRes.data);
      setPapi(papiData);
      setLoading(false);
    }

    void load();
  }, [user, approved]);

  async function handleDownload() {
    if (!certificate || !profile || downloading) return;

    setDownloading(true);
    setDownloadError("");
    try {
      const { downloadCertificatePdf } = await import("../lib/certificatePdf");
      const payload: CertificateData = {
        fullName: profile.full_name,
        certificateCode: certificate.certificate_code,
        issuedAt: certificate.issued_at,
        cfitRawTotal: cfit?.raw_total ?? null,
        cfitIq: cfit?.iq ?? null,
        cfitCategory: cfit?.category ?? null,
        papiHasil: papi?.final_summary
          ? papi.final_summary
          : "Telah direview psikolog dan disetujui admin",
        papiCatatan: papi?.final_summary ?? null,
        pimsleurScore: pimsleur?.score_total ?? null,
        pimsleurGrade: pimsleur?.grade ?? null,
        pimsleurLevelLabel:
          pimsleur?.grade_label || getPimsleurResultMeta(pimsleur?.grade)?.label || null,
        pimsleurStatusLabel:
          pimsleur?.status_label || getPimsleurResultMeta(pimsleur?.grade)?.status || null,
        pimsleurRecommendation:
          pimsleur?.recommendation ||
          getPimsleurResultMeta(pimsleur?.grade)?.recommendation ||
          null,
      };
      await downloadCertificatePdf(
        payload,
        `sertifikat-pemetaan-${certificate.certificate_code}.pdf`,
      );
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "Gagal mengunduh sertifikat PDF.",
      );
    } finally {
      setDownloading(false);
    }
  }

  if (!approved) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <Award className="mx-auto text-brand-red" size={32} />
        <h1 className="mt-4 font-display text-xl font-extrabold text-brand-navy">
          Sertifikat belum tersedia
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-brand-navy/55">
          Hasil masih menunggu interpretasi psikolog, QC internal, dan persetujuan admin.
        </p>
        <Link to="/dashboard" className="mt-5 inline-block text-sm font-semibold text-brand-red">
          Kembali ke dashboard
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-red border-t-transparent" />
      </div>
    );
  }

  if (notReady) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <Award className="mx-auto text-brand-red" size={32} />
        <h1 className="mt-4 font-display text-xl font-extrabold text-brand-navy">
          Sertifikat sedang disiapkan
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-brand-navy/55">
          Sertifikat belum ditampilkan sampai seluruh hasil tes, narasi, dan persetujuan final
          tersedia lengkap.
        </p>
        <Link to="/dashboard" className="mt-5 inline-block text-sm font-semibold text-brand-red">
          Kembali ke dashboard
        </Link>
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <p className="text-sm text-brand-red">{error || "Sertifikat belum ditemukan."}</p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm font-semibold text-brand-red">
          Kembali ke dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link
        to="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-brand-navy/50 hover:text-brand-red"
      >
        <ArrowLeft size={16} /> Dashboard
      </Link>

      <div className="rounded-2xl border border-brand-navy/8 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-red-soft text-brand-red">
          <Award size={32} />
        </div>
        <h1 className="font-display text-2xl font-extrabold text-brand-navy">
          Sertifikasi Pemetaan Talenta
        </h1>
        <p className="mt-1 text-sm text-brand-navy/50">{profile?.full_name}</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-brand-bg p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-brand-navy/40">
              Kode sertifikat
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-brand-navy">
              {certificate.certificate_code}
            </p>
          </div>
          <div className="rounded-xl bg-brand-bg p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-brand-navy/40">
              Status review
            </p>
            <p className="mt-1 text-sm font-bold text-emerald-700">Disetujui admin</p>
          </div>
        </div>

        <div className="mt-6 space-y-2 rounded-xl border border-brand-navy/8 p-4 text-left text-sm text-brand-navy/65">
          <p>
            <span className="font-bold text-brand-navy">Pimsleur:</span>{" "}
            {pimsleur
              ? `${pimsleur.score_total} / ${pimsleur.grade} - ${pimsleur.status_label}`
              : "Belum ada"}
          </p>
          <p>
            <span className="font-bold text-brand-navy">CFIT:</span>{" "}
            {cfit
              ? `Raw ${cfit.raw_total ?? "-"}/50 - IQ ${cfit.iq ?? "-"} - ${cfit.category ?? "-"}`
              : "Belum ada"}
          </p>
          <p>
            <span className="font-bold text-brand-navy">PAPI:</span>{" "}
            {papi?.final_summary
              ? papi.final_summary
              : "Telah direview psikolog"}
          </p>
        </div>

        {downloadError ? (
          <p className="mt-6 text-sm text-brand-red">{downloadError}</p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={downloading}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-red px-6 py-3.5 text-sm font-bold text-white hover:bg-brand-red-hover disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Download size={18} />
          {downloading ? "Menyiapkan PDF…" : "Unduh Sertifikat PDF"}
        </button>
        <p className="mt-3 text-xs leading-relaxed text-brand-navy/45">
          File PDF sudah menyertakan logo dan tanda tangan, jadi aman dibuka di HP maupun laptop.
        </p>

        <a
          href={LANDING_URL}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-navy/12 px-6 py-3.5 text-sm font-bold text-brand-navy hover:bg-brand-bg"
        >
          <ExternalLink size={16} />
          Kembali ke website Harunokaze
        </a>
      </div>
    </div>
  );
}
