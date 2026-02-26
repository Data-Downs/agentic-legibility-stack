import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false as unknown as NextConfig["devIndicators"],
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
