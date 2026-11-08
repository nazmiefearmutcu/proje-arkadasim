import Link from "next/link";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";

/**
 * Açık rıza kutusunun (AI_CONSENT_STATEMENT) hemen ardından gelen tam metin bağlantısı. Kayıt,
 * /dogrulama ve /ayarlar aynı bağlantıyı kullanır. Yeni sekmede açılır; formdaki seçim kaybolmaz.
 */
export function AiConsentTextLink({ className }: { className?: string }) {
  return (
    <Link
      href="/kvkk/acik-riza"
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex min-h-11 w-fit items-center rounded-control t-label text-pen", focusRing, className)}
    >
      Açık rıza metnini oku
    </Link>
  );
}
