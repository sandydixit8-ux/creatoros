import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, nowIso } from "@/lib/db/db";
import { isPlatformAdmin, isVerifiedPlatformAdmin } from "./access";
import { setOrgPlan, planCursor, listFlags, checkFlag, setFlag, updateTicketStatus, listOpenTickets } from "./engine";

let dir: string;
const ADMIN = "usr_admin";
const TENANT = "org_admin_test";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-admin-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'AdminTest', 'admin-test', 'free', ?, ?)", TENANT, nowIso(), nowIso());
  run("INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, 'boss@platform.dev', 'x', 'Boss', ?, ?)", ADMIN, nowIso(), nowIso());
  run("INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES ('mem1', ?, ?, 'owner', ?)", TENANT, ADMIN, nowIso());
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("platform admin access", () => {
  it("matches emails from ADMIN_EMAILS case-insensitively", () => {
    process.env.ADMIN_EMAILS = "Boss@Platform.Dev";
    expect(isPlatformAdmin("boss@platform.dev")).toBe(true);
    expect(isPlatformAdmin("boss@platform.dev") && isPlatformAdmin("BOSS@platform.dev")).toBe(true);
    expect(isPlatformAdmin("nope@x.dev")).toBe(false);
  });

  it("denies everyone when ADMIN_EMAILS is unset", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isPlatformAdmin("boss@platform.dev")).toBe(false);
  });
});

describe("verified platform admin access", () => {
  it("requires both an allow-listed email and a verified mailbox", () => {
    process.env.ADMIN_EMAILS = "boss@platform.dev";
    expect(isVerifiedPlatformAdmin({ email: "boss@platform.dev", emailVerified: true })).toBe(true);
    expect(isVerifiedPlatformAdmin({ email: "boss@platform.dev", emailVerified: false })).toBe(false);
    expect(isVerifiedPlatformAdmin({ email: "nope@x.dev", emailVerified: true })).toBe(false);
  });
});

describe("admin engine", () => {
  it("changes an org plan and rejects unknown plans / orgs", () => {
    expect(setOrgPlan(ADMIN, TENANT, "creator").ok).toBe(true);
    expect(() => setOrgPlan(ADMIN, TENANT, "mega")).toThrow("invalid_plan");
    expect(() => setOrgPlan(ADMIN, "nope", "pro")).toThrow("org_not_found");
    expect(planCursor()).toContain("free");
    expect(planCursor()).toContain("business");
  });

  it("flips feature flags and defaults to on", () => {
    expect(checkFlag("maintenance")).toBe(true);
    setFlag(ADMIN, "maintenance", false);
    expect(checkFlag("maintenance")).toBe(false);
    setFlag(ADMIN, "maintenance", true);
    expect(checkFlag("maintenance")).toBe(true);
    expect(listFlags().some((f) => f.flag === "maintenance")).toBe(true);
  });

  it("lists tickets and updates status", () => {
    run("INSERT INTO support_tickets (id, tenant_id, user_id, subject, body, status, created_at) VALUES ('tkt1', ?, ?, 'Bug', 'It broke', 'open', ?)", TENANT, ADMIN, nowIso());
    run("INSERT INTO support_tickets (id, tenant_id, user_id, subject, body, status, created_at) VALUES ('tkt2', ?, ?, 'Done', 'wrapped', 'resolved', ?)", TENANT, ADMIN, nowIso());
    const open = listOpenTickets();
    expect(open.length).toBe(1);
    expect(open[0].subject).toBe("Bug");
    expect(updateTicketStatus(ADMIN, "tkt1", "resolved").ok).toBe(true);
    expect(listOpenTickets().length).toBe(0);
    expect(() => updateTicketStatus(ADMIN, "tkt1", "bogus")).toThrow("invalid_status");
    expect(() => updateTicketStatus(ADMIN, "missing", "open")).toThrow("ticket_not_found");
  });
});