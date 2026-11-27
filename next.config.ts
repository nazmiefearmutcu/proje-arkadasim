import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["tesseract.js", "unpdf"],
  // Eski yönetim paneli adresleri editör paneline taşındı (spec 2026-11-27 §2).
  async redirects() {
    return [
      { source: "/admin", destination: "/editor", permanent: true },
      { source: "/admin/dogrulamalar", destination: "/editor/belgeler", permanent: true },
      { source: "/admin/sikayetler", destination: "/editor/sikayetler", permanent: true },
    ];
  },
};

export default nextConfig;
