import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, row, nowIso } from "@/lib/db/db";
import {
  exportAccountData,
  deleteOrganization,
  leaveOrganization,
  type AccountExport,
} from "./gdpr";

let dir: string;
const TENANT = "org_gdpr_a";
const TENANT_B = "org_gdpr_b";
const OWNER = "usr_gdpr_owner";
const COWORKER = "usr_gdpr_coworker";
const SOLE = "usr_gdpr_sole";

function seedOrg(id: string, slug: string) {
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, ?, ?, 'free', ?, ?)",
    id,
    `Org ${slug}`,
    slug,
    nowIso(),
    nowIso()
  );
}

function seedUser(id: string, email: string) {
  run(
    "INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES (?, ?, 'hash', ?, 'user', ?, ?)",
    id,
    email,
    id,
    nowIso(),
    nowIso()
  );
}

function seedMembership(id: string, tenantId: string, userId: string, role: string) {
  run(
    "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
    id,
    tenantId,
    userId,
    role,
    nowIso()
  );
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-gdpr-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();

  seedOrg(TENANT, "gdpr-a");
  seedOrg(TENANT_B, "gdpr-b");
  seedUser(OWNER, "owner@example.com");
  seedUser(COWORKER, "coworker@example.com");
  seedUser(SOLE, "sole@example.com");
});

beforeEach(() => {
  run("DELETE FROM organizations");
  run("DELETE FROM users");
  seedOrg(TENANT, "gdpr-a");
  seedOrg(TENANT_B, "gdpr-b");
  seedUser(OWNER, "owner@example.com");
  seedUser(COWORKER, "coworker@example.com");
  seedUser(SOLE, "sole@example.com");
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("account GDPR export", () => {
  it("exports org, user and tenant tables without password hashes", () => {
    seedMembership("mem_x", TENANT, OWNER, "owner");
    run(
      "INSERT INTO contacts (id, tenant_id, email, name, consent, source, created_at, updated_at) VALUES (?, ?, 'lead@example.com', 'Lead', 1, 'test', ?, ?)",
      "con_gdpr_1",
      TENANT,
      nowIso(),
      nowIso()
    );

    const data = exportAccountData(TENANT, OWNER) as AccountExport;

    expect((data.organization as { id: string }).id).toBe(TENANT);
    expect((data.user as { email: string }).email).toBe("owner@example.com");
    expect(Object.keys(data.user as object)).not.toContain("password_hash");
    expect(JSON.stringify(data)).not.toContain("password_hash");
    expect(data.memberships as unknown[]).toHaveLength(1);
    expect(data.contacts as unknown[]).toHaveLength(1);
    expect(data.courses as unknown[]).toEqual([]);
  });
});

describe("deleteOrganization (D-2: workspace deletion)", () => {
  it("removes the workspace and its tenant data", () => {
    seedMembership("mem_1", TENANT, OWNER, "owner");
    seedMembership("mem_2", TENANT, COWORKER, "editor");
    run(
      "INSERT INTO contacts (id, tenant_id, email, name, consent, source, created_at, updated_at) VALUES (?, ?, 'lead@example.com', 'Lead', 1, 'test', ?, ?)",
      "con_gdpr_1",
      TENANT,
      nowIso(),
      nowIso()
    );
    run(
      "INSERT INTO audit_logs (id, tenant_id, user_id, action, created_at) VALUES (?, ?, ?, 'test', ?)",
      "aud_gdpr_1",
      TENANT,
      OWNER,
      nowIso()
    );

    deleteOrganization(TENANT, OWNER);

    expect(row("SELECT id FROM organizations WHERE id = ?", TENANT)).toBeUndefined();
    expect(row("SELECT id FROM contacts WHERE id = ?", "con_gdpr_1")).toBeUndefined();
    expect(row("SELECT id FROM audit_logs WHERE id = ?", "aud_gdpr_1")).toBeUndefined();
    expect(row("SELECT id FROM memberships WHERE id = ?", "mem_2")).toBeUndefined();
  });

  it("does NOT delete the user identity or the user's other workspaces", () => {
    // Regression: the old deleteAccountData removed the user row outright, which
    // cascaded to every membership that user held in other workspaces.
    seedMembership("mem_1", TENANT, OWNER, "owner");
    seedMembership("mem_3", TENANT_B, OWNER, "admin");
    seedMembership("mem_4", TENANT_B, COWORKER, "owner");

    deleteOrganization(TENANT, OWNER);

    expect(row("SELECT id FROM users WHERE id = ?", OWNER)).toBeDefined();
    expect(row("SELECT id FROM memberships WHERE id = ?", "mem_3")).toBeDefined();
    expect(row("SELECT id FROM memberships WHERE id = ?", "mem_4")).toBeDefined();
    expect(row("SELECT id FROM organizations WHERE id = ?", TENANT_B)).toBeDefined();
  });
});

describe("leaveOrganization (D-2: membership deletion)", () => {
  it("removes only the caller's membership and preserves tenant data", () => {
    seedMembership("mem_1", TENANT, OWNER, "owner");
    seedMembership("mem_2", TENANT, COWORKER, "editor");
    // The leaver belongs to a second workspace, so their identity must survive.
    seedMembership("mem_5", TENANT_B, COWORKER, "admin");
    run(
      "INSERT INTO contacts (id, tenant_id, email, name, consent, source, created_at, updated_at) VALUES (?, ?, 'lead@example.com', 'Lead', 1, 'test', ?, ?)",
      "con_gdpr_1",
      TENANT,
      nowIso(),
      nowIso()
    );

    const result = leaveOrganization(TENANT, COWORKER);

    expect(result.removedMembership).toBe(true);
    expect(result.userDeleted).toBe(false);
    expect(row("SELECT id FROM memberships WHERE id = ?", "mem_2")).toBeUndefined();
    // Co-workers and workspace data must survive.
    expect(row("SELECT id FROM memberships WHERE id = ?", "mem_1")).toBeDefined();
    expect(row("SELECT id FROM contacts WHERE id = ?", "con_gdpr_1")).toBeDefined();
    expect(row("SELECT id FROM organizations WHERE id = ?", TENANT)).toBeDefined();
    expect(row("SELECT id FROM users WHERE id = ?", COWORKER)).toBeDefined();
  });

  it("reports a remaining workspace so the session can be re-pointed", () => {
    seedMembership("mem_1", TENANT, OWNER, "owner");
    seedMembership("mem_3", TENANT_B, OWNER, "admin");

    const result = leaveOrganization(TENANT, OWNER);

    expect(result.remainingOrgs).toBe(1);
    expect(result.nextOrgId).toBe(TENANT_B);
    expect(result.userDeleted).toBe(false);
  });

  it("erases the identity and its sessions when the last workspace is left", () => {
    seedMembership("mem_solo", TENANT, SOLE, "owner");
    run(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, 'tok', ?, ?)",
      "ses_gdpr_1",
      SOLE,
      nowIso(),
      nowIso()
    );

    const result = leaveOrganization(TENANT, SOLE);

    expect(result.userDeleted).toBe(true);
    expect(result.nextOrgId).toBeNull();
    expect(row("SELECT id FROM users WHERE id = ?", SOLE)).toBeUndefined();
    expect(row("SELECT id FROM sessions WHERE id = ?", "ses_gdpr_1")).toBeUndefined();
    // The workspace itself is untouched: a sole member leaving is not a
    // workspace deletion.
    expect(row("SELECT id FROM organizations WHERE id = ?", TENANT)).toBeDefined();
  });
});