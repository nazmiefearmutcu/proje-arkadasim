"use client";

import { Button } from "@/components/ui/button";
import "./globals.css";

/**
 * Son savunma hattı: kök düzenin kendisi hata verirse Next.js bu bileşeni kök düzenin yerine çizer.
 * Bu yüzden kendi `<html lang="tr">` ve `<body>` etiketlerini taşır; Next.js'in İngilizce varsayılan
 * sayfası görünmez. Yönlendirici bağlamına güvenilmez: yeniden deneme sayfayı tarayıcıda baştan yükler.
 * Geologica değişkeni kök düzende tanımlandığından burada belgelenmiş yedek yazı tipi (system-ui) kullanılır.
 */
export default function GlobalError() {
  return (
    <html lang="tr">
      <body className="bg-paper text-ink antialiased" style={{ fontFamily: "system-ui, sans-serif" }}>
        <title>Bir hata oluştu · Proje Arkadaşım</title>
        <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col items-center justify-center gap-3 px-4 py-10 text-center">
          <h1 className="t-card text-ink">Sayfa yüklenemedi</h1>
          <p className="t-body max-w-[68ch] text-ink-2">
            Bağlantını kontrol edip yeniden dene. Sorun sürerse biraz sonra tekrar gel.
          </p>
          <Button className="mt-1" onClick={() => window.location.reload()}>
            Yeniden dene
          </Button>
        </main>
      </body>
    </html>
  );
}
