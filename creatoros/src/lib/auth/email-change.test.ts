import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, row, newId, nowIso } from "@/lib/db/db";
import { confirmEmailChange, createEmailChange, hashChangeToken } from "./email-change";

let dir: string;

function seedUser(): { id: string; email: string } {
  const id = newId("usr");
  const email = `change-${id}@example.com`;
  run(
    "INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, 'x:y', '', ?, ?)",
    id,
    email,
    nowIso(),
    nowIso()
  );
  return { id, email };
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-email-change-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  run("DELETE FROM email_change_requests");
});

describe("email change requests", () => {
  it("stores only token hashes, never the raw tokens", () => {
    const { id, email } = seedUser();
    const change = createEmailChange(id, email, "new@example.com");
    expect(change.currentToken).not.toBe(change.newToken);

    const stored = row<{ current_token_hash: string; new_token_hash: string }>(
      "SELECT current_token_hash, new_token_hash FROM email_change_requests WHERE user_id = ?",
      id
    );
    expect(stored!.current_token_hash).toBe(hashChangeToken(change.currentToken));
    expect(stored!.new_token_hash).toBe(hashChangeToken(change.newToken));
    expect(stored!.current_token_hash).not.toBe(change.currentToken);
  });

  it("does not move the email until both sides have confirmed", () => {
    const { id, email } = seedUser();
    const change = createEmailChange(id, email, "new@example.com");

    const first = confirmEmailChange(change.currentToken);
    expect(first).toMatchObject({ applied: false, side: "current" });
    expect(row<{ email: string }>("SELECT email FROM users WHERE id = ?", id)!.email).toBe(email);

    const second = confirmEmailChange(change.newToken);
    expect(second).toMatchObject({ applied: true, side: "new" });
    expect(row<{ email: string }>("SELECT email FROM users WHERE id = ?", id)!.email).toBe("new@example.com");
  });

  it("marks the new address verified and bumps auth_version when it lands", () => {
    const { id, email } = seedUser();
    const before = row<{ auth_version: number }>("SELECT auth_version FROM users WHERE id = ?", id)!.auth_version;

    const change = createEmailChange(id, email, "moved@example.com");
    confirmEmailChange(change.newToken);
    confirmEmailChange(change.currentToken);

    const after = row<{ email: string; email_verified: number; auth_version: number }>(
      "SELECT email, email_verified, auth_version FROM users WHERE id = ?",
      id
    );
    expect(after!.email).toBe("moved@example.com");
    expect(after!.email_verified).toBe(1);
    expect(after!.auth_version).toBe(before + 1);
  });

  it("refuses to replay a link once the change has applied", () => {
    const { id, email } = seedUser();
    const change = createEmailChange(id, email, "replay@example.com");
    confirmEmailChange(change.currentToken);
    expect(confirmEmailChange(change.newToken)?.applied).toBe(true);

    // Both links are now spent.
    expect(confirmEmailChange(change.currentToken)).toBeNull();
    expect(confirmEmailChange(change.newToken)).toBeNull();
  });

  it("reports a repeated click on an already-confirmed side", () => {
    const { id, email } = seedUser();
    const change = createEmailChange(id, email, "new@example.com");
    confirmEmailChange(change.currentToken);
    const again = confirmEmailChange(change.currentToken);
    expect(again).toMatchObject({ applied: false, side: "current", alreadyConfirmed: true });
  });

  it("rejects an expired request", () => {
    const { id, email } = seedUser();
    const change = createEmailChange(id, email, "new@example.com");
    run("UPDATE email_change_requests SET expires_at = ? WHERE user_id = ?", new Date(Date.now() - 1000).toISOString(), id);
    expect(confirmEmailChange(change.currentToken)).toBeNull();
  });

  it("retires an earlier pending request when a new one is started", () => {
    const { id, email } = seedUser();
    const first = createEmailChange(id, email, "one@example.com");
    const second = createEmailChange(id, email, "two@example.com");
    expect(confirmEmailChange(first.currentToken)).toBeNull();
    expect(confirmEmailChange(second.currentToken)).toMatchObject({ side: "current" });
  });

  it("rejects a garbage or empty token", () => {
    expect(confirmEmailChange("nope")).toBeNull();
    expect(confirmEmailChange("")).toBeNull();
  });
});
