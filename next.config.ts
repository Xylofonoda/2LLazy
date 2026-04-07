import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages rely on native binaries, large files, or Node.js-specific
  // globals that must not be bundled by webpack
  serverExternalPackages: [
    "pdf-parse",
    "formidable",
    "ws",
    "@neondatabase/serverless",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
