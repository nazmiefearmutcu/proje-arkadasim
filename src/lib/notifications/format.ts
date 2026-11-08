import type { NotificationType } from "@/lib/notify";

// Bildirim metni, hedef adresi ve simgesi. Saf fonksiyon: sayfa ve yönlendirme rotası kullanır.
// Aktör ya da proje silinmişse (ilişki boş) genel bir metin ve /bildirimler adresi döner.

export type NotificationIcon =
  | "follow"
  | "request"
  | "accepted"
  | "rejected"
  | "invite"
  | "message"
  | "verification"
  | "intro"
  | "project";

export interface FormattableNotification {
  type: string;
  data: Record<string, unknown>;
  actor?: { firstName: string; lastName: string; username: string } | null;
  project?: { id: string; title: string } | null;
  conversationId?: string | null;
}

export interface FormattedNotification {
  text: string;
  href: string;
  icon: NotificationIcon;
}

export const FALLBACK_TEXT = "Bu bildirimin içeriği artık mevcut değil.";
const FALLBACK_HREF = "/bildirimler";

const ICON_BY_TYPE: Record<NotificationType, NotificationIcon> = {
  FOLLOW: "follow",
  JOIN_REQUEST: "request",
  JOIN_ACCEPTED: "accepted",
  JOIN_REJECTED: "rejected",
  INVITE: "invite",
  INVITE_ACCEPTED: "accepted",
  INVITE_DECLINED: "rejected",
  MESSAGE_REQUEST: "message",
  MESSAGE_REQUEST_ACCEPTED: "message",
  VERIFICATION_RESULT: "verification",
  INTRODUCTION: "intro",
  NEW_PROJECT_FROM_FOLLOWING: "project",
};

const VERIFICATION_TEXT: Record<string, string> = {
  APPROVED: "Belgen doğrulandı. Artık proje paylaşabilir ve projelere katılabilirsin.",
  REJECTED: "Belgen doğrulanamadı. Nedenini görmek için dokun.",
  MANUAL_REVIEW: "Belgen manuel incelemeye alındı. Sonucu 24 saat içinde bildireceğiz.",
};

function fallback(icon: NotificationIcon): FormattedNotification {
  return { text: FALLBACK_TEXT, href: FALLBACK_HREF, icon };
}

/** Bildirimi Türkçe metne, hedef adrese ve simgeye çevirir. */
export function formatNotification(notification: FormattableNotification): FormattedNotification {
  const icon = ICON_BY_TYPE[notification.type as NotificationType] ?? "project";
  const { actor = null, project = null, conversationId = null, data } = notification;

  const name = actor ? `${actor.firstName} ${actor.lastName}`.trim() : "";
  const profileHref = actor ? `/u/${actor.username}` : null;
  const projectHref = project ? `/projeler/${project.id}` : null;
  const projectTitle = project ? `“${project.title}”` : "";

  switch (notification.type) {
    case "FOLLOW":
      return profileHref
        ? { text: `${name} seni takip etmeye başladı.`, href: profileHref, icon }
        : fallback(icon);

    case "JOIN_REQUEST":
      return actor && projectHref
        ? { text: `${name}, ${projectTitle} projene katılmak istiyor.`, href: `${projectHref}#basvurular`, icon }
        : fallback(icon);

    case "JOIN_ACCEPTED":
      return projectHref
        ? { text: `${projectTitle} ekibine kabul edildin.`, href: projectHref, icon }
        : fallback(icon);

    case "JOIN_REJECTED":
      return projectHref
        ? { text: `${projectTitle} için başvurun bu kez kabul edilmedi.`, href: projectHref, icon }
        : fallback(icon);

    case "INVITE":
      return actor && projectHref
        ? { text: `${name} seni ${projectTitle} projesine davet etti.`, href: "/network?sekme=davetler", icon }
        : fallback(icon);

    case "INVITE_ACCEPTED":
      return actor && projectHref
        ? { text: `${name}, ${projectTitle} davetini kabul etti.`, href: projectHref, icon }
        : fallback(icon);

    case "INVITE_DECLINED":
      return actor && projectHref
        ? { text: `${name}, ${projectTitle} davetini kabul etmedi.`, href: projectHref, icon }
        : fallback(icon);

    case "MESSAGE_REQUEST":
      return actor
        ? { text: `${name} sana mesaj isteği gönderdi.`, href: "/mesajlar?sekme=istekler", icon }
        : fallback(icon);

    case "MESSAGE_REQUEST_ACCEPTED":
      return actor && conversationId
        ? { text: `${name} mesaj isteğini kabul etti.`, href: `/mesajlar/${conversationId}`, icon }
        : fallback(icon);

    case "VERIFICATION_RESULT": {
      const status = typeof data.status === "string" ? data.status : "";
      const text = VERIFICATION_TEXT[status];
      return text ? { text, href: "/dogrulama", icon } : fallback(icon);
    }

    case "INTRODUCTION": {
      const reason = typeof data.reason === "string" ? data.reason : null;
      return actor && reason !== null
        ? { text: `Seni ${name} ile tanıştıralım: ${reason}`, href: `/u/${actor.username}`, icon }
        : fallback(icon);
    }

    case "NEW_PROJECT_FROM_FOLLOWING":
      return actor && projectHref
        ? { text: `${name} yeni bir proje paylaştı: ${projectTitle}`, href: projectHref, icon }
        : fallback(icon);

    default:
      return fallback(icon);
  }
}
