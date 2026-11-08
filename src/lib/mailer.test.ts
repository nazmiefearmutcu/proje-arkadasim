import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

const transportSendMail = vi.hoisted(() => vi.fn<(options: unknown) => Promise<object>>(async () => ({})));
const createTransport = vi.hoisted(() =>
  vi.fn<(url: string) => { sendMail: typeof transportSendMail }>(() => ({ sendMail: transportSendMail })),
);

vi.mock("nodemailer", () => ({
  default: { createTransport },
}));

import { sendMail } from "./mailer";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";
const LINK = `http://localhost:3000/sifre-sifirla/${TOKEN}`;
const MAIL = {
  to: "kisi@ornek.test",
  subject: "Şifre sıfırlama bağlantın",
  text: ["Şifreni sıfırlamak için aşağıdaki bağlantıyı aç:", LINK, "", "Bağlantı 60 dakika geçerlidir."].join("\n"),
  devLink: LINK,
};

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"] as const;

type ConsoleSpies = Record<(typeof CONSOLE_METHODS)[number], MockInstance>;

/** Konsolun tüm yazma yöntemlerini dinler; testte gerçek çıktı üretilmez. */
function spyConsole(): ConsoleSpies {
  return {
    log: vi.spyOn(console, "log").mockImplementation(() => undefined),
    info: vi.spyOn(console, "info").mockImplementation(() => undefined),
    warn: vi.spyOn(console, "warn").mockImplementation(() => undefined),
    error: vi.spyOn(console, "error").mockImplementation(() => undefined),
    debug: vi.spyOn(console, "debug").mockImplementation(() => undefined),
  };
}

/** Konsola yazılan her şeyi tek metin olarak döner. */
function allOutput(spies: ConsoleSpies): string {
  return CONSOLE_METHODS.flatMap((method) => spies[method].mock.calls.map((call) => call.join(" "))).join("\n");
}

describe("sendMail", () => {
  beforeEach(() => {
    transportSendMail.mockClear();
    createTransport.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("geliştirmede SMTP yoksa gövdeyi gizler, sıfırlama bağlantısını ayrı satırda bir kez tam yazar", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SMTP_URL", "");
    const spies = spyConsole();

    await sendMail(MAIL);

    expect(spies.info).toHaveBeenCalledTimes(2);
    const body = String(spies.info.mock.calls[0][0]);
    expect(body).toContain("[gizlendi]");
    expect(body).not.toContain(TOKEN);
    expect(spies.info.mock.calls[1][0]).toBe(`Geliştirme bağlantısı: ${LINK}`);

    const output = allOutput(spies);
    expect(output.split(TOKEN)).toHaveLength(2); // tam bağlantı yalnız bir kez görünür
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("geliştirmede devLink verilmezse yalnız gizlenmiş gövdeyi yazar", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SMTP_URL", "");
    const spies = spyConsole();

    await sendMail({ to: MAIL.to, subject: MAIL.subject, text: MAIL.text });

    expect(spies.info).toHaveBeenCalledTimes(1);
    expect(allOutput(spies)).not.toContain(TOKEN);
  });

  it("üretimde SMTP yoksa hata fırlatır ve konsola hiçbir şey yazmaz", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SMTP_URL", "");
    const spies = spyConsole();

    await expect(sendMail(MAIL)).rejects.toThrow("SMTP yapılandırılmamış");

    expect(allOutput(spies)).toBe("");
    expect(createTransport).not.toHaveBeenCalled();
  });

  it.each(["development", "production"])(
    "SMTP_URL tanımlıysa (%s) nodemailer ile gönderir, devLink'i iletmez ve konsola yazmaz",
    async (nodeEnv) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.stubEnv("SMTP_URL", "smtp://kullanici:parola@sunucu.ornek.test:587");
      vi.stubEnv("MAIL_FROM", "Test <no-reply@ornek.test>");
      const spies = spyConsole();

      await sendMail(MAIL);

      expect(createTransport).toHaveBeenCalledWith("smtp://kullanici:parola@sunucu.ornek.test:587");
      expect(transportSendMail).toHaveBeenCalledTimes(1);
      expect(transportSendMail).toHaveBeenCalledWith({
        from: "Test <no-reply@ornek.test>",
        to: MAIL.to,
        subject: MAIL.subject,
        text: MAIL.text,
      });
      expect(allOutput(spies)).toBe("");
    },
  );
});
