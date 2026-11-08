import { z } from "zod";
import type { PdfSignals } from "../extract";

export const DOCUMENT_TYPES = [
  "OGRENCI_BELGESI",
  "MEZUN_BELGESI",
  "DIPLOMA",
  "TRANSKRIPT",
  "DIGER",
] as const;

// Spec §5.1 adım 6'daki JSON ile birebir uyumlu.
export const AiAnalysisSchema = z.object({
  isEducationDocument: z.boolean(),
  documentType: z.enum(DOCUMENT_TYPES),
  academicStatus: z.enum(["STUDENT", "GRADUATE", "UNKNOWN"]),
  institution: z.string().nullable(),
  isTurkishHigherEducation: z.boolean(),
  faculty: z.string().nullable(),
  department: z.string().nullable(),
  degreeLevel: z.enum(["ONLISANS", "LISANS", "YUKSEK_LISANS", "DOKTORA", "UNKNOWN"]),
  classYear: z.number().int().nullable(),
  graduationYear: z.number().int().nullable(),
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Tarih YYYY-AA-GG biçiminde olmalı." })
    .nullable(),
  issuer: z.enum(["E_DEVLET", "YOK", "UNIVERSITE", "DIGER"]),
  redFlags: z.array(z.string()).max(10),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(400),
});

export type AiAnalysis = z.infer<typeof AiAnalysisSchema>;

export interface VerifierInput {
  maskedText: string;
  signals: {
    source: "PDF_TEXT" | "OCR";
    pdf?: PdfSignals;
    ocrConfidence?: number;
  };
  today: string;
}

export interface VerifierProvider {
  name: string;
  model: string;
  analyze(input: VerifierInput): Promise<AiAnalysis>;
}

/** Sağlayıcı yanıtı alınamadığında ya da geçersiz olduğunda fırlatılır. Ayrıntı içermez. */
export class VerifierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerifierError";
  }
}
