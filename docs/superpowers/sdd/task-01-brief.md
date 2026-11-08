# Task 1 — Data foundation: Prisma schema, core libs, taxonomy, test infra

Read `docs/superpowers/sdd/global-constraints.md` first. Spec sections: §7 (data model), §4.3 (project fields), §4.9 (search folding), §6 (legal config).

The Next.js 15 app is already scaffolded (src dir, Tailwind 4, ESLint, `@/*` alias) and dependencies are installed. Prisma is installed but not initialised.

## 1. Prisma
- Create `prisma/schema.prisma`: generator `prisma-client-js`, datasource `sqlite` with `url = env("DATABASE_URL")`.
- Implement **every model in spec §7** with these conventions:
  - ids: `String @id @default(cuid())`; timestamps `DateTime @default(now())`, `updatedAt DateTime @updatedAt` where the spec lists updatedAt.
  - Enum-like fields are `String` with a default where sensible (User.role "USER", verificationStatus "UNVERIFIED", Project.status "OPEN", Conversation.status "ACTIVE", JoinRequest/ProjectInvite status "PENDING", Report.status "OPEN").
  - List fields: `String @default("[]")` (`skillsJson`, `interestsJson`, `tagsJson`, `redFlagsJson`), object fields `String @default("{}")` (`extractedJson`, `dataJson`).
  - `searchText String @default("")` on User and Project, with `@@index([searchText])`.
  - All relations to User use `onDelete: Cascade` (account deletion must cascade everything). `ProjectMember.roleId`, `JoinRequest.roleId`, `ProjectInvite.roleId` → `ProjectRole` with `onDelete: SetNull`. `VerificationAttempt.reviewedById` → User with `onDelete: SetNull`. `Notification.actorId` → User `onDelete: Cascade`; `Notification.projectId` → Project `onDelete: Cascade`; `Notification.conversationId` → Conversation `onDelete: Cascade`.
  - Composite keys: `Follow @@id([followerId, followingId])`, `Block @@id([blockerId, blockedId])`, `ConversationRead @@id([conversationId, userId])`.
  - Uniques: `User.email`, `User.username`, `Session.tokenHash`, `PasswordResetToken.tokenHash`, `ProjectMember @@unique([projectId, userId])`, `Introduction @@unique([userId, suggestedUserId])`, `Conversation @@unique([userAId, userBId])`.
  - Useful indexes: `Notification @@index([userId, readAt])`, `Message @@index([conversationId, createdAt])`, `VerificationAttempt @@index([userId, createdAt])`, `VerificationAttempt @@index([docHash])`, `Project @@index([ownerId, createdAt])`, `Project @@index([status, createdAt])`.
  - Multiple relations between the same models need explicit relation names (e.g. Follow follower/following, Conversation userA/userB/initiator, ProjectInvite inviter/invitee, Block blocker/blocked, Introduction user/suggestedUser).
- `.env` (gitignored) and `.env.example` (committed) with: `DATABASE_URL="file:./dev.db"`, `SESSION_SECRET`, `DOC_HASH_PEPPER`, `VERIFIER_PROVIDER="mock"`, `DEEPSEEK_API_KEY=""`, `DEEPSEEK_MODEL="deepseek-flash"`, `DEEPSEEK_BASE_URL="https://api.deepseek.com"`, `APP_URL="http://localhost:3000"`, `SMTP_URL=""`, `MAIL_FROM="Proje Arkadaşım <no-reply@proje-arkadasim.local>"`, `LOGIN_LOG_RETENTION_DAYS="365"`, `ADMIN_EMAILS=""`, `SEED_ADMIN_EMAIL="admin@proje-arkadasim.local"`, `SEED_ADMIN_PASSWORD="Yonetici-Dev-2026!"`, `SEED_USER_PASSWORD="Ogrenci-Dev-2026!"`. In `.env` generate real random hex values for SESSION_SECRET and DOC_HASH_PEPPER (32 bytes). Comment each variable in `.env.example` in Turkish.
- Run `npx prisma migrate dev --name init`. Make sure `.gitignore` contains `*.db`, `*.db-journal`, `/storage`, `.env` (but not `.env.example`).
- `package.json` scripts: `"db:migrate": "prisma migrate dev"`, `"db:reset": "prisma migrate reset --force"`, `"test": "vitest run"`, `"test:watch": "vitest"`, `"seed": "tsx prisma/seed.ts"`, `"purge": "tsx scripts/purge.ts"`, and `"postinstall": "prisma generate"`. Add `"prisma": { "seed": "tsx prisma/seed.ts" }`. Create a placeholder `prisma/seed.ts` that only logs "Seed henüz hazır değil" and `scripts/purge.ts` that logs "Temizlik henüz hazır değil" (later tasks replace them).

## 2. Libraries
- `src/lib/db.ts`: PrismaClient singleton (globalThis cache in dev), `import "server-only"` is NOT available — do not use it; just export `db`.
- `src/lib/tr.ts`:
  - `foldTr(input: string): string` — `toLocaleLowerCase("tr-TR")`, then map ç→c, ğ→g, ı→i, i̇ (i + combining dot U+0307) →i, ö→o, ş→s, ü→u, â→a, î→i, û→u; replace any non `[a-z0-9]` char with a space; collapse whitespace; trim. Must handle "İSTANBUL" → "istanbul", "IŞIK" → "isik", "Ayşe Nur" → "ayse nur".
  - `toSearchText(...parts: Array<string | null | undefined | string[]>): string` — flattens, folds, joins with single spaces.
  - `searchTokens(query: string): string[]` — folded tokens, dropping tokens shorter than 2 chars, max 6 tokens.
- `src/lib/json-fields.ts`: `parseList(json: string | null | undefined): string[]` (never throws; non-array → []), `toListJson(list: string[], max = 20): string` (trim, drop empty, dedupe case-insensitively via foldTr, cap length per item 40 chars, cap count `max`), `parseObject<T>(json, fallback: T): T`.
- `src/lib/action-result.ts`: `export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string> }` plus helpers `ok(data?)`, `fail(error, fieldErrors?)`, and `zodFieldErrors(error: ZodError): Record<string,string>` (first message per path).

## 3. Config
- `src/config/taxonomy.ts` exporting typed constants and unions:
  - `CATEGORIES` (value/label): YAZILIM "Yazılım", DONANIM "Donanım", TASARIM "Tasarım", GIRISIM "Girişim", ARASTIRMA "Araştırma", SOSYAL_SORUMLULUK "Sosyal sorumluluk", SANAT_MEDYA "Sanat ve medya", OYUN "Oyun", DIGER "Diğer". Type `Category`.
  - `STAGES`: FIKIR "Fikir", PROTOTIP "Prototip", GELISTIRME "Geliştirme", YAYINDA "Yayında". Type `Stage`.
  - `WORK_MODES`: UZAKTAN "Uzaktan", YUZ_YUZE "Yüz yüze", HIBRIT "Hibrit". Type `WorkMode`.
  - `ACADEMIC_STATUSES`: STUDENT "Öğrenci", GRADUATE "Mezun". `DEGREE_LEVELS`: ONLISANS "Ön lisans", LISANS "Lisans", YUKSEK_LISANS "Yüksek lisans", DOKTORA "Doktora".
  - `VERIFICATION_STATUSES`: UNVERIFIED, PENDING, MANUAL_REVIEW, VERIFIED, REJECTED with Turkish labels ("Doğrulanmadı", "İnceleniyor", "Manuel incelemede", "Doğrulandı", "Reddedildi").
  - `DISCIPLINE_GROUPS` — exactly these 12, each `{ id, label, color, keywords: string[] (folded), complements: id[] }`:
    | id | label | color |
    |---|---|---|
    | yazilim | Yazılım ve bilişim | #0B7285 |
    | elektronik | Elektrik ve elektronik | #E8590C |
    | makine | Makine ve imalat | #495057 |
    | endustri | Endüstri ve yönetim | #E0A800 |
    | mimarlik | İnşaat ve mimarlık | #9C6644 |
    | tasarim | Tasarım | #D6336C |
    | isletme | İşletme ve ekonomi | #2F9E44 |
    | saglik | Sağlık | #C92A2A |
    | hukuk | Hukuk ve siyaset | #3B5BDB |
    | sosyal | Sosyal bilimler ve iletişim | #845EF7 |
    | temel | Temel bilimler | #74B816 |
    | sanat | Sanat ve medya | #AE3EC9 |
    Keywords (folded) should map common Turkish department names, e.g. yazilim: bilgisayar, yazilim, bilisim, yonetim bilisim, veri bilimi, yapay zeka; elektronik: elektrik, elektronik, haberlesme, telekomunikasyon, biyomedikal; makine: makine, mekatronik, otomotiv, havacilik, uzay, imalat, metalurji, malzeme; endustri: endustri muhendisligi, yonetim muhendisligi, lojistik; mimarlik: mimarlik, insaat, sehir ve bolge planlama, peyzaj, harita; tasarim: endustriyel tasarim, grafik tasarim, ic mimarlik, moda, iletisim tasarimi, gorsel iletisim; isletme: isletme, iktisat, ekonomi, finans, muhasebe, pazarlama, uluslararasi ticaret, maliye; saglik: tip, hemsirelik, eczacilik, dis hekimligi, fizyoterapi, beslenme, saglik; hukuk: hukuk, siyaset, kamu yonetimi, uluslararasi iliskiler; sosyal: psikoloji, sosyoloji, iletisim, gazetecilik, halkla iliskiler, egitim, ogretmenlik, tarih, felsefe, edebiyat, dil; temel: matematik, fizik, kimya, biyoloji, molekuler, istatistik, astronomi, genetik; sanat: muzik, sinema, televizyon, resim, heykel, guzel sanatlar, tiyatro, fotograf, animasyon. Order matters: test longer/more specific keywords first (e.g. "endustriyel tasarim" → tasarim before "endustri" → endustri; "ic mimarlik" → tasarim before "mimarlik"; "yonetim bilisim" → yazilim before "yonetim"; "iletisim tasarimi"/"gorsel iletisim" → tasarim before "iletisim" → sosyal).
    Complements (who you typically need): yazilim→[tasarim, isletme, elektronik]; elektronik→[yazilim, makine, tasarim]; makine→[elektronik, yazilim, endustri]; endustri→[yazilim, isletme, makine]; mimarlik→[tasarim, makine, sanat]; tasarim→[yazilim, isletme, makine]; isletme→[yazilim, tasarim, hukuk]; saglik→[yazilim, elektronik, temel]; hukuk→[isletme, yazilim, sosyal]; sosyal→[yazilim, tasarim, sanat]; temel→[yazilim, saglik, elektronik]; sanat→[yazilim, tasarim, sosyal].
  - `disciplineGroupForDepartment(department: string | null | undefined): DisciplineGroupId | null` — matching rule: split `foldTr(department)` and each keyword into tokens; a keyword matches when its tokens match **consecutive** department tokens and each department token **starts with** the corresponding keyword token (prefix match, so keyword "ogretmen" matches "ogretmenligi", "muhendis" matches "muhendisligi"). Try keywords ordered by token count desc, then character length desc, across all groups; first match wins. With this rule use stems in keywords where Turkish suffixes vary (e.g. "ogretmen" instead of "ogretmenlik").
  - `getDisciplineGroup(id: string)` (returns the group or undefined), `isDisciplineGroupId(x): x is DisciplineGroupId`.
  - `CITIES`: all 81 Turkish provinces in alphabetical Turkish order with correct Turkish spelling (Adana … Düzce), as a readonly string tuple.
  - Helper `labelOf(list, value)` returning the label or the value.
- `src/config/legal.ts`: `LEGAL_VERSION = "2026-11-08"`; `LEGAL = { controllerName: "[Veri sorumlusu unvanı]", address: "[Açık adres]", email: "kvkk@proje-arkadasim.local", kep: "[KEP adresi]", verbisNo: "[VERBİS kayıt no — varsa]", hostingCountry: "Türkiye" }`; `AI_PROVIDER = { name: "DeepSeek", company: "Hangzhou DeepSeek Artificial Intelligence Co., Ltd.", country: "Çin Halk Cumhuriyeti" }`; retention constants: `MASKED_TEXT_RETENTION_DAYS = 30`, `SESSION_DAYS = 30`, `RESET_TOKEN_MINUTES = 60`. The bracketed values are operator-filled data, documented as such in a comment.

## 4. Test infrastructure
- `vitest.config.ts`: node environment, `@` alias to `src`, `test.env.DATABASE_URL = "file:./test.db"`, `globalSetup: "./tests/global-setup.ts"`, `fileParallelism: false` (single SQLite file), include `src/**/*.test.ts` and `tests/**/*.test.ts`.
- `tests/global-setup.ts`: runs `npx prisma db push --force-reset --skip-generate` with `DATABASE_URL=file:./test.db` (use `execSync` with `env`), once per run.
- `tests/helpers/db.ts`: `resetDb()` that deletes all rows from every table in FK-safe order (or uses `PRAGMA foreign_keys=OFF` + delete + ON), and `createUser(overrides)` factory creating a VERIFIED user with unique email/username.
- Tests: `src/lib/tr.test.ts` (folding cases above + tokens), `src/lib/json-fields.test.ts`, `src/config/taxonomy.test.ts` (12 groups, 81 cities, department mapping cases: "Bilgisayar Mühendisliği"→yazilim, "Endüstriyel Tasarım"→tasarim, "Endüstri Mühendisliği"→endustri, "İç Mimarlık"→tasarim, "Mimarlık"→mimarlik, "Yönetim Bilişim Sistemleri"→yazilim, "Görsel İletişim Tasarımı"→tasarim, "İletişim Fakültesi Gazetecilik"→sosyal, "Tıp"→saglik, "Moleküler Biyoloji ve Genetik"→temel, "Elektrik-Elektronik Mühendisliği"→elektronik, "Mekatronik Mühendisliği"→makine, "bilinmeyen"→null), and `tests/db.test.ts` that creates a user, a project with a role, a follow, and verifies that deleting the user cascades (project, role, follow gone).

## Done when
Migration applied, `npx tsc --noEmit`, `npm run lint`, `npx vitest run` all pass, work committed, report written.
