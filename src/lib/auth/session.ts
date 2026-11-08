import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { SESSION_DAYS } from "@/config/legal";
import { generateToken, hashToken } from "./tokens";
import { currentUserSelect, type CurrentUser } from "./user-select";

export const SESSION_COOKIE = "pa_session";

const DAY_MS = 24 * 60 * 60 * 1000;
// Bu süreden az kalmışsa oturum uzatılır (kayan yenileme).
const RENEW_BEFORE_MS = 15 * DAY_MS;
const USER_AGENT_MAX = 200;

export interface SessionUser {
  sessionId: string;
  user: CurrentUser;
}

type Store = Awaited<ReturnType<typeof cookies>>;

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires,
  };
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
  store.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

/**
 * Çerezdeki oturumu çözer ve kullanıcıyı döner. İstek başına bir kez çalışır (React cache).
 * Süresi dolmuş oturumu siler. Kayan yenileme: 15 günden az kaldıysa süreyi uzatır; çerezi
 * yalnız yazılabilen bağlamda (Server Action, Route Handler) yeniler, diğer yerde yalnız
 * veritabanı süresi uzar.
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

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  if (session.expiresAt.getTime() - now < RENEW_BEFORE_MS) {
    const renewed = new Date(now + SESSION_DAYS * DAY_MS);
    await db.session.update({
      where: { id: session.id },
      data: { expiresAt: renewed },
    });
    renewCookie(store, token, renewed);
  }

  return { sessionId: session.id, user: session.user };
});

function renewCookie(store: Store, token: string, expires: Date): void {
  try {
    store.set(SESSION_COOKIE, token, cookieOptions(expires));
  } catch {
    // Server Component içinde çerez yazılamaz; veritabanındaki süre zaten uzatıldı.
  }
}

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
