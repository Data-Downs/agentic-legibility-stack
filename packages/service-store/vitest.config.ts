import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "service-store",
    include: ["src/**/*.test.ts"],
  },
});
