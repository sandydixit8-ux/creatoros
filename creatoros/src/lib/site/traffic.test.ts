import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb } from "@/lib/db/db";
import { SITE_URL } from "@/lib/constants";
import { normalizePath, normalizeUtm, referrerHost, recordSiteVisit, siteTrafficSummary } from "./traffic";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-site-traffic-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("site traffic helpers", () => {
  it("normalizes a path: strips query/hash and forces a leading slash", () => {
    expect(normalizePath("")).toBe("/");
    expect(normalizePath("/pricing?utm=ad#faq")).toBe("/pricing");
    expect(normalizePath("pricing")).toBe("/pricing");
    expect(normalizePath("/a".padEnd(400, "b")).length).toBe(300);
  });

  it("keeps external referrers, drops self and unparseable ones", () => {
    expect(referrerHost("")).toBe("");
    expect(referrerHost("not a url")).toBe("");
    expect(referrerHost(`${SITE_URL}/pricing`)).toBe("");
    expect(referrerHost("https://www.google.com/search?q=creator")).toBe("www.google.com");
  });

  it("sanitizes campaign labels", () => {
    expect(normalizeUtm("  outreach\u0000 ")).toBe("outreach");
    expect(normalizeUtm(undefined)).toBe("");
    expect(normalizeUtm("x".repeat(200)).length).toBe(100);
  });
});

describe("site traffic summary", () => {
  it("counts page views, distinct visitors and countries with share", () => {
    recordSiteVisit({ path: "/", country: "US", device: "desktop", ref: "https://google.com", ip: "1.1.1.1", userAgent: "ua1" });
    recordSiteVisit({ path: "/", country: "US", device: "mobile", ip: "2.2.2.2", userAgent: "ua2" });
    recordSiteVisit({ path: "/pricing", country: "IN", device: "mobile", ip: "3.3.3.3", userAgent: "ua3" });
    // Same person, same day: stays one visitor but counts a second view.
    recordSiteVisit({ path: "/pricing", country: "US", device: "desktop", ip: "1.1.1.1", userAgent: "ua1" });
    // No country header: listed as Unknown, never dropped.
    recordSiteVisit({ path: "/", device: "desktop", ip: "4.4.4.4", userAgent: "ua4" });

    const s = siteTrafficSummary(30);
    expect(s.visitors).toBe(4);
    expect(s.pageViews).toBe(5);

    const byCountry = Object.fromEntries(s.countries.map((c) => [c.country, c.visitors]));
    expect(byCountry.US).toBe(2);
    expect(byCountry.IN).toBe(1);
    expect(byCountry[""]).toBe(1);
    expect(s.countries.find((c) => c.country === "US")?.name).toBe("United States");

    const pages = Object.fromEntries(s.pages.map((p) => [p.path, p.views]));
    expect(pages["/"]).toBe(3);
    expect(pages["/pricing"]).toBe(2);
    expect(s.pages[0].path).toBe("/");
  });

  it("returns empty aggregates when nothing has been recorded in range", () => {
    const s = siteTrafficSummary(30);
    expect(s.daily.length).toBeGreaterThan(0);
    expect(s.daily.every((d) => d.date.length === 10)).toBe(true);
  });

  it("records campaign labels and ranks them ahead of the raw referrer", () => {
    recordSiteVisit({
      path: "/",
      country: "US",
      ref: "https://www.reddit.com/r/something",
      utmSource: "reddit",
      utmCampaign: "week-1",
      ip: "9.9.9.9",
      userAgent: "ua9",
    });
    recordSiteVisit({
      path: "/pricing",
      country: "US",
      ref: "https://www.reddit.com/r/something",
      utmSource: "reddit",
      utmCampaign: "week-1",
      ip: "9.9.9.9",
      userAgent: "ua9",
    });

    const s = siteTrafficSummary(30);
    const tagged = s.sources.find((x) => x.source === "reddit");
    expect(tagged?.kind).toBe("campaign");
    expect(tagged?.campaign).toBe("week-1");
    expect(tagged?.views).toBe(2);
    expect(tagged?.visitors).toBe(1);
    // Untagged visits are still reported, as referrer or direct.
    expect(s.sources.some((x) => x.kind === "direct")).toBe(true);
    expect(s.sources.some((x) => x.source === "www.reddit.com")).toBe(false);
  });
});
