import { foldTr } from "@/lib/tr";
import { hasCaptcha, htmlToText, mainContent, parseLinks, parseServiceForm, parseWarnings } from "./html";
import type { FormField, ParsedForm } from "./html";

// e-Devlet "Barkodlu Belge Doğrulama" istemcisi (spec 2026-11-27 §4). Giriş istemeyen, herkese açık
// formu bir tarayıcı gibi adım adım yürür: barkod, sorgulama alanı (T.C. kimlik no), bilgilendirme ve
// onay, sonuç. Yalnız www.turkiye.gov.tr'ye gider. CAPTCHA, giriş sayfası ya da tanınmayan bir alan
// görürse durur ve "kullanılamıyor" döner; hiçbir korumayı aşmaya çalışmaz. T.C. kimlik no yalnız
// e-Devlet'e gönderilir; hiçbir hata metnine ya da loga girmez.

export const EDEVLET_ORIGIN = "https://www.turkiye.gov.tr";
export const EDEVLET_START_PATH = "/belge-dogrulama";
const ALLOWED_HOSTS = new Set(["www.turkiye.gov.tr", "turkiye.gov.tr"]);

const REQUEST_TIMEOUT_MS = 15_000;
const TOTAL_TIMEOUT_MS = 45_000;
const MAX_REDIRECTS = 5;
const MAX_STEPS = 5;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const USER_AGENT = "Mozilla/5.0 (compatible; ProBuddy-BelgeDogrulama/1.0)";

export type EDevletResult =
  /** Belge bulundu: sonuç sayfasının görünen metni ve varsa belgenin PDF'i. */
  | { kind: "FOUND"; text: string; pdf: Uint8Array | null }
  /** Barkod e-Devlet'te tanımlı değil. `message` e-Devlet'in uyarısıdır. */
  | { kind: "NOT_FOUND"; message: string }
  /** Barkod bulundu ama sorgulama alanı (T.C. kimlik no) tutmadı. */
  | { kind: "MISMATCH"; message: string }
  /** Barkod ve kimlik no tuttu ama e-Devlet belgeyi artık geçersiz sayıyor. `message` e-Devlet'in uyarısıdır. */
  | { kind: "INVALID"; message: string }
  /** Ulaşılamadı ya da sayfa biçimi tanınmadı. `reason` kişisel veri içermez; yalnız loglar içindir. */
  | { kind: "UNAVAILABLE"; reason: string };

export interface EDevletQuery {
  barcode: string;
  tckn: string;
}

export interface EDevletClient {
  verify(query: EDevletQuery): Promise<EDevletResult>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

class Unavailable extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

interface Page {
  url: string;
  contentType: string;
  bytes: Uint8Array;
}

function isPdf(page: Page): boolean {
  if (page.contentType.includes("application/pdf")) return true;
  return page.bytes.length > 4 && page.bytes[0] === 0x25 && page.bytes[1] === 0x50 && page.bytes[2] === 0x44 && page.bytes[3] === 0x46;
}

/** Alanın T.C. kimlik no alanı olup olmadığını adı ve etiketiyle anlar. */
function isIdentityField(field: FormField): boolean {
  const text = foldTr(`${field.name} ${field.label}`);
  // e-Devlet'in kimlik alanı 11 hanelidir; etiketi farklı yazılmış olsa da uzunluğundan tanınır.
  return /kimlik|tckn|tc no|tc kimlik|\btc\b/.test(text) || field.maxLength === 11;
}

function isFillableText(field: FormField): boolean {
  return field.type === "text" || field.type === "tel" || field.type === "number" || field.type === "password";
}

const SUBMIT_HINT = /devam|sorgula|onayla|dogrula|goster|goruntule|ileri/;

export class HttpEDevletClient implements EDevletClient {
  private readonly cookies = new Map<string, string>();
  private deadline = 0;

  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async verify(query: EDevletQuery): Promise<EDevletResult> {
    this.cookies.clear();
    this.deadline = Date.now() + TOTAL_TIMEOUT_MS;
    try {
      return await this.walk(query);
    } catch (error) {
      if (error instanceof Unavailable) return { kind: "UNAVAILABLE", reason: error.reason };
      const name = error instanceof Error ? error.name : "unknown";
      return { kind: "UNAVAILABLE", reason: `network:${name}` };
    } finally {
      this.cookies.clear();
    }
  }

  private async walk(query: EDevletQuery): Promise<EDevletResult> {
    let page = await this.request(`${EDEVLET_ORIGIN}${EDEVLET_START_PATH}`);
    let html = this.html(page);
    let form = parseServiceForm(html);
    if (!form || !form.fields.some((field) => field.name === "sorgulananBarkod")) throw new Unavailable("format:start");

    let passedBarcodeStep = false;
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const body = this.fill(form, query);
      if (body === null) {
        // Doldurulacak alan kalmadı: sonuç sayfası.
        break;
      }
      const atBarcodeStep = form.fields.some((field) => field.name === "sorgulananBarkod");
      const atIdentityStep = !atBarcodeStep && form.fields.some((field) => isFillableText(field) && isIdentityField(field));
      page = await this.request(new URL(form.action || page.url, page.url).toString(), {
        method: "POST",
        body,
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      if (isPdf(page)) return { kind: "FOUND", text: "", pdf: page.bytes };

      html = this.html(page);
      const warnings = parseWarnings(html);
      const next = parseServiceForm(html);
      const backAtBarcode = next?.fields.some((field) => field.name === "sorgulananBarkod") ?? false;

      if (warnings.length > 0 && (atBarcodeStep || backAtBarcode)) {
        return passedBarcodeStep && !atBarcodeStep
          ? { kind: "MISMATCH", message: warnings[0] }
          : { kind: "NOT_FOUND", message: warnings[0] };
      }
      if (warnings.length > 0) {
        // Kimlik no adımındaki uyarı eşleşmemedir. Onay adımından sonraki uyarı belgenin kendisiyle
        // ilgilidir (ör. "Bilgileriniz değiştiğinden belge geçersizdir"): belge artık geçerli değil.
        return atIdentityStep ? { kind: "MISMATCH", message: warnings[0] } : { kind: "INVALID", message: warnings[0] };
      }

      passedBarcodeStep = passedBarcodeStep || atBarcodeStep;
      if (!next) break;
      form = next;
    }

    if (!passedBarcodeStep) throw new Unavailable("format:no-progress");
    return this.result(page, html);
  }

  /** Sonuç sayfası: görünen metin ve varsa belgenin PDF'i (bağlantı ya da "göster" düğmesi). */
  private async result(page: Page, html: string): Promise<EDevletResult> {
    const content = mainContent(html);
    const text = htmlToText(content);
    let pdf: Uint8Array | null = null;

    const candidates = parseLinks(content).filter(({ href, text: label }) =>
      /pdf|indir|goster|goruntule|belge/i.test(`${href} ${foldTr(label)}`),
    );
    for (const candidate of candidates.slice(0, 3)) {
      let url: URL;
      try {
        url = new URL(candidate.href, page.url);
      } catch {
        continue;
      }
      if (!ALLOWED_HOSTS.has(url.hostname)) continue;
      try {
        const linked = await this.request(url.toString(), undefined, MAX_PDF_BYTES);
        if (isPdf(linked)) {
          pdf = linked.bytes;
          break;
        }
      } catch (error) {
        if (error instanceof Unavailable && error.reason.startsWith("captcha")) throw error;
      }
    }

    return { kind: "FOUND", text, pdf };
  }

  /**
   * Formu doldurur. Doldurulacak bir şey yoksa (yalnız gizli alanlar ve düğmeler, ya da sonuç sayfasının
   * "yeni sorgu" formu) null döner. Tanınmayan zorunlu bir alan görülürse durur.
   */
  private fill(form: ParsedForm, query: EDevletQuery): URLSearchParams | null {
    const params = new URLSearchParams();
    let fillable = 0;
    const submits = form.fields.filter((field) => field.type === "submit");

    for (const field of form.fields) {
      const type = field.type;
      if (type === "hidden") {
        params.append(field.name, field.value);
      } else if (field.name === "sorgulananBarkod") {
        params.append(field.name, query.barcode);
        fillable += 1;
      } else if (isFillableText(field)) {
        if (isIdentityField(field)) {
          params.append(field.name, query.tckn);
          fillable += 1;
        } else if (field.required) {
          throw new Unavailable("format:unknown-field");
        }
      } else if (type.startsWith("checkbox")) {
        // Bilgilendirme ve onay adımındaki kutular.
        params.append(field.name, field.value || "on");
        fillable += 1;
      } else if (type === "radio:checked") {
        params.append(field.name, field.value);
      } else if ((type === "radio" || type === "select" || type === "textarea") && field.required) {
        throw new Unavailable("format:unknown-field");
      }
    }

    if (fillable === 0) return null;
    const submit = submits.find((field) => SUBMIT_HINT.test(foldTr(field.value))) ?? submits[0];
    if (submit) params.append(submit.name, submit.value);
    return params;
  }

  private html(page: Page): string {
    const html = new TextDecoder("utf-8").decode(page.bytes);
    if (hasCaptcha(html)) throw new Unavailable("captcha");
    return html;
  }

  private async request(url: string, init?: RequestInit, maxBytes = MAX_HTML_BYTES): Promise<Page> {
    let current = url;
    let currentInit = init;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const target = new URL(current);
      if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
        // giris.turkiye.gov.tr gibi bir adrese yönlendirme: hizmet giriş istiyor, otomatik doğrulama yok.
        throw new Unavailable(target.hostname.endsWith("turkiye.gov.tr") ? "login-required" : "foreign-redirect");
      }
      const remaining = this.deadline - Date.now();
      if (remaining <= 0) throw new Unavailable("timeout");

      const send = () =>
        this.fetchImpl(target.toString(), {
          ...currentInit,
          redirect: "manual",
          signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, Math.max(1, this.deadline - Date.now()))),
          headers: {
            "user-agent": USER_AGENT,
            accept: "text/html,application/pdf;q=0.9,*/*;q=0.8",
            "accept-language": "tr-TR,tr;q=0.9",
            ...(this.cookies.size > 0 ? { cookie: this.cookieHeader() } : {}),
            ...(currentInit?.headers as Record<string, string> | undefined),
          },
        });
      let response: Response;
      try {
        response = await send();
      } catch (error) {
        // e-Devlet bağlantıyı ara sıra kuruluşta koparıyor (ECONNRESET). Yalnız GET bir kez yeniden denenir;
        // form gönderimi (POST) tekrarlanmaz.
        const isGet = (currentInit?.method ?? "GET") === "GET";
        if (!isGet || !(error instanceof TypeError) || this.deadline - Date.now() < 2_000) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
        response = await send();
      }
      this.storeCookies(response);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Unavailable(`http:${response.status}`);
        current = new URL(location, target).toString();
        // 303 ve 302 sonrası tarayıcılar GET ile devam eder.
        currentInit = undefined;
        continue;
      }
      if (response.status === 429) throw new Unavailable("rate-limited");
      if (!response.ok) throw new Unavailable(`http:${response.status}`);

      const bytes = await readLimited(response, maxBytes);
      return { url: target.toString(), contentType: (response.headers.get("content-type") ?? "").toLowerCase(), bytes };
    }
    throw new Unavailable("too-many-redirects");
  }

  private storeCookies(response: Response): void {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    const list = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
    for (const line of list) {
      const pair = line.split(";")[0];
      const index = pair.indexOf("=");
      if (index <= 0) continue;
      this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }

  private cookieHeader(): string {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new Unavailable("too-large");
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Unavailable("too-large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
