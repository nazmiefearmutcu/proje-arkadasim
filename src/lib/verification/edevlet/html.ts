// e-Devlet sayfalarını okumak için küçük, bağımlılıksız HTML yardımcıları. Tam bir ayrıştırıcı değildir;
// yalnız formu, uyarıları ve görünen metni çıkarır. Saf işlevler.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ccedil: "ç",
  Ccedil: "Ç",
  ouml: "ö",
  Ouml: "Ö",
  uuml: "ü",
  Uuml: "Ü",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const value = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) && value > 0 && value < 0x110000 ? String.fromCodePoint(value) : match;
    }
    return NAMED_ENTITIES[code] ?? match;
  });
}

/** Etiketleri atıp görünen metni döndürür; blok öğeleri satır sonuna çevrilir. */
export function htmlToText(html: string): string {
  const withoutHidden = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ");
  const withBreaks = withoutHidden.replace(/<\/?(?:p|div|li|tr|td|th|dt|dd|h[1-6]|br|table|section|ul|ol|dl|fieldset|legend|label)\b[^>]*>/gi, "\n");
  const text = decodeEntities(withBreaks.replace(/<[^>]+>/g, " "));
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

export function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=<>"'/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  const body = tag.replace(/^<\s*[a-z0-9]+/i, "").replace(/\/?>$/, "");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const name = match[1].toLowerCase();
    attributes[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

export interface FormField {
  name: string;
  type: string;
  value: string;
  label: string;
  required: boolean;
  maxLength: number | null;
}

export interface ParsedForm {
  action: string;
  method: string;
  fields: FormField[];
}

/**
 * `name="mainForm"` olan formu (e-Devlet hizmet formu) okur. Yoksa sayfadaki son POST formu denenir;
 * arama formu (GET) hiçbir zaman seçilmez.
 */
export function parseServiceForm(html: string): ParsedForm | null {
  const forms = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)].map((match) => match[0]);
  const candidates = forms
    .map((form) => ({ form, attributes: parseAttributes(form.match(/<form\b[^>]*>/i)?.[0] ?? "") }))
    .filter(({ attributes }) => (attributes.method ?? "get").toLowerCase() === "post");
  const chosen = candidates.find(({ attributes }) => attributes.name === "mainForm") ?? candidates.at(-1);
  if (!chosen) return null;

  const labels = new Map<string, string>();
  for (const match of chosen.form.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)) {
    const attributes = parseAttributes(`<label ${match[1]}>`);
    if (attributes.for) labels.set(attributes.for, htmlToText(match[2]).replace(/\n/g, " "));
  }

  const fields: FormField[] = [];
  for (const match of chosen.form.matchAll(/<input\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    if (!attributes.name) continue;
    const type = (attributes.type ?? "text").toLowerCase();
    const checked = "checked" in attributes;
    fields.push({
      name: attributes.name,
      type: type === "checkbox" || type === "radio" ? (checked ? `${type}:checked` : type) : type,
      value: attributes.value ?? (type === "checkbox" ? "on" : ""),
      label: labels.get(attributes.id ?? "") ?? attributes["aria-label"] ?? attributes.placeholder ?? "",
      required: "required" in attributes || attributes["aria-required"] === "true",
      maxLength: attributes.maxlength && /^\d+$/.test(attributes.maxlength) ? Number(attributes.maxlength) : null,
    });
  }
  for (const match of chosen.form.matchAll(/<(select|textarea)\b([^>]*)>/gi)) {
    const attributes = parseAttributes(`<x ${match[2]}>`);
    if (!attributes.name) continue;
    fields.push({
      name: attributes.name,
      type: match[1].toLowerCase(),
      value: "",
      label: labels.get(attributes.id ?? "") ?? "",
      required: "required" in attributes,
      maxLength: null,
    });
  }

  return { action: chosen.attributes.action ?? "", method: "post", fields };
}

/** Sayfadaki uyarı ve hata kutularının metni (ör. "Girilen barkod numarası ... tanımlı değildir."). */
export function parseWarnings(html: string): string[] {
  const warnings: string[] = [];
  const pattern = /<(div|ul|span|p)\b[^>]*class\s*=\s*"[^"]*\b(?:warningContainer|errorContainer|fieldError|errorMessage|errors?)\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const match of html.matchAll(pattern)) {
    const text = htmlToText(match[2]).replace(/\n/g, " ").trim();
    if (text.length > 0 && text.length < 400) warnings.push(text);
  }
  return warnings;
}

/** İnsan doğrulaması (CAPTCHA) izleri. Görülürse istemci durur; hiçbir korumayı aşmaya çalışmaz. */
export function hasCaptcha(html: string): boolean {
  return /captcha|g-recaptcha|hcaptcha|cf-turnstile|guvenlikKodu|güvenlik kodu/i.test(html);
}

/** Sayfanın ana içerik bölümü (e-Devlet'te `pageContentBlock`); bulunamazsa gövde. */
export function mainContent(html: string): string {
  const start = html.search(/id\s*=\s*"(?:pageContentBlock|contentStart|mainContent)"/i);
  const end = html.search(/<footer\b|id\s*=\s*"footer/i);
  if (start >= 0) return html.slice(start, end > start ? end : undefined);
  const body = html.match(/<body\b[\s\S]*<\/body>/i)?.[0];
  return body ?? html;
}

/** İçerikteki bağlantılar (href, iframe/embed/object src ve data). */
export function parseLinks(html: string): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = parseAttributes(`<a ${match[1]}>`).href;
    if (href) links.push({ href, text: htmlToText(match[2]).replace(/\n/g, " ") });
  }
  for (const match of html.matchAll(/<(iframe|embed|object)\b([^>]*)>/gi)) {
    const attributes = parseAttributes(`<x ${match[2]}>`);
    const href = attributes.src ?? attributes.data;
    if (href) links.push({ href, text: match[1] });
  }
  return links;
}
