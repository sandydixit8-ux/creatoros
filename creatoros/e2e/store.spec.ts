import { test, expect } from "@playwright/test";

test.describe("store checkout", () => {
  test("buys a product from the public bio page and lands on a paid receipt", async ({ page }) => {
    await page.goto("/u/democreator");

    const productCard = page.getByText("E2E Digital Guide");
    await expect(productCard).toBeVisible();

    // Open inline checkout
    const buyNow = page.getByRole("button", { name: "Buy now" });
    await buyNow.click();

    await page.getByPlaceholder("you@email.com").fill("buyer-e2e@example.com");
    await page.getByPlaceholder("Phone number").fill("9876543210");
    await page.getByRole("button", { name: /Pay \$5\.00/ }).click();

    // Mock provider confirms immediately and redirects to the receipt.
    await expect(page).toHaveURL(/\/store\/receipt\//, { timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Payment received" })).toBeVisible();
    await expect(page.getByText("E2E Digital Guide")).toBeVisible();
    await expect(page.locator("dl").getByText("paid")).toBeVisible();
  });
});