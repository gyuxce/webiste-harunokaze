import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, ArrowLeft, Clock, Download, RefreshCw, Search } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PIMSLEUR_MAX_SCORE } from "../data/pimsleurQuestions";
import {
  downloadCsv,
  formatAdminDateTime,
  isAdminToday,
  isWithinAdminDateRange,
} from "../lib/adminTools";
import { supabase } from "../lib/supabase";
import { isAssessmentStaffRole, isPsychologistRole } from "../lib/access";
import type { CertificateData } from "../lib/certificateHtml";
import { getPimsleurResultMeta } from "../lib/pimsleurScoring";
import type { Database } from "../lib/database.types";

type CertificateRow = Pick<
  Database["public"]["Tables"]["certificates"]["Row"],
  "user_id" | "certificate_code" | "issued_at"
>;

type FinalAssessment =
  Database["public"]["Functions"]["admin_get_final_assessment"]["Returns"][number];

type PimsleurRow = {
  user_id: string;
  score_total: number;
  grade: string;
  completed_at: string;
  full_name: string;
  email: string | null;
  whatsapp: string | null;
  city: string | null;
};

type CfitRow = {
  user_id: string;
  raw_total: number | null;
  iq: number | null;
  category: string | null;
  completed_at: string;
  full_name: string;
  email: string | null;
  whatsapp: string | null;
  city: string | null;
};

type PapikostikRow = {
  user_id: string;
  total_all: number | null;
  is_complete_pattern: boolean | null;
  review_status: "pending" | "reviewed";
  completed_at: string;
  full_name: string;
  email: string | null;
  whatsapp: string | null;
  city: string | null;
};

type RecapRow = {
  userId: string;
  fullName: string;
  email: string | null;
  whatsapp: string | null;
  city: string | null;
  pimsleur: PimsleurRow | null;
  cfit: CfitRow | null;
  papikostik: PapikostikRow | null;
  certificate: CertificateRow | null;
};

type RecapFilter = "all" | "today" | "recent" | "complete" | "incomplete";

const FILTER_OPTIONS: Array<{ value: RecapFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "recent", label: "Aktivitas 24 jam" },
  { value: "today", label: "Hari ini" },
  { value: "incomplete", label: "Belum lengkap" },
  { value: "complete", label: "Lengkap" },
];

const isWithinLastHours = (value: string | null, hours: number) => {
  if (!value) return false;
  const elapsed = Date.now() - new Date(value).getTime();
  return elapsed >= 0 && elapsed <= hours * 60 * 60 * 1000;
};

function getCompletedAtValues(row: RecapRow) {
  return [row.pimsleur?.completed_at, row.cfit?.completed_at, row.papikostik?.completed_at].filter(
    (value): value is string => Boolean(value),
  );
}

function getLatestCompletedAt(row: RecapRow) {
  return getCompletedAtValues(row).reduce<string | null>((latest, value) => {
    if (!latest || new Date(value).getTime() > new Date(latest).getTime()) return value;
    return latest;
  }, null);
}

function hasActivityToday(row: RecapRow) {
  return getCompletedAtValues(row).some((value) => isAdminToday(value));
}

function hasRecentActivity(row: RecapRow) {
  return getCompletedAtValues(row).some((value) => isWithinLastHours(value, 24));
}

function isComplete(row: RecapRow) {
  return Boolean(
    row.pimsleur &&
      row.cfit &&
      row.cfit.raw_total !== null &&
      row.papikostik &&
      row.papikostik.total_all !== null,
  );
}

export function AdminRecapPage() {
  const { profile, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<RecapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RecapFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [downloadingCertificateId, setDownloadingCertificateId] = useState<string | null>(null);
  const isPsychologist = isPsychologistRole(profile?.role);
  const detailBasePath = isPsychologist ? "/psychologist" : "/admin";

  const loadRows = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");

    const [pimsleurResponse, cfitResponse, papikostikResponse, certificateResponse] = await Promise.all([
      supabase.rpc("admin_list_pimsleur_results"),
      supabase.rpc("admin_list_cfit_results"),
      supabase.rpc("admin_list_papikostik_results"),
      isPsychologist
        ? Promise.resolve({ data: [] as CertificateRow[], error: null })
        : supabase.from("certificates").select("user_id, certificate_code, issued_at"),
    ]);

    const responseError =
      pimsleurResponse.error ??
      cfitResponse.error ??
      papikostikResponse.error ??
      certificateResponse.error;
    if (responseError) {
      setError(responseError.message);
      if (showLoader) setLoading(false);
      return;
    }

    const recapMap = new Map<string, RecapRow>();
    const getRow = (value: {
      user_id: string;
      full_name: string;
      email: string | null;
      whatsapp: string | null;
      city: string | null;
    }) => {
      const existing = recapMap.get(value.user_id);
      if (existing) return existing;

      const newRow: RecapRow = {
        userId: value.user_id,
        fullName: value.full_name || "Peserta",
        email: value.email,
        whatsapp: value.whatsapp,
        city: value.city,
        pimsleur: null,
        cfit: null,
        papikostik: null,
        certificate: null,
      };
      recapMap.set(value.user_id, newRow);
      return newRow;
    };

    for (const result of (pimsleurResponse.data as PimsleurRow[] | null) ?? []) {
      getRow(result).pimsleur = result;
    }
    for (const result of (cfitResponse.data as CfitRow[] | null) ?? []) {
      getRow(result).cfit = result;
    }
    for (const result of (papikostikResponse.data as PapikostikRow[] | null) ?? []) {
      getRow(result).papikostik = result;
    }
    for (const certificate of (certificateResponse.data as CertificateRow[] | null) ?? []) {
      const row = recapMap.get(certificate.user_id);
      if (row) row.certificate = certificate;
    }

    setRows([...recapMap.values()]);
    setLastUpdatedAt(new Date().toISOString());
    if (showLoader) setLoading(false);
  }, [isPsychologist]);

  useEffect(() => {
    if (authLoading || !isAssessmentStaffRole(profile?.role)) return;
    void loadRows();
  }, [authLoading, loadRows, profile?.role]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRows(false);
    setRefreshing(false);
  };

  const handleDownloadCertificate = async (row: RecapRow) => {
    if (!row.certificate || !isComplete(row) || downloadingCertificateId) return;

    setDownloadingCertificateId(row.userId);
    setError("");
    try {
      const { data, error: assessmentError } = await supabase.rpc("admin_get_final_assessment", {
        p_user_id: row.userId,
      });
      const assessment = data?.[0] as FinalAssessment | undefined;
      if (assessmentError || !assessment) {
        throw new Error(assessmentError?.message ?? "Data sertifikat peserta tidak ditemukan.");
      }

      const { downloadCertificatePdf } = await import("../lib/certificatePdf");
      const participantSummary = assessment.participant_summary ?? "";
      const pimsleurMeta = getPimsleurResultMeta(assessment.pimsleur_grade);
      const payload: CertificateData = {
        fullName: assessment.full_name,
        certificateCode: row.certificate.certificate_code,
        issuedAt: row.certificate.issued_at,
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
        `sertifikat-pemetaan-${row.certificate.certificate_code}.pdf`,
      );
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Gagal mengunduh sertifikat PDF.",
      );
    } finally {
      setDownloadingCertificateId(null);
    }
  };

  const handleExport = () => {
    downloadCsv(
      `harunokaze-rekap-asesmen-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Nama",
        "Email",
        "WhatsApp",
        "Kota",
        "Pimsleur selesai",
        "CFIT selesai",
        "PAPI selesai",
        "Aktivitas terakhir",
        "Status",
      ],
      filteredRows.map((row) => [
        row.fullName,
        row.email ?? "",
        row.whatsapp ?? "",
        row.city ?? "",
        formatAdminDateTime(row.pimsleur?.completed_at ?? null),
        formatAdminDateTime(row.cfit?.completed_at ?? null),
        formatAdminDateTime(row.papikostik?.completed_at ?? null),
        formatAdminDateTime(getLatestCompletedAt(row)),
        isComplete(row) ? "Lengkap" : "Belum lengkap",
      ]),
    );
  };

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return rows
      .filter((row) => {
        if (filter === "recent") return hasRecentActivity(row);
        if (filter === "today") return hasActivityToday(row);
        if (filter === "complete") return isComplete(row);
        if (filter === "incomplete") return !isComplete(row);
        return true;
      })
      .filter((row) => isWithinAdminDateRange(getLatestCompletedAt(row), fromDate, toDate))
      .filter((row) =>
        [row.fullName, row.email, row.whatsapp, row.city]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized)),
      )
      .sort((left, right) => {
        const leftDate = getLatestCompletedAt(left);
        const rightDate = getLatestCompletedAt(right);
        return (
          (rightDate ? new Date(rightDate).getTime() : 0) -
          (leftDate ? new Date(leftDate).getTime() : 0)
        );
      });
  }, [filter, fromDate, query, rows, toDate]);

  const completedCount = useMemo(() => rows.filter(isComplete).length, [rows]);
  const activityTodayCount = useMemo(() => rows.filter(hasActivityToday).length, [rows]);
  const recentActivityCount = useMemo(() => rows.filter(hasRecentActivity).length, [rows]);

  if (!authLoading && !isAssessmentStaffRole(profile?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="w-full">
      <Link
        to="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-brand-navy/50 hover:text-brand-red"
      >
        <ArrowLeft size={16} /> Panel staf
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-red">
            {isPsychologist ? "Area psikolog" : "Admin-only"}
          </p>
          <h1 className="font-display text-2xl font-extrabold text-brand-navy">
            Rekap asesmen peserta
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-brand-navy/50">
            Ringkasan Pimsleur, CFIT, dan PAPI Kostick. Waktu diambil dari saat peserta menyelesaikan
            masing-masing tes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-brand-bg px-3 py-2 text-brand-navy/55">
            Peserta {rows.length}
          </span>
          <span className="rounded-full bg-sky-50 px-3 py-2 text-sky-700">
            Aktivitas 24 jam {recentActivityCount}
          </span>
          <span className="rounded-full bg-brand-bg px-3 py-2 text-brand-navy/55">
            Hari ini {activityTodayCount}
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">
            Lengkap {completedCount}
          </span>
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
          placeholder="Cari nama, email, WhatsApp, atau kota"
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
            Aktivitas tes dari
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
            Aktivitas tes sampai
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

      {loading || authLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-red border-t-transparent" />
        </div>
      ) : error ? (
        <div className="mt-6 space-y-2">
          <p className="text-sm text-brand-red">{error}</p>
          <p className="text-xs text-brand-navy/50">
            Pastikan migration admin Pimsleur, CFIT, dan PAPI Kostick sudah dijalankan di Supabase.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-brand-navy/50">Belum ada hasil asesmen peserta.</p>
      ) : filteredRows.length === 0 ? (
        <p className="mt-6 text-sm text-brand-navy/50">
          Tidak ada peserta yang sesuai dengan pencarian atau filter ini.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-brand-navy/8 bg-white">
          <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
            <thead className="border-b border-brand-navy/8 bg-brand-bg text-[11px] uppercase tracking-wide text-brand-navy/45">
              <tr>
                <th rowSpan={2} className="w-[18%] px-4 py-3 align-middle font-bold">
                  Peserta
                </th>
                <th rowSpan={2} className="w-[12%] px-3 py-3 align-middle font-bold">
                  Aktivitas terakhir
                </th>
                <th colSpan={3} className="border-l border-brand-navy/8 px-3 py-2 text-center font-bold">
                  Hasil asesmen
                </th>
                <th
                  colSpan={isPsychologist ? 1 : 2}
                  className="border-l border-emerald-100 px-3 py-2 text-center font-bold text-emerald-700"
                >
                  Output akhir
                </th>
              </tr>
              <tr>
                <th className="w-[14%] border-l border-brand-navy/8 px-3 py-3 font-bold">Pimsleur</th>
                <th className="w-[16%] px-3 py-3 font-bold">CFIT</th>
                <th className="w-[14%] px-3 py-3 font-bold">PAPI Kostick</th>
                {!isPsychologist ? (
                  <th className="w-[14%] border-l border-emerald-100 px-3 py-3 font-bold text-emerald-700">
                    Sertifikat
                  </th>
                ) : null}
                <th className="sticky right-0 w-[14%] bg-brand-bg px-3 py-3 font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const recent = isWithinLastHours(getLatestCompletedAt(row), 1);
                return (
                <tr
                  key={row.userId}
                  className={`border-b border-brand-navy/5 align-top last:border-0 ${
                    recent ? "bg-sky-50/60" : ""
                  }`}
                >
                  <td className="px-4 py-3.5">
                    <p className="font-semibold leading-snug text-brand-navy">{row.fullName}</p>
                    <div className="mt-1 space-y-0.5 text-xs leading-relaxed text-brand-navy/45">
                      <p className="truncate" title={row.email ?? undefined}>
                        {row.email ?? "Email belum tersedia"}
                      </p>
                      <p>{row.whatsapp ?? "-"}</p>
                      <p>{row.city ?? "-"}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    {recent ? (
                      <span className="mb-1.5 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                        Baru selesai
                      </span>
                    ) : null}
                    <CompletionTime value={getLatestCompletedAt(row)} />
                  </td>
                  <td className="px-3 py-3.5">
                    <AssessmentSummary
                      done={Boolean(row.pimsleur)}
                      lines={
                        row.pimsleur
                          ? [`${row.pimsleur.score_total}/${PIMSLEUR_MAX_SCORE} · Grade ${row.pimsleur.grade}`]
                          : []
                      }
                      completedAt={row.pimsleur?.completed_at ?? null}
                    />
                  </td>
                  <td className="px-3 py-3.5">
                    <AssessmentSummary
                      done={Boolean(row.cfit)}
                      lines={
                        row.cfit
                          ? [
                              `Raw ${row.cfit.raw_total ?? "-"}/50 · IQ ${row.cfit.iq ?? "-"}`,
                              row.cfit.category ?? "Kategori belum tersedia",
                            ]
                          : []
                      }
                      completedAt={row.cfit?.completed_at ?? null}
                    />
                  </td>
                  <td className="px-3 py-3.5">
                    <AssessmentSummary
                      done={Boolean(row.papikostik)}
                      lines={
                        row.papikostik
                          ? [
                              `${row.papikostik.total_all ?? 0}/90 · ${
                                row.papikostik.review_status === "reviewed"
                                  ? "Reviewed"
                                  : "Menunggu review"
                              }`,
                            ]
                          : []
                      }
                      completedAt={row.papikostik?.completed_at ?? null}
                    />
                  </td>
                  {!isPsychologist ? (
                    <td className="border-l border-emerald-100 bg-emerald-50/20 px-3 py-3.5">
                      <CertificateStatus
                        certificate={row.certificate}
                        complete={isComplete(row)}
                        downloading={downloadingCertificateId === row.userId}
                        onDownload={() => void handleDownloadCertificate(row)}
                      />
                    </td>
                  ) : null}
                  <td
                    className={`sticky right-0 px-3 py-3.5 shadow-[-8px_0_12px_-12px_rgba(15,34,64,0.25)] ${
                      recent ? "bg-sky-50" : "bg-white"
                    }`}
                  >
                    <div className="grid grid-cols-2 gap-1.5">
                      <DetailLink
                        href={row.pimsleur ? `${detailBasePath}/pimsleur/${row.userId}` : null}
                        label="Pimsleur"
                      />
                      <DetailLink href={row.cfit ? `${detailBasePath}/cfit/${row.userId}` : null} label="CFIT" />
                      <DetailLink
                        href={row.papikostik ? `${detailBasePath}/papikostik/${row.userId}` : null}
                        label="PAPI"
                      />
                      {!isPsychologist ? (
                        <DetailLink
                          href={isComplete(row) ? `/admin/review/${row.userId}` : null}
                          label="Review"
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompletionTime({ value }: { value: string | null }) {
  if (!value) return null;

  return (
    <p className="mt-1.5 inline-flex items-start gap-1 text-[11px] leading-snug text-brand-navy/45">
      <Clock size={12} className="mt-0.5 shrink-0" />
      {formatAdminDateTime(value)}
    </p>
  );
}

function Status({ done }: { done: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
        done ? "bg-emerald-50 text-emerald-700" : "bg-brand-bg text-brand-navy/45"
      }`}
    >
      {done ? "Selesai" : "Belum"}
    </span>
  );
}

function AssessmentSummary({
  done,
  lines,
  completedAt,
}: {
  done: boolean;
  lines: string[];
  completedAt: string | null;
}) {
  return (
    <div>
      <Status done={done} />
      {lines.map((line) => (
        <p key={line} className="mt-1.5 text-xs leading-snug text-brand-navy/65" title={line}>
          {line}
        </p>
      ))}
      <CompletionTime value={completedAt} />
    </div>
  );
}

function DetailLink({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return (
      <span className="inline-flex items-center justify-center rounded-lg border border-brand-navy/8 bg-brand-bg px-2 py-1.5 text-center text-[11px] font-bold text-brand-navy/30">
        {label}
      </span>
    );
  }
  return (
    <Link
      to={href}
      className="inline-flex items-center justify-center rounded-lg border border-brand-red/20 bg-brand-red-soft px-2 py-1.5 text-center text-[11px] font-bold text-brand-red hover:bg-brand-red hover:text-white"
    >
      {label}
    </Link>
  );
}

function CertificateStatus({
  certificate,
  complete,
  downloading,
  onDownload,
}: {
  certificate: CertificateRow | null;
  complete: boolean;
  downloading: boolean;
  onDownload: () => void;
}) {
  if (!certificate) {
    return (
      <span className="inline-flex rounded-full bg-brand-bg px-2 py-0.5 text-[10px] font-bold text-brand-navy/45">
        Belum terbit
      </span>
    );
  }

  if (!complete) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
        Perlu cek hasil
      </span>
    );
  }

  return (
    <div>
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
        <Award size={12} /> Terbit
      </span>
      <p className="mt-1.5 font-mono text-[11px] font-semibold text-brand-navy/65">
        {certificate.certificate_code}
      </p>
      <CompletionTime value={certificate.issued_at} />
      <button
        type="button"
        onClick={onDownload}
        disabled={downloading}
        className="mt-2 inline-flex items-center gap-1 rounded-lg border border-emerald-700/25 px-2 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
      >
        <Download size={12} />
        {downloading ? "Menyiapkan..." : "Unduh PDF"}
      </button>
    </div>
  );
}
