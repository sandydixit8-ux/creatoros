import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, row, newId, nowIso } from "@/lib/db/db";
import {
  hashVerifyToken,
  createVerifyToken,
  resolveVerifyToken,
  consumeVerifyToken,
  revokeVerifyTokens,
} from "./email-verify";

let dir: string;

function seedUser(): string {
  const id = newId("usr");
  run(
    "INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES (?, ?, 'x:y', '', 'user', ?, ?)",
    id,
    `verify-${id}@example.com`,
    nowIso(),
    nowIso()
  );
  return id;
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-verify-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  run("DELETE FROM email_verify_tokens");
});

describe("email verification tokens", () => {
  it("never stores the raw token, only its hash", () => {
    const userId = seedUser();
    const created = createVerifyToken(userId);
    expect(created).not.toBeNull();

    const stored = row<{ token_hash: string }>("SELECT token_hash FROM email_verify_tokens WHERE user_id = ?", userId);
    expect(stored).toBeDefined();
    expect(stored!.token_hash).toBe(hashVerifyToken(created!.token));
    expect(stored!.token_hash).not.toBe(created!.token);
  });

  it("resolves a fresh token to its user", () => {
    const userId = seedUser();
    const created = createVerifyToken(userId)!;
    expect(resolveVerifyToken(created.token)?.userId).toBe(userId);
  });

  it("rejects a garbage or missing token", () => {
    expect(resolveVerifyToken("not-a-real-token")).toBeNull();
    expect(resolveVerifyToken("")).toBeNull();
  });

  it("consuming a token marks the account verified", () => {
    const userId = seedUser();
    const created = createVerifyToken(userId)!;
    expect(consumeVerifyToken(created.token)?.userId).toBe(userId);
    const user = row<{ email_verified: number }>("SELECT email_verified FROM users WHERE id = ?", userId);
    expect(user!.email_verified).toBe(1);
  });

  it("consumes a token once so a replay cannot re-verify", () => {
    const userId = seedUser();
    const created = createVerifyToken(userId)!;
    expect(consumeVerifyToken(created.token)).not.toBeNull();
    expect(consumeVerifyToken(created.token)).toBeNull();
  });

  it("rejects an expired token and does not mark the account verified", () => {
    const userId = seedUser();
    const created = createVerifyToken(userId)!;
    run("UPDATE email_verify_tokens SET expires_at = ? WHERE user_id = ?", new Date(Date.now() - 1000).toISOString(), userId);
    expect(resolveVerifyToken(created.token)).toBeNull();
    expect(consumeVerifyToken(created.token)).toBeNull();
    const user = row<{ email_verified: number }>("SELECT email_verified FROM users WHERE id = ?", userId);
    expect(user!.email_verified).toBe(0);
  });

  it("revokeVerifyTokens kills outstanding links", () => {
    const userId = seedUser();
    const created = createVerifyToken(userId)!;
    revokeVerifyTokens(userId);
    expect(resolveVerifyToken(created.token)).toBeNull();
  });

  it("returns null for an unknown user rather than a dangling token", () => {
    expect(createVerifyToken("usr_missing")).toBeNull();
  });

  it("caps how many live links one account can hold", () => {
    const userId = seedUser();
    for (let i = 0; i < 6; i++) createVerifyToken(userId);
    const count = row<{ n: number }>("SELECT COUNT(*) AS n FROM email_verify_tokens WHERE user_id = ? AND used_at IS NULL", userId);
    expect(count!.n).toBeLessThanOrEqual(3);
  });
});
