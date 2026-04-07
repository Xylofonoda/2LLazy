import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // playwright-core and @sparticuz/chromium-min must not be bundled — they rely on
  // native binaries resolved at runtime.
  serverExternalPackages: [
    "playwright-core",
    "playwright",
    "@sparticuz/chromium-min",
    "pdf-parse",
    "formidable",
    "pg",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
