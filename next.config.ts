import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
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
