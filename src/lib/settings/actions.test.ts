import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hasActiveConsent, recordConsent } from "@/lib/consent";
import { db } from "@/lib/db";
import { createUser, resetDb } from "../../../tests/helpers/db";

const state = vi.hoisted(() => ({ cookie: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (state.cookie ? { name, value: state.cookie } : undefined),
    set: () => undefined,
    delete: () => {
      state.cookie = undefined;
    },
  }),
  headers: async () => new Headers(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

import {
  changePasswordAction,
  deleteAccountAction,
  grantAiConsentAction,
  updateProfileAction,
  withdrawAiConsentAction,
} from "./actions";

const PASSWORD = "Eski-Sifre-2026";
const NEW_PASSWORD = "Yeni-Sifre-2026";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

/** Test kullanıcısı için gerçek bir oturum satırı ve çerez üretir. */
async function signIn(userId: string): Promise<string> {
  const token = generateToken();
  const row = await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  state.cookie = token;
  return row.id;
}

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("beklenen hata fırlatılmadı");
}

describe("ayarlar Server Action'ları", () => {
  beforeEach(async () => {
    await resetDb();
    state.cookie = undefined;
    (globalThis as unknown as { __rateLimitEntries?: Map<string, unknown> }).__rateLimitEntries?.clear();
  });

  describe("updateProfileAction", () => {
    it("doğrulanmış kullanıcıda disiplin grubunu ve arama metnini yeniler; ad ve üniversiteyi değiştirmez", async () => {
      const user = await createUser({
        firstName: "Ayşe",
        lastName: "Nur",
        university: "Test Üniversitesi",
        department: "Bilgisayar Mühendisliği",
        disciplineGroup: "yazilim",
      });
      await signIn(user.id);

      const result = await updateProfileAction(
        null,
        form({
          bio: "Robotik ve sürdürülebilir üretim üzerine çalışıyorum.",
          city: "Ankara",
          skills: JSON.stringify(["React", "SQL"]),
          interests: JSON.stringify(["robotik"]),
          lookingForProject: "on",
          firstName: "Hacker",
          lastName: "Değişti",
          username: "baska",
          university: "Başka Üniversite",
          faculty: "Mühendislik Fakültesi",
          department: "Makine Mühendisliği",
          degreeLevel: "LISANS",
          classYear: "3",
        }),
      );

      expect(result).toEqual({ ok: true });
      const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.firstName).toBe("Ayşe");
      expect(row.lastName).toBe("Nur");
      expect(row.username).toBe(user.username);
      expect(row.university).toBe("Test Üniversitesi");
      expect(row.department).toBe("Makine Mühendisliği");
      expect(row.disciplineGroup).toBe("makine");
      expect(row.faculty).toBe("Mühendislik Fakültesi");
      expect(row.degreeLevel).toBe("LISANS");
      expect(row.classYear).toBe(3);
      expect(row.city).toBe("Ankara");
      expect(row.bio).toContain("Robotik");
      expect(row.lookingForProject).toBe(true);
      expect(JSON.parse(row.skillsJson)).toEqual(["React", "SQL"]);
      expect(JSON.parse(row.interestsJson)).toEqual(["robotik"]);
      expect(row.searchText).toContain("react");
      expect(row.searchText).toContain("robotik");
      expect(row.searchText).toContain("ankara");
      expect(row.searchText).toContain("makine");
      expect(row.searchText).toContain("ayse");
      expect(row.searchText).not.toContain("hacker");
    });

    it("fazla beceriyi reddeder ve hiçbir alanı değiştirmez", async () => {
      const user = await createUser({ bio: "eski biyografi" });
      await signIn(user.id);

      const skills = Array.from({ length: 16 }, (_, index) => `beceri${index}`);
      const result = (await updateProfileAction(null, form({ bio: "yeni", skills: JSON.stringify(skills) }))) as {
        ok: boolean;
        fieldErrors?: Record<string, string>;
      };

      expect(result.ok).toBe(false);
      expect(result.fieldErrors?.skills).toContain("15");
      const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.bio).toBe("eski biyografi");
    });

    it("oturum yoksa işlemi reddeder", async () => {
      const result = await updateProfileAction(null, form({ bio: "x" }));
      expect(result).toMatchObject({ ok: false });
    });

    it("sınıfı boş (null) doğrulanmış öğrenci yalnız biyografisini kaydedebilir", async () => {
      const user = await createUser({ academicStatus: "STUDENT", classYear: null });
      await signIn(user.id);

      const result = await updateProfileAction(null, form({ bio: "Yüksek lisans öğrencisiyim.", classYear: "" }));

      expect(result).toEqual({ ok: true });
      const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.bio).toBe("Yüksek lisans öğrencisiyim.");
      expect(row.classYear).toBeNull();
    });

    it("akademik durumu boş (ör. tohum yöneticisi) doğrulanmış hesap kaydedebilir", async () => {
      const user = await createUser({ academicStatus: null, classYear: null, graduationYear: null, role: "ADMIN" });
      await signIn(user.id);

      const result = await updateProfileAction(null, form({ bio: "Platform yöneticisi.", city: "İzmir" }));

      expect(result).toEqual({ ok: true });
      const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.bio).toBe("Platform yöneticisi.");
      expect(row.city).toBe("İzmir");
    });

    it("mezuniyet yılı boş mezun kaydedebilir", async () => {
      const user = await createUser({ academicStatus: "GRADUATE", graduationYear: null, classYear: null });
      await signIn(user.id);

      const result = await updateProfileAction(null, form({ bio: "Mezunum.", graduationYear: "" }));

      expect(result).toEqual({ ok: true });
      expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).graduationYear).toBeNull();
    });

    it("listede olmayan kayıtlı sınıfı (10) değiştirmeden kabul eder, yeni aralık dışı seçimi reddeder", async () => {
      const user = await createUser({ academicStatus: "STUDENT", classYear: 10, bio: "eski" });
      await signIn(user.id);

      const kept = await updateProfileAction(null, form({ bio: "yeni", classYear: "10" }));
      expect(kept).toEqual({ ok: true });
      let row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.classYear).toBe(10);
      expect(row.bio).toBe("yeni");

      const outOfRange = (await updateProfileAction(null, form({ bio: "daha yeni", classYear: "9" }))) as {
        ok: boolean;
        fieldErrors?: Record<string, string>;
      };
      expect(outOfRange.ok).toBe(false);
      expect(outOfRange.fieldErrors?.classYear).toBeTruthy();
      row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.classYear).toBe(10);
      expect(row.bio).toBe("yeni");

      const changed = await updateProfileAction(null, form({ bio: "daha yeni", classYear: "2" }));
      expect(changed).toEqual({ ok: true });
      expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).classYear).toBe(2);
    });
  });

  describe("changePasswordAction", () => {
    it("mevcut şifre yanlışsa reddeder", async () => {
      const user = await createUser({ passwordHash: await hashPassword(PASSWORD) });
      await signIn(user.id);

      const result = await changePasswordAction(
        null,
        form({ currentPassword: "Yanlis-Sifre-1", newPassword: NEW_PASSWORD, newPasswordRepeat: NEW_PASSWORD }),
      );

      expect(result).toMatchObject({ ok: false, fieldErrors: { currentPassword: expect.any(String) } });
      const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(await verifyPassword(PASSWORD, row.passwordHash)).toBe(true);
    });

    it("doğru şifreyle değiştirir, yalnız mevcut oturumu korur", async () => {
      const user = await createUser({ passwordHash: await hashPassword(PASSWORD) });
      const currentSessionId = await signIn(user.id);
      await db.session.create({
        data: {
          tokenHash: hashToken(generateToken()),
          userId: user.id,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      await db.session.create({
        data: {
          tokenHash: hashToken(generateToken()),
          userId: user.id,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });

      const result = await changePasswordAction(
        null,
        form({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD, newPasswordRepeat: NEW_PASSWORD }),
      );

      expect(result).toEqual({ ok: true });
      const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(await verifyPassword(NEW_PASSWORD, row.passwordHash)).toBe(true);
      const sessions = await db.session.findMany({ where: { userId: user.id }, select: { id: true } });
      expect(sessions.map((session) => session.id)).toEqual([currentSessionId]);
    });

    it("tekrar alanı eşleşmezse reddeder", async () => {
      const user = await createUser({ passwordHash: await hashPassword(PASSWORD) });
      await signIn(user.id);

      const result = await changePasswordAction(
        null,
        form({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD, newPasswordRepeat: "Baska-Sifre-2026" }),
      );
      expect(result).toMatchObject({ ok: false, fieldErrors: { newPasswordRepeat: "Şifreler eşleşmiyor." } });
    });

    it("15 dakikada 10 denemeden sonra doğru şifreyi de denetlemeden reddeder", async () => {
      const user = await createUser({ passwordHash: await hashPassword(PASSWORD) });
      await signIn(user.id);

      for (let attempt = 0; attempt < 10; attempt++) {
        const wrong = await changePasswordAction(
          null,
          form({ currentPassword: `Yanlis-Sifre-${attempt}`, newPassword: NEW_PASSWORD, newPasswordRepeat: NEW_PASSWORD }),
        );
        expect(wrong).toMatchObject({ ok: false, fieldErrors: { currentPassword: expect.any(String) } });
      }

      const limited = await changePasswordAction(
        null,
        form({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD, newPasswordRepeat: NEW_PASSWORD }),
      );
      expect(limited.ok).toBe(false);
      expect(limited.ok === false && limited.error).toMatch(/^Çok fazla deneme yaptın\. \d+ dakika sonra tekrar dene\.$/);
      const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(await verifyPassword(PASSWORD, row.passwordHash)).toBe(true);
    });
  });

  describe("rıza işlemleri", () => {
    it("açık rızayı geri alır ve kaydı silmeden yeni 'verilmedi' satırı yazar", async () => {
      const user = await createUser();
      await signIn(user.id);
      await recordConsent(user.id, "CROSS_BORDER_AI", true);
      expect(await hasActiveConsent(user.id, "CROSS_BORDER_AI")).toBe(true);

      const result = await withdrawAiConsentAction();

      expect(result).toEqual({ ok: true });
      expect(await hasActiveConsent(user.id, "CROSS_BORDER_AI")).toBe(false);
      const rows = await db.consent.findMany({
        where: { userId: user.id, type: "CROSS_BORDER_AI" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { granted: true },
      });
      expect(rows.map((row) => row.granted)).toEqual([true, false]);
    });

    it("rıza kutusu işaretlenmeden rıza kaydetmez", async () => {
      const user = await createUser();
      await signIn(user.id);

      const result = await grantAiConsentAction(null, form({}));

      expect(result).toMatchObject({ ok: false });
      expect(await hasActiveConsent(user.id, "CROSS_BORDER_AI")).toBe(false);
    });

    it("kutu işaretliyse rıza kaydeder", async () => {
      const user = await createUser();
      await signIn(user.id);

      const result = await grantAiConsentAction(null, form({ aiConsent: "on" }));

      expect(result).toEqual({ ok: true });
      expect(await hasActiveConsent(user.id, "CROSS_BORDER_AI")).toBe(true);
    });
  });

  describe("deleteAccountAction", () => {
    it("yanlış kullanıcı adında ya da yanlış şifrede hesabı silmez", async () => {
      const user = await createUser({ passwordHash: await hashPassword(PASSWORD) });
      await signIn(user.id);

      const wrongName = await deleteAccountAction(null, form({ password: PASSWORD, usernameConfirm: "yanlis" }));
      expect(wrongName).toMatchObject({ ok: false, fieldErrors: { usernameConfirm: expect.any(String) } });

      const wrongPassword = await deleteAccountAction(
        null,
        form({ password: "Yanlis-Sifre-1", usernameConfirm: user.username }),
      );
      expect(wrongPassword).toMatchObject({ ok: false, fieldErrors: { password: expect.any(String) } });

      expect(await db.user.count({ where: { id: user.id } })).toBe(1);
    });

    it("onay alanına baştaki '@' ile yazılan kullanıcı adını kabul eder", async () => {
      const user = await createUser({ passwordHash: await hashPassword(PASSWORD) });
      await signIn(user.id);

      const error = await errorOf(
        deleteAccountAction(null, form({ password: PASSWORD, usernameConfirm: `@${user.username}` })),
      );

      expect((error as Error).message).toBe("REDIRECT:/?hesap=silindi");
      expect(await db.user.count({ where: { id: user.id } })).toBe(0);
    });

    it("yalnız tek bir baştaki '@' yok sayılır", async () => {
      const user = await createUser({ passwordHash: await hashPassword(PASSWORD) });
      await signIn(user.id);

      const result = await deleteAccountAction(null, form({ password: PASSWORD, usernameConfirm: `@@${user.username}` }));

      expect(result).toMatchObject({ ok: false, fieldErrors: { usernameConfirm: expect.any(String) } });
      expect(await db.user.count({ where: { id: user.id } })).toBe(1);
    });

    it("şifre değiştirmeyle ortak sınırı aşınca hesabı silmez", async () => {
      const user = await createUser({ passwordHash: await hashPassword(PASSWORD) });
      await signIn(user.id);

      for (let attempt = 0; attempt < 5; attempt++) {
        await changePasswordAction(
          null,
          form({ currentPassword: `Yanlis-Sifre-${attempt}`, newPassword: NEW_PASSWORD, newPasswordRepeat: NEW_PASSWORD }),
        );
      }
      for (let attempt = 0; attempt < 5; attempt++) {
        const wrong = await deleteAccountAction(
          null,
          form({ password: `Yanlis-Sifre-${attempt}`, usernameConfirm: user.username }),
        );
        expect(wrong).toMatchObject({ ok: false, fieldErrors: { password: expect.any(String) } });
      }

      const limited = await deleteAccountAction(null, form({ password: PASSWORD, usernameConfirm: user.username }));
      expect(limited.ok === false && limited.error).toMatch(/^Çok fazla deneme yaptın\. \d+ dakika sonra tekrar dene\.$/);
      expect(await db.user.count({ where: { id: user.id } })).toBe(1);
    });

    it("şifre ve kullanıcı adı doğruysa hesabı ve bağlı verileri siler, ana sayfaya yönlendirir", async () => {
      const passwordHash = await hashPassword(PASSWORD);
      const user = await createUser({ passwordHash });
      const other = await createUser();
      await signIn(user.id);

      const project = await db.project.create({
        data: {
          ownerId: user.id,
          title: "Akıllı sera",
          summary: "Sera nemini ölçen düşük maliyetli bir sistem.",
          description: "Sera nemini ve sıcaklığını ölçüp uzaktan izleyen bir prototip. ".repeat(3),
          category: "YAZILIM",
          stage: "PROTOTIP",
          workMode: "UZAKTAN",
          searchText: "akilli sera",
        },
      });
      await db.follow.create({ data: { followerId: user.id, followingId: other.id } });
      const conversation = await db.conversation.create({
        data: { userAId: user.id, userBId: other.id, initiatorId: user.id, status: "ACTIVE" },
      });
      await db.message.create({
        data: { conversationId: conversation.id, senderId: user.id, body: "merhaba" },
      });

      const error = await errorOf(
        deleteAccountAction(null, form({ password: PASSWORD, usernameConfirm: user.username })),
      );

      expect((error as Error).message).toBe("REDIRECT:/?hesap=silindi");
      expect(await db.user.count({ where: { id: user.id } })).toBe(0);
      expect(await db.project.count({ where: { id: project.id } })).toBe(0);
      expect(await db.follow.count({ where: { followerId: user.id } })).toBe(0);
      expect(await db.message.count({ where: { senderId: user.id } })).toBe(0);
      expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
      expect(await db.user.count({ where: { id: other.id } })).toBe(1);
    });
  });
});
