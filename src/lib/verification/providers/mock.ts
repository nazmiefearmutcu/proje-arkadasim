import { foldTr } from "@/lib/tr";
import { AiAnalysisSchema } from "./types";
import type { AiAnalysis, VerifierInput, VerifierProvider } from "./types";

// Yerel test ve seed için deterministik sağlayıcı. Gerçek bir analiz yapmaz; maskelenmiş
// metindeki anahtar kelimelere bakar. NODE_ENV=production iken kullanılamaz (bkz. index.ts).

type DocumentType = AiAnalysis["documentType"];
type DegreeLevel = AiAnalysis["degreeLevel"];

function isValidIsoDate(iso: string): boolean {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Metindeki en son gg.aa.yyyy (ya da gg/aa/yyyy) tarihini ISO biçiminde döndürür. */
function latestIsoDate(text: string): string | null {
  let latest: string | null = null;
  for (const match of text.matchAll(/(?<!\d)(\d{2})[./](\d{2})[./](\d{4})(?!\d)/g)) {
    const iso = `${match[3]}-${match[2]}-${match[1]}`;
    if (!isValidIsoDate(iso)) continue;
    if (latest === null || iso > latest) latest = iso;
  }
  return latest;
}

/** Bulunan ilk satırda, verilen anahtar kelimeyi içeren satırın iki nokta sonrasını döndürür. */
function valueOnLineWith(lines: string[], keywords: string[]): string | null {
  const line = lines.find((candidate) => {
    const folded = foldTr(candidate);
    return keywords.some((keyword) => folded.includes(keyword));
  });
  if (line === undefined) return null;
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const value = line.slice(colon + 1).trim();
  return value.length > 0 ? value : null;
}

function documentTypeOf(folded: string): DocumentType {
  if (folded.includes("ogrenci belgesi")) return "OGRENCI_BELGESI";
  if (folded.includes("mezun belgesi") || folded.includes("mezuniyet")) return "MEZUN_BELGESI";
  if (folded.includes("diploma")) return "DIPLOMA";
  return "DIGER";
}

function degreeLevelOf(folded: string): DegreeLevel {
  if (folded.includes("yuksek lisans") || folded.includes("yukseklisans")) return "YUKSEK_LISANS";
  if (folded.includes("doktora")) return "DOKTORA";
  if (folded.includes("on lisans") || folded.includes("onlisans")) return "ONLISANS";
  if (folded.includes("lisans")) return "LISANS";
  return "UNKNOWN";
}

function analyzeMock(input: VerifierInput): AiAnalysis {
  const text = input.maskedText;
  const folded = foldTr(text);
  const lines = text.split("\n");

  const documentType = documentTypeOf(folded);
  const isEducationDocument = documentType !== "DIGER";
  const academicStatus: AiAnalysis["academicStatus"] =
    documentType === "OGRENCI_BELGESI"
      ? "STUDENT"
      : documentType === "MEZUN_BELGESI" || documentType === "DIPLOMA"
        ? "GRADUATE"
        : "UNKNOWN";

  const institution = valueOnLineWith(lines, ["universite"]);
  const faculty = valueOnLineWith(lines, ["fakulte"]);
  const department = valueOnLineWith(lines, ["program", "bolum"]);
  const classMatch = /sinif (\d{1,2})(?!\d)/.exec(folded);
  const classYear = classMatch ? Number(classMatch[1]) : null;
  const issueDate = latestIsoDate(text) ?? input.today;

  const isTurkishHigherEducation =
    folded.includes("universitesi") || folded.includes("yuksekogretim");

  const sahte = folded.includes("sahte");
  const typeAndInstitutionFound = isEducationDocument && institution !== null;
  const confidence = sahte ? 0.3 : typeAndInstitutionFound ? 0.92 : 0.4;

  return AiAnalysisSchema.parse({
    isEducationDocument,
    documentType,
    academicStatus,
    institution,
    isTurkishHigherEducation,
    faculty,
    department,
    degreeLevel: degreeLevelOf(folded),
    classYear,
    graduationYear: null,
    issueDate,
    issuer: folded.includes("yuksekogretim") ? "YOK" : "DIGER",
    redFlags: sahte ? ["Test belgesi sahte olarak işaretlenmiş"] : [],
    confidence,
    summary: "Yerel test sağlayıcısı anahtar kelimelere göre sonuç üretti.",
  });
}

export function createMockProvider(): VerifierProvider {
  return {
    name: "mock",
    model: "mock-1",
    async analyze(input: VerifierInput): Promise<AiAnalysis> {
      return analyzeMock(input);
    },
  };
}
