import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("loads persona picker with persona names visible", async ({ page }) => {
    await page.goto("/");
    // Should show at least one persona name
    await expect(page.locator("body")).toContainText("Emma");
  });

  test("selecting persona navigates to dashboard with topics", async ({ page }) => {
    await page.goto("/");
    // Click on a persona (Emma Parker)
    const emmaButton = page.locator("text=Emma").first();
    await emmaButton.click();
    // Should navigate to dashboard and show topics
    await expect(page.locator("text=Topics")).toBeVisible({ timeout: 10000 });
  });

  test("/api/services returns valid JSON", async ({ request }) => {
    const response = await request.get("/api/services");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty("services");
    expect(Array.isArray(data.services)).toBe(true);
  });

  test("/api/life-events returns valid JSON", async ({ request }) => {
    const response = await request.get("/api/life-events");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty("lifeEvents");
    expect(Array.isArray(data.lifeEvents)).toBe(true);
  });
});
