"use client";

import { Check, Circle, FileText, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { VerifiedStamp } from "@/components/common/verified-stamp";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { MAX_DOCUMENT_BYTES } from "@/lib/verification/sniff";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSION = /\.(pdf|jpe?g|png|webp)$/i;

const TOO_LARGE_MESSAGE = "Dosya 10 MB'tan büyük olamaz.";
const UNSUPPORTED_MESSAGE = "Yalnızca PDF, JPEG, PNG veya WebP yükleyebilirsin.";
const GENERIC_ERROR_MESSAGE = "Belge şu an işlenemedi. Birazdan tekrar dene.";

const STEPS = [
  "Belge okunuyor",
  "Kişisel veriler maskeleniyor",
  "Yapay zeka inceliyor",
  "Sonuç",
] as const;

// Adım 1 → 2 ve 2 → 3 geçişleri. Üçüncü adım yanıt gelene kadar açık kalır.
const STEP_TIMINGS_MS = [800, 1600] as const;
const REFRESH_DELAY_MS = 1200;

type Phase = "idle" | "selected" | "uploading" | "done";

interface Result {
  status: string;
  message: string;
}

/** Dosya seçimini istemcide ön kontrol eder. Mesajlar sunucudakilerle aynıdır. */
export function precheckFile(file: File): string | null {
  if (file.size > MAX_DOCUMENT_BYTES) return TOO_LARGE_MESSAGE;
  const typeOk = ALLOWED_TYPES.includes(file.type);
  const extensionOk = file.type === "" && ALLOWED_EXTENSION.test(file.name);
  if (!typeOk && !extensionOk) return UNSUPPORTED_MESSAGE;
  return null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function readMessage(data: unknown): string {
  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
  }
  return GENERIC_ERROR_MESSAGE;
}

function readStatus(data: unknown): string {
  if (typeof data === "object" && data !== null) {
    const status = (data as Record<string, unknown>).status;
    if (typeof status === "string") return status;
  }
  return "ERROR";
}

/** Belge yükleyici: seçim, gönderim, canlı adım listesi ve sonuç. */
export function Uploader({ remaining }: { remaining: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [dragging, setDragging] = useState(false);

  // Adım zamanlayıcıları; temizlik yalnız aşama değişince ya da bileşen kapanınca çalışır.
  useEffect(() => {
    if (phase !== "uploading") return;
    const timers = STEP_TIMINGS_MS.map((delay, index) =>
      setTimeout(() => setStep(index + 1), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  // Onaylanan belgede sayfa sunucudan yenilenir; durum kartı "doğrulandı" olur.
  useEffect(() => {
    if (result?.status !== "APPROVED") return;
    const timer = setTimeout(() => router.refresh(), REFRESH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [result, router]);

  function choose(candidate: File | undefined) {
    if (!candidate) return;
    const problem = precheckFile(candidate);
    if (problem) {
      setError(problem);
      setFile(null);
      setPhase("idle");
      return;
    }
    setError(null);
    setFile(candidate);
    setPhase("selected");
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    setPhase("idle");
    setStep(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function send() {
    if (!file) return;
    setResult(null);
    setStep(0);
    setPhase("uploading");

    const body = new FormData();
    body.append("belge", file);

    try {
      const response = await fetch("/api/verification", { method: "POST", body });
      const data: unknown = await response.json().catch(() => null);
      setStep(STEPS.length - 1);
      setResult({ status: readStatus(data), message: readMessage(data) });
    } catch {
      setStep(STEPS.length - 1);
      setResult({ status: "ERROR", message: GENERIC_ERROR_MESSAGE });
    } finally {
      setPhase("done");
    }
  }

  if (remaining <= 0 && phase !== "done") {
    return (
      <Card className="flex flex-col gap-1 p-4">
        <p className="t-label text-ink">Bu dönemde deneme hakkın doldu.</p>
        <p className="t-meta text-ink-3">
          24 saat içinde en fazla 5 belge yükleyebilirsin. Daha sonra tekrar dene.
        </p>
      </Card>
    );
  }

  return (
    <div id="belge-yukle" className="flex scroll-mt-20 flex-col gap-4" aria-live="polite">
      {phase === "idle" || phase === "selected" ? (
        <>
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              choose(event.dataTransfer.files[0]);
            }}
            className={cn(
              "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line bg-surface px-4 py-8 text-center transition-colors hover:bg-surface-2",
              "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-pen",
              dragging && "border-pen bg-pen-soft",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(event) => choose(event.target.files?.[0])}
            />
            <span
              aria-hidden="true"
              className="inline-flex size-12 items-center justify-center rounded-full bg-pen-soft text-pen"
            >
              <Upload className="size-5" strokeWidth={1.75} />
            </span>
            <span className="t-card text-ink">Belgeni seç</span>
            <span className="t-meta text-ink-3">PDF, JPEG, PNG veya WebP</span>
            <span className="t-meta text-ink-3">En fazla 10 MB</span>
          </label>

          {error ? (
            <p role="alert" className="t-meta text-danger">
              {error}
            </p>
          ) : null}

          {phase === "selected" && file ? (
            <Card className="flex flex-col gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-surface-2 text-ink-2"
                >
                  <FileText className="size-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="t-label truncate text-ink">{file.name}</p>
                  <p className="t-meta text-ink-3">{formatSize(file.size)}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={send}>Belgeyi gönder</Button>
                <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                  Değiştir
                </Button>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      {phase === "uploading" ? (
        <Card className="p-4">
          <p className="t-label mb-3 text-ink">Belgen inceleniyor</p>
          <ol className="flex flex-col gap-3">
            {STEPS.map((label, index) => {
              const current = index === step;
              const done = index < step;
              return (
                <li
                  key={label}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "t-body flex items-center gap-3",
                    done || current ? "text-ink" : "text-ink-3",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-flex size-6 shrink-0 items-center justify-center rounded-full",
                      done
                        ? "bg-pen text-pen-ink"
                        : current
                          ? "border border-pen text-pen"
                          : "border border-line text-ink-3",
                    )}
                  >
                    {done ? (
                      <Check className="size-3.5" strokeWidth={2.5} />
                    ) : current ? (
                      <Spinner className="size-3.5" label="Sürüyor" />
                    ) : (
                      <Circle className="size-2.5" />
                    )}
                  </span>
                  {label}
                </li>
              );
            })}
          </ol>
        </Card>
      ) : null}

      {phase === "done" && result ? (
        <ResultCard result={result} onRetry={reset} onRefresh={() => router.refresh()} />
      ) : null}
    </div>
  );
}

function ResultCard({
  result,
  onRetry,
  onRefresh,
}: {
  result: Result;
  onRetry: () => void;
  onRefresh: () => void;
}) {
  if (result.status === "APPROVED") {
    return (
      <Card className="flex flex-col gap-3 bg-stamp-soft p-4">
        <VerifiedStamp size="lg" />
        <p className="t-body text-ink">{result.message}</p>
        <p className="t-meta text-ink-3">Profilin güncelleniyor.</p>
      </Card>
    );
  }

  if (result.status === "MANUAL_REVIEW") {
    return (
      <section className="flex flex-col gap-3 rounded-card bg-warn-soft p-4">
        <p className="t-label text-warn">Manuel incelemede</p>
        <p className="t-body text-ink">{result.message}</p>
        <Button variant="secondary" size="sm" className="self-start" onClick={onRefresh}>
          Durumu güncelle
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-card bg-danger-soft p-4">
      <p className="t-label text-danger">Belge doğrulanamadı</p>
      <p className="t-body text-ink">{result.message}</p>
      <Button variant="secondary" className="self-start" onClick={onRetry}>
        Tekrar dene
      </Button>
    </section>
  );
}
