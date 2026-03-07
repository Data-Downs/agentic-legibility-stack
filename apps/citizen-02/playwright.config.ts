import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3102",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3102",
    reuseExistingServer: true,
  },
});
