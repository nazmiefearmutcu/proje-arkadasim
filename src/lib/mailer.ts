import nodemailer from "nodemailer";

const DEFAULT_FROM = "Proje Arkadaşım <no-reply@proje-arkadasim.local>";

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  /**
   * Yalnız geliştirme konsolu için (üretim dışı ve `SMTP_URL` boşken) gizlenmeden yazılan bağlantı.
   * Şifre sıfırlama akışı yerelde baştan sona denenebilsin diye vardır. SMTP ile gönderimde ve
   * üretimde hiçbir yere yazılmaz; e-postaya da eklenmez (bağlantı zaten `text` içindedir).
   */
  devLink?: string;
}

/**
 * Geliştirmede gövdedeki uzun, token benzeri dizileri gizleyerek konsola yazar.
 * Sıfırlama bağlantısındaki jeton gövde çıktısında görünmez.
 */
function redactTokens(text: string): string {
  return text.replace(/[A-Za-z0-9_-]{32,}/g, "[gizlendi]");
}

/**
 * E-posta gönderir. `SMTP_URL` varsa nodemailer ile gönderir ve konsola hiçbir şey yazmaz. Yoksa
 * geliştirmede gövdeyi gizleyerek konsola yazar (varsa `devLink` ayrı satırda, gizlenmeden);
 * üretimde SMTP olmadan hata fırlatır ve hiçbir şey yazmaz.
 */
export async function sendMail({ to, subject, text, devLink }: MailInput): Promise<void> {
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
  // Tek istisna (karar R1): yerel geliştirmede sıfırlama bağlantısı denenebilsin diye gizlenmez.
  if (devLink) console.info(`Geliştirme bağlantısı: ${devLink}`);
}
