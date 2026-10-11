import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("dashboard mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens the drawer and navigates to a module", async ({ page }) => {
    await login(page);

    const trigger = page.getByRole("button", { name: "Open menu" });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const drawer = page.getByRole("dialog", { name: "Dashboard menu" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Analytics" })).toBeVisible();

    await drawer.getByRole("link", { name: "Analytics" }).click();
    await expect(page).toHaveURL(/\/app\/analytics$/);
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Dashboard menu" })).toBeHidden();
  });

  test("closes on Escape", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog", { name: "Dashboard menu" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Dashboard menu" })).toBeHidden();
  });
});