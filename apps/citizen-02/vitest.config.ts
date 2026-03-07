import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    name: "citizen-02",
    environment: "jsdom",
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.tsx",
      "app/api/**/*.test.ts",
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": __dirname,
    },
  },
});
