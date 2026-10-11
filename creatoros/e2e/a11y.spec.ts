import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

async function auditPublicControls(page: Page) {
  const issues = await page.evaluate(() => {
    const problems: string[] = [];

    for (const btn of Array.from(document.querySelectorAll("button"))) {
      const labelledBy = btn.getAttribute("aria-labelledby");
      const name =
        (labelledBy && document.getElementById(labelledBy)?.textContent?.trim()) ||
        btn.getAttribute("aria-label") ||
        (btn.textContent || "").trim();
      if (!name) problems.push(`button: ${btn.outerHTML.slice(0, 90)}`);
    }

    for (const a of Array.from(document.querySelectorAll("a"))) {
      const name = a.getAttribute("aria-label") || (a.textContent || "").trim();
      if (!name) problems.push(`a: ${a.outerHTML.slice(0, 90)}`);
    }

    for (const img of Array.from(document.querySelectorAll("img"))) {
      if (!img.hasAttribute("alt")) problems.push(`img missing alt: ${img.outerHTML.slice(0, 90)}`);
    }

    for (const table of Array.from(document.querySelectorAll("table"))) {
      if (!table.querySelector("caption")) problems.push("table missing caption");
      for (const th of Array.from(table.querySelectorAll("th"))) {
        if (!th.hasAttribute("scope")) problems.push(`th missing scope: ${(th.textContent || "").trim()}`);
      }
    }

    for (const field of Array.from(document.querySelectorAll("input, select, textarea"))) {
      const el = field as HTMLInputElement;
      if (el.type === "hidden" || el.disabled) continue;
      const id = el.id;
      const hasLabelFor = id && document.querySelector(`label[for=${CSS.escape(id)}]`);
      const wrapped = el.closest("label");
      const aria = el.getAttribute("aria-label");
      if (!aria && !hasLabelFor && !wrapped) problems.push(`field missing name: ${el.outerHTML.slice(0, 90)}`);
    }

    return problems;
  });
  expect(issues).toEqual([]);
}

async function auditFieldNames(page: Page) {
  const missing = await page.evaluate(() => {
    const out: string[] = [];
    for (const field of Array.from(document.querySelectorAll("input, select, textarea"))) {
      const el = field as HTMLInputElement;
      if (el.type === "hidden" || el.disabled) continue;
      const id = el.id;
      const hasLabelFor = id && document.querySelector(`label[for=${CSS.escape(id)}]`);
      const wrapped = el.closest("label");
      const aria = el.getAttribute("aria-label");
      if (!aria && !hasLabelFor && !wrapped) out.push(`${el.tagName.toLowerCase()}#${id || "(no-id)"}`);
    }
    return out;
  });
  expect(missing).toEqual([]);
}

test.describe("accessible markup (DOM audit)", () => {
  for (const [label, path] of [
    ["homepage", "/"],
    ["pricing", "/pricing"],
    ["login", "/auth/login"],
    ["register", "/auth/register"],
  ] as const) {
    test(`${label} has labelled controls, associated fields, valid tables and alt text`, async ({ page }) => {
      await page.goto(path);
      await auditPublicControls(page);
    });
  }

  test("auth pages are noindex", async ({ page }) => {
    for (const path of ["/auth/login", "/auth/register"]) {
      await page.goto(path);
      const robots = await page.locator('meta[name="robots"]').getAttribute("content");
      expect(robots).toContain("noindex");
    }
  });

  test("public booking form fields have accessible names after a slot is chosen", async ({ page }) => {
    await page.goto("/u/democreator/book/strategy-call");
    await page.getByRole("button", { name: /^(Mon|Wed)/ }).first().click({ timeout: 15000 });
    await page.getByRole("button", { name: /[0-9]:[0-9]{2} (AM|PM)/ }).first().click({ timeout: 15000 });
    await auditFieldNames(page);
  });

  test("dashboard tables carry captions and header scopes", async ({ page }) => {
    await login(page);
    for (const path of ["/app/store", "/app/leads"]) {
      await page.goto(path);
      const tables = page.locator("table");
      await expect(tables.first()).toBeVisible();
      const count = await tables.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expect(tables.nth(i).locator("caption")).toHaveCount(1);
      }
      const missing = await page.evaluate(() => {
        const out: string[] = [];
        for (const th of Array.from(document.querySelectorAll("table th"))) {
          if (!th.hasAttribute("scope")) out.push((th.textContent || "").trim());
        }
        return out;
      });
      expect(missing).toEqual([]);
    }
  });

  test("current dashboard nav link is marked aria-current", async ({ page }) => {
    await login(page);
    await page.goto("/app/store");
    const storeLinks = page.getByRole("link", { name: /Store/ });
    const count = await storeLinks.count();
    expect(count).toBeGreaterThan(0);
    let current = 0;
    for (let i = 0; i < count; i++) {
      if ((await storeLinks.nth(i).getAttribute("aria-current")) === "page") current += 1;
    }
    expect(current).toBeGreaterThan(0);
  });

  test("dashboard settings form fields all have accessible labels", async ({ page }) => {
    await login(page);
    await page.goto("/app/settings");
    await auditFieldNames(page);
  });
});