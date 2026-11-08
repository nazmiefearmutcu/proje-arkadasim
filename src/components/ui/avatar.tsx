import { DISCIPLINE_GROUP_IDS, isDisciplineGroupId } from "@/config/taxonomy";
import { avatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/cn";

export type AvatarSize = 28 | 36 | 48 | 72 | 96;

const fontSize: Record<AvatarSize, string> = {
  28: "11px",
  36: "13px",
  48: "16px",
  72: "24px",
  96: "32px",
};

/** Kullanıcı adından deterministik bir disiplin rengi seçer (djb2 özeti). */
export function paletteColorFor(seed: string): string {
  let hash = 5381;
  for (const char of seed) {
    hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  }
  const id = DISCIPLINE_GROUP_IDS[hash % DISCIPLINE_GROUP_IDS.length];
  return `var(--d-${id})`;
}

/** Görünen addan baş harfler: "Ayşe Kılıç" -> "AK". Tek kelimede ilk harf. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => /\p{L}/u.test(word));
  if (words.length === 0) return "?";
  const first = Array.from(words[0])[0] ?? "";
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] ?? "" : "";
  return `${first}${last}`.toLocaleUpperCase("tr-TR");
}

export interface AvatarProps {
  /** Görünen ad. Baş harfler buradan alınır. */
  name: string;
  /** Renk tohumu, genellikle kullanıcı adı. Disiplin grubu yoksa kullanılır. */
  seed?: string;
  avatarPath?: string | null;
  disciplineGroup?: string | null;
  size?: AvatarSize;
  className?: string;
}

/**
 * Profil resmi, yoksa baş harfler. Arka plan disiplin grubunun rengidir; grup yoksa tohuma
 * göre paletten bir renk seçilir.
 */
export function Avatar({
  name,
  seed,
  avatarPath,
  disciplineGroup,
  size = 36,
  className,
}: AvatarProps) {
  const src = avatarUrl(avatarPath);
  const background = isDisciplineGroupId(disciplineGroup)
    ? `var(--d-${disciplineGroup})`
    : paletteColorFor(seed ?? name);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-[650] text-white select-none",
        className,
      )}
      style={{ width: size, height: size, background, fontSize: fontSize[size] }}
    >
      {src ? (
        // Resim, kimlik doğrulamalı rota işleyicisinden gelir; next/image optimizasyonu gerekmez.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} loading="lazy" className="size-full object-cover" />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </span>
  );
}
