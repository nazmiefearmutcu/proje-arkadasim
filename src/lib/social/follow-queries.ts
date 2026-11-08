import { db } from "@/lib/db";
import { personSummarySelect, toPersonSummary, type PersonSummary } from "@/lib/dto";

// Takip okuma sorguları. Yazmalar follow.ts içindedir.

/** Liste başına en çok bu kadar kişi gösterilir. */
export const FOLLOW_LIST_LIMIT = 200;

export interface FollowState {
  /** Görüntüleyen, hedefi takip ediyor mu. */
  following: boolean;
  /** Hedef, görüntüleyeni takip ediyor mu. */
  followsYou: boolean;
}

export interface FollowCounts {
  followers: number;
  following: number;
}

export interface FollowListEntry {
  person: PersonSummary;
  /** Görüntüleyen bu kişiyi takip ediyor mu (geri takip düğmesi için). */
  viewerFollows: boolean;
}

/** İki kullanıcı arasındaki takip durumu. Aynı kullanıcı için ikisi de false. */
export async function getFollowState(viewerId: string, targetId: string): Promise<FollowState> {
  if (viewerId === targetId) return { following: false, followsYou: false };

  const [ab, ba] = await Promise.all([
    db.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
      select: { followerId: true },
    }),
    db.follow.findUnique({
      where: { followerId_followingId: { followerId: targetId, followingId: viewerId } },
      select: { followerId: true },
    }),
  ]);
  return { following: ab !== null, followsYou: ba !== null };
}

/** Takipçi ve takip edilen sayıları. */
export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const [followers, following] = await Promise.all([
    db.follow.count({ where: { followingId: userId } }),
    db.follow.count({ where: { followerId: userId } }),
  ]);
  return { followers, following };
}

/** Görüntüleyenle engel ilişkisi olan kullanıcı kimlikleri. */
async function blockedIdsFor(viewerId: string): Promise<Set<string>> {
  const blocks = await db.block.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  return new Set(blocks.map((block) => (block.blockerId === viewerId ? block.blockedId : block.blockerId)));
}

/** Verilen kullanıcı kimliklerinden görüntüleyenin takip ettiklerini bulur. */
async function viewerFollowSet(viewerId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db.follow.findMany({
    where: { followerId: viewerId, followingId: { in: ids } },
    select: { followingId: true },
  });
  return new Set(rows.map((row) => row.followingId));
}

/**
 * Bir kullanıcının takipçileri (en yeni önce). Görüntüleyenle engel ilişkisi olanlar listelenmez.
 */
export async function listFollowers(userId: string, viewerId: string): Promise<FollowListEntry[]> {
  const rows = await db.follow.findMany({
    where: { followingId: userId },
    orderBy: { createdAt: "desc" },
    take: FOLLOW_LIST_LIMIT,
    select: { follower: { select: personSummarySelect } },
  });
  const blocked = await blockedIdsFor(viewerId);
  const visible = rows.filter((row) => !blocked.has(row.follower.id));
  const followed = await viewerFollowSet(
    viewerId,
    visible.map((row) => row.follower.id),
  );
  return visible.map((row) => ({
    person: toPersonSummary(row.follower),
    viewerFollows: followed.has(row.follower.id),
  }));
}

/**
 * Bir kullanıcının takip ettikleri (en yeni önce). Görüntüleyenle engel ilişkisi olanlar listelenmez.
 */
export async function listFollowing(userId: string, viewerId: string): Promise<FollowListEntry[]> {
  const rows = await db.follow.findMany({
    where: { followerId: userId },
    orderBy: { createdAt: "desc" },
    take: FOLLOW_LIST_LIMIT,
    select: { following: { select: personSummarySelect } },
  });
  const blocked = await blockedIdsFor(viewerId);
  const visible = rows.filter((row) => !blocked.has(row.following.id));
  const followed = await viewerFollowSet(
    viewerId,
    visible.map((row) => row.following.id),
  );
  return visible.map((row) => ({
    person: toPersonSummary(row.following),
    viewerFollows: followed.has(row.following.id),
  }));
}
