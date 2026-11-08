# Task 4 — Auth pages, registration with KVKK consents, legal and help pages

Read `docs/superpowers/sdd/global-constraints.md` and `docs/design-system.md` first. Spec sections: §4.1 (registration), §6 (KVKK — the legal texts must reflect it accurately), §8 (rate limits), §9.
Available: auth libs (`src/lib/auth/*`: `hashPassword`, `verifyPassword`, `validatePasswordStrength`, `createSession`, `destroyAllSessionsForUser`, `generateToken`, `hashToken`, `getCurrentUser`, `safeNextPath`), `rateLimit`/`LIMITS`/`clientIp`, `sendMail`, `recordConsent`, `toSearchText`, `LEGAL`, `LEGAL_VERSION`, `AI_PROVIDER`, retention constants, UI primitives, shell. Stub pages exist for the routes below — replace them.

## Pages and actions
1. `src/app/(auth)/giris/page.tsx` + `src/lib/auth/login-action.ts` (`'use server'`, `loginAction(prev, formData)`).
   - Fields: e-posta, şifre; link "Şifremi unuttum", link "Hesap oluştur" (keeps `next`).
   - Rate limit key `login:<ip>:<email>` with `LIMITS.login`; on limit → "Çok fazla deneme yaptın. <n> dakika sonra tekrar dene."
   - Wrong email or password → single generic error "E-posta veya şifre hatalı." (no user enumeration; still run a dummy `verifyPassword` when the user doesn't exist).
   - Log every attempt with an existing user to `LoginEvent` (ip, userAgent, success).
   - Success → `createSession`, redirect to `safeNextPath(next)`; if user is not VERIFIED and next is "/" → redirect `/dogrulama`.
   - Logged-in users visiting `/giris` or `/kayit` are redirected to "/".
2. `src/app/(auth)/kayit/page.tsx` + client `src/components/auth/register-form.tsx` + `src/lib/auth/register-action.ts`.
   - Stepper with 3 visible steps (this content really is a sequence, so numbered steps are fine): 1 Hesap, 2 Onaylar, 3 Belge. Steps 1–2 are client-side views of one form; step 3 is the `/dogrulama` page after the account is created.
   - Step 1 fields: Ad, Soyad (hint: "Belgendeki adla birebir aynı yaz; doğrulamada eşleştirilecek."), E-posta, Kullanıcı adı (3–20, `^[a-z0-9_.]+$`, lowercase it, not starting/ending with "."; reserved: admin, yonetim, api, giris, kayit, ayarlar, destek, proje, projeler, u), Şifre (`validatePasswordStrength`), Şifre tekrar. Names: 2–40 chars, letters (incl. Turkish), spaces, hyphen, apostrophe; trim and collapse spaces. Client validates before moving to step 2; server validates everything again with zod.
   - Step 2: a short plain-language summary of the aydınlatma metni (what is collected, that the document is never stored, that only masked text may go abroad, rights) with link to `/kvkk/aydinlatma` (opens in new tab). Checkboxes:
     a) required: "Aydınlatma metnini okudum." → PRIVACY_NOTICE
     b) required: "Kullanım koşullarını kabul ediyorum." (link) → TERMS
     c) optional, unchecked by default, visually separated with its own explanation: "Maskelenmiş belge metnimin yapay zeka incelemesi için yurt dışına (DeepSeek, Çin Halk Cumhuriyeti) aktarılmasına açık rıza veriyorum." Explanation: what is sent (only masked text: TC kimlik no, ad-soyad, doğum bilgileri, öğrenci no removed), why (sonuç saniyeler içinde), risk (Çin için KVKK yeterlilik kararı yok), alternative ("İşaretlemezsen belgen yurt dışına çıkmaz; ekibimiz en geç 24 saat içinde inceler."), revocable in Ayarlar. Link to `/kvkk/acik-riza`.
   - Submit button "Hesabı oluştur ve belgeye geç". Server: rate limit `register:<ip>`; unique checks with field errors ("Bu e-posta ile kayıtlı bir hesap var.", "Bu kullanıcı adı alınmış."); create user (verificationStatus UNVERIFIED, email lowercased, searchText from names+username); record all three consents (c as granted true/false); `createSession`; redirect `/dogrulama?hosgeldin=1`.
3. `src/app/(auth)/sifremi-unuttum/page.tsx` + action: email field; always respond "Bu e-posta kayıtlıysa şifre sıfırlama bağlantısı gönderdik." Rate limit `LIMITS.passwordReset` per ip+email. Create PasswordResetToken (hash stored, expires `RESET_TOKEN_MINUTES`), send mail with `${APP_URL}/sifre-sifirla/<token>`.
4. `src/app/(auth)/sifre-sifirla/[token]/page.tsx` + action: validate token (exists, not used, not expired) — invalid → message with link to request a new one. New password + repeat; on success: update hash, mark token used, `destroyAllSessionsForUser`, redirect `/giris?sifre=yenilendi` (login page shows a success note for that param).
5. Legal pages (Server Components, readable long-form typography `.t-body`, max 68ch, headings `.t-section`, table for the data inventory) — content must match spec §6 precisely and use `LEGAL`, `LEGAL_VERSION`, `AI_PROVIDER` values:
   - `src/app/(app)/kvkk/aydinlatma/page.tsx` — KVKK m.10 aydınlatma metni: veri sorumlusu kimliği; işlenen veri kategorileri, amaçları ve hukuki sebepleri (spec §6.1 table, verbatim meaning); belge dosyasının saklanmadığı, yalnızca bellekte saniyeler içinde işlendiği; maskeleme ve yurt dışına aktarım (yalnızca açık rıza ile, yalnızca maskelenmiş metin, alıcı `AI_PROVIDER`), açık rıza vermeyenler için manuel inceleme; toplama yöntemi (web formları, elektronik ortam); saklama süreleri; m.11 hakları (tam liste); başvuru yolu (`LEGAL.email`, KEP); sürüm/tarih.
   - `src/app/(app)/kvkk/acik-riza/page.tsx` — açık rıza metni for CROSS_BORDER_AI: specific, informed, freely given; explicitly states consent is optional and not a condition of service, how to withdraw (Ayarlar → Gizlilik ve KVKK), risks.
   - `src/app/(app)/gizlilik/page.tsx` — gizlilik politikası (short, links to aydınlatma), security measures (spec §6.2 in plain language).
   - `src/app/(app)/cerezler/page.tsx` — only the strictly necessary session cookie `pa_session` (purpose, duration 30 days, httpOnly); no analytics/ads cookies, so no consent banner.
   - `src/app/(app)/kullanim-kosullari/page.tsx` — eligibility (Türkiye'de üniversite öğrencisi veya mezunu, belge doğrulaması), only real projects, no blog/spam/ads, respectful conduct, forged documents → permanent ban and possible legal action, content ownership stays with users, moderation and reporting, account deletion.
   - Every legal page shows a notice box (warn-soft): "Bu metin şablondur; yayımlanmadan önce hukuk danışmanınca gözden geçirilmelidir." — only when `LEGAL.controllerName` still starts with "[".
6. `src/app/(app)/yardim/page.tsx` — short FAQ using `<details>`: Neden belge istiyoruz?, Hangi belgeleri kabul ediyorsunuz? (e-Devlet Öğrenci Belgesi PDF, YÖK Mezun Belgesi PDF, üniversite belgesi fotoğrafı), Belgem saklanıyor mu?, Doğrulama ne kadar sürer?, Belgem reddedildi, ne yapmalıyım?, Mesaj isteği nedir?, Hesabımı nasıl silerim?, KVKK başvurusu.

## Tests
- `src/lib/auth/register-action.test.ts` (DB; mock `next/headers` cookies/headers and `next/navigation` redirect): creates user + 3 consent rows with correct granted values; duplicate email/username → field errors; invalid username → field error; reserved username rejected.
- `src/lib/auth/login-action.test.ts`: wrong password → generic error and LoginEvent success=false; rate limit after 10 attempts.
- Validation schemas exported from `src/lib/auth/schemas.ts` and unit tested (names with Turkish letters accepted, digits rejected).

## Done when
Flows work end to end in `npm run dev` (register → lands on `/dogrulama?hosgeldin=1` stub with a session cookie; logout via avatar menu; login; reset link printed to console), checks pass, committed, report written.
