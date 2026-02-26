import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: [
    "@als/schemas",
    "@als/runtime",
    "@als/evidence",
    "@als/legibility",
    "@als/identity",
    "@als/personal-data",
    "@als/adapters",
    "@als/service-graph",
  ],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
