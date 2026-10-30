import { all, row, run, newId, nowIso, type SQLParam } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { PLANS, PLAN_PRICES, type PriceCurrency } from "@/lib/plans";
import { mergeAmounts, mrrMovement, type MrrMovement } from "@/lib/analytics/money";
import { normalizeCurrency, type MoneyAmount } from "@/lib/money-format";

export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  members: number;
  created_at: string;
}

export interface AdminFlag {
  id: string;
  flag: string;
  enabled: boolean;
}

export interface AdminTicket {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  email?: string;
}

export const VALID_TICKET_STATUSES = ["open", "pending", "resolved", "closed"];

export function listOrgs(): AdminOrg[] {
  return all<AdminOrg>(
    `SELECT o.id, o.name, o.slug, o.plan, o.created_at,
            (SELECT COUNT(*) FROM memberships m WHERE m.tenant_id = o.id) AS members
     FROM organizations o ORDER BY o.created_at DESC`
  );
}

export function setOrgPlan(adminUserId: string, orgId: string, plan: string): { ok: boolean } {
  if (!(plan in PLANS)) throw new Error("invalid_plan");
  const org = row<{ id: string; plan: string }>("SELECT id, plan FROM organizations WHERE id = ?", orgId);
  if (!org) throw new Error("org_not_found");
  run("UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ?", plan, nowIso(), orgId);
  audit({ tenantId: orgId, userId: adminUserId, action: "admin.plan_change", resource: orgId, meta: { from: org.plan, to: plan } });
  return { ok: true };
}

export function planCursor(): string[] {
  return Object.keys(PLANS);
}

export function listFlags(): AdminFlag[] {
  return all<AdminFlag>("SELECT id, flag, enabled FROM feature_flags ORDER BY flag").map((f) => ({ ...f, enabled: !!f.enabled }));
}

export function checkFlag(flag: string): boolean {
  const r = row<{ enabled: number }>("SELECT enabled FROM feature_flags WHERE flag = ?", flag);
  return r === undefined ? true : !!r.enabled;
}

export function setFlag(adminUserId: string, flag: string, enabled: boolean): { ok: boolean } {
  const existing = row<{ id: string }>("SELECT id FROM feature_flags WHERE flag = ?", flag);
  if (existing) {
    run("UPDATE feature_flags SET enabled = ? WHERE id = ?", enabled ? 1 : 0, existing.id);
  } else {
    run("INSERT INTO feature_flags (id, flag, enabled) VALUES (?, ?, ?)", newId("flg"), flag, enabled ? 1 : 0);
  }
  audit({ tenantId: "_platform", userId: adminUserId, action: "admin.flag_change", resource: flag, meta: { enabled } });
  return { ok: true };
}

export function listOpenTickets(): AdminTicket[] {
  return all<AdminTicket>(
    `SELECT t.id, t.subject, t.body, t.status, t.created_at, u.email
     FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id
     WHERE t.status IN ('open', 'pending') ORDER BY t.created_at DESC LIMIT 200`
  );
}

export function updateTicketStatus(adminUserId: string, id: string, status: string): { ok: boolean } {
  if (!VALID_TICKET_STATUSES.includes(status)) throw new Error("invalid_status");
  const found = row<{ id: string }>("SELECT id FROM support_tickets WHERE id = ?", id);
  if (!found) throw new Error("ticket_not_found");
  run("UPDATE support_tickets SET status = ? WHERE id = ?", status, id);
  audit({ tenantId: "_platform", userId: adminUserId, action: "admin.ticket_update", resource: id, meta: { status } });
  return { ok: true };
}

// --- Platform-wide reporting -------------------------------------------------
// The tenant-scoped helpers in lib/analytics/money.ts take a single workspace.
// An admin needs the same figures summed across every workspace, so these
// variants drop the tenant filter. Amounts are never converted between
// currencies — USD and INR are reported side by side (see formatMoneyBreakdown).

function finalizeAmounts(totals: Map<string, number>): MoneyAmount[] {
  return [...totals.entries()]
    .filter(([, cents]) => cents !== 0)
    .map(([currency, cents]) => ({ currency, cents }))
    .sort((a, b) => b.cents - a.cents || a.currency.localeCompare(b.currency));
}

function groupCurrency(sql: string, ...params: SQLParam[]): MoneyAmount[] {
  const totals = new Map<string, number>();
  for (const r of all<{ currency: string; c: number | string }>(sql, ...params)) {
    const currency = normalizeCurrency(r.currency);
    totals.set(currency, (totals.get(currency) ?? 0) + Number(r.c ?? 0));
  }
  return finalizeAmounts(totals);
}

function countOf(sql: string): number {
  return Number(all<{ c: number | string }>(sql)[0]?.c ?? 0);
}

export interface AdminRevenue {
  mrr: MoneyAmount[];
  /** Net revenue for the window (`net`). Kept for existing callers. */
  period: MoneyAmount[];
  lifeTime: MoneyAmount[];
  /** Collected before refunds. */
  gross: MoneyAmount[];
  /** Returned to customers in the window (positive magnitude). */
  refunds: MoneyAmount[];
  /** Collected minus refunds. */
  net: MoneyAmount[];
  /** New / expansion / contraction / churned MRR for the same window. */
  movement: MrrMovement;
  activeSubscriptions: number;
  paidOrders: number;
}

/** Recurring revenue from active paid subscriptions across every workspace. */
export function platformMrr(): MoneyAmount[] {
  const totals = new Map<string, number>();
  for (const s of all<{ plan: string; currency: string }>(
    "SELECT plan, currency FROM subscriptions WHERE status = 'active' AND plan != 'free'"
  )) {
    const currency = normalizeCurrency(s.currency);
    const price = PLAN_PRICES[s.plan]?.[currency as PriceCurrency];
    if (typeof price !== "number") continue;
    totals.set(currency, (totals.get(currency) ?? 0) + price * 100);
  }
  return finalizeAmounts(totals);
}

export function platformRevenue(days = 30): AdminRevenue {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  // Payments attached to an order are already represented by that order row;
  // counting both is what doubled every store sale in this report.
  const standalonePayments = (clause: string, ...params: string[]) =>
    groupCurrency(
      `SELECT currency, COALESCE(SUM(amount_cents), 0) AS c FROM payments
       WHERE status IN ('succeeded', 'refunded') AND COALESCE(order_id, '') = '' ${clause}
       GROUP BY currency`,
      ...params
    );
  const net = mergeAmounts(
    groupCurrency(
      "SELECT currency, COALESCE(SUM(amount_cents - COALESCE(refunded_cents, 0)), 0) AS c FROM orders WHERE status = 'paid' AND created_at >= ? GROUP BY currency",
      since
    ),
    standalonePayments("AND status = 'succeeded' AND created_at >= ?", since)
  );
  return {
    mrr: platformMrr(),
    period: net,
    lifeTime: mergeAmounts(
      groupCurrency(
        "SELECT currency, COALESCE(SUM(amount_cents - COALESCE(refunded_cents, 0)), 0) AS c FROM orders WHERE status = 'paid' GROUP BY currency"
      ),
      standalonePayments("AND status = 'succeeded'")
    ),
    gross: mergeAmounts(
      groupCurrency(
        "SELECT currency, COALESCE(SUM(amount_cents), 0) AS c FROM orders WHERE status IN ('paid', 'refunded') AND created_at >= ? GROUP BY currency",
        since
      ),
      standalonePayments("AND created_at >= ?", since)
    ),
    refunds: groupCurrency(
      "SELECT currency, COALESCE(SUM(amount_cents), 0) AS c FROM refunds WHERE status = 'succeeded' AND created_at >= ? GROUP BY currency",
      since
    ),
    net,
    movement: mrrMovement({ days }),
    activeSubscriptions: countOf("SELECT COUNT(*) AS c FROM subscriptions WHERE status = 'active' AND plan != 'free'"),
    paidOrders: countOf("SELECT COUNT(*) AS c FROM orders WHERE status = 'paid'"),
  };
}

export interface AdminOrder {
  id: string;
  tenant_id: string;
  org_name: string | null;
  email: string;
  status: string;
  amount_cents: number;
  refunded_cents: number;
  currency: string;
  provider: string;
  created_at: string;
  has_pending_refund: boolean;
}

export function listOrders(limit = 100): AdminOrder[] {
  const capped = Math.min(Math.max(limit, 1), 500);
  return all<Omit<AdminOrder, "has_pending_refund"> & { has_pending_refund: number }>(
    `SELECT o.id, o.tenant_id, org.name AS org_name, o.email, o.status, o.amount_cents,
            o.refunded_cents, o.currency, o.provider, o.created_at,
            EXISTS(SELECT 1 FROM refunds r WHERE r.order_id = o.id AND r.status = 'pending') AS has_pending_refund
     FROM orders o LEFT JOIN organizations org ON org.id = o.tenant_id
     ORDER BY o.created_at DESC LIMIT ?`,
    capped
  ).map((o) => ({ ...o, has_pending_refund: !!o.has_pending_refund }));
}

export interface AdminAuditEntry {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  action: string;
  resource: string;
  meta: string;
  ip: string;
  created_at: string;
  email: string | null;
}

export function listAudit(opts: { action?: string; tenantId?: string; limit?: number } = {}): AdminAuditEntry[] {
  const where: string[] = [];
  const params: SQLParam[] = [];
  if (opts.action) {
    where.push("a.action LIKE ?");
    params.push(`%${opts.action}%`);
  }
  if (opts.tenantId) {
    where.push("a.tenant_id = ?");
    params.push(opts.tenantId);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(Math.min(Math.max(opts.limit ?? 100, 1), 500));
  return all<AdminAuditEntry>(
    `SELECT a.id, a.tenant_id, a.user_id, a.action, a.resource, a.meta, a.ip, a.created_at, u.email
     FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
     ${clause}
     ORDER BY a.created_at DESC LIMIT ?`,
    ...params
  );
}