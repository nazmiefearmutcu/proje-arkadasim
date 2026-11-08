import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getHomeFeed, FEED_PAGE_SIZE, normalizeFeedPage } from "@/lib/social/feed";
import { toSearchText } from "@/lib/tr";
import { createUser, resetDb } from "./helpers/db";

async function seedProject(ownerId: string, title: string, status = "OPEN") {
  return db.project.create({
    data: {
      ownerId,
      title,
      summary: "Öğrencilerin birlikte geliştirdiği bir proje özeti burada yazılıdır.",
      description: "Açıklama metni, en az seksen karakter olacak şekilde yazılmış bir proje açıklaması.",
      category: "YAZILIM",
      stage: "FIKIR",
      workMode: "UZAKTAN",
      status,
      searchText: toSearchText(title),
      members: { create: [{ userId: ownerId, isOwner: true }] },
    },
  });
}

describe("getHomeFeed", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("yalnız takip edilenlerin projelerini döner; kendi ve takip edilmeyenlerin projeleri yoktur", async () => {
    const viewer = await createUser();
    const followed = await createUser();
    const stranger = await createUser();

    await db.follow.create({ data: { followerId: viewer.id, followingId: followed.id } });

    const followedProject = await seedProject(followed.id, "Takip edilen proje");
    await seedProject(followed.id, "Kapalı takip edilen proje", "CLOSED");
    await seedProject(viewer.id, "Kendi projem");
    await seedProject(stranger.id, "Yabancı proje");

    const feed = await getHomeFeed(viewer.id, 1);

    const ids = feed.items.map((item) => item.id);
    expect(feed.items).toHaveLength(2);
    expect(ids).toContain(followedProject.id);
    expect(feed.items.every((item) => item.owner.id === followed.id)).toBe(true);
    expect(feed.hasMore).toBe(false);
  });

  it("takip yoksa boş döner", async () => {
    const viewer = await createUser();
    const stranger = await createUser();
    await seedProject(stranger.id, "Yabancı proje");

    expect(await getHomeFeed(viewer.id, 1)).toEqual({ items: [], hasMore: false });
  });

  it("sayfalar 10'arlık, en yeniden eskiye; sonraki sayfa kalanı verir", async () => {
    const viewer = await createUser();
    const followed = await createUser();
    await db.follow.create({ data: { followerId: viewer.id, followingId: followed.id } });

    for (let i = 0; i < FEED_PAGE_SIZE + 3; i += 1) {
      await seedProject(followed.id, `Proje ${i}`);
    }

    const first = await getHomeFeed(viewer.id, 1);
    expect(first.items).toHaveLength(FEED_PAGE_SIZE);
    expect(first.hasMore).toBe(true);

    const second = await getHomeFeed(viewer.id, 2);
    expect(second.items).toHaveLength(3);
    expect(second.hasMore).toBe(false);

    const firstIds = new Set(first.items.map((item) => item.id));
    expect(second.items.some((item) => firstIds.has(item.id))).toBe(false);
  });

  it("sayfa numarasını güvenli biçimde normalleştirir", () => {
    expect(normalizeFeedPage(undefined)).toBe(1);
    expect(normalizeFeedPage("abc")).toBe(1);
    expect(normalizeFeedPage("0")).toBe(1);
    expect(normalizeFeedPage("3")).toBe(3);
    expect(normalizeFeedPage("2.9")).toBe(2);
  });
});
