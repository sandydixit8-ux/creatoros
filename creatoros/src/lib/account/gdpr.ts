import { all, run, row, tx, nowIso } from "@/lib/db/db";

// Tenant-scoped tables (all carry tenant_id) exported for data portability.
const TENANT_TABLES = [
  "memberships",
  "subscriptions",
  "plans_usage",
  "profiles",
  "bio_pages",
  "bio_blocks",
  "products",
  "services",
  "availability_windows",
  "contacts",
  "bookings",
  "analytics_events",
  "email_lists",
  "email_list_members",
  "email_templates",
  "email_campaigns",
  "email_sends",
  "unsubscribes",
  "communities",
  "posts",
  "automation_workflows",
  "notifications",
  "payments",
  "orders",
  "order_items",
  "courses",
  "course_sections",
  "lessons",
  "enrollments",
  "lesson_progress",
  "audit_logs",
  "support_tickets",
];

export type AccountExport = Record<string, unknown>;

export function exportAccountData(tenantId: string, userId: string): AccountExport {
  const data: AccountExport = { exportedAt: nowIso() };
  data.organization = row(
    "SELECT id, name, slug, plan, trial_ends, settings, created_at, updated_at FROM organizations WHERE id = ?",
    tenantId
  );
  data.user = row(
    "SELECT id, email, name, role, email_verified, created_at, updated_at FROM users WHERE id = ?",
    userId
  );
  for (const table of TENANT_TABLES) {
    data[table] = all(`SELECT * FROM ${table} WHERE tenant_id = ?`, tenantId);
  }
  return data;
}

export type LeaveOrgResult = {
  removedMembership: boolean;
  userDeleted: boolean;
  remainingOrgs: number;
  /** A workspace the user still belongs to, so the caller can re-point the session. */
  nextOrgId: string | null;
};

/**
 * Remove the acting user from a workspace without touching anyone else's data.
 *
 * Deleting an account and deleting the organisation are different acts with
 * different blast radii. "Delete my account" previously ran
 * `DELETE FROM organizations`, which cascaded to every tenant table and
 * destroyed co-workers' contacts, orders, bookings and courses. Any member
 * could trigger it, because the route only checked that a session existed.
 */
export function leaveOrganization(tenantId: string, userId: string): LeaveOrgResult {
  return tx(() => {
    const membership = row<{ id: string }>(
      "SELECT id FROM memberships WHERE tenant_id = ? AND user_id = ?",
      tenantId,
      userId
    );
    if (membership) run("DELETE FROM memberships WHERE id = ?", membership.id);

    const remaining = row<{ c: number }>(
      "SELECT COUNT(*) AS c FROM memberships WHERE user_id = ?",
      userId
    );
    const remainingOrgs = Number(remaining?.c ?? 0);
    const next = row<{ tenant_id: string }>(
      "SELECT tenant_id FROM memberships WHERE user_id = ? ORDER BY created_at ASC LIMIT 1",
      userId
    );

    let userDeleted = false;
    if (remainingOrgs === 0) {
      // No other workspace holds this identity, so the user record itself can go.
      run("DELETE FROM sessions WHERE user_id = ?", userId);
      run("DELETE FROM users WHERE id = ?", userId);
      userDeleted = true;
    }

    return {
      removedMembership: Boolean(membership),
      userDeleted,
      remainingOrgs,
      nextOrgId: userDeleted ? null : (next?.tenant_id ?? null),
    };
  });
}

/**
 * Irreversibly delete an entire workspace. Owner-only — callers must enforce
 * that before invoking this.
 */
export function deleteOrganization(tenantId: string, actorUserId: string): void {
  tx(() => {
    // Tables without a tenant FK are scrubbed first so the trail outlives the
    // tenant rows they reference.
    run("DELETE FROM audit_logs WHERE tenant_id = ? OR user_id = ?", tenantId, actorUserId);
    run("DELETE FROM support_tickets WHERE tenant_id = ? OR user_id = ?", tenantId, actorUserId);
    run("DELETE FROM memberships WHERE tenant_id = ?", tenantId);
    // organizations cascades to every tenant table (ON DELETE CASCADE).
    run("DELETE FROM organizations WHERE id = ?", tenantId);
  });
}