import { describe, expect, it } from "vitest";
import { HttpEDevletClient } from "./client";

const QUERY = { barcode: "YOKOB1234ABCD5678", tckn: "10000000146" };

function page(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
  <form id="searchForm" method="get" action="/arama"><input name="aranan" value=""></form>
  <div id="pageContentBlock">${body}</div><footer>e-Devlet</footer></body></html>`;
}

const STEP1 = (warning = "") =>
  page(`${warning ? `<div class="warningContainer"><span>${warning}</span></div>` : ""}
  <form name="mainForm" action="/belge-dogrulama?submit" method="POST" class="serviceForm"><fieldset>
  <label for="sorgulananBarkod" class="rowLabel">Barkod Numarası</label>
  <input type="text" name="sorgulananBarkod" maxlength="50" required="required" id="sorgulananBarkod" />
  <input class="submitButton" name="btn" type="submit" value="Devam Et" />
  <input type="hidden" name="token" value="{tok1}" /></fieldset></form>`);

const STEP2 = (warning = "") =>
  page(`${warning ? `<div class="warningContainer"><span>${warning}</span></div>` : ""}
  <form name="mainForm" action="/belge-dogrulama?islem=dogrulama&amp;submit" method="POST">
  <label for="ikinciAlan">T.C. Kimlik Numarası</label>
  <input type="text" name="ikinciAlan" id="ikinciAlan" maxlength="11" required="required" />
  <input type="submit" name="btn" value="Devam Et" />
  <input type="hidden" name="token" value="{tok2}" /></form>`);

const STEP3 = page(`<form name="mainForm" action="/belge-dogrulama?islem=onay&amp;submit" method="POST">
  <p>Belge sahibinin bilgilerini görüntülemek üzeresiniz.</p>
  <input type="checkbox" name="chkOnay" id="chkOnay" value="1" required="required" /><label for="chkOnay">Okudum, onaylıyorum</label>
  <input type="submit" name="btn" value="Devam Et" />
  <input type="hidden" name="token" value="{tok3}" /></form>`);

const RESULT = page(`<h2>İşlem Sonucu</h2>
  <dl><dt>Belge Adı</dt><dd>Öğrenci Belgesi</dd><dt>Adı Soyadı</dt><dd>AYŞE NUR YILMAZ</dd></dl>
  <a href="/belge-dogrulama?belge=goster&amp;indir=1">Belgeyi Göster</a>
  <form name="mainForm" action="/belge-dogrulama?islem=yeni&amp;submit" method="POST">
  <input type="submit" name="btn" value="Yeni Sorgulama" /><input type="hidden" name="token" value="{tok4}" /></form>`);

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

interface Call {
  url: string;
  method: string;
  body: string;
  cookie: string;
}

/** Sıralı yanıtlar veren sahte fetch; her çağrıyı kaydeder. */
function fakeFetch(responses: Array<(call: Call) => Response>) {
  const calls: Call[] = [];
  let index = 0;
  const fn = async (input: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers as HeadersInit);
    const call = {
      url: input,
      method: init?.method ?? "GET",
      body: init?.body ? String(init.body) : "",
      cookie: headers.get("cookie") ?? "",
    };
    calls.push(call);
    const respond = responses[index];
    index += 1;
    if (!respond) throw new Error(`beklenmeyen istek: ${input}`);
    return respond(call);
  };
  return { fn, calls };
}

const html = (body: string, headers: Record<string, string> = {}) => () =>
  new Response(body, { status: 200, headers: { "content-type": "text/html; charset=UTF-8", ...headers } });
const redirect = (location: string) => () => new Response(null, { status: 302, headers: { location } });

describe("HttpEDevletClient", () => {
  it("dört aşamayı yürür, kimlik noyu yalnız ikinci aşamada gönderir ve belgenin PDF'ini indirir", async () => {
    const { fn, calls } = fakeFetch([
      html(STEP1(), { "set-cookie": "TURKIYESESSIONID=abc; path=/; secure" }),
      redirect("/belge-dogrulama?islem=dogrulama"),
      html(STEP2()),
      html(STEP3),
      html(RESULT),
      () => new Response(PDF, { status: 200, headers: { "content-type": "application/pdf" } }),
    ]);

    const result = await new HttpEDevletClient(fn).verify(QUERY);

    expect(result.kind).toBe("FOUND");
    if (result.kind !== "FOUND") return;
    expect(result.text).toContain("AYŞE NUR YILMAZ");
    expect(result.pdf).toEqual(PDF);

    expect(calls.map((call) => `${call.method} ${new URL(call.url).pathname}${new URL(call.url).search}`)).toEqual([
      "GET /belge-dogrulama",
      "POST /belge-dogrulama?submit",
      "GET /belge-dogrulama?islem=dogrulama",
      "POST /belge-dogrulama?islem=dogrulama&submit",
      "POST /belge-dogrulama?islem=onay&submit",
      "GET /belge-dogrulama?belge=goster&indir=1",
    ]);
    const step1 = new URLSearchParams(calls[1].body);
    expect(step1.get("sorgulananBarkod")).toBe(QUERY.barcode);
    expect(step1.get("token")).toBe("{tok1}");
    expect(step1.get("btn")).toBe("Devam Et");
    expect(calls[1].body).not.toContain(QUERY.tckn);
    expect(new URLSearchParams(calls[3].body).get("ikinciAlan")).toBe(QUERY.tckn);
    expect(new URLSearchParams(calls[4].body).get("chkOnay")).toBe("1");
    expect(calls.slice(1).every((call) => call.cookie.includes("TURKIYESESSIONID=abc"))).toBe(true);
    expect(calls.every((call) => new URL(call.url).hostname === "www.turkiye.gov.tr")).toBe(true);
  });

  it("gerçek sonuç sayfasında paylaş/yeni sorgu bağlantılarını atlar, PDF'i gömülü bağlantıdan indirir", async () => {
    // e-Devlet'in canlı sonuç sayfasının bağlantı sırası (2026-11-28): başlık, paylaş, indir, yeni, object, dil.
    const real = page(`<h2><a href="/belge-dogrulama">Belge Doğrulama</a></h2>
      <a target="_blank" href="https://twitter.com/intent/tweet?url=https%3A%2F%2Fturkiye.gov.tr/belge-dogrulama">Twitter'da Paylaş</a>
      <a target="_blank" href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fturkiye.gov.tr/belge-dogrulama">Facebook'da Paylaş</a>
      <p>Bu işlem toplam 4 aşamalıdır. Şu anda 4 . aşamadasınız.</p>
      <a class="download" href="/belge-dogrulama?belge=goster&amp;goster=1">Dosyayı İndir</a>
      <a href="/belge-dogrulama" class="new">Yeni Doğrulama</a>
      <object data="/belge-dogrulama?belge=goster&amp;goster=1&amp;display=display" type="application/pdf"></object>
      <a href="/belge-dogrulama?belge=goster&amp;lang=en_US">English</a>`);
    const { fn, calls } = fakeFetch([
      html(STEP1()),
      redirect("/belge-dogrulama?islem=dogrulama"),
      html(STEP2()),
      redirect("/belge-dogrulama?islem=onay"),
      html(STEP3),
      redirect("/belge-dogrulama?belge=goster"),
      html(real),
      () => new Response(PDF, { status: 200, headers: { "content-type": "application/pdf" } }),
    ]);

    const result = await new HttpEDevletClient(fn).verify(QUERY);

    expect(result.kind).toBe("FOUND");
    if (result.kind !== "FOUND") return;
    expect(result.pdf).toEqual(PDF);
    expect(result.text).not.toContain("pageContentBlock");
    const last = new URL(calls[calls.length - 1].url);
    expect(last.searchParams.get("goster")).toBe("1");
    expect(calls.filter((call) => new URL(call.url).search === "" && call.method === "GET")).toHaveLength(1);
  });

  it("tanımsız barkodda e-Devlet'in uyarısıyla NOT_FOUND döner", async () => {
    const warning = "Girilen barkod numarası e-Devlet Kapısında tanımlı değildir.";
    const { fn } = fakeFetch([html(STEP1()), html(STEP1(warning))]);

    expect(await new HttpEDevletClient(fn).verify(QUERY)).toEqual({ kind: "NOT_FOUND", message: warning });
  });

  it("kimlik no tutmazsa MISMATCH döner", async () => {
    const warning = "Girdiğiniz bilgiler belge bilgileri ile uyuşmamaktadır.";
    const { fn } = fakeFetch([html(STEP1()), html(STEP2()), html(STEP2(warning))]);

    expect(await new HttpEDevletClient(fn).verify(QUERY)).toEqual({ kind: "MISMATCH", message: warning });
  });

  it("onaydan sonra gelen uyarıda belgeyi geçersiz sayar (INVALID)", async () => {
    const warning = "Bilgileriniz değiştiğinden belge geçersizdir. Belgeyi yeniden oluşturunuz.";
    const { fn } = fakeFetch([
      html(STEP1()),
      redirect("/belge-dogrulama?islem=dogrulama"),
      html(STEP2()),
      html(STEP3),
      redirect("/belge-dogrulama?hata=sayfasi"),
      html(page(`<div class="warningContainer"><span>${warning}</span></div>`)),
    ]);

    expect(await new HttpEDevletClient(fn).verify(QUERY)).toEqual({ kind: "INVALID", message: warning });
  });

  it("bağlantı koparsa ilk GET'i bir kez yeniden dener", async () => {
    const warning = "Girilen barkod numarası e-Devlet Kapısında tanımlı değildir.";
    const { fn, calls } = fakeFetch([
      () => {
        throw new TypeError("fetch failed");
      },
      html(STEP1()),
      html(STEP1(warning)),
    ]);

    expect(await new HttpEDevletClient(fn).verify(QUERY)).toEqual({ kind: "NOT_FOUND", message: warning });
    expect(calls.map((call) => call.method)).toEqual(["GET", "GET", "POST"]);
  });

  it("form gönderimi koparsa tekrarlamaz", async () => {
    const { fn, calls } = fakeFetch([
      html(STEP1()),
      () => {
        throw new TypeError("fetch failed");
      },
    ]);

    expect(await new HttpEDevletClient(fn).verify(QUERY)).toEqual({ kind: "UNAVAILABLE", reason: "network:TypeError" });
    expect(calls).toHaveLength(2);
  });

  it("CAPTCHA görürse durur", async () => {
    const { fn, calls } = fakeFetch([html(page('<div class="g-recaptcha"></div>'))]);

    expect(await new HttpEDevletClient(fn).verify(QUERY)).toEqual({ kind: "UNAVAILABLE", reason: "captcha" });
    expect(calls).toHaveLength(1);
  });

  it("giriş sayfasına ya da başka bir alan adına yönlendirmede durur", async () => {
    const login = fakeFetch([html(STEP1()), redirect("https://giris.turkiye.gov.tr/Giris/gir")]);
    expect(await new HttpEDevletClient(login.fn).verify(QUERY)).toEqual({ kind: "UNAVAILABLE", reason: "login-required" });

    const foreign = fakeFetch([html(STEP1()), redirect("https://ornek.com/x")]);
    expect(await new HttpEDevletClient(foreign.fn).verify(QUERY)).toEqual({ kind: "UNAVAILABLE", reason: "foreign-redirect" });
  });

  it("tanınmayan zorunlu bir alan çıkarsa kimlik noyu tahmin etmez, durur", async () => {
    const strange = page(`<form name="mainForm" action="/belge-dogrulama?x" method="POST">
      <label for="dogum">Doğum Yılı</label><input type="text" name="dogum" id="dogum" required="required" />
      <input type="submit" name="btn" value="Devam Et" /></form>`);
    const { fn, calls } = fakeFetch([html(STEP1()), html(strange)]);

    expect(await new HttpEDevletClient(fn).verify(QUERY)).toEqual({ kind: "UNAVAILABLE", reason: "format:unknown-field" });
    expect(calls.some((call) => call.body.includes(QUERY.tckn))).toBe(false);
  });

  it("biçim tanınmazsa ve ağ hatasında UNAVAILABLE döner", async () => {
    const odd = fakeFetch([html(page("<p>Bakım çalışması</p>"))]);
    expect(await new HttpEDevletClient(odd.fn).verify(QUERY)).toEqual({ kind: "UNAVAILABLE", reason: "format:start" });

    const down = fakeFetch([() => new Response("", { status: 503 })]);
    expect(await new HttpEDevletClient(down.fn).verify(QUERY)).toEqual({ kind: "UNAVAILABLE", reason: "http:503" });
  });
});
