import { db } from "@/lib/db";
import { SESSION_DAYS } from "@/config/legal";
import { hashToken } from "./tokens";

const DAY_MS = 24 * 60 * 60 * 1000;
// Bu süreden az kalmışsa oturum uzatılır (kayan yenileme).
export const RENEW_BEFORE_MS = 15 * DAY_MS;

export type RenewOutcome =
  | { kind: "none" } // jetona karşılık gelen oturum yok
  | { kind: "expired" } // süresi dolmuş; satır silindi
  | { kind: "active" } // geçerli ve yenileme penceresinde değil; hiçbir şey yazılmadı
  | { kind: "renewed"; expiresAt: Date }; // veritabanı süresi uzatıldı; çerez aynı süreyle yazılmalı

/**
 * Middleware tarafından her istekte çağrılır (yalnız çerez varsa). Veritabanındaki süre ile
 * çerezin süresi burada birlikte belirlenir: çağıran taraf `renewed` ise çerezi `expiresAt` ile
 * yazmak zorundadır. Böylece çerez ve veritabanı süresi ayrışmaz.
 */
export async function renewSessionByToken(
  token: string,
  now: number = Date.now(),
): Promise<RenewOutcome> {
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, expiresAt: true },
  });
  if (!session) return { kind: "none" };

  if (session.expiresAt.getTime() <= now) {
    await db.session.deleteMany({ where: { id: session.id } });
    return { kind: "expired" };
  }

  if (session.expiresAt.getTime() - now >= RENEW_BEFORE_MS) return { kind: "active" };

  const expiresAt = new Date(now + SESSION_DAYS * DAY_MS);
  await db.session.update({ where: { id: session.id }, data: { expiresAt } });
  return { kind: "renewed", expiresAt };
}
