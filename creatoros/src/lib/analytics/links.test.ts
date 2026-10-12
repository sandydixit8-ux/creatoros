import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, run, closeDb, nowIso } from "@/lib/db/db";
import {
  createCampaign,
  createTrackedLink,
  deleteTrackedLink,
  destinationWithAttribution,
  linkPerformance,
  listCampaigns,
  listTrackedLinks,
  recordTrackedLinkClick,
  resolveTrackedLink,
  updateCampaign,
  updateTrackedLink,
} from "@/lib/analytics/links";
import { presetRange } from "@/lib/analytics/reporting";
import { trackEvent } from "@/lib/analytics/engine";

const T1 = "org_links_1";
const T2 = "org_links_2";
let dir: string;

function seedTenant(id: string, user: string, profile: string) {
  const now = nowIso();
  run("INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?,?, 'x','U',?,?)", user, `${user}@t.com`, now, now);
  run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?,?,?,'free',?,?)", id, id, id, now, now);
  run("INSERT INTO profiles (id, tenant_id, user_id, username, created_at, updated_at) VALUES (?,?,?,?,?,?)", profile, id, user, profile, now, now);
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-links-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  seedTenant(T1, "u1", "creator1");
  seedTenant(T2, "u2", "creator2");
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("campaigns", () => {
  it("creates a campaign and defaults utm_campaign to the name", () => {
    const r = createCampaign(T1, { name: "Diwali promo", utmSource: "instagram" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.utmCampaign).toBe("Diwali promo");
    expect(r.data.utmSource).toBe("instagram");
    expect(listCampaigns(T1)).toHaveLength(1);
  });

  it("rejects a duplicate campaign name", () => {
    const r = createCampaign(T1, { name: "Diwali promo" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("conflict");
  });

  it("updates a campaign and keeps names unique", () => {
    const c = createCampaign(T1, { name: "Launch" });
    if (!c.ok) throw new Error("setup");
    const upd = updateCampaign(T1, c.data.id, { utmMedium: "email" });
    expect(upd.ok && upd.data.utmMedium).toBe("email");
    const dupe = updateCampaign(T1, c.data.id, { name: "Diwali promo" });
    expect(dupe.ok).toBe(false);
  });
});

describe("tracked links", () => {
  it("creates a link with an explicit slug and resolves it with campaign UTMs", () => {
    const c = createCampaign(T1, { name: "Story", utmSource: "instagram", utmMedium: "social" });
    if (!c.ok) throw new Error("setup");
    const l = createTrackedLink(T1, { label: "My site", slug: "my-site", destination: "https://example.com/offer", campaignId: c.data.id });
    expect(l.ok).toBe(true);
    if (!l.ok) return;
    expect(l.data.slug).toBe("my-site");

    const resolved = resolveTrackedLink("my-site");
    expect(resolved?.destination).toBe("https://example.com/offer");
    expect(resolved?.utmSource).toBe("instagram");
    expect(resolved?.utmMedium).toBe("social");
    expect(resolved?.utmCampaign).toBe("Story");
  });

  it("rejects an unsafe destination", () => {
    const r = createTrackedLink(T1, { destination: "javascript:alert(1)" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid");
  });

  it("rejects a reserved or already-taken slug", () => {
    const reserved = createTrackedLink(T1, { slug: "app", destination: "https://example.com" });
    expect(reserved.ok).toBe(false);
    const taken = createTrackedLink(T1, { slug: "my-site", destination: "https://example.com" });
    expect(taken.ok).toBe(false);
    if (!taken.ok) expect(taken.code).toBe("conflict");
  });

  it("auto-generates a unique slug from the label", () => {
    const a = createTrackedLink(T1, { label: "Free guide", destination: "https://example.com/g" });
    const b = createTrackedLink(T1, { label: "Free guide", destination: "https://example.com/g" });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.data.slug).toMatch(/^free-guide-/);
      expect(a.data.slug).not.toBe(b.data.slug);
    }
  });

  it("scopes list and mutation to the owning tenant", () => {
    const t2Link = createTrackedLink(T2, { slug: "t2-only", destination: "https://example.com/t2" });
    expect(t2Link.ok).toBe(true);
    expect(listTrackedLinks(T1).some((l) => l.slug === "t2-link")).toBe(false);
    if (t2Link.ok) {
      // Another tenant cannot edit or delete it.
      const upd = updateTrackedLink(T1, t2Link.data.id, { label: "hijack" });
      expect(upd.ok).toBe(false);
      expect(deleteTrackedLink(T1, t2Link.data.id)).toBe(false);
      expect(deleteTrackedLink(T2, t2Link.data.id)).toBe(true);
    }
  });
});

describe("attribution", () => {
  it("appends UTM parameters without clobbering existing ones", () => {
    const c = createCampaign(T1, { name: "UTM", utmSource: "ig", utmMedium: "social", utmCampaign: "summer" });
    if (!c.ok) throw new Error("setup");
    const l = createTrackedLink(T1, { slug: "utm-link", destination: "https://example.com/path?utm_source=existing", campaignId: c.data.id });
    if (!l.ok) throw new Error("setup");
    const resolved = resolveTrackedLink("utm-link")!;
    const out = new URL(destinationWithAttribution(resolved));
    expect(out.searchParams.get("utm_source")).toBe("existing");
    expect(out.searchParams.get("utm_medium")).toBe("social");
    expect(out.searchParams.get("utm_campaign")).toBe("summer");
    expect(out.searchParams.get("crl")).toBe(resolved.id);
  });

  it("counts clicks attributed by properties.linkId", () => {
    const link = createTrackedLink(T1, { slug: "count-me", destination: "https://example.com/c" });
    if (!link.ok) throw new Error("setup");
    const resolved = resolveTrackedLink("count-me")!;
    recordTrackedLinkClick(resolved, { visitorId: "v1", sessionId: "s1", country: "IN", device: "mobile" });
    recordTrackedLinkClick(resolved, { visitorId: "v1", sessionId: "s1", country: "IN" });

    // A click with no linkId (an ordinary bio link) must not be attributed here.
    trackEvent({ tenantId: T1, eventType: "link_click", visitorId: "v9", ref: "https://other.example" });

    const perf = linkPerformance(T1, presetRange("30d"));
    const row = perf.find((p) => p.linkId === resolved.id);
    expect(row?.clicks).toBe(2);
    expect(row?.visitors).toBe(1);
  });
});

describe("updates and deletes", () => {
  it("updates fields and removes a link", () => {
    const l = createTrackedLink(T1, { slug: "edit-me", destination: "https://example.com/e" });
    if (!l.ok) throw new Error("setup");
    const upd = updateTrackedLink(T1, l.data.id, { label: "Edited", active: false });
    expect(upd.ok && upd.data.label).toBe("Edited");
    expect(upd.ok && upd.data.active).toBe(false);
    expect(listTrackedLinks(T1).some((x) => x.slug === "edit-me")).toBe(true);
    expect(deleteTrackedLink(T1, l.data.id)).toBe(true);
    expect(listTrackedLinks(T1).some((x) => x.slug === "edit-me")).toBe(false);
  });
});
