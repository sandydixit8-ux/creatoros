import { test, expect } from "@playwright/test";

const PLAN_NAMES = ["Free", "Starter", "Creator", "Pro", "Business"];
const PLAN_PRICES = ["$0", "$9", "$19", "$49", "$99"];
const MODULE_TITLES = [
  "Bio Pages",
  "Store & Payments",
  "Courses & Learning",
  "Bookings & Calendar",
  "Leads CRM",
  "Email & Newsletters",
  "Analytics",
  "Community",
  "AI Strategy Coach",
];
const WORKFLOW_TITLES = ["Create", "Publish", "Grow", "Monetize", "Analyse"];

test.describe("marketing homepage", () => {
  test("renders the full section set with all nine modules, plans and legal footer", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("One Powerful Workspace.");
    await expect(page.getByRole("link", { name: "Start for Free" }).first()).toHaveAttribute("href", "/auth/register");
    await expect(page.getByRole("link", { name: "Explore the Platform" })).toHaveAttribute("href", "/#product");

    const modules = page.locator("section#product .group");
    await expect(modules).toHaveCount(9);
    for (const title of MODULE_TITLES) {
      await expect(page.locator("section#product").getByRole("heading", { name: title })).toBeVisible();
    }
    await expect(modules.filter({ hasText: "Live" })).toHaveCount(9);

    const workflow = page.locator("section#workflow ol > li");
    await expect(workflow).toHaveCount(5);
    for (const title of WORKFLOW_TITLES) {
      await expect(page.locator("section#workflow").getByRole("heading", { name: title })).toBeVisible();
    }

    const pricing = page.locator("section#pricing");
    await expect(pricing.locator('a[href="/auth/register"]')).toHaveCount(PLAN_NAMES.length);
    for (const name of PLAN_NAMES) {
      await expect(pricing.getByText(name, { exact: true })).toBeVisible();
    }
    for (const price of PLAN_PRICES) {
      await expect(pricing.getByText(price, { exact: true })).toBeVisible();
    }

    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Refund Policy" })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^http:\/\/localhost:3000\/?$/);
    await expect(page).toHaveTitle(/All in One Place/);
  });

  test("FAQ accordion starts open, toggles and exposes ARIA state", async ({ page }) => {
    await page.goto("/");
    const faq = page.locator("section#faq");
    const first = faq.getByRole("button", { name: "How do I get started?" });
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await expect(faq.getByRole("region", { name: "How do I get started?" })).toBeVisible();

    const billing = faq.getByRole("button", { name: "How does billing work?" });
    await billing.click();
    await expect(billing).toHaveAttribute("aria-expanded", "true");
    await expect(faq.getByRole("region", { name: "How does billing work?" })).toBeVisible();
    await expect(faq.getByRole("region", { name: "Who owns my data?" })).toHaveCount(0);
  });

  test("mobile header opens the drawer with primary nav and auth actions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const toggle = page.getByRole("button", { name: "Open menu" });
    await expect(toggle).toBeVisible();
    await expect(page.locator('nav[aria-label="Primary"]')).toBeHidden();

    await toggle.click();
    await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible();
    const mobile = page.locator('nav[aria-label="Mobile"]');
    await expect(mobile).toBeVisible();
    await expect(mobile.getByRole("link", { name: "Pricing" })).toBeVisible();

    await mobile.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
  });
});

test.describe("pricing page", () => {
  test("renders all plans with a single-brand title and canonical", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Simple, transparent pricing");
    for (const name of PLAN_NAMES) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    await expect(page.locator("main a[href='/auth/register']")).toHaveCount(PLAN_NAMES.length);
    await expect(page).toHaveTitle("Pricing | CreatorOS");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/pricing$/);
  });
});