import type { CertificateAssetUrls } from "./certificateAssets";
import { certificateNameFontSize, formatCertificateName } from "./certificateNameArt";
import { getPimsleurResultMeta } from "./pimsleurScoring";

export type CertificateData = {
  fullName: string;
  certificateCode: string;
  issuedAt: string;
  /** CFIT */
  cfitRawTotal: number | null;
  cfitIq: number | null;
  cfitCategory: string | null;
  /** PAPI */
  papiHasil: string | null;
  papiCatatan: string | null;
  /** Pimsleur */
  pimsleurScore: number | null;
  pimsleurGrade: string | null;
  pimsleurLevelLabel: string | null;
  pimsleurStatusLabel: string | null;
  pimsleurRecommendation: string | null;
};

function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitTextIntoChunks(value: string, maxCharacters: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > maxCharacters) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function firstSentence(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "";

  return normalized.match(/^.*?[.!?](?=\s|$)/)?.[0]?.trim() ?? normalized;
}

export function buildCertificateHtml(
  data: CertificateData,
  assets: CertificateAssetUrls,
): string {
  const dateStr = new Date(data.issuedAt).toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const name = esc(formatCertificateName(data.fullName) || "Peserta");
  const code = esc(data.certificateCode);
  const cfitSkor = data.cfitRawTotal !== null ? `${data.cfitRawTotal} / 50` : "-";
  const cfitIq = data.cfitIq !== null ? String(data.cfitIq) : "-";
  const cfitKat = esc(data.cfitCategory ?? "Belum tersedia");
  const papiSummary = data.papiHasil?.trim() || "Menunggu review";
  const papiHasil = esc(firstSentence(papiSummary));
  const narrativeText = data.papiCatatan?.trim() || "Belum ada catatan psikolog.";
  const narrativeChunks =
    narrativeText.length > 900 ? splitTextIntoChunks(narrativeText, 2200) : [];
  const papiCatatan = esc(
    narrativeChunks.length > 0
      ? "Narasi lengkap dilanjutkan di halaman berikutnya."
      : narrativeText,
  );
  const pimsleurMeta = getPimsleurResultMeta(data.pimsleurGrade);
  const pimsleurNilai =
    data.pimsleurScore !== null
      ? `${data.pimsleurScore}${data.pimsleurGrade ? ` / ${data.pimsleurGrade}` : ""}`
      : "-";
  const pimsleurLevel = esc(
    data.pimsleurLevelLabel?.trim() ||
      pimsleurMeta?.label ||
      data.pimsleurStatusLabel?.trim() ||
      pimsleurMeta?.status ||
      "Belum tersedia",
  );
  const pimsleurCatatan = esc(
    data.pimsleurRecommendation?.trim() ||
      pimsleurMeta?.recommendation ||
      "Belum ada catatan evaluasi.",
  );
  const nameFontSize = certificateNameFontSize(data.fullName);

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Sertifikasi Pemetaan Talenta — ${name}</title>
  <link data-certificate-fonts="true" href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Outfit:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #eef1f5;
      color: #0f2240;
      padding: 24px;
    }
    .page {
      max-width: 900px;
      margin: 0 auto 28px;
      background: #fff;
      position: relative;
      overflow: hidden;
      border-radius: 4px;
      box-shadow: 0 12px 40px rgba(15,34,64,0.12);
      min-height: 1100px;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .side-bar {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 28px;
      background: linear-gradient(180deg, #e61935 0%, #0f2240 55%, #0f2240 100%);
    }
    /* Equal side padding so centered text aligns to the page visual center
       (sidebar sits outside this box as decoration only). */
    .content { padding: 44px 56px 48px 56px; }
    .cover-content {
      min-height: 1100px;
      display: flex;
      flex-direction: column;
    }
    .logos {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
      min-height: 104px;
      margin-bottom: 24px;
    }
    .logos > div:not(.divider-dot) { display: none; }
    .logo-image {
      display: block;
      object-fit: contain;
    }
    .logo-hnz {
      width: 78px;
      height: 104px;
    }
    .logo-wiwitan {
      width: 232px;
      height: 76px;
    }
    .divider-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #e61935;
    }
    h1.title {
      font-family: 'Outfit', sans-serif;
      font-size: 34px;
      font-weight: 800;
      text-align: center;
      color: #0f2240;
      letter-spacing: 0.02em;
      margin-bottom: 18px;
    }
    .badge {
      display: inline-block;
      background: #e61935;
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      padding: 8px 22px;
      border-radius: 999px;
      margin: 0 auto 10px;
    }
    .badge-wrap { text-align: center; }
    .recipient-block {
      margin-top: -4px;
      width: 100%;
      text-align: center;
    }
    /* Placeholder swapped for a pre-centered PNG before PDF capture. */
    .name,
    .name-art {
      display: block;
      width: 100%;
      margin: 2px auto 16px;
      padding: 0;
    }
    .name {
      font-family: 'Great Vibes', cursive;
      font-size: var(--certificate-name-size, 56px);
      font-weight: 400;
      text-align: center;
      color: #c41e3a;
      line-height: 1.22;
      min-height: 78px;
    }
    .name-art {
      height: auto;
    }
    .role {
      text-align: center;
      font-size: 14px;
      font-weight: 600;
      color: #0f2240;
      margin-bottom: 24px;
      line-height: 1.55;
    }
    .body-text {
      text-align: center;
      font-size: 14px;
      line-height: 1.75;
      color: rgba(15,34,64,0.72);
      max-width: 620px;
      margin: 0 auto;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 24px;
      margin-top: auto;
      padding-top: 48px;
    }
    .meta-left {
      font-size: 12px;
      color: rgba(15,34,64,0.55);
      line-height: 1.7;
    }
    .sign {
      text-align: center;
      min-width: 220px;
    }
    .signature-image {
      display: block;
      width: 190px;
      height: 58px;
      margin: 0 auto 4px;
      object-fit: contain;
    }
    .sign-name {
      font-size: 13px;
      font-weight: 700;
      color: #0f2240;
      margin-top: 6px;
    }
    .sign-title {
      font-size: 11px;
      color: rgba(15,34,64,0.5);
      margin-top: 2px;
    }
    .code {
      text-align: center;
      margin-top: 28px;
      font-family: monospace;
      font-size: 11px;
      color: rgba(15,34,64,0.4);
    }

    /* Page 2 tables */
    .section-title {
      font-family: 'Outfit', sans-serif;
      font-size: 18px;
      font-weight: 800;
      color: #e61935;
      margin: 28px 0 10px;
    }
    .section-title:first-of-type { margin-top: 8px; }
    table.report {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 13px;
    }
    table.report th,
    table.report td {
      border: 1px solid rgba(15,34,64,0.15);
      padding: 12px 14px;
      text-align: left;
      vertical-align: top;
    }
    table.report th {
      width: 32%;
      background: #fafafa;
      font-weight: 700;
      color: #0f2240;
    }
    table.report td {
      color: rgba(15,34,64,0.78);
      line-height: 1.55;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .page2-header {
      font-family: 'Outfit', sans-serif;
      font-size: 22px;
      font-weight: 800;
      color: #0f2240;
      margin-bottom: 6px;
    }
    .page2-sub {
      font-size: 12px;
      color: rgba(15,34,64,0.45);
      margin-bottom: 20px;
    }
    .narrative-content {
      min-height: 1000px;
    }
    .narrative-body {
      color: rgba(15,34,64,0.78);
      font-size: 14px;
      line-height: 1.8;
      white-space: pre-wrap;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .page {
        box-shadow: none;
        border-radius: 0;
        margin: 0;
        min-height: 100vh;
      }
    }
  </style>
</head>
<body>
  <!-- PAGE 1: Cover -->
  <div class="page">
    <div class="side-bar"></div>
    <div class="content cover-content">
      <div class="logos">
        <div>
          <div class="logo-text">wiwitan</div>
          <div class="logo-sub">Improving lives · Improving quality of life</div>
        </div>
        <img class="logo-image logo-hnz" src="${assets.logoHarunokaze}" alt="Harunokaze" />
        <div class="divider-dot"></div>
        <img class="logo-image logo-wiwitan" src="${assets.logoWiwitan}" alt="Wiwitan" />
        <div>
          <div class="logo-text">Haru<span>No</span>Kaze</div>
          <div class="logo-sub">春の風 · HARU NO KAZE</div>
        </div>
      </div>

      <h1 class="title">SERTIFIKASI PEMETAAN TALENTA</h1>
      <div class="recipient-block">
        <div class="badge-wrap"><span class="badge">Dengan Bangga Diberikan Kepada :</span></div>
        <p class="name" style="--certificate-name-size: ${nameFontSize}px">${name}</p>
        <p class="role">
          Sebagai peserta Seleksi Awal Program Pelatihan ke Jepang di LPK<br/>
          Wiwitan Baru Sukabumi
        </p>
        <p class="body-text">
          Berdasarkan hasil tersebut, peserta dinyatakan telah menyelesaikan seluruh tahapan seleksi awal.
          Semoga hasil ini bisa menjadi bahan evaluasi dan pengembangan diri dalam mengikuti
          pelatihan di LPK Wiwitan Baru Sukabumi.
        </p>
      </div>

      <div class="meta-row">
        <div class="meta-left">
          <div><strong>Ditetapkan di:</strong> Sukabumi</div>
          <div><strong>Tanggal:</strong> ${esc(dateStr)}</div>
        </div>
        <div class="sign">
          <img class="signature-image" src="${assets.signatureAki}" alt="Tanda tangan Ketua LPK" />
          <div class="sign-name">Setiaki Murdi Pratomodono</div>
          <div class="sign-title">Ketua LPK Wiwitan Baru Sukabumi</div>
        </div>
      </div>
      <p class="code">${code}</p>
    </div>
  </div>

  <!-- PAGE 2: Detail rekap 3 asesmen -->
  <div class="page">
    <div class="side-bar"></div>
    <div class="content">
      <p class="page2-header">Rekap Hasil Pemetaan Talenta</p>
      <p class="page2-sub">${name} · ${code} · ${esc(dateStr)}</p>

      <h2 class="section-title">Pemetaan Potensi Berpikir</h2>
      <table class="report">
        <tr><th>Skor</th><td>${esc(cfitSkor)}</td></tr>
        <tr><th>IQ</th><td>${esc(cfitIq)}</td></tr>
        <tr><th>Klasifikasi</th><td>${cfitKat}</td></tr>
      </table>

      <h2 class="section-title">Pemetaan Karakter &amp; Gaya Kerja</h2>
      <table class="report">
        <tr><th>Hasil</th><td>${papiHasil}</td></tr>
        <tr><th>Catatan</th><td>${papiCatatan}</td></tr>
      </table>

      <h2 class="section-title">Pemetaan Kesiapan Belajar Bahasa</h2>
      <table class="report">
        <tr><th>Nilai</th><td>${esc(pimsleurNilai)}</td></tr>
        <tr><th>Level Kesiapan Belajar Bahasa</th><td>${pimsleurLevel}</td></tr>
        <tr><th>Catatan Evaluasi</th><td>${pimsleurCatatan}</td></tr>
      </table>
    </div>
  </div>
  ${narrativeChunks
    .map(
      (chunk, index) => `
  <div class="page">
    <div class="side-bar"></div>
    <div class="content narrative-content">
      <p class="page2-header">Narasi Hasil Asesmen</p>
      <p class="page2-sub">${name} · ${code} · Bagian ${index + 1}</p>
      <div class="narrative-body">${esc(chunk)}</div>
    </div>
  </div>`,
    )
    .join("")}
</body>
</html>`;
}
