"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const ROTATE_INTERVAL_MS = 3500;
const FADE_MS = 400;

export interface SearchBarProps {
  suggestions: string[];
  /** `/ara` sayfasındaki mevcut sorgu. */
  initialQuery?: string;
}

/**
 * Üst bar arama kutusu. Boşken yarı saydam öneriler 3,5 sn'de bir yumuşakça değişir (hareket
 * azaltma tercihinde değişmez). Odaklanınca tüm öneriler listelenir; birine dokunmak arar.
 */
export function SearchBar({ suggestions, initialQuery = "" }: SearchBarProps) {
  const [value, setValue] = useState(initialQuery);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const count = suggestions.length;

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
      <form ref={formRef} action="/ara" role="search">
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
          className="h-11 w-full rounded-chip border border-transparent bg-surface-2 pr-4 pl-11 text-[16px] text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen [&::-webkit-search-cancel-button]:appearance-none"
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
        <ul className="absolute inset-x-0 top-full z-40 mt-2 flex flex-col gap-1 rounded-card border border-line bg-surface p-2">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setValue(suggestion);
                  setOpen(false);
                  formRef.current?.requestSubmit();
                }}
                className="t-body flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen"
              >
                <Search aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-ink-3" />
                <span className="min-w-0 truncate">{suggestion}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
