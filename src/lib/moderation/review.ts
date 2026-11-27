import { db } from "@/lib/db";
import { parseList } from "@/lib/json-fields";
import { notifyMany } from "@/lib/notify";
import { assessContent } from "./assess";
import type { ContentInput, FlagCode } from "./assess";

// İlan kaydedilirken çağrılan denetim (spec 2026-11-27 §3). Sahibin yakın geçmişini okur, metni
// puanlar ve kaydedilecek denetim alanlarını döndürür.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Aynı projeye bu kadar farklı kişiden açık şikayet gelirse ilan yayından çekilip editöre düşer. */
export const REPORT_HOLD_THRESHOLD = 3;

export type ExtendedFlag = FlagCode | "REPORTED";

export const REPORTED_LABEL = "Çok sayıda şikayet";

export interface ModerationFields {
  moderationStatus: "APPROVED" | "PENDING";
  moderationFlagsJson: string;
}

/** Yeni ilan için denetim alanları. */
export async function moderationForNewProject(ownerId: string, input: ContentInput): Promise<ModerationFields> {
  const now = Date.now();
  const [recent, createdLast24h] = await Promise.all([
    db.project.findMany({
      where: { ownerId, createdAt: { gte: new Date(now - 7 * DAY_MS) } },
      select: { title: true, description: true },
      take: 50,
    }),
    db.project.count({ where: { ownerId, createdAt: { gte: new Date(now - DAY_MS) } } }),
  ]);
  const result = assessContent(input, { recent, createdLast24h });
  return {
    moderationStatus: result.hold ? "PENDING" : "APPROVED",
    moderationFlagsJson: JSON.stringify(result.flags),
  };
}

/**
 * Düzenlenen ilan için denetim alanları. Yalnız düzenleme yeni bir şüphe getirirse ilan bekletilir:
 * editörün daha önce gördüğü işaretler (onayladığı anda kayıtlı olanlar) yeniden bekletme sebebi değildir.
 * Bekleyen bir ilan düzenlemeyle kendiliğinden yayına girmez; kararı editör verir.
 */
export async function moderationForEditedProject(
  project: { id: string; ownerId: string; moderationStatus: string; moderationFlagsJson: string; moderatedAt: Date | null },
  input: ContentInput,
): Promise<ModerationFields> {
  const recent = await db.project.findMany({
    where: { ownerId: project.ownerId, id: { not: project.id }, createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) } },
    select: { title: true, description: true },
    take: 50,
  });
  // Düzenleme yeni ilan sayılmaz; kısa sürede çok ilan işareti burada aranmaz.
  const result = assessContent(input, { recent, createdLast24h: 0 });
  const flagsJson = JSON.stringify(result.flags);

  if (project.moderationStatus === "PENDING") {
    return { moderationStatus: "PENDING", moderationFlagsJson: flagsJson };
  }
  if (!result.hold) return { moderationStatus: "APPROVED", moderationFlagsJson: flagsJson };

  const seenByEditor = project.moderatedAt ? new Set(parseList(project.moderationFlagsJson)) : new Set<string>();
  const newFlags = result.flags.filter((flag) => !seenByEditor.has(flag));
  return { moderationStatus: newFlags.length > 0 ? "PENDING" : "APPROVED", moderationFlagsJson: flagsJson };
}

/**
 * Şikayet sonrası: projeye farklı kişilerden gelen açık şikayet sayısı eşiğe ulaştıysa yayındaki ilan
 * bekletmeye alınır. Bekletildiyse true döner.
 */
export async function holdIfReportedEnough(projectId: string): Promise<boolean> {
  const reporters = await db.report.findMany({
    where: { targetType: "PROJECT", targetId: projectId, status: "OPEN", reporterId: { not: null } },
    distinct: ["reporterId"],
    select: { reporterId: true },
  });
  if (reporters.length < REPORT_HOLD_THRESHOLD) return false;

  const project = await db.project.findUnique({ where: { id: projectId }, select: { moderationFlagsJson: true } });
  if (!project) return false;
  const flags = new Set(parseList(project.moderationFlagsJson));
  flags.add("REPORTED");
  const { count } = await db.project.updateMany({
    where: { id: projectId, moderationStatus: "APPROVED" },
    data: { moderationStatus: "PENDING", moderationFlagsJson: JSON.stringify([...flags]) },
  });
  return count > 0;
}

/**
 * Takipçilere yeni ilan bildirimi. Onaylı yeni ilanda ya da bekleyen ilan editörce onaylandığında
 * çağrılır. Sunucu eylemi değildir: istemciden çağrılamaz.
 */
export async function notifyFollowersOfNewProject(ownerId: string, projectId: string): Promise<void> {
  const followers = await db.follow.findMany({
    where: { followingId: ownerId },
    select: { followerId: true },
  });
  await notifyMany(
    followers.map((follow) => follow.followerId),
    { type: "NEW_PROJECT_FROM_FOLLOWING", actorId: ownerId, projectId },
  );
}
