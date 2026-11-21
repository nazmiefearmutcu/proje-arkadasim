/**
 * Belge doğrulama modu (VERIFICATION_MODE).
 * - "editor" (varsayılan): her belge editörlerin inceleme kuyruğuna düşer; yapay zeka çağrılmaz,
 *   yurt dışı aktarım rızası da sorulmaz. Otomatik onay yoktur.
 * - "ai": yapay zeka ön incelemesi açıktır; rıza veren kullanıcının belgesi koşullar uygunsa
 *   otomatik onaylanabilir.
 * Tanınmayan değer güvenli tarafa, "editor" moduna düşer.
 */
export type VerificationMode = "editor" | "ai";

export function verificationMode(env: Record<string, string | undefined> = process.env): VerificationMode {
  return (env.VERIFICATION_MODE ?? "").trim().toLowerCase() === "ai" ? "ai" : "editor";
}

export function aiReviewEnabled(): boolean {
  return verificationMode() === "ai";
}
