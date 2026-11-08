import { cn } from "@/lib/cn";
import { focusRing } from "./styles";

// JSX içermeyen sınıf yardımcısı: hem Chip hem başka dokunulan çipler (ör. arama önerileri) kullanır
// ve vitest'te doğrudan test edilebilir (tsconfig jsx: preserve olduğu için .tsx test edilemiyor).

export interface ChipStyle {
  /** Dokunulan çip (bağlantı ya da düğme): 44 px dokunma hedefi. Verilmezse 32 px statik çip. */
  interactive?: boolean;
  /** Tek satırda kalır (yatay kaydırılan filtre satırları). Verilmezse uzun metin satır kırar. */
  nowrap?: boolean;
}

/**
 * Çip sınıfları. Yükseklik ve satır kırma birbirini dışlayan sınıflarla seçilir: `cn` çakışan
 * Tailwind sınıflarını birleştirmez, bu yüzden aynı özelliği iki kez veren sınıf eklenmez.
 * Satır kıran çipler `max-w-full` ve `overflow-wrap: anywhere` ile kapsayıcıya sığar; 60 karakterlik
 * bir rol adı ya da boşluksuz bir etiket 375 px'te yatay kaydırma açmaz.
 */
export function chipClasses(selected = false, className?: string, style: ChipStyle = {}): string {
  return cn(
    "inline-flex items-center gap-1.5 rounded-chip px-3 py-1 t-label",
    style.interactive ? "min-h-11" : "min-h-8",
    style.nowrap ? "whitespace-nowrap" : "max-w-full whitespace-normal [overflow-wrap:anywhere]",
    selected ? "bg-pen-soft text-pen" : "bg-surface-2 text-ink-2",
    focusRing,
    className,
  );
}
