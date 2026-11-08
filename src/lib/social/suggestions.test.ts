import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "../../../tests/helpers/db";
import { createIntroductions, getSuggestions, scoreCandidate, WEIGHTS, type SuggestionProfile } from "./suggestions";

const DAY_MS = 24 * 60 * 60 * 1000;

function profile(overrides: Partial<SuggestionProfile> = {}): SuggestionProfile {
  return {
    id: "x",
    city: null,
    university: null,
    disciplineGroup: null,
    interests: [],
    lookingForProject: false,
    ...overrides,
  };
}

describe("scoreCandidate (saf puanlama)", () => {
  it("spec §8 ağırlıklarını toplar ve en yüksek katkılı faktörden gerekçe üretir", () => {
    const viewer = profile({
      id: "v",
      city: "İzmir",
      university: "Ege Üniversitesi",
      disciplineGroup: "yazilim",
      interests: ["Yapay Zeka", "Robotik"],
    });
    const candidate = profile({
      id: "c",
      city: "İzmir",
      university: "Ege Üniversitesi",
      disciplineGroup: "tasarim",
      interests: ["yapay zeka", "robotik", "müzik"],
      lookingForProject: true,
    });

    const result = scoreCandidate(viewer, candidate, { mutualCount: 2 });

    expect(result.factors.sharedInterests).toBe(2 * WEIGHTS.sharedInterest);
    expect(result.factors.complementaryDiscipline).toBe(WEIGHTS.complementaryDiscipline);
    expect(result.factors.sameCity).toBe(WEIGHTS.sameCity);
    expect(result.factors.mutual).toBe(2 * WEIGHTS.mutual);
    expect(result.factors.lookingForProject).toBe(WEIGHTS.lookingForProject);
    expect(result.factors.sameUniversity).toBe(WEIGHTS.sameUniversity);
    expect(result.score).toBe(6 + 2 + 1.5 + 2 + 1 + 0.5);
    expect(result.reason).toBe("Ortak ilgi: Yapay Zeka, Robotik");
  });

  it("ortak bağlantı katkısını en fazla 3 ile sınırlar", () => {
    const result = scoreCandidate(profile({ id: "v" }), profile({ id: "c" }), { mutualCount: 7 });
    expect(result.factors.mutual).toBe(WEIGHTS.mutualCap * WEIGHTS.mutual);
    expect(result.reason).toBe("7 ortak bağlantı");
  });

  it("tamamlayıcı disiplin gerekçesi Türkçe etiketle yazılır", () => {
    const result = scoreCandidate(
      profile({ disciplineGroup: "yazilim" }),
      profile({ disciplineGroup: "tasarim" }),
      { mutualCount: 0 },
    );
    expect(result.score).toBe(WEIGHTS.complementaryDiscipline);
    expect(result.reason).toBe("Farklı disiplin: Tasarım ile tamamlayıcı");
  });

  it("aynı şehir gerekçesi şehri gösterir; Türkçe büyük harf farkı yoktur", () => {
    const result = scoreCandidate(profile({ city: "IZMIR" }), profile({ city: "İzmir" }), { mutualCount: 0 });
    expect(result.score).toBe(WEIGHTS.sameCity);
    expect(result.reason).toBe("Aynı şehirde: İzmir");
  });

  it("proje arayan ve aynı üniversite gerekçeleri", () => {
    const looking = scoreCandidate(profile(), profile({ lookingForProject: true }), { mutualCount: 0 });
    expect(looking.reason).toBe("Proje arıyor");

    const same = scoreCandidate(profile({ university: "Boğaziçi Üniversitesi" }), profile({ university: "boğaziçi üniversitesi" }), {
      mutualCount: 0,
    });
    expect(same.reason).toBe("Aynı üniversite");
  });

  it("ortak özellik yoksa puan 0 ve gerekçe boş", () => {
    const result = scoreCandidate(profile({ disciplineGroup: "yazilim" }), profile({ disciplineGroup: "yazilim" }), {
      mutualCount: 0,
    });
    expect(result.score).toBe(0);
    expect(result.reason).toBe("");
  });
});

describe("getSuggestions ve createIntroductions (veritabanı)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("kendini, takip edilenleri, engelleri, gizlenenleri ve doğrulanmamışları dışarıda bırakır", async () => {
    const viewer = await createUser({ city: "İzmir", interestsJson: JSON.stringify(["yapay zeka"]) });
    const eligible = await createUser({ disciplineGroup: "tasarim" });
    const followed = await createUser({ disciplineGroup: "tasarim" });
    const blocked = await createUser({ disciplineGroup: "tasarim" });
    const dismissed = await createUser({ disciplineGroup: "tasarim" });
    const unverified = await createUser({ disciplineGroup: "tasarim", verificationStatus: "UNVERIFIED" });

    await db.follow.create({ data: { followerId: viewer.id, followingId: followed.id } });
    await db.block.create({ data: { blockerId: blocked.id, blockedId: viewer.id } });
    await db.introduction.create({
      data: { userId: viewer.id, suggestedUserId: dismissed.id, reason: "x", dismissed: true },
    });

    const suggestions = await getSuggestions(viewer.id, 10);
    const ids = suggestions.map((suggestion) => suggestion.person.id);

    expect(ids).toEqual([eligible.id]);
    expect(ids).not.toContain(viewer.id);
    expect(ids).not.toContain(unverified.id);
    expect(suggestions[0]?.reason).toBe("Farklı disiplin: Tasarım ile tamamlayıcı");
  });

  it("tanıştırmaları en fazla 3 satır ve 3 bildirimle yazar; 7 gün dolmadan ikinci parti yazılmaz", async () => {
    const viewer = await createUser({ disciplineGroup: "yazilim" });
    for (let i = 0; i < 5; i += 1) {
      await createUser({ disciplineGroup: "tasarim" });
    }
    const start = new Date();

    const first = await createIntroductions(viewer.id, start);
    expect(first).toBe(3);
    expect(await db.introduction.count({ where: { userId: viewer.id } })).toBe(3);
    expect(await db.notification.count({ where: { userId: viewer.id, type: "INTRODUCTION" } })).toBe(3);

    // Ertesi gün ve 7. günün hemen öncesi: bekleme süresi dolmadı (eskiden 24 saatte bir parti yazılıyordu).
    expect(await createIntroductions(viewer.id, new Date(start.getTime() + DAY_MS))).toBe(0);
    expect(await createIntroductions(viewer.id, new Date(start.getTime() + 7 * DAY_MS - 1))).toBe(0);
    expect(await db.introduction.count({ where: { userId: viewer.id } })).toBe(3);
    expect(await db.notification.count({ where: { userId: viewer.id, type: "INTRODUCTION" } })).toBe(3);

    // 7 gün dolunca yalnız ilk kez önerilecek kalan iki kişi tanıştırılır.
    expect(await createIntroductions(viewer.id, new Date(start.getTime() + 7 * DAY_MS))).toBe(2);
    expect(await db.introduction.count({ where: { userId: viewer.id } })).toBe(5);
    expect(await db.notification.count({ where: { userId: viewer.id, type: "INTRODUCTION" } })).toBe(5);
  });

  it("partiyi gizlemek 7 günlük bekleme süresini atlatmaz", async () => {
    const viewer = await createUser({ disciplineGroup: "yazilim" });
    for (let i = 0; i < 6; i += 1) {
      await createUser({ disciplineGroup: "tasarim" });
    }
    const start = new Date();

    expect(await createIntroductions(viewer.id, start)).toBe(3);
    await db.introduction.updateMany({ where: { userId: viewer.id }, data: { dismissed: true } });

    expect(await createIntroductions(viewer.id, start)).toBe(0);
    expect(await createIntroductions(viewer.id, new Date(start.getTime() + 3 * DAY_MS))).toBe(0);
    expect(await db.introduction.count({ where: { userId: viewer.id } })).toBe(3);
    expect(await db.notification.count({ where: { userId: viewer.id, type: "INTRODUCTION" } })).toBe(3);
  });

  it("hiç tanıştırılmamış bir öneriyi gizlemek sonraki partiyi geciktirmez", async () => {
    const viewer = await createUser({ disciplineGroup: "yazilim" });
    const hidden = await createUser({ disciplineGroup: "tasarim" });
    for (let i = 0; i < 6; i += 1) {
      await createUser({ disciplineGroup: "tasarim" });
    }
    const start = new Date();
    expect(await createIntroductions(viewer.id, start)).toBe(3);

    // Gizle düğmesinin yazdığı satır (dismissIntroductionAction): boş gerekçe, 6. gün.
    const sixth = new Date(start.getTime() + 6 * DAY_MS);
    await db.introduction.deleteMany({ where: { userId: viewer.id, suggestedUserId: hidden.id } });
    await db.introduction.create({
      data: { userId: viewer.id, suggestedUserId: hidden.id, reason: "", dismissed: true, createdAt: sixth },
    });

    expect(await createIntroductions(viewer.id, new Date(start.getTime() + 7 * DAY_MS + 1000))).toBeGreaterThan(0);
  });

  it("8 gün önce tanıştırılan kişiyi yeniden tanıştırmaz ve bildirmez; satırın tarihi yenilenmez", async () => {
    const viewer = await createUser({ disciplineGroup: "yazilim" });
    const old = await createUser({ disciplineGroup: "tasarim" });
    const fresh = await createUser({ disciplineGroup: "tasarim" });
    const now = new Date();
    const eightDaysAgo = new Date(now.getTime() - 8 * DAY_MS);
    await db.introduction.create({
      data: { userId: viewer.id, suggestedUserId: old.id, reason: "eski", createdAt: eightDaysAgo },
    });

    expect(await createIntroductions(viewer.id, now)).toBe(1);

    const notes = await db.notification.findMany({ where: { userId: viewer.id, type: "INTRODUCTION" } });
    expect(notes.map((note) => note.actorId)).toEqual([fresh.id]);
    const oldRow = await db.introduction.findUniqueOrThrow({
      where: { userId_suggestedUserId: { userId: viewer.id, suggestedUserId: old.id } },
    });
    expect(oldRow.createdAt.getTime()).toBe(eightDaysAgo.getTime());
    expect(oldRow.reason).toBe("eski");
  });

  it("tanıştırılmış ama gizlenmemiş kişi Tanıştırmalar listesinde kalır", async () => {
    const viewer = await createUser({ disciplineGroup: "yazilim" });
    const candidate = await createUser({ disciplineGroup: "tasarim" });

    expect(await createIntroductions(viewer.id)).toBe(1);
    const ids = (await getSuggestions(viewer.id, 10)).map((suggestion) => suggestion.person.id);
    expect(ids).toEqual([candidate.id]);
  });
});
