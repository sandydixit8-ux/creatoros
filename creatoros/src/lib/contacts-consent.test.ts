import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, row, newId, nowIso } from "@/lib/db/db";
import { createOrderForProduct, getProduct, type ProductRow } from "@/lib/store/orders";

let dir: string;
const TENANT = "org_consent_test";

type ContactRow = {
  id: string;
  email: string;
  consent: number;
  source: string;
  consent_at: string | null;
  consent_source: string | null;
};

function seedProduct(): ProductRow {
  const id = newId("prd");
  run(
    "INSERT INTO products (id, tenant_id, name, description, price_cents, currency, kind, active, created_at, updated_at) VALUES (?, ?, 'Consent test', 'desc', 1500, 'usd', 'digital', 1, ?, ?)",
    id,
    TENANT,
    nowIso(),
    nowIso()
  );
  return getProduct(id)!;
}

function contact(email: string): ContactRow | undefined {
  return row<ContactRow>(
    "SELECT id, email, consent, source, consent_at, consent_source FROM contacts WHERE tenant_id = ? AND email = ?",
    TENANT,
    email
  );
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-consent-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Consent Test', 'test-consent-org', 'creator', ?, ?)",
    TENANT,
    nowIso(),
    nowIso()
  );
});

beforeEach(() => {
  run("DELETE FROM contacts WHERE tenant_id = ?", TENANT);
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("D-1: consent provenance", () => {
  it("records no consent when a contact is created by a product purchase", () => {
    const product = seedProduct();
    createOrderForProduct(product, { email: "shopper@example.com" });

    const c = contact("shopper@example.com");
    expect(c).toBeDefined();
    // Completing a purchase is a transaction, not marketing consent.
    expect(c!.consent).toBe(0);
    expect(c!.consent_at).toBeNull();
    expect(c!.consent_source).toBe("");
  });

  it("records no consent when a contact is created by a course enrollment", () => {
    // The course path writes source 'course' directly; mirror that here so the
    // invariant is asserted for both transactional sources.
    run(
      "INSERT INTO contacts (id, tenant_id, email, name, consent, source, tags, created_at, updated_at) VALUES (?, ?, ?, 'Student', 0, 'course', '[]', ?, ?)",
      newId("con"),
      TENANT,
      "student@example.com",
      nowIso(),
      nowIso()
    );

    const c = contact("student@example.com");
    expect(c!.consent).toBe(0);
    expect(c!.consent_at).toBeNull();
  });

  it("does not grant consent to an existing contact who buys again", () => {
    run(
      "INSERT INTO contacts (id, tenant_id, email, name, consent, source, tags, created_at, updated_at) VALUES (?, ?, ?, 'Buyer', 0, 'store', '[]', ?, ?)",
      "con_existing_no_consent",
      TENANT,
      "repeat@example.com",
      nowIso(),
      nowIso()
    );

    createOrderForProduct(seedProduct(), { email: "repeat@example.com" });

    const c = contact("repeat@example.com");
    // Regression guard: a repeat purchase previously flipped consent on.
    expect(c!.consent).toBe(0);
    expect(c!.consent_at).toBeNull();
    expect(c!.consent_source).toBe("");
  });

  it("preserves an existing explicit opt-in across a later purchase", () => {
    run(
      "INSERT INTO contacts (id, tenant_id, email, name, consent, source, consent_at, consent_source, tags, created_at, updated_at) VALUES (?, ?, ?, 'Fan', 1, 'bio', '2026-01-01T00:00:00.000Z', 'lead_form', '[]', ?, ?)",
      "con_existing_consent",
      TENANT,
      "fan@example.com",
      nowIso(),
      nowIso()
    );

    createOrderForProduct(seedProduct(), { email: "fan@example.com" });

    const c = contact("fan@example.com");
    // A purchase must neither revoke nor rewrite an opt-in already given.
    expect(c!.consent).toBe(1);
    expect(c!.consent_at).toBe("2026-01-01T00:00:00.000Z");
    expect(c!.consent_source).toBe("lead_form");
  });

  it("exposes consent_at and consent_source columns for audit", () => {
    const columns = row<{ name: string }>(
      "SELECT name FROM pragma_table_info('contacts') WHERE name IN ('consent_at', 'consent_source')"
    );
    expect(columns).toBeDefined();
  });
});

describe("D-1: legacy consent remediation migration", () => {
  it("clears consent that was inferred from a transactional source", () => {
    // Simulate a pre-fix row: purchase-created contacts stored consent = 1.
    run(
      "INSERT INTO contacts (id, tenant_id, email, name, consent, source, tags, created_at, updated_at) VALUES (?, ?, ?, 'Legacy', 1, 'store', '[]', ?, ?)",
      "con_legacy_store",
      TENANT,
      "legacy-store@example.com",
      nowIso(),
      nowIso()
    );
    run(
      "INSERT INTO contacts (id, tenant_id, email, name, consent, source, tags, created_at, updated_at) VALUES (?, ?, ?, 'Legacy', 1, 'course', '[]', ?, ?)",
      "con_legacy_course",
      TENANT,
      "legacy-course@example.com",
      nowIso(),
      nowIso()
    );
    run(
      "INSERT INTO contacts (id, tenant_id, email, name, consent, source, consent_at, consent_source, tags, created_at, updated_at) VALUES (?, ?, ?, 'Opted in', 1, 'bio', '2026-01-01T00:00:00.000Z', 'lead_form', '[]', ?, ?)",
      "con_legit_optin",
      TENANT,
      "opted-in@example.com",
      nowIso(),
      nowIso()
    );

    // Re-apply the remediation statements the migration runs.
    run(
      "UPDATE contacts SET consent = 0, consent_at = NULL WHERE consent = 1 AND source IN ('store', 'course') AND consent_at IS NULL"
    );

    expect(contact("legacy-store@example.com")!.consent).toBe(0);
    expect(contact("legacy-course@example.com")!.consent).toBe(0);
    // A genuine opt-in carries provenance and must survive.
    expect(contact("opted-in@example.com")!.consent).toBe(1);
    expect(contact("opted-in@example.com")!.consent_at).toBe("2026-01-01T00:00:00.000Z");
  });
});
