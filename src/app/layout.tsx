import type { Metadata, Viewport } from "next";
import { Geologica } from "next/font/google";
import "./globals.css";

const geologica = Geologica({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geologica",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F6F9" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1222" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={`${geologica.variable} bg-paper text-ink antialiased`}>
        {children}
      </body>
    </html>
  );
}
