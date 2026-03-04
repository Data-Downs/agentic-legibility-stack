import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "personal-data",
    include: ["src/**/*.test.ts"],
  },
});
