/** Kunci & skoring Pimsleur — jangan expose ke UI soal */

export type PimsleurGrade = "A" | "B" | "C" | "D" | "E" | "F";

export type PimsleurScoreBreakdown = {
  score_section2: number;
  score_section3: number;
  score_section4: number;
  score_section5: number;
  score_section6: number;
  score_verbal: number;
  score_audio: number;
  score_total: number;
  grade: PimsleurGrade;
  grade_label: string;
  status_label: string;
  recommendation: string;
};

export type PimsleurResultMeta = {
  label: string;
  status: string;
  recommendation: string;
};

/** Seksi 3: huruf A–H */
const KEY_S3 = [
  "D", "F", "C", "G", "A", "H", "C", "E", "B", "F", "C", "H",
  "A", "F", "D", "E", "D", "G", "B", "E", "B", "H", "C", "E",
];

/** Seksi 4: huruf A–H */
const KEY_S4 = ["A", "F", "D", "G", "D", "H", "C", "E", "C", "F", "D", "E", "B", "F", "A"];

/** Seksi 5: Kabin / Boa / Teman */
const KEY_S5 = [
  "Kabin", "Kabin", "Boa", "Boa", "Boa", "Kabin", "Boa",
  "Teman", "Boa", "Teman", "Boa", "Teman", "Teman", "Boa", "Teman",
  "Kabin", "Teman", "Boa", "Boa", "Teman", "Kabin", "Boa", "Kabin",
  "Boa", "Teman", "Teman", "Teman", "Boa", "Boa", "Teman",
];

/** Seksi 6: nomor opsi 1–4 */
const KEY_S6 = [
  "1", "4", "2", "3", "4", "1", "2", "1", "2", "4", "3", "2",
  "1", "4", "2", "1", "4", "3", "2", "3", "1", "3", "1", "4",
];

const GRADE_META: Record<
  PimsleurGrade,
  { label: string; status: string; recommendation: string; min: number; max: number }
> = {
  A: {
    min: 90,
    max: 100,
    label: "Kesiapan Bahasa Sangat Baik",
    status: "LULUS",
    recommendation:
      "Kemampuan bahasa sangat baik. Kosakata luas, analisis bahasa kuat, dan mampu mengikuti instruksi audio dengan baik.",
  },
  B: {
    min: 80,
    max: 89,
    label: "Kesiapan Bahasa Baik",
    status: "LULUS",
    recommendation:
      "Pemahaman bahasa baik dengan kosakata cukup luas dan analisis yang stabil. Siap lanjut dengan penguatan terarah.",
  },
  C: {
    min: 70,
    max: 79,
    label: "Kesiapan Bahasa Cukup",
    status: "LULUS",
    recommendation:
      "Dasar bahasa cukup baik. Kosakata umum telah dikuasai, namun pengenalan pola bahasa masih perlu dilatih.",
  },
  D: {
    min: 60,
    max: 69,
    label: "Perlu Penguatan Bertahap",
    status: "DIBERI KESEMPATAN",
    recommendation:
      "Kemampuan bahasa dasar mulai terbentuk, namun masih terbatas pada kosakata, sehingga perlu penguatan bertahap.",
  },
  E: {
    min: 50,
    max: 59,
    label: "Perlu Penguatan Dasar",
    status: "DIBERI KESEMPATAN",
    recommendation:
      "Peserta berada pada tahap awal penguasaan bahasa. Memerlukan pembelajaran intensif pada fondasi dasar.",
  },
  F: {
    min: 0,
    max: 49,
    label: "Perlu Pendampingan Bahasa",
    status: "DIBERI KESEMPATAN",
    recommendation:
      "Peserta membutuhkan pendampingan lebih intensif dalam membangun fondasi bahasa sebelum lanjut tahap berikutnya.",
  },
};

export function getPimsleurResultMeta(
  grade: string | null | undefined,
): PimsleurResultMeta | null {
  const normalized = grade?.trim().toUpperCase();
  if (!normalized || !(normalized in GRADE_META)) return null;

  const meta = GRADE_META[normalized as PimsleurGrade];
  return {
    label: meta.label,
    status: meta.status,
    recommendation: meta.recommendation,
  };
}

export function gradeFromTotal(total: number): PimsleurGrade {
  if (total >= 90) return "A";
  if (total >= 80) return "B";
  if (total >= 70) return "C";
  if (total >= 60) return "D";
  if (total >= 50) return "E";
  return "F";
}

function norm(v: string | undefined): string {
  return (v ?? "").trim().toUpperCase();
}

/**
 * answers map: questionId -> value
 * s2-1: "0"|"2"|"4"|"6"|"8"
 * s3-n: "A".."H"
 * s4-n: "A".."H"
 * s5-n: "Kabin"|"Boa"|"Teman"
 * s6-n: "1"|"2"|"3"|"4"
 */
export function scorePimsleur(answers: Record<string, string>): PimsleurScoreBreakdown {
  const score_section2 = Number(answers["s2-1"] ?? 0) || 0;

  let score_section3 = 0;
  KEY_S3.forEach((key, i) => {
    if (norm(answers[`s3-${i + 1}`]) === norm(key)) score_section3 += 1;
  });

  let score_section4 = 0;
  KEY_S4.forEach((key, i) => {
    if (norm(answers[`s4-${i + 1}`]) === norm(key)) score_section4 += 1;
  });

  let score_section5 = 0;
  KEY_S5.forEach((key, i) => {
    if (norm(answers[`s5-${i + 1}`]) === norm(key)) score_section5 += 1;
  });

  let score_section6 = 0;
  KEY_S6.forEach((key, i) => {
    if (norm(answers[`s6-${i + 1}`]) === norm(key)) score_section6 += 1;
  });

  const score_verbal = score_section3 + score_section4;
  const score_audio = score_section5 + score_section6;
  const score_total = score_section2 + score_verbal + score_audio;
  const grade = gradeFromTotal(score_total);
  const meta = GRADE_META[grade];

  return {
    score_section2,
    score_section3,
    score_section4,
    score_section5,
    score_section6,
    score_verbal,
    score_audio,
    score_total,
    grade,
    grade_label: meta.label,
    status_label: meta.status,
    recommendation: meta.recommendation,
  };
}
