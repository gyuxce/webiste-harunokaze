import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { CFIT_TOTAL_QUESTIONS } from "../data/cfitQuestions";
import { calculateCfitIqFromNorm } from "../data/cfitScoring";
import { supabase } from "../lib/supabase";
import { isAssessmentStaffRole, isPsychologistRole } from "../lib/access";

type AdminCfitRow = {
  id: string;
  user_id: string;
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
  completed_at: string;
  full_name: string;
  email: string | null;
  whatsapp: string | null;
  city: string | null;
};

export function AdminCfitPage() {
  const { profile, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<AdminCfitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const detailBasePath = isPsychologistRole(profile?.role) ? "/psychologist/cfit" : "/admin/cfit";

  useEffect(() => {
    if (authLoading || !isAssessmentStaffRole(profile?.role)) return;

    async function load() {
      const { data, error: qError } = await supabase.rpc("admin_list_cfit_results");

      if (qError) {
        setError(qError.message);
        setLoading(false);
        return;
      }

      setRows((data as AdminCfitRow[]) ?? []);
      setLoading(false);
    }

    void load();
  }, [authLoading, profile?.role]);

  if (!authLoading && !isAssessmentStaffRole(profile?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        to="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-brand-navy/50 hover:text-brand-red"
      >
        <ArrowLeft size={16} /> Panel staf
      </Link>

      <h1 className="font-display text-2xl font-extrabold text-brand-navy">Hasil CFIT peserta</h1>
      <p className="mt-1 text-sm text-brand-navy/50">
        Daftar raw score, IQ, kategori, dan akses detail jawaban peserta.
      </p>

      {loading || authLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-red border-t-transparent" />
        </div>
      ) : error ? (
        <div className="mt-6 space-y-2">
          <p className="text-sm text-brand-red">{error}</p>
          <p className="text-xs text-brand-navy/50">
            Jika error fungsi tidak ditemukan, jalankan migration CFIT terbaru di Supabase SQL
            Editor.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-brand-navy/50">Belum ada hasil CFIT.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-brand-navy/8 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-brand-navy/8 bg-brand-bg text-xs uppercase tracking-wide text-brand-navy/45">
              <tr>
                <th className="px-4 py-3 font-bold">Peserta</th>
                <th className="px-4 py-3 font-bold">Raw</th>
                <th className="px-4 py-3 font-bold">IQ</th>
                <th className="px-4 py-3 font-bold">Kategori</th>
                <th className="px-4 py-3 font-bold">Usia/Norma</th>
                <th className="px-4 py-3 font-bold">Selesai</th>
                <th className="px-4 py-3 font-bold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
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
                    {row.raw_total ?? 0}/{CFIT_TOTAL_QUESTIONS}
                    <p className="text-xs font-normal text-brand-navy/45">
                      {row.raw_subtest1 ?? 0}/{row.raw_subtest2 ?? 0}/{row.raw_subtest3 ?? 0}/
                      {row.raw_subtest4 ?? 0}
                    </p>
                  </td>
                  <td
                    className={`px-4 py-3 font-bold ${
                      isIqMissing(row) ? "text-amber-600" : "text-brand-navy"
                    }`}
                  >
                    {getDisplayIq(row)}
                    {isIqMissing(row) && (
                      <span className="ml-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        Cek tgl lahir
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-navy/65">
                    {getDisplayCategory(row)}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-navy/50">
                    {formatAge(row.age_years, row.age_months)} · {row.norm_code ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-navy/50">
                    {new Date(row.completed_at).toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`${detailBasePath}/${row.user_id}`}
                      className="text-xs font-bold text-brand-red hover:underline"
                    >
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatAge(years: number | null, months: number | null) {
  if (years === null) return "-";
  return `${years} th ${months ?? 0} bln`;
}

function getDisplayIq(row: AdminCfitRow) {
  return row.iq ?? calculateCfitIqFromNorm(row.raw_total, row.norm_code).iq ?? "-";
}

function isIqMissing(row: AdminCfitRow) {
  return row.raw_total !== null && getDisplayIq(row) === "-";
}

function getDisplayCategory(row: AdminCfitRow) {
  return row.category ?? calculateCfitIqFromNorm(row.raw_total, row.norm_code).category ?? "-";
}
