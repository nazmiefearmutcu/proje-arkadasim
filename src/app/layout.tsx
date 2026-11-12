import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// Tek aile, iki genişlik: gövde normal, başlıklar dar ve kalın (genişlik ekseni).
const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
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
  themeColor: "#1746B8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Yazı tipi değişkeni <html> üzerinde durur: Tailwind'in temel stili yazı tipini kökte okur.
    <html lang="tr" className={archivo.variable}>
      <body className="bg-paper text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
