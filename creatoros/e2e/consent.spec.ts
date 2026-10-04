import { test, expect } from "@playwright/test";

/**
 * D-5: the Cookie Policy promises consent is asked for before any non-essential
 * measurement, and that it can be withdrawn at any time. These tests hold the
 * product to that wording.
 */

test.describe("cookie consent", () => {
  test("shows the banner on a first visit and stores the choice", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByTestId("consent-banner");
    await expect(banner).toBeVisible();

    // Reject is offered as a first-class action, not buried behind a link.
    await expect(page.getByTestId("consent-reject")).toBeVisible();
    await expect(page.getByTestId("consent-accept")).toBeVisible();

    await page.getByTestId("consent-reject").click();
    await expect(banner).toBeHidden();

    const stored = await page.evaluate(() =>
      window.localStorage.getItem("creatoros_consent_v1")
    );
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string)).toMatchObject({ essential: true, analytics: false });
  });

  test("does not show the banner again once a decision is recorded", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("consent-banner")).toBeVisible();
    await page.getByTestId("consent-accept").click();
    await expect(page.getByTestId("consent-banner")).toBeHidden();

    await page.goto("/pricing");
    await expect(page.getByTestId("consent-banner")).toHaveCount(0);
  });

  test("does not fire a tracking request before consent is given", async ({ page }) => {
    const tracks: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/track")) tracks.push(req.url());
    });

    await page.goto("/");
    await expect(page.getByTestId("consent-banner")).toBeVisible();
    // Give any effect a chance to fire.
    await page.waitForTimeout(700);
    expect(tracks).toHaveLength(0);
  });

  test("sends tracking once analytics is allowed through the real consent flow", async ({
    page,
  }) => {
    // Grant consent the way a visitor does, so the server actually mints the
    // signed receipt cookie. Faking localStorage alone would not be enough:
    // /api/track authorises from the receipt, not from storage.
    await page.goto("/");
    await page.getByTestId("consent-accept").click();
    await expect(page.getByTestId("consent-banner")).toBeHidden();

    const cookies = await page.context().cookies();
    const receipt = cookies.find((c) => c.name === "creatoros_consent");
    expect(receipt).toBeTruthy();
    expect(receipt?.httpOnly).toBe(true);

    const bodies: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/track") && req.method() === "POST") {
        bodies.push(req.postData() ?? "");
      }
    });

    await page.goto("/u/democreator");
    await page.waitForTimeout(900);
    expect(bodies.length).toBeGreaterThan(0);
    // The request body carries no consent flag at all any more.
    expect(JSON.parse(bodies[0]).consent).toBeUndefined();
  });

  test("stopped sending tracking once consent is withdrawn", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("consent-accept").click();
    await expect(page.getByTestId("consent-banner")).toBeHidden();

    const bodies: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/track") && req.method() === "POST") bodies.push("hit");
    });

    await page.goto("/cookie-policy");
    await page.getByTestId("policy-withdraw").click();
    await expect(page.getByTestId("consent-summary")).toContainText("not allowed");

    bodies.length = 0;
    await page.goto("/u/democreator");
    await page.waitForTimeout(900);
    expect(bodies).toHaveLength(0);
  });

  test("the cookie policy page lets a visitor withdraw consent", async ({ page }) => {
    await page.goto("/cookie-policy");
    const panel = page.getByTestId("consent-preferences");
    await expect(panel).toBeVisible();

    // No decision yet: only strictly necessary cookies are in use.
    await expect(page.getByTestId("consent-undecided")).toBeVisible();

    await page.getByTestId("policy-analytics-toggle").check();
    await expect(page.getByTestId("consent-summary")).toContainText("allowed");

    await page.getByTestId("policy-withdraw").click();
    await expect(page.getByTestId("consent-summary")).toContainText("not allowed");

    const stored = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("creatoros_consent_v1") as string)
    );
    expect(stored.analytics).toBe(false);
    expect(stored.source).toBe("withdrawn");
  });

  test("a granular choice from the banner is saved", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("consent-manage").click();
    await page.getByTestId("consent-analytics-toggle").check();
    await page.getByTestId("consent-save").click();
    await expect(page.getByTestId("consent-banner")).toBeHidden();

    const stored = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("creatoros_consent_v1") as string)
    );
    expect(stored.analytics).toBe(true);
    expect(stored.source).toBe("preferences");
  });
});