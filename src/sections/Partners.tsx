import { ShieldCheck } from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import { Reveal } from "../components/Reveal";
import { partners } from "../data/content";
import trustImg from "../assets/images/partners-trust.jpg";
import logoWiwitan from "../assets/images/partners/partner-wiwitan.png";
import logoIjbAcademy from "../assets/images/partners/partner-ijb-academy.png";
import logoKasugaFarm from "../assets/images/solo-kfi/logo-kasuga-farm.png";
import logoAkiNoSora from "../assets/images/partners/partner-aki-no-sora.png";

const partnerLogos: Record<string, string> = {
  "partner-wiwitan": logoWiwitan,
  "partner-ijb-academy": logoIjbAcademy,
  "partner-kasuga-farm": logoKasugaFarm,
  "partner-aki-no-sora": logoAkiNoSora,
};

export function Partners() {
  return (
    <section id="partner" className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <SectionHeading
          eyebrow="Partner & Legalitas"
          title="Berjalan bersama mitra resmi"
          description="Harunokaze bekerja sama dengan lembaga pelatihan, akademi bahasa, dan mitra penempatan yang terdaftar resmi di Indonesia maupun Jepang."
        />

        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8 items-stretch">
          <Reveal direction="left" className="rounded-2xl overflow-hidden min-h-[280px] relative">
            <img
              src={trustImg}
              alt="Kemitraan resmi Harunokaze"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-navy-deep/70 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 text-white text-sm font-semibold">
              Kemitraan resmi lintas lembaga Indonesia–Jepang
            </div>
          </Reveal>

          <div className="flex flex-col gap-6">
            <Reveal delay={0.05}>
              <div className="rounded-2xl border border-brand-navy/8 bg-brand-bg px-7 py-7">
                <p className="mb-5 text-xs font-bold uppercase tracking-wider text-brand-navy/40">
                  Mitra Resmi Kami
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  {partners.map((partner) => (
                    <div
                      key={partner.name}
                      className="flex h-16 items-center justify-center rounded-xl border border-brand-navy/5 bg-white px-5 py-3 shadow-sm"
                    >
                      <img
                        src={partnerLogos[partner.logo]}
                        alt={partner.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full max-h-9 w-auto object-contain"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.1} className="flex items-start gap-3 rounded-xl bg-brand-navy/[0.03] px-6 py-4">
              <ShieldCheck size={18} className="text-brand-red shrink-0 mt-0.5" />
              <p className="text-sm text-brand-navy/60 leading-relaxed">
                Harunokaze beroperasi bersama LPK &amp; SO Wiwitan Baru yang terdaftar dan menjalankan proses
                penempatan kerja sesuai jalur resmi ketenagakerjaan Indonesia–Jepang.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
