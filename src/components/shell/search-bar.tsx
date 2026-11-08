"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { chipClasses } from "@/components/ui/chip-classes";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import { suggestionToQuery } from "@/lib/search-suggestions";

const ROTATE_INTERVAL_MS = 3500;
const FADE_MS = 400;

export interface SearchBarProps {
  suggestions: string[];
}

/**
 * Üst bar arama kutusu. `useSearchParams` için bir Suspense sınırı içinde çalışır; yer tutucu
 * arama kutusunun boyutunu korur.
 */
export function SearchBar(props: SearchBarProps) {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-11 min-w-0 flex-1 rounded-chip bg-surface-2" />}
    >
      <SearchField {...props} />
    </Suspense>
  );
}

/**
 * Boşken yarı saydam öneriler 3,5 sn'de bir yumuşakça değişir (hareket azaltma tercihinde değişmez).
 * Odaklanınca tüm öneriler çip olarak görünür; birine dokunmak kutuyu doldurur ve aramayı gönderir.
 * `/ara` sayfasındayken kutu, URL'deki `q` değerini gösterir.
 * Kutuda `outline-none` kullanılmaz: Tailwind 4'te `--tw-outline-style` değerini de `none` yapar ve
 * `focusRing` halkası görünmez olur.
 */
function SearchField({ suggestions }: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = pathname === "/ara" ? (searchParams.get("q") ?? "") : "";
  const [value, setValue] = useState(urlQuery);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState(false);
  const count = suggestions.length;

  // URL'deki sorgu değişince (ör. arama yapılınca ya da başka sayfaya geçilince) kutuyu eşitle.
  useEffect(() => {
    setValue(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (count < 2 || value.length > 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let fadeTimer: number | undefined;
    const timer = window.setInterval(() => {
      setVisible(false);
      fadeTimer = window.setTimeout(() => {
        setIndex((current) => (current + 1) % count);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(fadeTimer);
    };
  }, [count, value]);

  const hint = count > 0 ? suggestions[index % count] : undefined;

  return (
    <div
      className="relative min-w-0 flex-1"
      onBlur={(event) => {
        // Panel içindeki bir öğeye geçiş odağı kapatmaz.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <form action="/ara" role="search">
        <Search
          aria-hidden="true"
          strokeWidth={1.75}
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-3"
        />
        <input
          name="q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          aria-label="Proje veya kişi ara"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          className={cn(
            "h-11 w-full rounded-chip border border-transparent bg-surface-2 pr-4 pl-11 text-[16px] text-ink [&::-webkit-search-cancel-button]:appearance-none",
            focusRing,
          )}
        />
        {value.length === 0 && hint ? (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-0 top-0 right-4 left-11 flex items-center truncate text-[16px] text-ink-3 transition-opacity duration-[400ms]",
              visible ? "opacity-100" : "opacity-0",
            )}
          >
            {hint}
          </span>
        ) : null}
      </form>

      {open && count > 0 ? (
        // Spec §3.1: odaklanınca öneri çipleri görünür. Çipler satır kırarak dizilir; her biri 44 px dokunma hedefi.
        <ul
          aria-label="Önerilen aramalar"
          className="absolute inset-x-0 top-full z-40 mt-2 flex flex-wrap gap-2 rounded-card border border-line bg-surface p-3"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion} className="flex max-w-full">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  // Öneri metni ("'robotik' projelerini ara…") değil, sorgunun kendisi aranır.
                  const query = suggestionToQuery(suggestion);
                  // Yönlendirmeyi doğrudan kuruyoruz: state henüz işlenmeden form okunursa eski değer gider.
                  setValue(query);
                  setOpen(false);
                  router.push(`/ara?q=${encodeURIComponent(query)}`);
                }}
                className={chipClasses(false, "text-left hover:text-ink", { interactive: true })}
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
