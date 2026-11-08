import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["tesseract.js", "unpdf"],
};

export default nextConfig;
