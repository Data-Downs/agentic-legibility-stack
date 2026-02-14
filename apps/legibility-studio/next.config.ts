import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@als/schemas",
    "@als/runtime",
    "@als/evidence",
    "@als/legibility",
    "@als/identity",
    "@als/personal-data",
    "@als/adapters",
  ],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
