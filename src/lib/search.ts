import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { personSummarySelect, toPersonSummary, type PersonSummary, type ProjectCardData } from "@/lib/dto";
import { listProjects } from "@/lib/projects/queries";
import { foldTr, searchTokens } from "@/lib/tr";

// Arama sorguları (spec §4.9). Eşleşme searchText üzerinden, Türkçe duyarsız ve her belirteç AND'lenerek yapılır.

const DEFAULT_LIMIT = 20;

export interface PersonSearchResult {
  person: PersonSummary;
  following: boolean;
}

/** Katlamadan sonra en az iki karakter ve en az bir arama belirteci varsa sorgu aranabilir. */
export function isSearchableQuery(q: string): boolean {
  return foldTr(q).length >= 2 && searchTokens(q).length > 0;
}

/** Yalnız açık projeleri döner. Sorgu aranabilir değilse boş liste. */
export async function searchProjects(q: string, { limit = DEFAULT_LIMIT } = {}): Promise<ProjectCardData[]> {
  if (!isSearchableQuery(q)) return [];
  const list = await listProjects({ q, pageSize: limit });
  return list.items;
}

/**
 * Yalnız doğrulanmış kullanıcılar. Görüntüleyen, engeli olan iki yönde kişiler dışarıda kalır.
 * Sıra: kullanıcı adı tam eşleşenler önce, sonra doğrulanma tarihine göre en yeni.
 */
export async function searchPeople(
  q: string,
  viewerId: string,
  { limit = DEFAULT_LIMIT } = {},
): Promise<PersonSearchResult[]> {
  if (!isSearchableQuery(q)) return [];

  const tokens = searchTokens(q);
  const handle = q.trim().replace(/^@/, "").toLocaleLowerCase("tr-TR");

  const blocks = await db.block.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  const excluded = new Set<string>([viewerId]);
  for (const block of blocks) {
    excluded.add(block.blockerId === viewerId ? block.blockedId : block.blockerId);
  }

  const base: Prisma.UserWhereInput = {
    verificationStatus: "VERIFIED",
    AND: tokens.map((token) => ({ searchText: { contains: token } })),
  };

  const exact = await db.user.findFirst({
    where: { ...base, id: { notIn: [...excluded] }, username: handle },
    select: personSummarySelect,
  });

  const restLimit = limit - (exact ? 1 : 0);
  const rest =
    restLimit > 0
      ? await db.user.findMany({
          where: {
            ...base,
            id: { notIn: [...excluded, ...(exact ? [exact.id] : [])] },
          },
          orderBy: [{ verifiedAt: "desc" }, { id: "desc" }],
          take: restLimit,
          select: personSummarySelect,
        })
      : [];

  const people = exact ? [exact, ...rest] : rest;
  if (people.length === 0) return [];

  const follows = await db.follow.findMany({
    where: { followerId: viewerId, followingId: { in: people.map((person) => person.id) } },
    select: { followingId: true },
  });
  const following = new Set(follows.map((follow) => follow.followingId));

  return people.map((row) => ({
    person: toPersonSummary(row),
    following: following.has(row.id),
  }));
}
