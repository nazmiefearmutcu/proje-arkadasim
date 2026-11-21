import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Gövde Inter, başlıklar Plus Jakarta Sans, tarih ve sayılar JetBrains Mono.
const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s · Proje Arkadaşım",
    default: "Proje Arkadaşım",
  },
  description:
    "Doğrulanmış üniversite öğrencileri ve mezunları için proje paylaşma ve ekip kurma platformu.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#0D1117",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Yazı tipi değişkeni <html> üzerinde durur: Tailwind'in temel stili yazı tipini kökte okur.
    <html lang="tr" className={`${inter.variable} ${jakarta.variable} ${jetbrains.variable}`}>
      <body className="bg-paper text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
