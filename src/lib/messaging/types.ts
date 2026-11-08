// İstemci tarafında da kullanılan saf tipler ve yardımcılar. Veritabanı import edilmez.

export const MESSAGE_MAX_LENGTH = 2000;
export const PREVIEW_MAX_LENGTH = 80;
export const MESSAGES_PER_PAGE = 50;
export const MESSAGES_PER_POLL = 100;

export type ConversationStatus = "ACTIVE" | "REQUEST" | "DECLINED";
export type ConversationKind = "chats" | "requests";

/** İstemciye giden mesaj. Gönderen kimliği döndürülmez; yalnız `mine` bayrağı. */
export interface MessageDTO {
  id: string;
  body: string;
  /** ISO 8601 metin. */
  createdAt: string;
  mine: boolean;
}

/** Gövdeyi kırpar ve boş olup olmadığını denetler. Boşsa `null`. */
export function normalizeBody(raw: string): string | null {
  const body = raw.trim();
  if (body.length === 0) return null;
  if (Array.from(body).length > MESSAGE_MAX_LENGTH) return null;
  return body;
}

/** Metni en çok `max` karakter (kod noktası) gösterir; kırpılırsa sona "…" ekler. */
export function truncateText(text: string, max: number = PREVIEW_MAX_LENGTH): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, max).join("")}…`;
}

/** Önizleme metni: kendi mesajsa "Sen: " öneki eklenir. */
export function previewText(body: string, mine: boolean): string {
  const truncated = truncateText(body.replace(/\s+/g, " "));
  return mine ? `Sen: ${truncated}` : truncated;
}
