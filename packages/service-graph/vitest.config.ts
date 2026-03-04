import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "service-graph",
    include: ["src/**/*.test.ts"],
  },
});
