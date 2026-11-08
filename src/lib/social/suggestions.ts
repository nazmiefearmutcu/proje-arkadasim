import { getDisciplineGroup, isDisciplineGroupId } from "@/config/taxonomy";
import { db } from "@/lib/db";
import { toPersonSummary, type PersonSummary } from "@/lib/dto";
import { parseList } from "@/lib/json-fields";
import { notify } from "@/lib/notify";
import { foldTr } from "@/lib/tr";

// Tanıştırma algoritması (spec §8). Puanlama saf fonksiyondur; veritabanı okuması ve yazması
// ayrı fonksiyonlardadır. Bu dosya 'use server' değildir: kapatma eylemi introductions.ts içindedir.

/** Puanlama için kişinin gerekli alanları. */
export interface SuggestionProfile {
  id: string;
  city: string | null;
  university: string | null;
  disciplineGroup: string | null;
  interests: string[];
  lookingForProject: boolean;
}

export interface ScoreContext {
  /** Görüntüleyenin takip ettiği ve adayı takip eden kişi sayısı. */
  mutualCount: number;
}

export interface ScoreResult {
  score: number;
  reason: string;
  /** Her faktörün ağırlıklı katkısı. Katkı yoksa 0. */
  factors: Record<string, number>;
}

export const WEIGHTS = {
  sharedInterest: 3,
  complementaryDiscipline: 2,
  sameCity: 1.5,
  mutual: 1,
  mutualCap: 3,
  lookingForProject: 1,
  sameUniversity: 0.5,
} as const;

/** Eşitlikte önceliği belirler. Sırası spec §8 sırasıdır. */
const FACTOR_ORDER = [
  "sharedInterests",
  "complementaryDiscipline",
  "sameCity",
  "mutual",
  "lookingForProject",
  "sameUniversity",
] as const;

const MAX_REASON_INTERESTS = 3;

/** Katlanmış, boş olmayan ve yinelenmeyen ilgi alanları (ilk görünüm sırasıyla). Değer: özgün metin. */
function uniqueFolded(interests: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const interest of interests) {
    const key = foldTr(interest);
    if (key.length > 0 && !map.has(key)) map.set(key, interest.trim());
  }
  return map;
}

function sameFolded(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  const folded = foldTr(a);
  return folded.length > 0 && folded === foldTr(b);
}

/** Puanlar bir adayı. Gerekçe en yüksek katkılı faktörden üretilir; puanı 0 ise gerekçe boştur. */
export function scoreCandidate(
  viewer: SuggestionProfile,
  candidate: SuggestionProfile,
  ctx: ScoreContext,
): ScoreResult {
  const viewerInterests = uniqueFolded(viewer.interests);
  const candidateInterestKeys = new Set(uniqueFolded(candidate.interests).keys());
  const sharedNames: string[] = [];
  for (const [key, original] of viewerInterests) {
    if (candidateInterestKeys.has(key)) sharedNames.push(original);
  }

  const complementGroup =
    viewer.disciplineGroup && isDisciplineGroupId(viewer.disciplineGroup)
      ? getDisciplineGroup(viewer.disciplineGroup)
      : undefined;
  const isComplementary =
    complementGroup !== undefined &&
    candidate.disciplineGroup !== null &&
    complementGroup.complements.some((id) => id === candidate.disciplineGroup);

  const sameCity = sameFolded(viewer.city, candidate.city);
  const sameUniversity = sameFolded(viewer.university, candidate.university);
  const mutualCount = Math.max(0, ctx.mutualCount);

  const factors: Record<string, number> = {
    sharedInterests: sharedNames.length * WEIGHTS.sharedInterest,
    complementaryDiscipline: isComplementary ? WEIGHTS.complementaryDiscipline : 0,
    sameCity: sameCity ? WEIGHTS.sameCity : 0,
    mutual: Math.min(mutualCount, WEIGHTS.mutualCap) * WEIGHTS.mutual,
    lookingForProject: candidate.lookingForProject ? WEIGHTS.lookingForProject : 0,
    sameUniversity: sameUniversity ? WEIGHTS.sameUniversity : 0,
  };

  const score = Object.values(factors).reduce((sum, value) => sum + value, 0);

  let best: (typeof FACTOR_ORDER)[number] | null = null;
  for (const name of FACTOR_ORDER) {
    const value = factors[name] ?? 0;
    if (value > 0 && (best === null || value > (factors[best] ?? 0))) best = name;
  }

  let reason = "";
  if (best === "sharedInterests") {
    reason = `Ortak ilgi: ${sharedNames.slice(0, MAX_REASON_INTERESTS).join(", ")}`;
  } else if (best === "complementaryDiscipline") {
    const label = getDisciplineGroup(candidate.disciplineGroup ?? "")?.label ?? candidate.disciplineGroup;
    reason = `Farklı disiplin: ${label} ile tamamlayıcı`;
  } else if (best === "sameCity") {
    reason = `Aynı şehirde: ${candidate.city}`;
  } else if (best === "mutual") {
    reason = `${mutualCount} ortak bağlantı`;
  } else if (best === "lookingForProject") {
    reason = "Proje arıyor";
  } else if (best === "sameUniversity") {
    reason = "Aynı üniversite";
  }

  return { score, reason, factors };
}

// ---------------------------------------------------------------------------
// Veritabanı
// ---------------------------------------------------------------------------

const PROFILE_SELECT = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  avatarPath: true,
  university: true,
  department: true,
  disciplineGroup: true,
  academicStatus: true,
  verificationStatus: true,
  city: true,
  interestsJson: true,
  lookingForProject: true,
} as const;

interface ProfileRow {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarPath: string | null;
  university: string | null;
  department: string | null;
  disciplineGroup: string | null;
  academicStatus: string | null;
  verificationStatus: string;
  city: string | null;
  interestsJson: string;
  lookingForProject: boolean;
}

function toProfile(row: ProfileRow): SuggestionProfile {
  return {
    id: row.id,
    city: row.city,
    university: row.university,
    disciplineGroup: row.disciplineGroup,
    interests: parseList(row.interestsJson),
    lookingForProject: row.lookingForProject,
  };
}

export interface Suggestion {
  person: PersonSummary;
  reason: string;
  score: number;
}

/** Aday havuzu: en son doğrulananlar. */
const CANDIDATE_POOL = 300;
const INTRO_BATCH = 3;
const INTRO_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const INTRO_REPEAT_MS = 7 * 24 * 60 * 60 * 1000;
/** Tanıştırma için taranacak en çok öneri (7 gün kuralı sonrası yeterli aday bulmak için). */
const INTRO_SCAN = 30;

/**
 * Görüntüleyen için puanlı öneriler. Aday: doğrulanmış, kendisi değil, takip edilmeyen, engel
 * ilişkisi olmayan ve gizlenmiş tanıştırması olmayan. Puanı 0 olanlar atılır.
 */
export async function getSuggestions(viewerId: string, limit = 10): Promise<Suggestion[]> {
  const viewerRow = await db.user.findUnique({ where: { id: viewerId }, select: PROFILE_SELECT });
  if (!viewerRow) return [];
  const viewer = toProfile(viewerRow);

  const [followRows, blockRows, dismissedRows] = await Promise.all([
    db.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } }),
    db.block.findMany({
      where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
      select: { blockerId: true, blockedId: true },
    }),
    db.introduction.findMany({
      where: { userId: viewerId, dismissed: true },
      select: { suggestedUserId: true },
    }),
  ]);

  const followingIds = new Set(followRows.map((row) => row.followingId));
  const excluded = new Set<string>([
    viewerId,
    ...followingIds,
    ...blockRows.map((row) => (row.blockerId === viewerId ? row.blockedId : row.blockerId)),
    ...dismissedRows.map((row) => row.suggestedUserId),
  ]);

  const candidateRows = await db.user.findMany({
    where: { verificationStatus: "VERIFIED", id: { notIn: [...excluded] } },
    orderBy: [{ verifiedAt: "desc" }, { id: "asc" }],
    take: CANDIDATE_POOL,
    select: PROFILE_SELECT,
  });
  if (candidateRows.length === 0) return [];

  const followsOfCandidates = await db.follow.findMany({
    where: { followingId: { in: candidateRows.map((row) => row.id) } },
    select: { followerId: true, followingId: true },
  });
  const mutualByCandidate = new Map<string, number>();
  for (const follow of followsOfCandidates) {
    if (!followingIds.has(follow.followerId)) continue;
    mutualByCandidate.set(follow.followingId, (mutualByCandidate.get(follow.followingId) ?? 0) + 1);
  }

  const scored = candidateRows
    .map((row) => ({
      row,
      result: scoreCandidate(viewer, toProfile(row), { mutualCount: mutualByCandidate.get(row.id) ?? 0 }),
    }))
    .filter((entry) => entry.result.score > 0);

  // Dizi kararlıdır: eşit puanda havuz sırası (en son doğrulanan önce) korunur.
  scored.sort((a, b) => b.result.score - a.result.score);

  return scored.slice(0, limit).map(({ row, result }) => ({
    person: toPersonSummary(row),
    reason: result.reason,
    score: result.score,
  }));
}

/**
 * Görüntüleyene en fazla 3 tanıştırma yazar ve her biri için INTRODUCTION bildirimi üretir.
 * Kişi başı 7 günde en çok bir kez önerilir. Görüntüleyen için 24 saatte en çok bir kez çalışır
 * (gizlenmiş satırlar bu sayılmaz). Yazılan tanıştırma sayısını döner.
 */
export async function createIntroductions(viewerId: string, now: Date = new Date()): Promise<number> {
  const latest = await db.introduction.findFirst({
    where: { userId: viewerId, dismissed: false },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest && now.getTime() - latest.createdAt.getTime() < INTRO_COOLDOWN_MS) return 0;

  const suggestions = await getSuggestions(viewerId, INTRO_SCAN);
  if (suggestions.length === 0) return 0;

  const recent = await db.introduction.findMany({
    where: {
      userId: viewerId,
      suggestedUserId: { in: suggestions.map((suggestion) => suggestion.person.id) },
      createdAt: { gte: new Date(now.getTime() - INTRO_REPEAT_MS) },
    },
    select: { suggestedUserId: true },
  });
  const recentIds = new Set(recent.map((row) => row.suggestedUserId));

  const picks = suggestions
    .filter((suggestion) => !recentIds.has(suggestion.person.id))
    .slice(0, INTRO_BATCH);

  for (const pick of picks) {
    await db.introduction.upsert({
      where: { userId_suggestedUserId: { userId: viewerId, suggestedUserId: pick.person.id } },
      update: { reason: pick.reason, createdAt: now },
      create: { userId: viewerId, suggestedUserId: pick.person.id, reason: pick.reason },
    });
    await notify({
      userId: viewerId,
      actorId: pick.person.id,
      type: "INTRODUCTION",
      data: { reason: pick.reason },
    });
  }

  return picks.length;
}
