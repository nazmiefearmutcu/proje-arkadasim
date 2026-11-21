import { ArrowDown, Check } from "lucide-react";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/common/logo";
import { ButtonLink } from "@/components/ui/button";

// Misafir açılış sayfasının bölümleri. Tasarım: siyah-beyaz, keskin köşeler, ince ızgara zeminler.
// Renk yalnız disiplin vurgularında (şerit renkleri) ve doğrulama tikinde kullanılır. Bölümler statiktir;
// örnek proje metni yerine soyut çizimler kullanılır.

const GRID_DARK =
  "[background-image:linear-gradient(to_right,rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.06)_1px,transparent_1px)] [background-size:48px_48px]";
const GRID_LIGHT =
  "[background-image:linear-gradient(to_right,rgb(13_17_23/0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgb(13_17_23/0.045)_1px,transparent_1px)] [background-size:40px_40px]";

function Eyebrow({ children, inverse = false }: { children: ReactNode; inverse?: boolean }) {
  return (
    <p
      className={`mb-3 inline-flex items-center gap-2 font-mono text-[12px] font-[600] tracking-[0.18em] uppercase ${
        inverse ? "text-white/80" : "text-ink-2"
      }`}
    >
      <span aria-hidden="true" className={`h-0.5 w-4 ${inverse ? "bg-white/80" : "bg-ink"}`} />
      {children}
    </p>
  );
}

const HUB_TILES = [
  { label: "Mühendislik", sub: "Sistem", color: "var(--d-yazilim)" },
  { label: "Biyoloji", sub: "Doğa bilimi", color: "var(--d-temel)" },
  { label: "Tasarım", sub: "Arayüz ve form", color: "var(--d-sosyal)" },
  { label: "Hukuk", sub: "Regülasyon", color: "var(--d-endustri)" },
  { label: "Yazılım", sub: "Geliştirme", color: "var(--d-yazilim)" },
  { label: "İşletme", sub: "Strateji", color: "var(--d-elektronik)" },
] as const;

function HubTile({ tile }: { tile: (typeof HUB_TILES)[number] }) {
  return (
    <div className="border bg-black/60 p-2.5 sm:p-3" style={{ borderColor: tile.color }}>
      <div className="mb-2 flex items-center justify-between">
        <span aria-hidden="true" className="size-4 border-[1.5px]" style={{ borderColor: tile.color }} />
        <span aria-hidden="true" className="size-2" style={{ background: tile.color }} />
      </div>
      <div className="font-display text-[13px] leading-tight font-[700] text-white sm:text-[14px]">{tile.label}</div>
      <div className="mt-0.5 text-[10px] tracking-wider text-white/60 uppercase">{tile.sub}</div>
    </div>
  );
}

/** Giriş bölümü: başlık ve iki düğme solda, disiplin bağlantı matrisi sağda, altında 1-2-3 adımlar. */
export function LandingHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section data-wide className={`relative overflow-hidden rounded-card bg-pen text-pen-ink ${GRID_DARK}`}>
      <div className="grid grid-cols-1 items-center gap-10 px-5 pt-10 pb-10 sm:px-8 lg:grid-cols-12 lg:gap-12 lg:px-12 lg:pt-14">
        <div className="flex flex-col gap-6 lg:col-span-6">
          <h1 className="t-hero">Bölümünün dışında bir ekip kur.</h1>
          <p className="max-w-xl text-[16px] leading-relaxed text-white/85 sm:text-[18px]">
            Fikrini panoya as, aradığın rolleri şeritlere yaz. Başka bölümlerden öğrenciler ve mezunlar kendine uyan
            şeridi koparıp ekibine katılsın.
          </p>
          <div className="flex flex-wrap gap-3.5 pt-1">
            {signedIn ? (
              <ButtonLink href="/dogrulama" variant="inverse" className="h-12 px-6 text-[15px]">
                Belgeni yükle
              </ButtonLink>
            ) : (
              <ButtonLink href="/kayit" variant="inverse" className="h-12 px-6 text-[15px]">
                Hesap oluştur
              </ButtonLink>
            )}
            <ButtonLink href="/projeler" variant="inverse-outline" className="h-12 px-6 text-[15px]">
              Panodaki projelere bak
            </ButtonLink>
          </div>
          <p className="max-w-md border-l-2 border-white/35 pl-3.5 text-[13px] leading-relaxed text-white/75">
            Yalnızca öğrenci ya da mezun belgesi doğrulanmış kişiler proje asabilir ve şerit koparabilir. Panoya herkes
            bakabilir.
          </p>
        </div>

        <div className="lg:col-span-6" aria-hidden="true">
          <div className="border border-white/25 bg-black/40 p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-white/15 pb-3">
              <span className="flex items-center gap-2 font-display text-[12px] font-[600] tracking-[0.16em] text-white/90 uppercase">
                <span className="size-2.5 bg-white" />
                Disiplin bağlantı matrisi
              </span>
              <span className="font-mono text-[11px] tracking-wider text-white/60 uppercase">Ekibi dengele</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {HUB_TILES.slice(0, 3).map((tile) => (
                <HubTile key={tile.label} tile={tile} />
              ))}
            </div>
            <div className="my-5 flex justify-center">
              <div className="flex items-center gap-3.5 border-2 border-white bg-white px-5 py-3.5 text-ink shadow-[6px_6px_0_rgb(255_255_255/0.25)]">
                <LogoMark onLight className="size-8 text-ink" />
                <div>
                  <div className="font-display text-[14px] leading-tight font-[700] tracking-wide uppercase">Proje Arkadaşım</div>
                  <div className="mt-0.5 font-mono text-[11px] text-ink-2">6 disiplin tek masada</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {HUB_TILES.slice(3).map((tile) => (
                <HubTile key={tile.label} tile={tile} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <ol className="mx-5 grid grid-cols-1 gap-8 border-t border-white/25 pt-8 pb-10 sm:mx-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-white/20 lg:mx-12">
        {[
          ["Hesabını aç, belgeni yükle", "e-Devlet öğrenci ya da mezun belgen saniyeler içinde kontrol edilir."],
          ["Projeni as ya da bir şerit kopar", "Her şerit bir rol. Dolunca panodan düşer."],
          ["Ekibinle yazış, üretmeye başla", "Mesajlar yalnızca ekip arkadaşlarından ve kabul ettiğin kişilerden gelir."],
        ].map(([title, text], index) => (
          <li key={title} className={index === 0 ? "md:pr-8" : index === 1 ? "md:px-8" : "md:pl-8"}>
            <div aria-hidden="true" className="mb-3 font-display text-[30px] leading-none font-[700]">
              {index + 1}
            </div>
            <h2 className="mb-1.5 font-display text-[17px] font-[700]">{title}</h2>
            <p className="text-[14px] leading-relaxed text-white/80">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const DEMO_STRIPS = [
  { label: "Yazılım", color: "var(--d-yazilim)", torn: false },
  { label: "Tasarım", color: "var(--d-sosyal)", torn: false },
  { label: "Araştırma", color: "var(--d-endustri)", torn: true },
  { label: "Analiz", color: "var(--d-temel)", torn: false },
] as const;

/** "Şerit mantığı nasıl işler?": soyut bir pano ilanı ve altında koparılabilir dört şerit. */
export function StripMechanics() {
  return (
    <section data-wide className={`rounded-card border border-line bg-surface-2 px-5 py-14 sm:px-8 lg:px-12 lg:py-20 ${GRID_LIGHT}`}>
      <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <Eyebrow>Uygulama mekaniği</Eyebrow>
          <h2 className="font-display text-[32px] leading-[1.08] font-[700] tracking-tight text-ink sm:text-[40px]">
            Şerit mantığı nasıl işler?
          </h2>
        </div>
        <p className="max-w-sm text-[15px] leading-relaxed text-ink-2">
          Her proje bir ilan, her rol ilanın altındaki bir şerit. Sana uyan şeridi koparırsın; dolan şerit panodan düşer
          ve ekibe yeni bir disiplin eklenir.
        </p>
      </div>

      <div aria-hidden="true" className="mx-auto max-w-4xl border-2 border-ink bg-surface shadow-[10px_10px_0_var(--ink)]">
        <div className="p-6 sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center bg-ink font-display text-[12px] font-[700] text-white">PA</div>
              <div className="flex flex-col gap-1.5">
                <div className="h-3 w-36 bg-ink sm:w-48" />
                <div className="h-2 w-24 bg-ink/25 sm:w-32" />
              </div>
            </div>
            <div className="border border-ink bg-surface-2 px-3.5 py-1.5 font-mono text-[12px] font-[600] tracking-wider text-ink uppercase">
              1 / 4 rol dolu
            </div>
          </div>
          <div className="flex flex-col gap-2.5 py-8">
            <div className="h-4 w-5/6 bg-ink/90" />
            <div className="h-4 w-3/5 bg-ink/90" />
            <div className="mt-3 h-2.5 w-full bg-ink/15" />
            <div className="h-2.5 w-11/12 bg-ink/15" />
            <div className="h-2.5 w-2/3 bg-ink/15" />
          </div>
        </div>
        <div className="h-px w-full [background-image:repeating-linear-gradient(to_right,var(--ink)_0,var(--ink)_6px,transparent_6px,transparent_12px)] opacity-40" />
        <div className="grid grid-cols-2 divide-x divide-y divide-ink/20 bg-surface-2 sm:grid-cols-4 sm:divide-y-0">
          {DEMO_STRIPS.map((strip, index) => (
            <div key={strip.label} className="relative min-h-[124px] p-2.5">
              {strip.torn ? (
                <div className="flex h-full min-h-[104px] flex-col items-center justify-center border border-dashed border-ink/35 p-2 text-center">
                  <span className="font-mono text-[10px] font-[600] tracking-widest text-ink-2 uppercase">Rol doldu</span>
                  <span className="mt-1 font-display text-[12px] font-[700] text-ink">{strip.label} eklendi</span>
                </div>
              ) : (
                <div
                  className="flex h-full min-h-[104px] flex-col justify-between border border-ink p-3.5"
                  style={{ background: strip.color }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-[600] tracking-wider text-ink/80 uppercase">
                      {String(index + 1).padStart(2, "0")} / rol
                    </span>
                    <ArrowDown strokeWidth={2} className="size-4 text-ink" />
                  </div>
                  <div>
                    <div className="font-display text-[16px] font-[700] text-ink">{strip.label}</div>
                    <div className="mt-0.5 text-[11px] font-[600] text-ink/75">Şeridi kopar</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PrincipleCard({
  art,
  artClass,
  index,
  topic,
  title,
  text,
}: {
  art: ReactNode;
  artClass: string;
  index: string;
  topic: string;
  title: string;
  text: string;
}) {
  return (
    <article className="flex flex-col border border-ink bg-surface">
      <div aria-hidden="true" className={`flex aspect-[4/3] w-full items-center justify-center border-b border-ink p-6 ${artClass}`}>
        {art}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="mb-2 font-mono text-[11px] font-[600] tracking-widest text-ink-2 uppercase">
          {index} — {topic}
        </p>
        <h3 className="mb-2 font-display text-[20px] font-[700] text-ink">{title}</h3>
        <p className="text-[14px] leading-relaxed text-ink-2">{text}</p>
      </div>
    </article>
  );
}

/** Üç ilke kartı: büyük geometrik çizim ve kısa açıklama. */
export function Principles() {
  return (
    <section data-wide className="rounded-card border border-line bg-surface px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
      <div className="mb-10 max-w-2xl">
        <Eyebrow>Temel ilkeler</Eyebrow>
        <h2 className="font-display text-[30px] leading-[1.1] font-[700] tracking-tight text-ink sm:text-[36px]">
          Sade, doğrulanmış ve odaklanmış çalışma alanı.
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
        <PrincipleCard
          artClass="bg-surface-2"
          index="01"
          topic="Disiplinler"
          title="Farklı fakülteler, tek masa"
          text="Mühendislik, tasarım, hukuk ve temel bilimler öğrencileri tek bir ortak üretim masasında buluşur."
          art={
            <svg className="h-full max-h-[240px] w-full" viewBox="0 0 320 240" fill="none">
              <path d="M0 60H320M0 120H320M0 180H320M80 0V240M160 0V240M240 0V240" stroke="#0D1117" strokeOpacity="0.08" />
              <rect x="96" y="72" width="128" height="96" fill="#0D1117" stroke="#0D1117" strokeWidth="2" />
              <rect x="112" y="88" width="96" height="64" stroke="#FFFFFF" strokeOpacity="0.35" strokeDasharray="4 4" />
              <rect x="44" y="34" width="66" height="54" fill="#68C9B8" stroke="#0D1117" strokeWidth="2" />
              <line x1="44" y1="61" x2="110" y2="61" stroke="#0D1117" strokeWidth="1.5" />
              <polygon points="210,34 276,34 276,88 210,88" fill="#A992F0" stroke="#0D1117" strokeWidth="2" />
              <polygon points="210,34 276,88 210,88" fill="#0D1117" fillOpacity="0.14" />
              <polygon points="56,152 110,152 110,206 44,206 44,166" fill="#C8DC4B" stroke="#0D1117" strokeWidth="2" />
              <rect x="210" y="152" width="66" height="54" fill="#F0904A" stroke="#0D1117" strokeWidth="2" />
              <rect x="226" y="168" width="34" height="22" fill="#FFFFFF" stroke="#0D1117" strokeWidth="1.5" />
              <rect x="142" y="102" width="36" height="36" fill="#FFFFFF" stroke="#0D1117" strokeWidth="2" />
              <rect x="154" y="114" width="12" height="12" fill="#0D1117" />
            </svg>
          }
        />
        <PrincipleCard
          artClass="bg-pen"
          index="02"
          topic="Güvenlik"
          title="Doğrulanmış öğrenci ağı"
          text="Yalnızca öğrenci ya da mezun belgesi doğrulanan gerçek kişiler proje paylaşabilir ve projelere katılabilir."
          art={
            <svg className="h-full max-h-[240px] w-full" viewBox="0 0 320 240" fill="none">
              <path d="M32 30H288M32 70H288M32 110H288M32 150H288M32 190H288" stroke="#FFFFFF" strokeOpacity="0.08" />
              <path d="M40 52V28H64M280 52V28H256M40 188V212H64M280 188V212H256" stroke="#FFFFFF" strokeWidth="2.5" />
              <rect x="74" y="48" width="172" height="144" fill="#1C2129" stroke="#FFFFFF" strokeWidth="2" />
              <rect x="74" y="48" width="172" height="28" fill="#FFFFFF" />
              <rect x="88" y="58" width="52" height="8" fill="#0D1117" />
              <rect x="90" y="92" width="44" height="44" fill="#FFFFFF" />
              <rect x="96" y="98" width="12" height="12" fill="#0D1117" />
              <rect x="116" y="98" width="12" height="12" fill="#0D1117" />
              <rect x="96" y="118" width="12" height="12" fill="#0D1117" />
              <rect x="148" y="94" width="80" height="8" fill="#FFFFFF" fillOpacity="0.85" />
              <rect x="148" y="110" width="58" height="6" fill="#FFFFFF" fillOpacity="0.4" />
              <rect x="148" y="124" width="70" height="6" fill="#FFFFFF" fillOpacity="0.4" />
              <path
                d="M90 156V174M96 156V174M100 156V174M108 156V174M114 156V174M124 156V174M130 156V174M138 156V174M148 156V174M156 156V174M164 156V174"
                stroke="#FFFFFF"
                strokeOpacity="0.65"
                strokeWidth="2"
              />
              <rect x="196" y="142" width="44" height="44" fill="#7CF0A2" stroke="#0D1117" strokeWidth="2" />
              <polyline points="207,164 215,172 230,154" stroke="#0D1117" strokeWidth="3.5" fill="none" />
            </svg>
          }
        />
        <PrincipleCard
          artClass="bg-surface-2"
          index="03"
          topic="İletişim"
          title="Yalnızca ekip içi iletişim"
          text="Rastgele mesajlar ve kalabalık akışlar yok; yalnızca onayladığın kişilerle doğrudan yazışırsın."
          art={
            <svg className="h-full max-h-[240px] w-full" viewBox="0 0 320 240" fill="none">
              <line x1="16" y1="64" x2="54" y2="64" stroke="#0D1117" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="4 4" />
              <line x1="266" y1="176" x2="304" y2="176" stroke="#0D1117" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="4 4" />
              <path d="M46 56L58 68M58 56L46 68" stroke="#0D1117" strokeWidth="2" />
              <path d="M262 168L274 180M274 168L262 180" stroke="#0D1117" strokeWidth="2" />
              <rect x="66" y="34" width="188" height="172" fill="#FFFFFF" stroke="#0D1117" strokeWidth="2" />
              <rect x="66" y="34" width="188" height="26" fill="#0D1117" />
              <rect x="78" y="43" width="8" height="8" fill="#7CF0A2" />
              <rect x="92" y="45" width="60" height="4" fill="#FFFFFF" fillOpacity="0.7" />
              <rect x="82" y="76" width="22" height="22" fill="#68C9B8" stroke="#0D1117" strokeWidth="1.5" />
              <rect x="112" y="76" width="96" height="22" fill="#F3F4F6" stroke="#0D1117" strokeOpacity="0.2" />
              <rect x="120" y="85" width="56" height="4" fill="#0D1117" />
              <rect x="216" y="112" width="22" height="22" fill="#A992F0" stroke="#0D1117" strokeWidth="1.5" />
              <rect x="112" y="112" width="96" height="22" fill="#0D1117" />
              <rect x="122" y="121" width="66" height="4" fill="#FFFFFF" />
              <rect x="82" y="148" width="22" height="22" fill="#C8DC4B" stroke="#0D1117" strokeWidth="1.5" />
              <rect x="112" y="148" width="82" height="22" fill="#F3F4F6" stroke="#0D1117" strokeOpacity="0.2" />
              <rect x="120" y="157" width="44" height="4" fill="#0D1117" />
            </svg>
          }
        />
      </div>
    </section>
  );
}

const NETWORK_TILES = [
  { label: "Fen", sub: "Temel bilimler", color: "var(--d-temel)" },
  { label: "Mühendislik", sub: "Sistem ve teknoloji", color: "var(--d-yazilim)" },
  { label: "Tasarım", sub: "Görsel ve endüstriyel", color: "var(--d-sosyal)" },
  { label: "Hukuk", sub: "Mevzuat ve uyum", color: "var(--d-endustri)" },
  { label: "İktisat", sub: "Veri ve finans", color: "var(--d-elektronik)" },
  { label: "İletişim", sub: "Medya ve strateji", color: "var(--d-tasarim)" },
] as const;

/** Koyu bant: üniversiteler ve fakülteler arası ağ. */
export function CampusBand() {
  return (
    <section data-wide className={`rounded-card bg-pen px-5 py-14 text-pen-ink sm:px-8 lg:px-12 lg:py-20 ${GRID_DARK}`}>
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Eyebrow inverse>Üniversiteler arası ağ</Eyebrow>
          <h2 className="font-display text-[32px] leading-[1.06] font-[700] tracking-tight sm:text-[40px]">Kampüs sınırlarını aş.</h2>
          <p className="max-w-md text-[15px] leading-relaxed text-white/75">
            Farklı şehirlerdeki üniversiteler ve farklı fakülteler tek bir iş birliği ağında buluşur.
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:col-span-7">
          {NETWORK_TILES.map((tile) => (
            <li key={tile.label} className="border border-white/20 bg-black/50 p-4 sm:p-5">
              <span aria-hidden="true" className="mb-3 block size-5 border-2" style={{ borderColor: tile.color }} />
              <div className="font-display text-[16px] font-[700]">{tile.label}</div>
              <div className="mt-1 font-mono text-[11px] text-white/55 uppercase">{tile.sub}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Kapanış çağrısı. */
export function ClosingCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section data-wide className="flex flex-col items-start justify-between gap-8 rounded-card bg-pen px-5 py-14 text-pen-ink sm:px-8 md:flex-row md:items-center lg:px-12">
      <div>
        <h2 className="font-display text-[30px] font-[700] tracking-tight sm:text-[40px]">Disiplinler arası ilk ekibini kur.</h2>
        <p className="mt-2.5 flex items-center gap-2 text-[15px] text-white/80">
          <Check aria-hidden="true" strokeWidth={2.6} className="size-4 text-[var(--tick)]" />
          Öğrenci ya da mezun belgenle saniyeler içinde katıl.
        </p>
      </div>
      <ButtonLink href={signedIn ? "/dogrulama" : "/kayit"} variant="inverse" className="h-12 shrink-0 px-6 text-[15px]">
        {signedIn ? "Belgeni yükle" : "Hesap oluştur"}
      </ButtonLink>
    </section>
  );
}
