"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";
const PREFIX = "/api/avatar/";

interface AvatarFieldProps {
  displayName: string;
  /** Renk tohumu (kullanıcı adı). */
  seed: string;
  avatarPath: string | null;
  disciplineGroup: string | null;
}

type Notice = { kind: "ok" | "error"; text: string } | null;

/** Profil resmi: önizleme, yükleme ve kaldırma. Yükleme ayrı bir uç noktaya gider (/api/avatar). */
export function AvatarField({ displayName, seed, avatarPath: initialPath, disciplineGroup }: AvatarFieldProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState<string | null>(initialPath);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function upload(file: File) {
    setNotice(null);
    if (file.size > MAX_BYTES) {
      setNotice({ kind: "error", text: "Fotoğraf en fazla 2 MB olabilir. Daha küçük bir dosya seç." });
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("avatar", file);
      const response = await fetch("/api/avatar", { method: "POST", body });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
      if (!response.ok || !data?.ok || typeof data.url !== "string") {
        setNotice({ kind: "error", text: data?.error ?? "Fotoğraf yüklenemedi. Tekrar dene." });
        return;
      }
      setPath(data.url.startsWith(PREFIX) ? decodeURIComponent(data.url.slice(PREFIX.length)) : null);
      setNotice({ kind: "ok", text: "Profil fotoğrafın güncellendi." });
      router.refresh();
    } catch {
      setNotice({ kind: "error", text: "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene." });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setNotice(null);
    setBusy(true);
    try {
      const response = await fetch("/api/avatar", { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) {
        setNotice({ kind: "error", text: data?.error ?? "Fotoğraf kaldırılamadı. Tekrar dene." });
        return;
      }
      setPath(null);
      setNotice({ kind: "ok", text: "Profil fotoğrafın kaldırıldı." });
      router.refresh();
    } catch {
      setNotice({ kind: "error", text: "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Avatar name={displayName} seed={seed} avatarPath={path} disciplineGroup={disciplineGroup} size={96} />
      <div className="flex flex-col gap-2">
        <p className="t-meta text-ink-3">JPEG, PNG veya WebP. En fazla 2 MB.</p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id="avatar-file"
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <Button variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}>
            Fotoğraf yükle
          </Button>
          {path ? (
            <Button variant="ghost" disabled={busy} onClick={() => void remove()}>
              Kaldır
            </Button>
          ) : null}
        </div>
        {notice ? (
          <p role={notice.kind === "error" ? "alert" : "status"} className={notice.kind === "error" ? "t-meta text-danger" : "t-meta text-ok"}>
            {notice.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
