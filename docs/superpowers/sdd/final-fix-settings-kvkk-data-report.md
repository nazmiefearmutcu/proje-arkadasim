# Final fix wave: settings-kvkk-data

Packet: Settings, masking rules, KVKK export and avatar metadata.
Branch `task-26` (worktree `proje-arkadasim-wt/t26`).

- BASE: `2d0e939bbc869a4d5ff7fe3947bd0944dcff239f`
- Code HEAD (last code commit): `370153d`. This report is committed on top of it.

All 14 items are fixed. No existing file outside the packet was changed. Two new files were added: `src/lib/image-metadata.ts` and `src/lib/image-metadata.test.ts`. No schema change, no `npm install`, no `prisma generate` or `migrate`.

## Items

### F5 (Critical): masking labels miss possessive and qualified forms
- Defect confirmed. Only the bare forms were listed (`adres`, `telefon`, `kimlik no`, `seri no`), and each label had to be followed by a non-letter. So "İkamet Adresi", "Cep Telefonu", "(T.C.) Kimlik Numarası" and "Seri Numarası" were sent unmasked.
- Fix (`src/lib/verification/mask.ts`): `VALUE_LABEL_SOURCES` now has these folded forms:
  - `\(?t\.?…c\.?\)?…kimlik (numarasi|no)` and `kimlik (numarasi|no)`
  - `ogrenci (numarasi|no)`, `seri (numarasi|no)`, `barkod (numarasi|no)`
  - `e-posta( adresi)?`, `telefon( numarasi| no|u)?`, `adres(i)?`

  A qualifier in front ("İkamet", "Cep") stays as text, and the label ends where the value starts. The bare "Kimlik" counts as a label only when it is the first word on its line and a ":" follows (`LINE_VALUE_LABEL_SOURCES`, using the same anchor as F4). Longer sources are listed first. `keptLabelHits` already keeps the longest hit at each start position.
- Extra hardening:
  - Non-breaking spaces (U+00A0, U+2007, U+202F) become plain spaces before masking. PDF text such as "Doğum[NBSP]Tarihi" and TCKNs spaced with NBSP were missed before.
  - A trailing `\r` is trimmed from label values.
- Tests (`mask.test.ts`): a table-driven test checks every spec label in bare and possessive form, in normal case and in upper case ("LABEL: value"). Covered: Baba/Anne/Ana Adı, Doğum Yeri / Tarihi / Yeri-Tarihi, Öğrenci No/Numarası, Uyruk/Uyruğu, Adres/Adresi/İkamet Adresi, Telefon/Telefonu/Cep Telefonu/Telefon No, E-posta (Adresi), Seri No/Numarası, Barkod (No), (Belge) Doğrulama Kodu, Kimlik No/Numarası, T.C./(T.C.) Kimlik Numarası, "Kimlik :", Adı Soyadı, Adı, Soyadı. Other tests:
  - the full address and "532 123 45 67" are masked
  - "A12B34567" is masked
  - "(T.C.) Kimlik Numarası : [TCKN]"
  - a bare "Kimlik" in a sentence is kept
  - the NBSP label and NBSP TCKN cases

### F4: bare "Adı"/"Soyadı" over-masks institution lines
- Defect confirmed. The bare `adi`/`soyadi` were part of `NAME_LABEL_SOURCES`, so "Program Adı : X" turned into "[AD SOYAD]".
- Fix: "adi soyadi" and "ad soyad" still match anywhere (now also "Adı/Soyadı" and "Adı-Soyadı"). A bare `adi`/`soyadi` matches only as the first word of a line (leading spaces allowed) followed by optional spaces and ":". This pattern runs with the `m` flag on the folded text, which keeps newlines because `foldKeepingLength` maps character by character. A CRLF test is included.
- One deliberate addition: `soyadi` followed by ":" also matches in the middle of a line, as in "Anne Kızlık Soyadı : X". The old code masked that value, and strict line anchoring would have leaked a mother's maiden name. A bare "Soyadı :" has no non-name meaning, so this adds no over-masking.
- Tests:
  - Program, Üniversite, Fakülte and Bölüm Adı keep their values, and `AD_SOYAD` = 0.
  - "Adı geçen öğrenci AYŞE NUR KILIÇ … Bölümü …" keeps the sentence, and the name tokens become [AD]/[SOYAD].
  - Indented "Adı :", "Soyadı:" and "Anne Kızlık Soyadı :" are masked.
  - The existing "Adı : Zeynep" test still passes.

### F6: OCR names with digits escape rule 4
- Defect confirmed. `WORD_RE = /\p{L}+/u` split "K1LIÇ" into "K" and "LIÇ".
- Fix: rule 4 now uses the same tokens as `matchName`:
  - It splits on `/[\p{L}\p{N}]+/gu`. The sentinel private-use characters are not letters or digits, so they stay outside the class.
  - Tokens made only of digits are skipped.
  - Each token is folded with `foldTr` and compared with `matchesNameToken`.
  - Fallback: when a mixed letter-and-digit token does not match as a whole, each letter run in it is tried. "KILIÇ2023" still masks the surname, as it did before the change.
- Tests: "AYŞE K1LIÇ 2023" → "[AD] [SOYAD] 2023". "MEHMET ÖZT0RK 2023 - 2024" → "[AD] [SOYAD] 2023 - 2024". "KILIÇ2023" → "[SOYAD]2023".

### F28: TCKN separators
- Defect confirmed. Only one `[ .-]` was allowed between digits.
- Fix: `TCKN_RE = /(?<!\d)\d(?:[ \t.\-]{0,3}\d){10}(?!\d)/g`.
- Tests:
  - These are masked and counted once: "1000  0000 146" (double space), the tab-separated form, and "100 - 000 - 001 - 46".
  - These are left unchanged: "15.09.2023 - 15.09.2024", "01.01.2000-01.01.2001" and "2021 - 2022 / 2023 - 2024".

### F7: KVKK export incomplete
- Defect confirmed. Login events were capped by `take: 100`, and conversations, blocks, reports, sessions and introductions were missing.
- Fix (`src/lib/account-export.ts`): `LOGIN_EVENT_EXPORT_LIMIT` and `take` are removed. Every stored login event is exported, because purge already deletes rows past the retention window. New sections:
  - `conversations`: partnerUsername, status, initiatedByMe, createdAt, lastMessageAt
  - `blocksGiven`: blockedUsername, createdAt
  - `reportsFiled`: targetType, reason, details, status, createdAt. `targetId` is never selected.
  - `sessions`: userAgent, createdAt, expiresAt. The token and `tokenHash` are never selected.
  - `introductions`: suggestedUsername, reason, dismissed, createdAt

  `EXPORT_NOTES` now lists these sections and says that session tokens and other users' ids are not exported. Blocks received are left out on purpose: they are another user's action.
- Tests (`tests/export-route.test.ts`):
  - 140 login events are all exported.
  - The new sections have exact shapes.
  - A conversation and a block that belong to a stranger are excluded.
  - The token hash, `tokenHash`, `targetId` and the reported user's id are absent.

### F8: avatar EXIF/GPS served publicly
- Defect confirmed. `saveAvatar` wrote the uploaded bytes as they came.
- Fix: new pure module `src/lib/image-metadata.ts` with `stripImageMetadata(bytes, type)`. `saveAvatar` calls it after the type and size checks and before `writeFile`.
  - JPEG: drops APP1 (EXIF/XMP), APP13 (IPTC), COM and all other APPn. Keeps APP0 (JFIF), APP14 "Adobe" and APP2 only when it is an `ICC_PROFILE` (an APP2 "MPF" or FlashPix segment is dropped). Entropy-coded data is walked correctly (FF00 stuffing, RSTn, progressive scans). Trailing data after EOI is dropped, including MPF secondary images and vendor trailers.
  - PNG: drops eXIf, tEXt, iTXt, zTXt and tIME, plus any data after IEND. Keeps iCCP and all other chunks byte for byte.
  - WebP: drops the EXIF and XMP chunks, clears the VP8X XMP and EXIF flags, and recomputes the RIFF size. Handles chunk padding.
  - Orientation is kept on purpose. If EXIF Orientation is 2..8, a 26-byte EXIF that holds only that tag is written: an APP1, an eXIf chunk with a correct CRC32, or an EXIF chunk with the VP8X flag set. Without it, portrait phone photos would show rotated, because browsers apply EXIF orientation. No other EXIF field is carried over.
  - Parsing failures (truncated or unexpected structure) return the input bytes unchanged. Existing tests that use fake JPEG headers still pass.
- Tests (`src/lib/image-metadata.test.ts`): the fixtures are built in the test.
  - JPEG: a JFIF segment, an "Exif\0\0" APP1 with a Model string, an XMP APP1, MPF, APP13, COM, ICC, Adobe, DQT, SOF0, SOS with FF00/RST data, EOI and a trailer. The output equals the expected byte sequence, contains no secret and sniffs as JPEG. A second test checks the orientation-only EXIF.
  - PNG: a PNG with eXIf, tEXt, iTXt, zTXt and tIME produces the exact expected chunks. A second test keeps orientation with a CRC verified against `node:zlib` `crc32`.
  - WebP: a WebP with VP8X, ICCP, an odd-sized VP8, EXIF and XMP produces the expected chunks, flags and RIFF size. A second test keeps orientation.
  - Malformed inputs are returned unchanged (same reference).
  - `src/lib/avatar-storage.test.ts`: `saveAvatar` writes a file without "Exif" or GPS text.
- Note: avatars stored before this change keep their metadata. They would need a one-off re-processing script, or users can re-upload. Existing files were not migrated here.

### F9a: profile save blocked by a missing or legacy class year
- Defect confirmed. `superRefine` required `classYear` for non-graduates and `graduationYear` for graduates, and the range check rejected stored values outside 1..8.
- Fix:
  - `src/lib/settings/validation.ts`: both `superRefine` requirements are removed, and null is allowed for both fields. `parseProfileForm` takes `stored: { classYear, graduationYear }`. The stored value is accepted unchanged even out of range. New class choices must be within 1..`CLASS_YEAR_MAX`. New graduation years keep the `GRADUATION_YEAR_MIN`..next-year rule. graduationYear gets the same stored-value allowance because it has the same null and legacy path.
  - `src/lib/settings/actions.ts`: passes `viewer.classYear` and `viewer.graduationYear`.
  - `profile-form.tsx`: `CLASS_YEARS` comes from `CLASS_YEAR_MAX`. The placeholder is "Belirtilmemiş" (value ""). An extra option shows a stored value that is outside the list. Both fields get the hint "İsteğe bağlı.", and the graduation `min` uses `GRADUATION_YEAR_MIN`.
- Tests (`src/lib/settings/actions.test.ts`):
  - A verified student with a null classYear saves a bio.
  - An ADMIN with academicStatus null saves a bio and a city.
  - A graduate with a null graduationYear saves.
  - A stored classYear of 10 saves unchanged; a new 9 is rejected without changing anything; a new 2 saves.

### M42: delete-account hint asks for "@username"
- Defect confirmed.
- Fix: the hint in `delete-account-form.tsx` now shows the plain username. `deleteAccountAction` strips one leading "@" before it compares.
- Tests: "@username" deletes the account. "@@username" is rejected.

### M48: no rate limit on current-password checks
- Defect confirmed.
- Fix: `LIMITS.passwordCheck = [10, 15 * 60_000]` in `src/lib/rate-limit.ts`. `changePasswordAction` and `deleteAccountAction` both call `rateLimit("passwordCheck:<userId>", …)` before `verifyPassword`, after form validation. On the limit they return "Çok fazla deneme yaptın. N dakika sonra tekrar dene.".
- Tests:
  - After 10 wrong attempts, the 11th attempt with the correct password is refused, and the password is unchanged.
  - The two actions share one bucket: 5 change attempts plus 5 delete attempts block the next delete, and the account still exists.

### M49: retention days parsed with `parseInt`
- Defect confirmed.
- Fix: `loginRetentionDays` accepts the value only when `raw.trim()` matches `/^\d+$/` and the number is a safe integer above 0. Otherwise it returns 365.
- Tests:
  - Accepted: "30" and " 30 ".
  - Fall back to 365: "30d", "1e3", "", "   ", "0", "-5", "+30", "30.5" and "0x1E".
  - With "1e3", a 2-day-old login event is not purged.

### F30: misleading "upload a new document" hints
- Fix: both hints now read "Belgenden alındı; buradan değiştirilemez. Hatalıysa KVKK başvuru adresine yaz." through a shared `DOCUMENT_FIELD_HINT` constant in `profile-form.tsx`. The settings page already links "KVKK başvurusu" (mailto).

### F33: legal texts missing from settings
- Fix: `page.tsx` adds `LegalLink` entries for `/gizlilik` ("Gizlilik politikası") and `/kullanim-kosullari` ("Kullanım koşulları"). Both routes exist under `src/app/(app)/`.

### M27b: settings touch targets under 44 px
- Fix:
  - ChipInput "Ekle" uses the default md Button (h-11).
  - Chip remove buttons are `size-11 shrink-0` inside `min-h-11` chips.
  - AvatarField "Fotoğraf yükle" and "Kaldır" use the md size.
  - No `size="sm"`, `size-9` or `h-9` is left in `src/app/(app)/ayarlar/`.

### F39: tr-TR lowercase breaks ASCII "I" dedupe
- Fix: `dedupeKey` maps "ı" to "i" after the tr-TR lowercase. It is now exported, and ChipInput uses it, so the client dedupe (which had the same bug) matches `toListJson`.
- Tests: ["AI","ai"] → ["AI"]. ["IoT","iot"] → ["IoT"]. ["ROBOTIK","Robotik","robotık"] → ["ROBOTIK"]. The existing "ROBOTİK" and C#/C++ tests still pass.

## Items not fixed
None.

## Checks (run on the code HEAD `370153d`)
- `npx tsc --noEmit`: exit 0, no output.
- `npm run lint`: clean.
- `npx vitest run`: 52 files and 548 tests pass.

## Commits
- `78a783f` fix(mask): F5, F4, F6, F28
- `2b65c55` fix(export): F7
- `55ba3d0` fix(avatar): F8
- `76469ab` fix(settings): F9a, F30, M42, M48
- `92e84c7` fix(ayarlar): F33, M27b, F39
- `b708024` fix(purge): M49
- `370153d` fix(mask): letter-run fallback for digit-joined names, NBSP normalisation
