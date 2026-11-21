"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

// Her disiplinin kendi rengi. Koyu zeminde parlak görünmeleri için doygun ve açık tonlar.
const DISCIPLINES = [
  { id: "yazilim", label: "Yazılım", color: "#38bdf8" },
  { id: "tasarim", label: "Tasarım", color: "#f472b6" },
  { id: "elektronik", label: "Elektronik", color: "#fb923c" },
  { id: "biyoloji", label: "Biyoloji", color: "#a3e635" },
  { id: "hukuk", label: "Hukuk", color: "#facc15" },
  { id: "isletme", label: "İşletme", color: "#34d399" },
  { id: "mimarlik", label: "Mimarlık", color: "#c084fc" },
  { id: "saglik", label: "Sağlık", color: "#f87171" },
] as const;

type DisciplineId = (typeof DISCIPLINES)[number]["id"];

// Yanan disiplinler ve birlikte yapabilecekleri örnek proje.
const SCENES: ReadonlyArray<{ lit: DisciplineId[]; project: string }> = [
  { lit: ["yazilim", "tasarim"], project: "Kampüs etkinlik uygulaması" },
  { lit: ["elektronik", "biyoloji"], project: "Akıllı sera sensörü" },
  { lit: ["hukuk", "yazilim"], project: "Sözleşme okuma asistanı" },
  { lit: ["mimarlik", "tasarim", "isletme"], project: "Bisiklet istasyonu ağı" },
  { lit: ["saglik", "yazilim"], project: "Tıbbi görüntü etiketleyici" },
  { lit: ["isletme", "elektronik"], project: "Yerel üretici pazarı kiosku" },
  { lit: ["biyoloji", "saglik", "yazilim"], project: "Hasta takip giyilebiliri" },
];

const STEP_MS = 2600;

/**
 * Otomatik dönen disiplin tablosu. Sönük disiplinler renksizdir; yananlar yalnızca kendi renginde, hafif
 * bir parıltıyla görünür. Ortada, yanan disiplinlerin birlikte yapabileceği örnek proje belirir.
 * Hareket azaltma tercihi açıksa sahne değişmez, ilk sahne durağan gösterilir.
 */
export function DisciplineMatrix() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % SCENES.length), STEP_MS);
    return () => window.clearInterval(timer);
  }, []);

  const scene = SCENES[index];
  const top = DISCIPLINES.slice(0, 4);
  const bottom = DISCIPLINES.slice(4);
  const litColors = DISCIPLINES.filter((d) => scene.lit.includes(d.id)).map((d) => d.color);

  return (
    <div className="mx-auto w-full max-w-4xl select-none" aria-hidden="true">
      <Row items={top} lit={scene.lit} />
      <div className="relative my-8 flex h-28 items-center justify-center sm:my-10 sm:h-32">
        <div
          className="matrix-halo absolute inset-x-8 inset-y-0 rounded-full opacity-60 blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${litColors[0]}55, ${litColors[1] ?? litColors[0]}22, transparent)` }}
        />
        <p
          key={index}
          className="matrix-project relative text-center font-display text-[28px] leading-tight font-[700] tracking-tight text-white sm:text-[44px]"
        >
          {scene.project}
        </p>
      </div>
      <Row items={bottom} lit={scene.lit} />
    </div>
  );
}

function Row({
  items,
  lit,
}: {
  items: ReadonlyArray<(typeof DISCIPLINES)[number]>;
  lit: DisciplineId[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {items.map((item) => {
        const on = lit.includes(item.id);
        return (
          <div
            key={item.id}
            className={cn(
              "relative overflow-hidden rounded-[3px] border px-4 py-5 text-center transition-all duration-700 sm:py-6",
              on ? "matrix-on" : "border-white/10",
            )}
            style={
              on
                ? {
                    borderColor: item.color,
                    color: item.color,
                    boxShadow: `0 0 28px -4px ${item.color}, inset 0 0 22px -12px ${item.color}`,
                  }
                : undefined
            }
          >
            <span
              className={cn(
                "relative z-10 font-display text-[17px] font-[700] tracking-tight transition-colors duration-700 sm:text-[20px]",
                on ? "" : "text-white/30",
              )}
              style={on ? { textShadow: `0 0 18px ${item.color}` } : undefined}
            >
              {item.label}
            </span>
            {on ? <span className="matrix-shine" /> : null}
          </div>
        );
      })}
    </div>
  );
}
