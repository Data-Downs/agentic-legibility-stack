import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "data-integrity",
    include: ["tests/**/*.test.ts"],
  },
});
