import { all, row, run, tx, newId } from "@/lib/db/db";

/** Increment a tenant's usage counter for a metric+period, returning the new count. */
export function bumpUsage(tenantId: string, metric: string, amount = 1): number {
  const period = new Date().toISOString().slice(0, 7);
  const existing = row<{ used: number }>(
    "SELECT used FROM plans_usage WHERE tenant_id = ? AND metric = ? AND period = ?",
    tenantId,
    metric,
    period
  );
  if (!existing) {
    run(
      "INSERT INTO plans_usage (id, tenant_id, metric, period, used) VALUES (?, ?, ?, ?, ?)",
      newId("pu"),
      tenantId,
      metric,
      period,
      amount
    );
    return amount;
  }
  const next = existing.used + amount;
  run(
    "UPDATE plans_usage SET used = ? WHERE tenant_id = ? AND metric = ? AND period = ?",
    next,
    tenantId,
    metric,
    period
  );
  return next;
}

export function getUsage(tenantId: string, metric: string): number {
  const period = new Date().toISOString().slice(0, 7);
  const r = row<{ used: number }>(
    "SELECT used FROM plans_usage WHERE tenant_id = ? AND metric = ? AND period = ?",
    tenantId,
    metric,
    period
  );
  return r?.used ?? 0;
}

export function allUsage(tenantId: string): Record<string, number> {
  const rows = all<{ metric: string; used: number }>(
    "SELECT metric, used FROM plans_usage WHERE tenant_id = ? AND period = ?",
    tenantId,
    new Date().toISOString().slice(0, 7)
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.metric] = r.used;
  return out;
}

export function hasQuota(used: number, limit: number): boolean {
  return limit === -1 || used < limit;
}

/**
 * Take a metered unit *before* the work that spends money on it, and only if the
 * tenant is still within `limit`. Returns the new total, or null when the
 * reservation would exceed the limit.
 *
 * A `getUsage` + `hasQuota` + `bumpUsage` sequence is not equivalent to this,
 * even though it looks like it. `bumpUsage` reads, then writes, so two
 * concurrent requests against used=9 with limit=10 both read 9, both pass, both
 * call the provider, and both write 10. Two paid calls get metered as one credit
 * - which is the D-7 leak in a different costume. `tx()` issues BEGIN IMMEDIATE,
 * so the second caller waits for the first to commit and then reads 10 and is
 * refused.
 *
 * Consuming up front also means a provider outage costs the tenant nothing: the
 * caller refunds with `refundUsage` when the work fails.
 */
export function reserveUsage(tenantId: string, metric: string, limit: number, amount = 1): number | null {
  return tx(() => {
    const used = getUsage(tenantId, metric);
    if (limit !== -1 && used + amount > limit) return null;
    return bumpUsage(tenantId, metric, amount);
  });
}

/**
 * Hand back a reservation whose work failed, so an outage does not silently
 * consume a metered credit the tenant never received value for.
 *
 * Clamped at zero: a refund must never hand out credit the tenant did not pay
 * for, even if a reservation and its refund were somehow applied twice.
 */
export function refundUsage(tenantId: string, metric: string, amount = 1): number {
  const period = new Date().toISOString().slice(0, 7);
  return tx(() => {
    const existing = row<{ used: number }>(
      "SELECT used FROM plans_usage WHERE tenant_id = ? AND metric = ? AND period = ?",
      tenantId,
      metric,
      period
    );
    if (!existing) return 0;
    const next = Math.max(0, existing.used - amount);
    run(
      "UPDATE plans_usage SET used = ? WHERE tenant_id = ? AND metric = ? AND period = ?",
      next,
      tenantId,
      metric,
      period
    );
    return next;
  });
}