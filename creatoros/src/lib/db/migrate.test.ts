import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "./db";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-migrate-test-"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("migrate", () => {
  // Regression test for the 2026-10-31 deploy: schema.sql is executed before
  // migrations, so anything in it that references a column added by a migration
  // makes the whole schema exec fail on an existing database. That is exactly
  // how a CREATE INDEX on utm_source took the app to a 503.
  it("upgrades a pre-25 site_visits table without aborting the schema exec", () => {
    const db = new DatabaseSync(join(dir, "old.db"));
    db.exec(`
      CREATE TABLE site_visits (
        id         TEXT PRIMARY KEY,
        path       TEXT NOT NULL,
        country    TEXT NOT NULL DEFAULT '',
        device     TEXT NOT NULL DEFAULT '',
        ref        TEXT NOT NULL DEFAULT '',
        visitor_id TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )
    `);
    db.exec(
      "INSERT INTO site_visits (id, path, country, device, ref, visitor_id, created_at) " +
        "VALUES ('sv1', '/', 'US', 'desktop', '', 'v1', '2026-10-30T00:00:00.000Z')"
    );

    expect(() => migrate(db)).not.toThrow();

    const cols = (db.prepare("PRAGMA table_info(site_visits)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain("utm_source");
    expect(cols).toContain("utm_campaign");

    // The existing row is preserved and reads as untagged.
    const row = db.prepare("SELECT utm_source, utm_campaign FROM site_visits WHERE id = 'sv1'").get() as {
      utm_source: string;
      utm_campaign: string;
    };
    expect(row.utm_source).toBe("");
    expect(row.utm_campaign).toBe("");

    const applied = db.prepare("SELECT COUNT(*) AS c FROM _migrations WHERE id = 25").get() as { c: number };
    expect(applied.c).toBe(1);

    db.close();
  });
});
