import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { SESSION_DAYS } from "@/config/legal";
import { generateToken, hashToken } from "./tokens";
import { SESSION_COOKIE, sessionCookieOptions } from "./cookie";
import { currentUserSelect, type CurrentUser } from "./user-select";

export { SESSION_COOKIE } from "./cookie";

const DAY_MS = 24 * 60 * 60 * 1000;
const USER_AGENT_MAX = 200;

export interface SessionUser {
  sessionId: string;
  user: CurrentUser;
}

/** Oturum açar: jeton üretir, özetini veritabanına yazar ve çerezi ayarlar. Server Action içinde çağrılmalı. */
export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);

  const h = await headers();
  const userAgent = (h.get("user-agent") ?? "").slice(0, USER_AGENT_MAX) || null;

  await db.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt, userAgent },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

/**
 * Çerezdeki oturumu çözer ve kullanıcıyı döner. İstek başına bir kez çalışır (React cache).
 * Yalnız okur: çerez ve veritabanı süresi middleware'de (`renewSessionByToken`) birlikte
 * uzatılır. Burada yalnızca süresi dolmuş satır silinir.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: { select: currentUserSelect },
    },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  return { sessionId: session.id, user: session.user };
});

/** Geçerli oturumu kapatır: veritabanı satırını ve çerezi siler. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/** Kullanıcının tüm oturumlarını kapatır (parola değişimi, hesap güvenliği). */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
