import nodemailer from "nodemailer";

const DEFAULT_FROM = "Proje Arkadaşım <no-reply@proje-arkadasim.local>";

export interface MailInput {
  to: string;
  subject: string;
  text: string;
}

/**
 * Geliştirmede gövdedeki uzun, token benzeri dizileri gizleyerek konsola yazar.
 * Sıfırlama bağlantısındaki jeton konsola düşmez.
 */
function redactTokens(text: string): string {
  return text.replace(/[A-Za-z0-9_-]{32,}/g, "[gizlendi]");
}

/**
 * E-posta gönderir. `SMTP_URL` varsa nodemailer ile gönderir. Yoksa geliştirmede yalnız konsola
 * yazar; üretimde SMTP olmadan hata fırlatır.
 */
export async function sendMail({ to, subject, text }: MailInput): Promise<void> {
  const smtpUrl = process.env.SMTP_URL;
  const from = process.env.MAIL_FROM || DEFAULT_FROM;

  if (smtpUrl) {
    const transport = nodemailer.createTransport(smtpUrl);
    await transport.sendMail({ from, to, subject, text });
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SMTP yapılandırılmamış");
  }

  console.info(`[e-posta, geliştirme] alıcı=${to} konu=${subject}\n${redactTokens(text)}`);
}
