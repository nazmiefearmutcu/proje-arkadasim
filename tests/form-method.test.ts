import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// JavaScript yüklenmeden gönderilen bir form tarayıcının varsayılanıyla GET olur ve alanlar (şifre dahil)
// adres çubuğuna, geçmişe ve sunucu loglarına düşer. `onSubmit` ile çalışan ve sunucu eylemi (`action`)
// almayan her form `method="post"` bildirmelidir.

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

/** `<form` açılış etiketini, JSX süslü parantezlerinin içindeki `>` işaretlerini atlayarak döner. */
function formTags(source: string): string[] {
  const tags: string[] = [];
  for (const match of source.matchAll(/<form\b/g)) {
    let depth = 0;
    let end = match.index;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0) break;
    }
    tags.push(source.slice(match.index, end + 1));
  }
  return tags;
}

describe("form gönderim yöntemi", () => {
  it("onSubmit ile çalışan formlar JavaScript'siz gönderimde alanları URL'ye koymaz", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(path.resolve(__dirname, "../src"))) {
      for (const tag of formTags(readFileSync(file, "utf8"))) {
        if (tag.includes("onSubmit") && !tag.includes("action=") && !tag.includes('method="post"')) {
          offenders.push(path.relative(process.cwd(), file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("giriş formu şifreyi POST ile gönderir", () => {
    const source = readFileSync(path.resolve(__dirname, "../src/components/auth/login-form.tsx"), "utf8");
    expect(formTags(source).every((tag) => tag.includes('method="post"'))).toBe(true);
  });
});
