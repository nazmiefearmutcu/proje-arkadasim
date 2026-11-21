import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { PandaHero } from "@/components/common/logo";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { DisciplineMatrix } from "./discipline-matrix";
import { Reveal } from "./reveal";

// Misafir açılış sayfası: Apple tarzı tam ekran bölümler. Her bölüm ekranı tek renkle doldurur, tek
// başlık taşır, yazı en aza iner; anlatımı görseller ve hareket yapar.

function Screen({
  tone,
  title,
  sub,
  children,
  id,
}: {
  tone: "dark" | "light";
  title: string;
  sub?: string;
  children?: ReactNode;
  id?: string;
}) {
  const dark = tone === "dark";
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-baslik` : undefined}
      className={cn(
        "flex min-h-[calc(100svh-60px)] flex-col items-center justify-center gap-10 px-5 py-20 text-center sm:px-8 lg:gap-14",
        dark ? "bg-pen text-pen-ink" : "bg-surface text-ink",
      )}
    >
      <Reveal className="flex max-w-4xl flex-col items-center gap-4">
        <h2
          id={id ? `${id}-baslik` : undefined}
          className="font-display text-[40px] leading-[1.05] font-[700] tracking-[-0.03em] sm:text-[64px] lg:text-[80px]"
        >
          {title}
        </h2>
        {sub ? (
          <p className={cn("text-[19px] font-[500] sm:text-[24px]", dark ? "text-white/60" : "text-ink-2")}>{sub}</p>
        ) : null}
      </Reveal>
      {children}
    </section>
  );
}

/** 1. ekran: başlık, iki düğme ve otomatik dönen disiplin tablosu. */
export function LandingHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="flex min-h-[calc(100svh-60px)] flex-col items-center justify-center gap-12 bg-pen px-5 py-16 text-center text-pen-ink sm:px-8 lg:gap-16">
      <div className="flex max-w-5xl flex-col items-center gap-6">
        <h1 className="font-display text-[42px] leading-[1.04] font-[700] tracking-[-0.035em] sm:text-[68px] lg:text-[88px]">
          Bir kişiden çıkamayan, birçok kişiden çıkar.
        </h1>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink href={signedIn ? "/dogrulama" : "/kayit"} variant="inverse" className="h-12 rounded-full px-7 text-[16px]">
            {signedIn ? "Belgeni yükle" : "Hesap oluştur"}
          </ButtonLink>
          <ButtonLink href="/projeler" variant="inverse-outline" className="h-12 rounded-full px-7 text-[16px]">
            Projelere bak
          </ButtonLink>
        </div>
      </div>
      <DisciplineMatrix />
    </section>
  );
}

const STRIPS = [
  { label: "Yazılım geliştirme", color: "#38bdf8" },
  { label: "Arayüz tasarımı", color: "#f472b6" },
  { label: "Veri analizi", color: "#a3e635" },
  { label: "Hukuki danışmanlık", color: "#facc15" },
] as const;

/** 2. ekran: soyut bir ilan ve sırayla kopup yerine dönen beceri şeritleri. Aranan şey kişi ya da bölüm değil, beceridir. */
export function StripScreen() {
  return (
    <Screen id="serit" tone="light" title="Her beceri bir şerit.">
      <Reveal className="w-full max-w-3xl" delayMs={150}>
        <div aria-hidden="true" className="border-2 border-ink bg-surface text-left shadow-[12px_12px_0_var(--ink)]">
          <div className="flex flex-col gap-3 p-7 sm:p-10">
            <div className="h-5 w-3/4 bg-ink" />
            <div className="h-5 w-1/2 bg-ink" />
            <div className="mt-3 h-3 w-full bg-ink/15" />
            <div className="h-3 w-5/6 bg-ink/15" />
          </div>
          <div className="h-px w-full [background-image:repeating-linear-gradient(to_right,var(--ink)_0,var(--ink)_6px,transparent_6px,transparent_12px)] opacity-50" />
          <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-4">
            {STRIPS.map((strip, index) => (
              <div key={strip.label} className="relative h-28 border border-dashed border-ink/30 sm:h-32">
                <div
                  className="strip-loop absolute inset-0 flex items-end border border-ink p-3"
                  style={{ background: strip.color, animationDelay: `${index * 1.5}s` }}
                >
                  <span className="text-left font-display text-[16px] leading-tight font-[700] text-ink sm:text-[17px]">{strip.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </Screen>
  );
}

/** 3. ekran: taranan belge ve beliren yeşil onay. */
export function VerifiedScreen() {
  return (
    <Screen id="dogrulama" tone="dark" title="Sadece gerçek öğrenciler." sub="Belgeni yükle, saniyeler içinde doğrulan.">
      <Reveal className="w-full max-w-md" delayMs={150}>
        <div aria-hidden="true" className="relative mx-auto aspect-[3/4] w-64 overflow-hidden border border-white/25 bg-white/[0.04] sm:w-72">
          <div className="flex flex-col gap-3 p-6">
            <div className="h-3 w-1/2 bg-white/80" />
            <div className="h-2 w-1/3 bg-white/30" />
            <div className="mt-6 h-2 w-full bg-white/20" />
            <div className="h-2 w-11/12 bg-white/20" />
            <div className="h-2 w-4/5 bg-white/20" />
            <div className="h-2 w-full bg-white/20" />
            <div className="mt-6 flex gap-1">
              {Array.from({ length: 14 }, (_, i) => (
                <span key={i} className="h-8 bg-white/50" style={{ width: i % 3 === 0 ? 4 : 2 }} />
              ))}
            </div>
          </div>
          <div
            className="scan-line absolute inset-x-0 top-0 h-0.5 bg-[var(--tick)] shadow-[0_0_24px_6px_rgb(124_240_162/0.6)]"
            style={{ ["--scan-distance" as string]: "100%" }}
          />
          <div className="check-pop absolute right-5 bottom-5 flex size-16 items-center justify-center bg-[var(--tick)] text-ink">
            <Check strokeWidth={3.5} className="size-9" />
          </div>
        </div>
      </Reveal>
    </Screen>
  );
}

const MESSAGES = [
  { side: "left", color: "#38bdf8", width: "w-56" },
  { side: "right", color: "#f472b6", width: "w-44" },
  { side: "left", color: "#a3e635", width: "w-64" },
  { side: "right", color: "#facc15", width: "w-36" },
] as const;

/** 4. ekran: sırayla gelen mesaj baloncukları. */
export function ChatScreen() {
  return (
    <Screen id="mesaj" tone="light" title="Ekibinle yazış." sub="Yalnızca kabul ettiğin kişilerle.">
      <Reveal className="w-full max-w-lg" delayMs={150}>
        <div aria-hidden="true" className="flex flex-col gap-4 border border-line bg-paper p-6 sm:p-8">
          {MESSAGES.map((message, index) => (
            <div
              key={index}
              className={cn("bubble-in flex items-end gap-3", message.side === "right" && "flex-row-reverse")}
              style={{ animationDelay: `${index * 0.9}s` }}
            >
              <span className="size-9 shrink-0 rounded-[3px] border border-ink/20" style={{ background: message.color }} />
              <span
                className={cn(
                  "flex h-11 items-center rounded-[10px] px-4",
                  message.width,
                  message.side === "right" ? "rounded-br-[3px] bg-ink" : "rounded-bl-[3px] border border-line bg-surface",
                )}
              >
                <span className={cn("h-2 w-3/4", message.side === "right" ? "bg-white/70" : "bg-ink/25")} />
              </span>
            </div>
          ))}
        </div>
      </Reveal>
    </Screen>
  );
}

/** 5. ekran: kapanış çağrısı ve büyük panda. */
export function ClosingScreen({ signedIn }: { signedIn: boolean }) {
  return (
    <Screen id="basla" tone="dark" title="İlk ekibini kur.">
      <Reveal className="flex flex-col items-center gap-10" delayMs={150}>
        <PandaHero className="w-44 sm:w-56" />
        <ButtonLink href={signedIn ? "/dogrulama" : "/kayit"} variant="inverse" className="h-12 rounded-full px-8 text-[16px]">
          {signedIn ? "Belgeni yükle" : "Hesap oluştur"}
        </ButtonLink>
      </Reveal>
    </Screen>
  );
}
