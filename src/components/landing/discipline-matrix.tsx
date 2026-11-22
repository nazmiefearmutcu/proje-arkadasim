"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// Her alanın kendi rengi. Beyaz zeminde okunmaları için doygun ve koyu tonlar (yazı olarak 4.5:1 üstü).
const FIELDS = [
  { id: "yazilim", label: "Yazılım", color: "#0369a1" },
  { id: "tasarim", label: "Tasarım", color: "#be185d" },
  { id: "elektronik", label: "Elektronik", color: "#c2410c" },
  { id: "biyoloji", label: "Biyoloji", color: "#4d7c0f" },
  { id: "hukuk", label: "Hukuk", color: "#a16207" },
  { id: "isletme", label: "İşletme", color: "#047857" },
  { id: "mimarlik", label: "Mimarlık", color: "#7e22ce" },
  { id: "saglik", label: "Sağlık", color: "#b91c1c" },
] as const;

type FieldId = (typeof FIELDS)[number]["id"];

// Yanan alanlar ve birlikte yapabilecekleri örnek proje.
const SCENES: ReadonlyArray<{ lit: FieldId[]; project: string }> = [
  { lit: ["yazilim", "tasarim"], project: "Kampüs etkinlik uygulaması" },
  { lit: ["elektronik", "biyoloji"], project: "Akıllı sera sensörü" },
  { lit: ["hukuk", "yazilim"], project: "Sözleşme okuma asistanı" },
  { lit: ["mimarlik", "tasarim", "isletme"], project: "Bisiklet istasyonu ağı" },
  { lit: ["saglik", "yazilim"], project: "Tıbbi görüntü etiketleyici" },
  { lit: ["isletme", "elektronik"], project: "Yerel üretici pazarı kiosku" },
  { lit: ["biyoloji", "saglik", "yazilim"], project: "Hasta takip giyilebiliri" },
];

const STEP_MS = 2600;

interface Connector {
  id: FieldId;
  color: string;
  d: string;
}

/**
 * Otomatik dönen alan tablosu. Sönük alanlar renksizdir; yananlar yalnızca kendi renginde, hafif bir
 * parıltıyla görünür. Ortada, yanan alanların birlikte yapabileceği örnek proje belirir. Her yanan
 * kutudan projeye, kendi renginde ince bir çizgi iner: önce dikey, sonra 90 derece dönüp yatay olarak
 * projeye uzanır (eğim yalnız 0 ya da dik). Hareket azaltma açıksa sahne değişmez.
 */
export function DisciplineMatrix() {
  const [index, setIndex] = useState(0);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLSpanElement>(null);
  const tileRefs = useRef(new Map<FieldId, HTMLDivElement>());

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % SCENES.length), STEP_MS);
    return () => window.clearInterval(timer);
  }, []);

  const scene = SCENES[index];

  const measure = useCallback(() => {
    const root = rootRef.current;
    const project = projectRef.current;
    if (!root || !project) return;
    const r = root.getBoundingClientRect();
    const p = project.getBoundingClientRect();
    const projectTop = p.top - r.top;
    const projectBottom = p.bottom - r.top;
    const projectLeft = p.left - r.left;
    const projectRight = p.right - r.left;
    const projectMidY = (projectTop + projectBottom) / 2;
    const gap = 10;

    const next: Connector[] = [];
    for (const field of FIELDS) {
      if (!scene.lit.includes(field.id)) continue;
      const tile = tileRefs.current.get(field.id);
      if (!tile) continue;
      const t = tile.getBoundingClientRect();
      const x = (t.left + t.right) / 2 - r.left;
      const fromTop = t.bottom - r.top <= projectTop;
      const startY = fromTop ? t.bottom - r.top : t.top - r.top;
      // Üst sıradan inen çizgi projenin biraz üstünde, alttan çıkan biraz altında döner; çakışmazlar.
      const turnY = fromTop ? projectMidY - 6 : projectMidY + 6;
      let d: string;
      if (x >= projectLeft - gap && x <= projectRight + gap) {
        // Kutu projenin tam üstünde ya da altında: yalnız dikey çizgi.
        d = `M ${x} ${startY} V ${fromTop ? projectTop - gap : projectBottom + gap}`;
      } else {
        const endX = x < projectLeft ? projectLeft - gap : projectRight + gap;
        d = `M ${x} ${startY} V ${turnY} H ${endX}`;
      }
      next.push({ id: field.id, color: field.color, d });
    }
    setBox({ w: r.width, h: r.height });
    setConnectors(next);
  }, [scene]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("ResizeObserver" in window)) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(root);
    return () => observer.disconnect();
  }, [measure]);

  const top = FIELDS.slice(0, 4);
  const bottom = FIELDS.slice(4);
  const litColors = FIELDS.filter((f) => scene.lit.includes(f.id)).map((f) => f.color);

  return (
    <div ref={rootRef} className="relative mx-auto w-full max-w-4xl select-none" aria-hidden="true">
      <svg className="pointer-events-none absolute inset-0 z-0 overflow-visible" width={box.w} height={box.h}>
        {connectors.map((c) => (
          <path
            key={`${index}-${c.id}`}
            d={c.d}
            fill="none"
            stroke={c.color}
            strokeWidth={1.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            className="matrix-line"
            style={{ filter: `drop-shadow(0 0 3px ${c.color}66)` }}
          />
        ))}
      </svg>

      <Row items={top} lit={scene.lit} tileRefs={tileRefs} />
      <div className="relative my-7 flex h-20 items-center justify-center sm:my-14 sm:h-32">
        <div
          className="matrix-halo absolute inset-x-8 inset-y-0 rounded-full opacity-50 blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${litColors[0]}33, ${litColors[1] ?? litColors[0]}14, transparent)` }}
        />
        <p
          key={index}
          className="matrix-project relative z-10 max-w-[70%] text-center font-display text-[19px] leading-tight font-[700] tracking-tight text-balance text-ink sm:max-w-[80%] sm:text-[40px]"
        >
          {/* Ölçüm satır içi öğeden yapılır: blok kutu değil, görünen yazının genişliği hedeflenir. */}
          <span ref={projectRef}>{scene.project}</span>
        </p>
      </div>
      <Row items={bottom} lit={scene.lit} tileRefs={tileRefs} />
    </div>
  );
}

function Row({
  items,
  lit,
  tileRefs,
}: {
  items: ReadonlyArray<(typeof FIELDS)[number]>;
  lit: FieldId[];
  tileRefs: React.RefObject<Map<FieldId, HTMLDivElement>>;
}) {
  return (
    <div className="relative z-10 grid grid-cols-4 gap-1.5 sm:gap-4">
      {items.map((item) => {
        const on = lit.includes(item.id);
        return (
          <div
            key={item.id}
            ref={(node) => {
              if (node) tileRefs.current.set(item.id, node);
              else tileRefs.current.delete(item.id);
            }}
            className={cn(
              "relative overflow-hidden rounded-[3px] border bg-surface px-1 py-3 text-center transition-all duration-700 sm:px-4 sm:py-6",
              on ? "matrix-on" : "border-line",
            )}
            style={
              on
                ? {
                    borderColor: item.color,
                    color: item.color,
                    background: `${item.color}0f`,
                    boxShadow: `0 10px 30px -10px ${item.color}80, 0 0 0 1px ${item.color}`,
                  }
                : undefined
            }
          >
            <span
              className={cn(
                "relative z-10 block truncate font-display text-[12.5px] font-[700] tracking-tight transition-colors duration-700 min-[400px]:text-[13.5px] sm:text-[20px]",
                on ? "" : "text-ink-3/60",
              )}
              style={on ? { textShadow: `0 0 14px ${item.color}40` } : undefined}
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
