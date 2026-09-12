import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Clock3,
  ClipboardList,
  CreditCard,
  FileCheck,
  Mail,
  MessageCircle,
  ReceiptText,
  RotateCcw,
  TestTube,
  Users,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { ProgressSteps } from "../components/ProgressSteps";
import { LANDING_URL, supabase } from "../lib/supabase";
import { isPsychologistRole } from "../lib/access";
import { formatAdminDateTime } from "../lib/adminTools";
import { getParticipantNextStep } from "../lib/nextStep";
import { notifyPapikostikCompleted } from "../lib/papiNotifications";

const WHATSAPP_URL = "https://wa.me/message/DWVTJESHI2RQC1";

export function DashboardPage() {
  const { profile, progress } = useAuth();
  const isAdmin = profile?.role === "admin";

  if (isAdmin) {
    return <AdminHome name={profile?.full_name?.split(" ")[0] ?? "Admin"} />;
  }

  if (isPsychologistRole(profile?.role)) {
    return <PsychologistHome name={profile?.full_name?.split(" ")[0] ?? "Psikolog"} />;
  }

  return <ParticipantHome profileName={profile?.full_name?.split(" ")[0] ?? "Peserta"} progress={progress} />;
}

function PapiNotificationInboxForm({ description }: { description: string }) {
  const { profile, refreshProfile } = useAuth();
  const [notificationEmail, setNotificationEmail] = useState(profile?.notification_email ?? "");
  const [savingInbox, setSavingInbox] = useState(false);
  const [testingInbox, setTestingInbox] = useState(false);
  const [inboxMessage, setInboxMessage] = useState("");

  useEffect(() => {
    setNotificationEmail(profile?.notification_email ?? "");
  }, [profile?.notification_email]);

  async function saveNotificationEmail() {
    if (!profile?.id || savingInbox) return false;
    const nextEmail = notificationEmail.trim();
    setSavingInbox(true);
    setInboxMessage("");
    const { error } = await supabase
      .from("profiles")
      .update({ notification_email: nextEmail || null })
      .eq("id", profile.id);
    setSavingInbox(false);
    if (error) {
      setInboxMessage(error.message);
      return false;
    }
    await refreshProfile();
    setInboxMessage(
      nextEmail
        ? "Notifikasi PAPI akan dikirim ke alamat ini (bisa lebih dari satu)."
        : "Email notifikasi dikosongkan.",
    );
    return true;
  }

  async function sendTestNotification() {
    if (testingInbox) return;
    setTestingInbox(true);
    setInboxMessage("");
    const saved = await saveNotificationEmail();
    if (!saved) {
      setTestingInbox(false);
      return;
    }
    const result = await notifyPapikostikCompleted({ test: true });
    setTestingInbox(false);
    setInboxMessage(result.message);
  }

  return (
    <form
      className="rounded-2xl border border-brand-navy/8 bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void saveNotificationEmail();
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red-soft text-brand-red">
          <Mail size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-brand-navy">Email notifikasi PAPI</p>
          <p className="mt-1 text-sm text-brand-navy/50">{description}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <input
                type="text"
                value={notificationEmail}
                onChange={(event) => setNotificationEmail(event.target.value)}
                placeholder="gmail.psikolog@gmail.com, tester@gmail.com"
                className="w-full rounded-xl border border-brand-navy/12 bg-brand-bg px-3 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-red sm:flex-1"
              />
              <button
                type="submit"
                disabled={savingInbox || testingInbox}
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-navy-light disabled:opacity-60"
              >
                {savingInbox ? "Menyimpan…" : "Simpan"}
              </button>
              <button
                type="button"
                disabled={savingInbox || testingInbox}
                onClick={() => void sendTestNotification()}
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-brand-navy/12 px-4 py-2.5 text-sm font-bold text-brand-navy hover:border-brand-red/30 hover:text-brand-red disabled:opacity-60"
              >
                {testingInbox ? "Mengirim tes…" : "Kirim email tes"}
              </button>
            </div>
          {inboxMessage ? (
            <p className="mt-2 text-xs font-semibold text-brand-navy/55">{inboxMessage}</p>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function PsychologistHome({ name }: { name: string }) {
  const [queueRows, setQueueRows] = useState<
    Array<{ review_status: "pending" | "reviewed"; completed_at: string }>
  >([]);

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      const { data } = await supabase.rpc("psychologist_list_review_queue");
      if (active && data) {
        setQueueRows(
          data as Array<{ review_status: "pending" | "reviewed"; completed_at: string }>,
        );
      }
    }

    void loadQueue();
    return () => {
      active = false;
    };
  }, []);

  const pendingCount = queueRows.filter((row) => row.review_status === "pending").length;
  const reviewedCount = queueRows.filter((row) => row.review_status === "reviewed").length;
  const latestPending = queueRows
    .filter((row) => row.review_status === "pending")
    .sort((left, right) => new Date(right.completed_at).getTime() - new Date(left.completed_at).getTime())[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-red">
          Panel psikolog
        </p>
        <h1 className="font-display text-2xl font-extrabold text-brand-navy md:text-3xl">
          Halo, {name}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-brand-navy/55">
          Kelola pembacaan hasil asesmen peserta dan tulis interpretasi psikolog. Menu pembayaran dan
          persetujuan sertifikat tidak tersedia di area ini.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <HomeStat icon={<Clock3 size={18} />} label="Menunggu review" value={pendingCount} tone="amber" />
        <HomeStat icon={<CheckCircle2 size={18} />} label="Sudah direview" value={reviewedCount} tone="green" />
        <HomeStat
          icon={<Clock3 size={18} />}
          label="Peserta pending terakhir"
          value={latestPending ? formatAdminDateTime(latestPending.completed_at) : "-"}
          tone="blue"
        />
      </div>

      <PapiNotificationInboxForm description="Isi Gmail psikolog, lalu email tester, dipisah koma. Email login bisa tetap acak." />

      <Link
        to="/psychologist/papikostik"
        className="flex items-center justify-between gap-4 rounded-2xl border border-brand-navy/8 bg-white p-6 transition-all hover:border-brand-red/20 hover:shadow-md"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-red-soft text-brand-red">
            <FileCheck size={24} />
          </div>
          <div>
            <p className="font-display text-lg font-bold text-brand-navy">Antrean review PAPI Kostick</p>
            <p className="mt-1 text-sm text-brand-navy/50">
              Baca profil faktor dan isi interpretasi psikolog peserta
            </p>
          </div>
        </div>
        <ArrowRight className="shrink-0 text-brand-red" size={20} />
      </Link>

      <Link
        to="/psychologist/recap"
        className="flex items-center justify-between gap-4 rounded-2xl border border-brand-navy/8 bg-white p-6 transition-all hover:border-brand-red/20 hover:shadow-md"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-red-soft text-brand-red">
            <ClipboardList size={24} />
          </div>
          <div>
            <p className="font-display text-lg font-bold text-brand-navy">Rekap asesmen peserta</p>
            <p className="mt-1 text-sm text-brand-navy/50">
              Lihat ringkasan tiga tes, waktu pengerjaan, dan status kelengkapan
            </p>
          </div>
        </div>
        <ArrowRight className="shrink-0 text-brand-red" size={20} />
      </Link>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/psychologist/pimsleur"
          className="rounded-2xl border border-brand-navy/8 bg-white p-5 transition-all hover:border-brand-red/20 hover:shadow-md"
        >
          <p className="font-display font-bold text-brand-navy">Hasil Pimsleur</p>
          <p className="mt-1 text-sm text-brand-navy/50">Lihat skor dan detail jawaban peserta</p>
        </Link>
        <Link
          to="/psychologist/cfit"
          className="rounded-2xl border border-brand-navy/8 bg-white p-5 transition-all hover:border-brand-red/20 hover:shadow-md"
        >
          <p className="font-display font-bold text-brand-navy">Hasil CFIT</p>
          <p className="mt-1 text-sm text-brand-navy/50">Lihat IQ, kategori, dan detail jawaban</p>
        </Link>
      </div>

      <a
        href={LANDING_URL}
        className="block text-center text-xs text-brand-navy/40 transition-colors hover:text-brand-red"
      >
        ← Kembali ke website Harunokaze
      </a>
    </div>
  );
}

function HomeStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  tone: "amber" | "green" | "blue";
}) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
  }[tone];

  return (
    <div className="rounded-2xl border border-brand-navy/8 bg-white p-4">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}>{icon}</div>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-navy/45">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-brand-navy">{value}</p>
    </div>
  );
}

function AdminHome({ name }: { name: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-red">Panel staf</p>
        <h1 className="font-display text-2xl font-extrabold text-brand-navy md:text-3xl">
          Halo, {name}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-brand-navy/55">
          Ini beranda admin — khusus kelola hasil peserta. Menu pembayaran/tes peserta tidak ditampilkan
          di sini agar tidak bentrok.
        </p>
      </div>

      <PapiNotificationInboxForm description="Untuk tes, isi Gmailmu di sini. Bisa lebih dari satu, dipisah koma. Psikolog tetap bisa punya inbox sendiri." />

      <Link
        to="/admin/payments"
        className="flex items-center justify-between gap-4 rounded-2xl border border-brand-navy/8 bg-white p-6 transition-all hover:border-brand-red/20 hover:shadow-md"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-red-soft text-brand-red">
            <ReceiptText size={24} />
          </div>
          <div>
            <p className="font-display text-lg font-bold text-brand-navy">Tagihan peserta</p>
            <p className="mt-1 text-sm text-brand-navy/50">
              Tetapkan nominal, jatuh tempo, dan pantau status pembayaran
            </p>
          </div>
        </div>
        <ArrowRight className="shrink-0 text-brand-red" size={20} />
      </Link>

      <Link
        to="/admin/test-progress"
        className="flex items-center justify-between gap-4 rounded-2xl border border-brand-navy/8 bg-white p-6 transition-all hover:border-brand-red/20 hover:shadow-md"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-red-soft text-brand-red">
            <RotateCcw size={24} />
          </div>
          <div>
            <p className="font-display text-lg font-bold text-brand-navy">Progress tes peserta</p>
            <p className="mt-1 text-sm text-brand-navy/50">
              Pantau status 3 tes tiap peserta, reset tes yang macet di tengah jalan
            </p>
          </div>
        </div>
        <ArrowRight className="shrink-0 text-brand-red" size={20} />
      </Link>

      <Link
        to="/admin/pimsleur"
        className="flex items-center justify-between gap-4 rounded-2xl border border-brand-navy/8 bg-white p-6 transition-all hover:border-brand-red/20 hover:shadow-md"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-red-soft text-brand-red">
            <Users size={24} />
          </div>
          <div>
            <p className="font-display text-lg font-bold text-brand-navy">Hasil Pimsleur peserta</p>
            <p className="mt-1 text-sm text-brand-navy/50">
              Daftar peserta, skor tahap 2–6, grade A–F, dan detail jawaban
            </p>
          </div>
        </div>
        <ArrowRight className="shrink-0 text-brand-red" size={20} />
      </Link>

      <Link
        to="/admin/cfit"
        className="flex items-center justify-between gap-4 rounded-2xl border border-brand-navy/8 bg-white p-6 transition-all hover:border-brand-red/20 hover:shadow-md"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-red-soft text-brand-red">
            <TestTube size={24} />
          </div>
          <div>
            <p className="font-display text-lg font-bold text-brand-navy">Hasil CFIT peserta</p>
            <p className="mt-1 text-sm text-brand-navy/50">
              Raw score, IQ, kategori, dan detail jawaban per soal
            </p>
          </div>
        </div>
        <ArrowRight className="shrink-0 text-brand-red" size={20} />
      </Link>

      <Link
        to="/admin/papikostik"
        className="flex items-center justify-between gap-4 rounded-2xl border border-brand-navy/8 bg-white p-6 transition-all hover:border-brand-red/20 hover:shadow-md"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-red-soft text-brand-red">
            <FileCheck size={24} />
          </div>
          <div>
            <p className="font-display text-lg font-bold text-brand-navy">
              Hasil PAPI Kostick peserta
            </p>
            <p className="mt-1 text-sm text-brand-navy/50">
              Skor 20 faktor, detail jawaban, dan catatan review psikolog/admin
            </p>
          </div>
        </div>
        <ArrowRight className="shrink-0 text-brand-red" size={20} />
      </Link>

      <Link
        to="/admin/recap"
        className="flex items-center justify-between gap-4 rounded-2xl border border-brand-navy/8 bg-white p-6 transition-all hover:border-brand-red/20 hover:shadow-md"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-red-soft text-brand-red">
            <ClipboardList size={24} />
          </div>
          <div>
            <p className="font-display text-lg font-bold text-brand-navy">Rekap asesmen peserta</p>
            <p className="mt-1 text-sm text-brand-navy/50">
              Ringkasan tiga tes dan status review dalam satu tampilan admin
            </p>
          </div>
        </div>
        <ArrowRight className="shrink-0 text-brand-red" size={20} />
      </Link>

      <a
        href={LANDING_URL}
        className="block text-center text-xs text-brand-navy/40 transition-colors hover:text-brand-red"
      >
        ← Kembali ke website Harunokaze
      </a>
    </div>
  );
}

function ParticipantHome({
  profileName,
  progress,
}: {
  profileName: string;
  progress: ReturnType<typeof useAuth>["progress"];
}) {
  const paymentDone =
    progress?.payment_status === "verified" || progress?.payment_status === "paid";
  const pimsleurDone = progress?.language_test_status === "completed";
  const cfitDone = progress?.cfit_test_status === "completed";
  const papikostikDone = progress?.papikostik_test_status === "completed";
  const finalApproved = progress?.result_status === "completed";
  const resultAvailable =
    progress?.result_status === "available" ||
    progress?.result_status === "completed" ||
    pimsleurDone;
  const nextStep = getParticipantNextStep(progress);
  const pimsleurCta =
    pimsleurDone
      ? "Selesai"
      : progress?.language_test_status === "in_progress"
        ? "Lanjutkan tes"
        : "Mulai tes";
  const cfitCta = cfitDone
    ? "Selesai"
    : !pimsleurDone
      ? "Terkunci"
      : progress?.cfit_test_status === "in_progress"
        ? "Lanjutkan tes"
        : "Mulai tes";
  const papiCta = papikostikDone
    ? "Selesai"
    : !cfitDone
      ? "Terkunci"
      : progress?.papikostik_test_status === "in_progress"
        ? "Lanjutkan tes"
        : "Mulai tes";

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-red">Beranda</p>
          <h1 className="font-display text-2xl font-extrabold text-brand-navy md:text-3xl">
            Halo, {profileName}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-brand-navy/55">
            Semua tes pemetaan ada di sini, berurutan: bayar, Pimsleur, CFIT, PAPI, lalu review dan
            sertifikat. Kerjakan yang sedang terbuka dulu.
          </p>
        </div>

        <Link
          to={nextStep.href}
          className={`flex items-center justify-between gap-4 rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${
            nextStep.tone === "done"
              ? "border border-emerald-200 bg-emerald-50"
              : nextStep.tone === "wait"
                ? "border border-amber-200 bg-amber-50"
                : "bg-brand-red text-white"
          }`}
        >
          <div>
            <p
              className={`text-[11px] font-bold uppercase tracking-widest ${
                nextStep.tone === "action" ? "text-white/70" : "text-brand-navy/45"
              }`}
            >
              Langkah berikutnya
            </p>
            <p
              className={`mt-1 font-display text-lg font-bold ${
                nextStep.tone === "action" ? "text-white" : "text-brand-navy"
              }`}
            >
              {nextStep.title}
            </p>
            <p
              className={`mt-1 text-sm leading-relaxed ${
                nextStep.tone === "action" ? "text-white/80" : "text-brand-navy/60"
              }`}
            >
              {nextStep.description}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold ${
              nextStep.tone === "action"
                ? "bg-white text-brand-red"
                : "bg-brand-navy text-white"
            }`}
          >
            {nextStep.cta}
            <ArrowRight size={14} />
          </span>
        </Link>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ActionCard
            icon={<CreditCard size={20} />}
            title="Pembayaran Pemetaan"
            description="Bayar Rp99.000 untuk membuka tes"
            href="/payment"
            disabled={paymentDone}
            highlighted={nextStep.key === "payment"}
            cta={paymentDone ? "Sudah dibayar" : "Bayar sekarang"}
          />
          <ActionCard
            icon={<TestTube size={20} />}
            title="Tes Pimsleur"
            description="Aptitude bahasa · 30 menit · tahap 2–6"
            href="/test/pimsleur"
            disabled={!paymentDone || pimsleurDone}
            highlighted={nextStep.key === "language"}
            cta={pimsleurCta}
          />
          <ActionCard
            icon={<TestTube size={20} />}
            title="CFIT"
            description="Tes kognitif, aktif setelah Pimsleur"
            href="/test/cfit"
            disabled={!pimsleurDone || cfitDone}
            highlighted={nextStep.key === "cfit"}
            cta={cfitCta}
          />
          <ActionCard
            icon={<TestTube size={20} />}
            title="PAPI Kostick"
            description="Tes preferensi kerja, aktif setelah CFIT"
            href="/test/papikostik"
            disabled={!cfitDone || papikostikDone}
            highlighted={nextStep.key === "papikostik"}
            cta={papiCta}
          />
          <ActionCard
            icon={<FileCheck size={20} />}
            title="Hasil Pimsleur"
            description="Skor per tahap, grade A–F, rekomendasi"
            href="/result/pimsleur"
            disabled={!resultAvailable}
            cta={resultAvailable ? "Lihat hasil" : "Belum tersedia"}
          />
          <ActionCard
            icon={<FileCheck size={20} />}
            title="Hasil CFIT"
            description="Raw score, IQ, dan kategori"
            href="/result/cfit"
            disabled={!cfitDone}
            cta={cfitDone ? "Lihat hasil" : "Belum tersedia"}
          />
          <ActionCard
            icon={<FileCheck size={20} />}
            title="Status PAPI Kostick"
            description="Status jawaban dan review psikolog/admin"
            href="/result/papikostik"
            disabled={!papikostikDone}
            highlighted={nextStep.key === "result"}
            cta={papikostikDone ? "Lihat status" : "Belum tersedia"}
          />
          <ActionCard
            icon={<Award size={20} />}
            title="Sertifikat Pemetaan"
            description="Tersedia setelah psikolog, QC, dan admin menyetujui hasil"
            href="/result/certificate"
            disabled={!finalApproved}
            highlighted={nextStep.key === "certificate"}
            cta={finalApproved ? "Lihat sertifikat" : "Menunggu review"}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-brand-navy/12 bg-white px-5 py-3 text-sm font-bold text-brand-navy hover:border-brand-red/30 hover:text-brand-red"
          >
            <MessageCircle size={18} />
            Konsultasi lanjutan (WhatsApp)
          </a>
          <a
            href={LANDING_URL}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-brand-navy/12 bg-white px-5 py-3 text-sm font-bold text-brand-navy hover:border-brand-red/30 hover:text-brand-red"
          >
            ← Kembali ke website
          </a>
        </div>
      </div>

      <div className="lg:col-span-2">
        <ProgressSteps progress={progress} />
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  href,
  disabled,
  cta,
  highlighted,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  disabled?: boolean;
  cta: string;
  highlighted?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red-soft text-brand-red">
          {icon}
        </div>
        <div>
          <p className="text-sm font-bold text-brand-navy">{title}</p>
          <p className="mt-1 text-xs text-brand-navy/50">{description}</p>
        </div>
      </div>
      <span
        className={`mt-4 inline-flex items-center gap-1 text-xs font-bold ${
          disabled ? "text-brand-navy/30" : "text-brand-red"
        }`}
      >
        {cta}
        {!disabled && <ArrowRight size={14} />}
      </span>
    </>
  );

  if (disabled) {
    return (
      <div className="cursor-not-allowed rounded-2xl border border-brand-navy/8 bg-white/60 p-5 opacity-60">
        {inner}
      </div>
    );
  }

  return (
    <Link
      to={href}
      className={`rounded-2xl border bg-white p-5 transition-all hover:border-brand-red/20 hover:shadow-md ${
        highlighted ? "border-brand-red/40 ring-2 ring-brand-red/15" : "border-brand-navy/8"
      }`}
    >
      {inner}
    </Link>
  );
}
