import { DISCIPLINE_GROUP_IDS, isDisciplineGroupId, type DisciplineGroupId } from "@/config/taxonomy";

// JSX içermeyen renk yardımcıları (Avatar kullanır; vitest'te doğrudan test edilebilir).

/** Kullanıcı adından deterministik bir disiplin grubu seçer (djb2 özeti). */
export function paletteGroupFor(seed: string): DisciplineGroupId {
  let hash = 5381;
  for (const char of seed) {
    hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  }
  return DISCIPLINE_GROUP_IDS[hash % DISCIPLINE_GROUP_IDS.length];
}

/** Kullanıcı adından deterministik bir disiplin rengi seçer. */
export function paletteColorFor(seed: string): string {
  return `var(--d-${paletteGroupFor(seed)})`;
}

/**
 * Avatar renkleri: arka plan disiplin rengi (grup yoksa tohuma göre paletten), baş harfler o rengin
 * mürekkebi (`--d-<id>-ink`, globals.css). Mürekkep her temada her disiplin renginde en az 4.5:1 verir.
 */
export function avatarColorsFor(
  disciplineGroup: string | null | undefined,
  seed: string,
): { background: string; color: string } {
  const id = isDisciplineGroupId(disciplineGroup) ? disciplineGroup : paletteGroupFor(seed);
  return { background: `var(--d-${id})`, color: `var(--d-${id}-ink)` };
}
