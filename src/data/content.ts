/** Portal pemetaan — override via VITE_PORTAL_URL di Vercel */
export const portalUrl =
  import.meta.env.VITE_PORTAL_URL ?? "https://portal.harunokaze.id";

export const navLinks = [
  { href: "#tentang", label: "Tentang" },
  { href: "#tahapan", label: "Tahapan" },
  { href: "#hnz-solo", label: "HNZ Solo" },
  { href: "#ekosistem", label: "Ekosistem" },
  { href: "#pemetaan", label: "Pemetaan" },
  { href: "#alumni", label: "Alumni" },
  { href: "#faq", label: "FAQ" },
];

export const instagramUrl = "https://www.instagram.com/harunokaze.id/";

export const soloKfiProgram = {
  eyebrow: "Jalur Terbaru",
  title: "Program HNZ Solo",
  subtitle: "Persiapan Karier Driver di Jepang",
  description:
    "Harunokaze berkolaborasi dengan LPK Kasuga Farm Indonesia dalam Program HNZ Solo untuk jalur persiapan karier Driver di Jepang. Program dilaksanakan di Solo sebagai jalur terbaru di ekosistem Harunokaze.",
  highlights: [
    "Seleksi awal untuk kandidat yang serius menuju jalur Driver di Jepang",
    "Pendidikan bahasa Jepang dan persiapan karier di Solo bersama LPK Kasuga Farm Indonesia",
    "Pendampingan menuju peluang kerja setelah tahap persiapan selesai",
  ],
  ctaNote:
    "Ringkasan program ada di sini. Jadwal, batch, dan info terbaru yang paling update kami bagikan di Instagram Harunokaze.",
  ctaLabel: "Lihat Info Terbaru di Instagram",
  badge: "Solo · Driver Jepang",
  imageAlt:
    "Program HNZ Solo bersama LPK Kasuga Farm Indonesia untuk persiapan karier Driver di Jepang.",
  gallery: [
    {
      key: "worker" as const,
      alt: "Kandidat program driver di lingkungan kerja logistik Jepang",
    },
    {
      key: "trucks" as const,
      alt: "Armada truk logistik Jepang untuk jalur karier driver",
    },
    {
      key: "walking" as const,
      alt: "Tim operasional logistik Jepang di area distribusi",
    },
    {
      key: "cab" as const,
      alt: "Pengemudi truk logistik sedang bersiap menjalankan kendaraan",
    },
  ],
};

export const heroStats = [
  { value: "6", label: "Tahap pendampingan end-to-end" },
  { value: "100%", label: "Bermitra resmi & terdaftar Kemenaker" },
  { value: "Digital", label: "Pemetaan & monitoring proses" },
];

export const trustBadges = [
  "Terdaftar Kemenaker RI",
  "LPK & SO Resmi Bersertifikat",
  "Jalur SSW & TITP Legal",
  "Kemitraan Terverifikasi",
];

export const heroSteps = [
  { label: "Pemetaan & konsultasi awal", active: false },
  { label: "Pendidikan & pelatihan bahasa", active: true },
  { label: "Job matching & interview", active: false },
  { label: "Persiapan keberangkatan", active: false },
  { label: "Pendampingan selama bekerja", active: false },
  { label: "Kembali ke Indonesia & langkah berikutnya", active: false },
];

export const ecosystemRoles = [
  {
    tag: "Harunokaze",
    title: "Menarik & menyiapkan minat",
    description:
      "Edukasi publik, informasi karier Jepang, pemetaan potensi, dan konsultasi awal — titik masuk sebelum seseorang resmi menjadi peserta didik.",
  },
  {
    tag: "LPK & SO Wiwitan Baru",
    title: "Mendidik & melatih",
    description:
      "Pelatihan bahasa Jepang, kedisiplinan, kesiapan kerja, hingga proses formal keberangkatan sesuai jalur resmi tenaga kerja (SSW & TITP).",
  },
  {
    tag: "Mitra Jaringan",
    title: "Mempertemukan & menampung",
    description:
      "Mitra penempatan kerja dan lembaga pendidikan di Jepang yang menerima serta mendampingi peserta selama masa kerja.",
  },
];

export const journeyStages = [
  {
    num: "01",
    title: "Enrollment",
    description: "Edukasi, pemetaan potensi, konsultasi & pendaftaran.",
  },
  {
    num: "02",
    title: "Pendidikan",
    description: "Bahasa Jepang, karakter, kesiapan wawancara & dokumen.",
  },
  {
    num: "03",
    title: "Job Matching",
    description: "Pencocokan peserta dengan kebutuhan mitra kerja.",
  },
  {
    num: "04",
    title: "Keberangkatan",
    description: "Visa, COE, briefing pra-keberangkatan.",
  },
  {
    num: "05",
    title: "Bekerja di Jepang",
    description: "Pendampingan adaptasi & asistensi selama bekerja.",
  },
  {
    num: "06",
    title: "Kembali & Langkah Berikutnya",
    description: "Transisi karier & jaringan alumni sepulang ke Indonesia.",
  },
];

export type ProgramItem = {
  icon: string;
  title: string;
  description: string;
  meta: string;
  href?: string;
  hrefLabel?: string;
};

export const programs: ProgramItem[] = [
  {
    icon: "語",
    title: "Pelatihan Bahasa & Karakter",
    description:
      "Kelas bahasa Jepang terstruktur per modul, dilengkapi pembentukan disiplin dan kesiapan kerja lintas budaya.",
    meta: "Training Program",
  },
  {
    icon: "建",
    title: "Program Bidang Konstruksi",
    description:
      "Persiapan kerja Jepang di sektor konstruksi, mencakup kompetensi teknis dasar dan kesiapan lapangan.",
    meta: "Sektor Prioritas",
  },
  {
    icon: "介護",
    title: "Program Perawatan & Jasa",
    description:
      "Jalur kerja di bidang kaigo (perawatan lansia) dan layanan, sesuai permintaan mitra penempatan.",
    meta: "Sektor Berkembang",
  },
  {
    icon: "運",
    title: "Program Bidang Kerja Driver",
    description:
      "Jalur persiapan karier Driver di Jepang melalui Program HNZ Solo, berkolaborasi dengan LPK Kasuga Farm Indonesia di Solo.",
    meta: "Program HNZ Solo",
    href: "#hnz-solo",
    hrefLabel: "Info lengkap",
  },
  {
    icon: "協",
    title: "Job Opportunity Collaborator",
    description:
      "Kolaborasi dengan mitra penyedia lowongan kerja resmi di Jepang untuk memastikan penempatan yang sah dan terpantau.",
    meta: "Kolaborator",
  },
  {
    icon: "教",
    title: "Training Program Collaborator",
    description:
      "Kerja sama dengan lembaga pelatihan & pendidikan bahasa untuk memperkuat kualitas kurikulum dan pengajar.",
    meta: "Kolaborator",
  },
  {
    icon: "追",
    title: "Kelas Persiapan Tambahan",
    description:
      "Modular class untuk peserta yang butuh persiapan interview matching atau ujian SSW secara terpisah.",
    meta: "Add-on",
  },
];

export const mappingSteps = [
  { label: "Registrasi & akun peserta", status: "done" as const },
  { label: "Verifikasi pembayaran", status: "done" as const },
  { label: "Tes potensi & bahasa", status: "active" as const },
  { label: "Tes kepribadian", status: "pending" as const },
  { label: "Hasil & sertifikat digital", status: "pending" as const },
  { label: "Konsultasi lanjutan", status: "optional" as const },
];

export const mappingPoints = [
  "Registrasi & pembayaran dilakukan online, tanpa antre jadwal manual.",
  "Rangkaian tes mencakup potensi umum, pemahaman bahasa, dan kepribadian.",
  "Hasil awal & sertifikat digital langsung tersedia setelah tes selesai.",
  "Opsional lanjut ke sesi konsultasi dengan tim Harunokaze.",
];

export const whyUsPillars = [
  {
    num: "01",
    title: "Disiplin Finansial",
    description:
      "Struktur biaya dan tahapan pembayaran dirancang transparan dan mengikuti progres, bukan dibebankan di awal secara sepihak.",
  },
  {
    num: "02",
    title: "Pendidikan Terukur",
    description:
      "Kurikulum, progres belajar, dan kesiapan peserta dipantau secara berkala, bukan dilepas begitu saja.",
  },
  {
    num: "03",
    title: "Aktivasi Komunitas",
    description:
      "Webinar, sesi konsultasi, dan dokumentasi kegiatan rutin dijalankan agar calon peserta punya gambaran nyata program.",
  },
  {
    num: "04",
    title: "Transparansi & Evaluasi",
    description:
      "Setiap tahap punya proses monitoring internal, sehingga kualitas layanan bisa terus dievaluasi dan diperbaiki.",
  },
];

export const partners = [
  { name: "LPK & SO Wiwitan Baru", logo: "partner-wiwitan" },
  { name: "IJB Academy", logo: "partner-ijb-academy" },
  { name: "Kasuga Farm", logo: "partner-kasuga-farm" },
  { name: "Aki No Sora", logo: "partner-aki-no-sora" },
];

export const alumniStories = [
  {
    quote: "Prosesnya jelas dari awal — saya tahu harus siap apa sebelum berangkat.",
    who: "Alumni Program Konstruksi",
    photo: "alumni-1",
  },
  {
    quote: "Pendampingan setelah sampai di Jepang benar-benar membantu adaptasi awal.",
    who: "Alumni Program Kaigo",
    photo: "alumni-2",
  },
  {
    quote: "Pemetaan potensi di awal bikin saya lebih yakin pilih jalur yang tepat.",
    who: "Peserta Aktif",
    photo: "alumni-3",
  },
];

export const faqs = [
  {
    q: "Apakah Harunokaze sama dengan LPK & SO Wiwitan Baru?",
    a: "Tidak persis sama. Harunokaze adalah ekosistem yang mendampingi peserta dari awal hingga kembali ke Indonesia, sementara LPK & SO Wiwitan Baru adalah lembaga yang menjalankan pendidikan dan pelatihannya secara resmi dan terdaftar di Kemenaker RI.",
  },
  {
    q: "Apakah program ini lowongan kerja langsung?",
    a: "Bukan. Ini adalah program persiapan yang mencakup pendidikan selama beberapa bulan sebelum peserta masuk ke tahap job matching dan keberangkatan.",
  },
  {
    q: "Berapa lama proses pendidikannya?",
    a: "Durasi pendidikan disesuaikan dengan jalur dan kesiapan masing-masing peserta. Detail lengkap akan dijelaskan saat sesi konsultasi.",
  },
  {
    q: "Bagaimana cara mulai pemetaan potensi?",
    a: 'Kamu bisa memulai lewat tombol "Mulai Pemetaan Potensi" di header atau hero, atau mengisi form konsultasi di bagian bawah lalu lanjut chat WhatsApp.',
  },
];

export const whatsappUrl = "https://wa.me/message/DWVTJESHI2RQC1";

/** Nomor WA internasional tanpa + (opsional). Jika diisi, pesan konsultasi langsung ke nomor ini. */
export const whatsappPhone = import.meta.env.VITE_WHATSAPP_PHONE?.replace(/\D/g, "") ?? "";

export function buildConsultWhatsAppUrl(input: {
  name: string;
  whatsapp: string;
  interest: string;
}) {
  const text = [
    "Halo Harunokaze, saya ingin konsultasi.",
    "",
    `Nama: ${input.name.trim()}`,
    `WhatsApp: ${input.whatsapp.trim()}`,
    `Minat program: ${input.interest.trim()}`,
  ].join("\n");

  const encoded = encodeURIComponent(text);
  if (whatsappPhone) {
    return `https://wa.me/${whatsappPhone}?text=${encoded}`;
  }
  // Tanpa nomor: buka WhatsApp dengan pesan siap kirim (pilih chat Harunokaze)
  return `https://wa.me/?text=${encoded}`;
}

export const galleryPhotos = [
  { key: "activity-classroom", caption: "Kelas bahasa & diskusi kelompok" },
  { key: "activity-orientation", caption: "Orientasi budaya & etika kerja Jepang" },
  { key: "activity-graduation", caption: "Wisuda kelulusan peserta" },
  { key: "activity-departure", caption: "Momen keberangkatan ke Jepang" },
];

export const officeInfo = {
  addressNote: "Alamat lengkap kampus & kantor akan diinformasikan saat sesi konsultasi.",
  city: "Sukabumi, Jawa Barat",
  hours: "Senin–Sabtu, 08.00–17.00 WIB",
};
