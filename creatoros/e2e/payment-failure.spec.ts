import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("payment failure handling", () => {
  test("an expired checkout settles the order as canceled, not paid", async ({ page }) => {
    await login(page);

    // Locate the seeded product in the demo store.
    const productsRes = await page.request.get("/api/store/products");
    expect(productsRes.ok()).toBeTruthy();
    const products = (await productsRes.json()).data.products as Array<{ id: string; name: string }>;
    const product = products.find((p) => p.name === "E2E Digital Guide");
    expect(product).toBeTruthy();

    // Start a checkout with the mock provider and pull the order + session id.
    const checkoutRes = await page.request.post("/api/store/checkout", {
      data: { productId: product!.id, email: `fail-${Date.now()}@example.com`, phone: "9876543210" },
    });
    expect(checkoutRes.ok()).toBeTruthy();
    const checkout = (await checkoutRes.json()).data as { url: string; orderId: string };
    const sessionId = new URL(checkout.url).searchParams.get("session_id");
    expect(sessionId).toBeTruthy();

    // The provider reports the checkout as expired instead of paid.
    const hookRes = await page.request.post("/api/webhooks/stripe", {
      data: { id: `evt_fail_${Date.now()}`, type: "checkout.session.expired", data: { id: sessionId } },
    });
    expect(hookRes.ok()).toBeTruthy();

    // Returning from the failed checkout must show a non-paid receipt.
    const success = await page.request.get(`/api/store/checkout/success?order=${checkout.orderId}`, { maxRedirects: 0 });
    expect(success.status()).toBe(303);
    const location = success.headers()["location"];
    expect(location).toContain("/store/receipt/");

    await page.goto(location);
    await expect(page.getByRole("heading", { name: "Payment processing" })).toBeVisible();
    await expect(page.locator("dl").getByText("canceled")).toBeVisible();
  });
});
