"use client";

import { ChevronLeft, EllipsisVertical, Send } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClasses } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { BlockButton } from "@/components/social/block-button";
import { ReportSheet } from "@/components/social/report-sheet";
import { controlBase, focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import type { ActionResult } from "@/lib/action-result";
import { clockLabel, dayLabel, isGroupEnd } from "@/lib/messaging/format";
import { sendMessageAction } from "@/lib/messaging/actions";
import { MESSAGE_MAX_LENGTH, type ConversationStatus, type MessageDTO } from "@/lib/messaging/types";
import { RequestActions } from "./request-actions";

const POLL_INTERVAL_MS = 3_000;
const NEAR_BOTTOM_PX = 96;

export interface ChatOther {
  id: string;
  username: string;
  /** Görüntüleyiciye göre ad (sunucuda `displayName` ile seçilir). */
  name: string;
  avatarPath: string | null;
  disciplineGroup: string | null;
}

export interface ChatProps {
  conversationId: string;
  other: ChatOther;
  initialStatus: ConversationStatus;
  isInitiator: boolean;
  blocked: boolean;
  /** Görüntüleyen karşı tarafı engellediyse true: menüdeki düğme "Engeli kaldır" olur. */
  blockedByViewer: boolean;
  initialMessages: MessageDTO[];
  /** Sayfanın oluşturulma anı (ISO). Hiç mesaj yoksa yoklamanın başlangıç imleci olur. */
  renderedAt: string;
}

type ChatMessage = MessageDTO & { pending?: boolean };

const subscribeNoop = () => () => {};

/** Tarih ve saat yalnız istemcide (tarayıcı saat dilimiyle) yazılır; sunucu ve istemci çıktısı ayrışmaz. */
function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

function mergeMessages(previous: ChatMessage[], incoming: MessageDTO[]): ChatMessage[] {
  const known = new Set(previous.map((message) => message.id));
  const fresh = incoming.filter((message) => !known.has(message.id));
  if (fresh.length === 0) return previous;
  return [...previous, ...fresh];
}

function dedupeById(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}

/** Gönderme ve yazma durumuna göre yazma alanının açık olup olmadığı ve nedeni. */
function composerRule(status: ConversationStatus, isInitiator: boolean, blocked: boolean): { allowed: boolean; reason: string } {
  if (blocked) return { allowed: false, reason: "Bu kişiyle mesajlaşamazsın." };
  if (status === "ACTIVE") return { allowed: true, reason: "Mesaj yaz" };
  if (status === "REQUEST") {
    return isInitiator
      ? { allowed: false, reason: "İsteğin karşı tarafın onayını bekliyor." }
      : { allowed: false, reason: "Önce mesaj isteğini kabul et." };
  }
  return isInitiator
    ? { allowed: false, reason: "İsteğin karşı tarafın onayını bekliyor." }
    : { allowed: false, reason: "Bu isteği reddettin." };
}

/** Sohbet ekranı: başlık, mesajlar, durum şeridi ve yazma alanı. 3 sn'de bir yeni mesajları yoklar. */
export function Chat({
  conversationId,
  other,
  initialStatus,
  isInitiator,
  blocked,
  blockedByViewer,
  initialMessages,
  renderedAt,
}: ChatProps) {
  const isClient = useIsClient();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [status, setStatus] = useState<ConversationStatus>(initialStatus);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const cursorRef = useRef<string>(initialMessages[initialMessages.length - 1]?.createdAt ?? renderedAt);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);

  const rule = composerRule(status, isInitiator, blocked);
  const trimmed = draft.trim();
  const canSend = rule.allowed && trimmed.length > 0 && Array.from(trimmed).length <= MESSAGE_MAX_LENGTH;

  // Yoklama: açıkken 3 sn'de bir; sekme yeniden görünür olunca hemen.
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function poll(): Promise<void> {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const response = await fetch(
          `/api/conversations/${conversationId}/messages?after=${encodeURIComponent(cursorRef.current)}`,
          { cache: "no-store" },
        );
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { messages: MessageDTO[]; status: ConversationStatus };
        if (cancelled) return;

        setStatus(body.status);
        if (body.messages.length > 0) {
          cursorRef.current = body.messages[body.messages.length - 1].createdAt;
          setMessages((previous) => mergeMessages(previous, body.messages));
        }
      } catch {
        // Ağ hatasında bir sonraki yoklama denenir.
      } finally {
        inFlight = false;
      }
    }

    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [conversationId]);

  // Mesaj listesi: yalnız kullanıcı dibe yakınsa ya da kendi mesajı geldiyse kaydır.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const last = messages[messages.length - 1];
    if (nearBottomRef.current || last?.mine) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  // Yazma alanı içeriğe göre büyür; CSS en fazla beş satıra kadar sınırlar.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draft]);

  function onScroll(): void {
    const list = listRef.current;
    if (!list) return;
    nearBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_PX;
  }

  async function send(): Promise<void> {
    if (!canSend) return;
    const body = trimmed;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setError(null);
    setDraft("");
    setMessages((previous) =>
      dedupeById([
        ...previous,
        { id: tempId, body, createdAt: new Date().toISOString(), mine: true, pending: true },
      ]),
    );

    let result: ActionResult<MessageDTO>;
    try {
      result = await sendMessageAction(conversationId, body);
    } catch {
      // Ağ hatası veya sunucu istisnası: geçici balon geri alınır, taslak korunur.
      result = { ok: false, error: "Mesaj gönderilemedi. Bağlantını kontrol edip tekrar dene." };
    }
    if (result.ok && result.data) {
      const sent = result.data;
      setMessages((previous) =>
        dedupeById(previous.map((message) => (message.id === tempId ? { ...sent } : message))),
      );
      return;
    }

    setMessages((previous) => previous.filter((message) => message.id !== tempId));
    setDraft((current) => (current.length === 0 ? body : current));
    setError(result.ok ? "Mesaj gönderilemedi. Tekrar dene." : result.error);
  }

  // Enter masaüstünde gönderir; dokunmatik cihazda yeni satır ekler. Shift+Enter her zaman yeni satırdır.
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    event.preventDefault();
    void send();
  }

  const otherUrl = `/u/${encodeURIComponent(other.username)}`;

  return (
    <div className="fixed inset-x-0 top-[60px] bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 mx-auto flex w-full max-w-[640px] flex-col bg-paper">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-2 py-1.5">
        <Link
          href="/mesajlar"
          aria-label="Mesajlara dön"
          className={cn("flex size-11 shrink-0 items-center justify-center rounded-control text-ink-2", focusRing)}
        >
          <ChevronLeft aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </Link>
        <Link href={otherUrl} className={cn("flex min-w-0 flex-1 items-center gap-2.5 rounded-control py-1", focusRing)}>
          <Avatar
            size={36}
            name={other.name}
            seed={other.username}
            avatarPath={other.avatarPath}
            disciplineGroup={other.disciplineGroup}
          />
          <span className="t-label min-w-0 truncate text-ink">{other.name}</span>
        </Link>
        <button
          type="button"
          aria-label="Sohbet seçenekleri"
          onClick={() => setMenuOpen(true)}
          className={buttonClasses("ghost", "md", "size-11 shrink-0 px-0 text-ink-2")}
        >
          <EllipsisVertical aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </button>
      </header>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Sohbet">
        <div className="flex flex-col gap-3 px-2 pt-2 pb-2">
          <BlockButton userId={other.id} blocked={blockedByViewer} />
          <Button
            variant="secondary"
            onClick={() => {
              setMenuOpen(false);
              setReportOpen(true);
            }}
          >
            Şikayet et
          </Button>
        </div>
      </Sheet>

      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="USER"
        targetId={other.id}
        subject={other.name}
      />

      {blocked ? (
        <div className="border-b border-line bg-surface px-4 py-3">
          <p className="t-meta text-ink-2">Bu kişiyle mesajlaşamazsın.</p>
        </div>
      ) : status === "REQUEST" && !isInitiator ? (
        <div className="flex flex-col gap-3 border-b border-line bg-surface px-4 py-3">
          <p className="t-body text-ink">{other.name} sana mesaj isteği gönderdi.</p>
          <RequestActions conversationId={conversationId} onAccepted={() => setStatus("ACTIVE")} />
        </div>
      ) : (status === "REQUEST" || status === "DECLINED") && isInitiator ? (
        <div className="border-b border-line bg-surface px-4 py-3">
          <p className="t-meta text-ink-2">İsteğin karşı tarafın onayını bekliyor.</p>
        </div>
      ) : status === "DECLINED" && !isInitiator ? (
        <div className="border-b border-line bg-surface px-4 py-3">
          <p className="t-meta text-ink-2">Bu isteği reddettin.</p>
        </div>
      ) : null}

      <div ref={listRef} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
        {messages.length === 0 ? <p className="t-body text-ink-2">Henüz mesaj yok.</p> : null}
        {messages.map((message, index) => {
          const current = toLocalMeta(message);
          const previous = index > 0 ? toLocalMeta(messages[index - 1]) : undefined;
          const next = index < messages.length - 1 ? toLocalMeta(messages[index + 1]) : undefined;
          const newDay = previous === undefined || previous.dayKey !== current.dayKey;
          const groupEnd = isGroupEnd(current, next);

          return (
            <div key={message.id} className="flex flex-col">
              {newDay && isClient ? (
                <div className="my-3">
                  <span className="t-meta inline-flex rounded-chip bg-surface-2 px-3 py-1 text-ink-2">
                    {dayLabel(current.date)}
                  </span>
                </div>
              ) : null}
              <div className={cn("flex flex-col", message.mine ? "items-end" : "items-start", groupEnd ? "mb-3" : "mb-1")}>
                <div
                  className={cn(
                    "max-w-[80%] break-words whitespace-pre-wrap px-3.5 py-2 t-body",
                    "rounded-[18px]",
                    message.mine
                      ? "rounded-br-[6px] bg-pen text-pen-ink"
                      : "rounded-bl-[6px] border border-line bg-surface text-ink",
                    message.pending && "opacity-60",
                  )}
                >
                  {message.body}
                </div>
                {groupEnd && isClient ? (
                  <time dateTime={message.createdAt} className="t-meta px-1 pt-0.5 text-ink-3">
                    {clockLabel(current.date)}
                  </time>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-line bg-surface px-3 pt-2 pb-2">
        {error ? (
          <p role="alert" className="t-meta pb-2 text-danger">
            {error}
          </p>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={textareaRef}
            aria-label="Mesaj"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={!rule.allowed}
            placeholder={rule.reason}
            maxLength={MESSAGE_MAX_LENGTH}
            rows={1}
            className={cn(
              controlBase,
              "min-h-11 max-h-[9.5rem] min-w-0 flex-1 resize-none overflow-y-auto px-3.5 py-2.5 leading-[1.4]",
            )}
          />
          <button
            type="submit"
            aria-label="Gönder"
            disabled={!canSend}
            className={buttonClasses("primary", "md", "size-11 shrink-0 px-0")}
          >
            <Send aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

/** Mesajın yerel tarih bilgisi. Tarih yalnız istemcide hesaplanır (sunucu saat dilimi farklı olabilir). */
function toLocalMeta(message: MessageDTO): { mine: boolean; createdAt: Date; dayKey: string; date: Date } {
  const date = new Date(message.createdAt);
  return {
    mine: message.mine,
    createdAt: date,
    dayKey: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    date,
  };
}
