import { productionConfigProblem } from "@/lib/startup-check";

/**
 * Next.js sunucu başlarken bir kez çağırır. Üretimde mock doğrulama sağlayıcısı seçilmişse
 * başlatmayı durdurur (spec §5.2). İstek anındaki MANUAL_REVIEW geri dönüşü ikinci savunma hattıdır.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const problem = productionConfigProblem(process.env);
  if (problem) throw new Error(problem);
}
