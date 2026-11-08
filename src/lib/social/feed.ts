import { db } from "@/lib/db";
import { projectCardInclude, toProjectCardData, type ProjectCardData } from "@/lib/dto";

// Ana sayfa akışı: görüntüleyenin takip ettiği kişilerin projeleri (her durum), en yeni önce.
// Görüntüleyenin kendi projeleri ve takip etmediği kişilerin projeleri bu akışa girmez.

export const FEED_PAGE_SIZE = 10;
const MAX_PAGE = 10_000;

export interface HomeFeed {
  items: ProjectCardData[];
  hasMore: boolean;
}

/** Sayfa numarası: tam sayıya indirilir, en az 1. Geçersiz değer 1 sayılır. */
export function normalizeFeedPage(raw: unknown): number {
  const value = typeof raw === "string" ? Number.parseInt(raw, 10) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(Math.floor(value), MAX_PAGE);
}

/** Takip edilen kişilerin projeleri. Sayfa boyutundan bir fazla satır çekilerek `hasMore` bulunur. */
export async function getHomeFeed(viewerId: string, page = 1): Promise<HomeFeed> {
  const follows = await db.follow.findMany({
    where: { followerId: viewerId },
    select: { followingId: true },
  });
  const ownerIds = follows.map((follow) => follow.followingId).filter((id) => id !== viewerId);
  if (ownerIds.length === 0) return { items: [], hasMore: false };

  const safePage = normalizeFeedPage(page);
  const rows = await db.project.findMany({
    where: { ownerId: { in: ownerIds } },
    include: projectCardInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (safePage - 1) * FEED_PAGE_SIZE,
    take: FEED_PAGE_SIZE + 1,
  });

  const hasMore = rows.length > FEED_PAGE_SIZE;
  return {
    items: rows.slice(0, FEED_PAGE_SIZE).map(toProjectCardData),
    hasMore,
  };
}
