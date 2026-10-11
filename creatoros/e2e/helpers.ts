import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export const DEMO_EMAIL = "demo@creatoros.dev";
export const DEMO_PASSWORD = "Demo1234!";

async function submitAndWait(page: Page, expected: RegExp, refill: () => Promise<void>) {
  // A fresh page can fire a native (GET) form submission before React hydrates
  // and attaches onSubmit. Retry until the client-side flow actually lands.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.click('button[type="submit"]');
    try {
      await expect(page).toHaveURL(expected, { timeout: 15_000 });
      return;
    } catch {
      await page.waitForSelector("#email", { state: "visible" });
      await refill();
    }
  }
  throw new Error(`navigation to ${expected} did not happen after form submit`);
}

export async function login(page: Page, email = DEMO_EMAIL, password = DEMO_PASSWORD) {
  await page.goto("/auth/login");
  const refill = async () => {
    await page.fill("#email", email);
    await page.fill("#password", password);
  };
  await refill();
  await submitAndWait(page, /\/app$/, refill);
}

export async function logout(page: Page) {
  await page.goto("/app");
  await page.getByRole("button", { name: /log out/i }).click();
  await page.goto("/auth/login");
}

export async function register(page: Page, name: string, email: string, password: string) {
  await page.goto("/auth/register");
  const refill = async () => {
    await page.fill("#name", name);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.check("#agree");
  };
  await refill();
  await submitAndWait(page, /\/app$/, refill);
}