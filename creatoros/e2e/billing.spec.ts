import { test, expect } from "@playwright/test";
import type { Locator, Page, Response } from "@playwright/test";
import { login } from "./helpers";

/**
 * Click Upgrade until the checkout request actually fires.
 *
 * The card is server-rendered, so its button is visible and enabled before
 * React attaches `onClick`. A click in that window is silently swallowed: no
 * request, no navigation, no error. Dev mode widens the window because the
 * client chunk is compiled on first visit, which is why this only shows up in
 * the full suite. Same hydration race `helpers.ts` handles for form submits.
 *
 * Retrying is safe: once the handler runs, `busyPlan` disables the button, so
 * the retry cannot double-submit a checkout.
 */
async function startCheckout(page: Page, card: Locator): Promise<Response> {
  const button = card.locator("button").first();
  for (let attempt = 0; attempt < 4; attempt++) {
    const waiter = page
      .waitForResponse((r) => r.url().includes("/api/billing/checkout") && r.request().method() === "POST", {
        timeout: 15_000,
      })
      .catch(() => null);
    // Skip the click when the previous attempt did land and the button is now
    // the disabled "Starting checkout…" state.
    if (await button.isEnabled().catch(() => false)) await button.click();
    const response = await waiter;
    if (response) return response;
  }
  throw new Error("checkout request never fired — the Upgrade click was swallowed before hydration");
}

test.describe("billing & plan upgrades", () => {
  test("upgrades to the pro plan via simulated checkout, then cancels", async ({ page }) => {
    await login(page);
    await page.goto("/app/billing");

    // Upgrade to pro. The checkout is started with a POST (Stripe returns a
    // hosted URL, Cashfree opens the browser SDK), so the card exposes a button.
    const proCard = page.locator("div.card", { has: page.getByRole("heading", { name: "pro", exact: true }) });
    const response = await startCheckout(page, proCard);
    expect(response.status(), "checkout POST should succeed").toBe(200);

    // The mock gateway redirects immediately, so the response body is gone by
    // the time we can read it (the page navigates away). Assert on the redirect
    // instead: the query flag is a real post-click signal, unlike the path,
    // which was already /app/billing before the click.
    await expect(page).toHaveURL(/[?&]upgraded=pro/, { timeout: 20_000 });
    await expect(page.getByText("You're on the pro plan.")).toBeVisible({ timeout: 15_000 });

    const subBanner = page.getByText(/pro plan · active/);
    await expect(subBanner).toBeVisible();

    // Cancel subscription (status -> canceled, active plan retained per Stripe period-end semantics).
    await page.getByRole("button", { name: /cancel subscription/i }).click();
    await expect(page).toHaveURL(/\/app\/billing/, { timeout: 20_000 });
    await expect(page.getByText("You're on the pro plan.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /cancel subscription/i })).toHaveCount(0);
  });
});
