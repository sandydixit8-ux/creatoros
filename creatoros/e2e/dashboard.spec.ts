import { test, expect } from "@playwright/test";
import { login } from "./helpers";

const SHELL_PAGES: Array<[string, string, string]> = [
  ["/app/templates", "Template Library", "Start from a proven layout"],
  ["/app/community", "Community", ""],
  ["/app/notifications", "Notifications", ""],
  ["/app/admin", "Platform admin only", ""],
  ["/app/leads", "Leads", ""],
  ["/app/bio", "Bio Pages", "Demo Page"],
  ["/app/booking", "Booking", ""],
  ["/app/analytics", "Traffic & click analytics", ""],
  ["/app/coach", "AI Coach", ""],
  ["/app/email", "Email", ""],
  ["/app/courses", "Courses", ""],
  ["/app/learn", "My learning", ""],
];

test.describe("dashboard shell", () => {
  test("every module page renders for the demo user", async ({ page }) => {
    await login(page);

    for (const [route, heading, content] of SHELL_PAGES) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      if (content) await expect(page.getByText(content).first()).toBeVisible();
      await expect(page.getByRole("link", { name: "Dashboard" }).first()).toBeVisible();
    }
  });

  test("unknown dashboard route renders the not-found shell", async ({ page }) => {
    await login(page);
    await page.goto("/app/definitely-not-a-real-route");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  });

  test("settings profile form loads demo values and saves", async ({ page }) => {
    await login(page);
    await page.goto("/app/settings");
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.locator("#profile-username")).toHaveValue("democreator");
    await expect(page.locator("#profile-display-name")).toHaveValue("Demo Creator");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved. Check your public page.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Export your data" })).toBeVisible();
  });

  test("store allows creating and removing a product", async ({ page }) => {
    await login(page);
    await page.goto("/app/store");
    await expect(page.getByRole("heading", { name: "Store" })).toBeVisible();

    await page.getByRole("button", { name: "New product" }).click();
    await page.getByPlaceholder("Logo design package").fill("E2E Smoke Widget");
    await page.getByPlaceholder("What's included").fill("A transient product.");
    await page.getByPlaceholder("19.00").fill("7.50");
    await page.getByRole("button", { name: "Create product" }).click();

    await expect(page.getByText("E2E Smoke Widget")).toBeVisible();
    await expect(page.getByText("$7.50")).toBeVisible();

    // Clean up so other specs see a tidy store. Deletion uses an inline
    // confirm (no native dialog): first click arms, second click confirms.
    const del = page.getByRole("row", { name: /E2E Smoke Widget/ }).getByRole("button", { name: "Delete" });
    await del.click();
    await del.click();
    await expect(page.getByText("E2E Smoke Widget")).toHaveCount(0, { timeout: 10000 });
  });
});