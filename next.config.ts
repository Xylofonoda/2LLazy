import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages rely on native binaries or large files that must not be bundled
  serverExternalPackages: [
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
