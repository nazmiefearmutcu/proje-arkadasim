# Proje Arkadaşım — Uygulama planı

Spec: `docs/superpowers/specs/2026-11-08-proje-arkadasim-design.md` (bağlayıcı otorite)
Ortak kurallar: `docs/superpowers/sdd/global-constraints.md`
Yürütme: subagent-driven development — görev başına taze bir uygulayıcı, ardından görev incelemesi (spec uyumu + kod kalitesi), en fazla 5 düzeltme turu, en sonda tüm dalın geniş incelemesi. Uygulayıcılar sırayla çalışır (paralel değil). Model kuralı: önce Haiku; 4.–5. düzeltme turları ve son inceleme Opus.

## Görev sırası ve bağımlılıklar

| # | Görev | Brief | Bağlı olduğu |
|---|---|---|---|
| 0 | İskelet: Next.js 15, bağımlılıklar, git (orkestratör tarafından yapıldı) | — | — |
| 1 | Veri temeli: Prisma şeması, çekirdek kütüphaneler, taksonomi, test altyapısı | `sdd/task-01-brief.md` | 0 |
| 2 | Kimlik çekirdeği, güvenlik yardımcıları, bildirim, izinler, rıza | `sdd/task-02-brief.md` | 1 |
| 3 | Tasarım sistemi, UI ilkelleri, uygulama kabuğu, sayaç API'si, rota taslakları | `sdd/task-03-brief.md` | 2 |
| 4 | Giriş/kayıt sayfaları, KVKK onayları, yasal ve yardım sayfaları | `sdd/task-04-brief.md` | 3 |
| 5 | Belge doğrulama hattı (kütüphane + testler) | `sdd/task-05-brief.md` | 2 |
| 6 | Doğrulama arayüzü, yükleme API'si, yönetim paneli | `sdd/task-06-brief.md` | 3, 5 |
| 7 | Projeler: paylaş, keşfet, detay, başvuru, davet, ekip | `sdd/task-07-brief.md` | 3 |
| 8 | Sosyal: ana sayfa akışı, tanıtım, profil, takip, Network, engel/şikayet | `sdd/task-08-brief.md` | 7 |
| 9 | Mesajlaşma ve mesaj istekleri | `sdd/task-09-brief.md` | 8 |
| 10 | Bildirimler sayfası ve arama | `sdd/task-10-brief.md` | 8 |
| 11 | Ayarlar, avatar, KVKK hakları, temizlik | `sdd/task-11-brief.md` | 6 |
| 12 | Seed verisi, README, son derleme sağlığı | `sdd/task-12-brief.md` | 1–11 |

## Aşamalar
- **Aşama A (temel):** 1, 2, 3 → orkestratör sonuçları ve görsel kabuğu tarayıcıda kontrol eder.
- **Aşama B (çekirdek akışlar):** 4, 5, 6, 7.
- **Aşama C (sosyal ve tamamlayıcılar):** 8, 9, 10, 11, 12.
- **Aşama D:** tüm dalın son incelemesi (Opus), tek düzeltme dalgası, kapsamlı yeniden inceleme; ardından uygulama içi tarayıcıda mobil (375 px) uçtan uca doğrulama.

## Her görev için tamamlanma ölçütü
`npx tsc --noEmit`, `npm run lint`, `npx vitest run` yeşil; commit atılmış; rapor dosyası yazılmış; görev incelemesi temiz (veya kalan bulgular ledger'da gerekçeli kararla park edilmiş).

## Ledger
`docs/superpowers/sdd/ledger.md`
