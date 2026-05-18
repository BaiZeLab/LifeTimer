import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  headers: async () => [
    {
      // Service Worker must be served from the root scope with correct MIME type
      source: "/sw.js",
      headers: [
        { key: "Content-Type",  value: "application/javascript; charset=utf-8" },
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
    {
      // PWA manifest
      source: "/manifest.json",
      headers: [
        { key: "Content-Type",  value: "application/manifest+json" },
        { key: "Cache-Control", value: "public, max-age=86400" },
      ],
    },
  ],
};

export default nextConfig;
