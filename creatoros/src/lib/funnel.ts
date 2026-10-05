import { all, row, run, newId, nowIso } from "@/lib/db/db";

/**
 * Platform-side acquisition funnel: signup -> activation -> checkout -> paid.
 *
 * This is deliberately a separate table from `analytics_events` (see the comment
 * in schema.sql): analytics_events is consent-gated visitor tracking shown to the
 * creator, while this is our own view of how people become paying accounts. The
 * two have different readers, different retention rules and different consent
 * questions, and folding them together would leak internal steps into customer
 * dashboards.
 */

export const FUNNEL_STEPS = [
  "signup_completed",
  "activation_reached",
  "checkout_started",
  "purchase_completed",
  "subscription_canceled",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export interface FunnelEventInput {
  step: FunnelStep;
  tenantId?: string;
  userId?: string;
  plan?: string;
  currency?: string;
  amountCents?: number;
  source?: string;
  meta?: Record<string, unknown>;
}

/**
 * Record a funnel step. Never throws.
 *
 * Instrumentation that can fail the thing it measures is worse than no
 * instrumentation: a signup or a payment webhook must not 500 because a
 * reporting row could not be written. Failures are logged and swallowed.
 */
export function recordFunnelEvent(input: FunnelEventInput): void {
  try {
    run(
      `INSERT INTO funnel_events (id, step, tenant_id, user_id, plan, currency, amount_cents, source, meta, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId("fnl"),
      input.step,
      input.tenantId ?? "",
      input.userId ?? "",
      input.plan ?? "",
      input.currency ?? "",
      input.amountCents ?? 0,
      input.source ?? "",
      JSON.stringify(input.meta ?? {}),
      nowIso()
    );
  } catch (e) {
    console.error("[funnel] failed to record step", input.step, e);
  }
}

export interface FunnelStepCount {
  step: FunnelStep;
  count: number;
}

export interface FunnelSummary {
  days: number;
  steps: FunnelStepCount[];
  /** Signups that reached at least one later step, and the rates between them. */
  conversion: { from: string; to: string; rate: number | null }[];
  recentSignups: {
    tenant_id: string;
    user_id: string;
    source: string;
    activated: boolean;
    paid: boolean;
    created_at: string;
  }[];
}

function since(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/**
 * Counts and step-to-step conversion over a window.
 *
 * Conversion is measured on *distinct tenants* rather than raw event counts, so a
 * user who reloads a checkout page or saves their page twice cannot inflate the
 * funnel and make activation look better than it is.
 */
export function funnelSummary(days = 30): FunnelSummary {
  const from = since(days);

  const steps: FunnelStepCount[] = FUNNEL_STEPS.map((step) => ({
    step,
    count: Number(row<{ c: number }>("SELECT COUNT(DISTINCT tenant_id) AS c FROM funnel_events WHERE step = ? AND created_at >= ?", step, from)?.c ?? 0),
  }));

  const countOf = (step: FunnelStep) => steps.find((s) => s.step === step)?.count ?? 0;

  // Forward path: signup -> activation -> checkout -> paid.
  const forward: [FunnelStep, FunnelStep][] = [
    ["signup_completed", "activation_reached"],
    ["activation_reached", "checkout_started"],
    ["checkout_started", "purchase_completed"],
    ["signup_completed", "purchase_completed"],
  ];
  const conversion = forward.map(([a, b]) => {
    const from_ = countOf(a);
    const to = countOf(b);
    return { from: a, to: b, rate: from_ === 0 ? null : Math.round((to / from_) * 1000) / 10 };
  });

  const recentSignups = all<{ tenant_id: string; user_id: string; source: string; created_at: string }>(
    `SELECT tenant_id, user_id, source, created_at FROM funnel_events
     WHERE step = 'signup_completed' ORDER BY created_at DESC LIMIT 50`
  ).map((s) => {
    const activated = Boolean(
      row("SELECT 1 AS x FROM funnel_events WHERE step = 'activation_reached' AND tenant_id = ?", s.tenant_id)
    );
    const paid = Boolean(
      row("SELECT 1 AS x FROM funnel_events WHERE step = 'purchase_completed' AND tenant_id = ?", s.tenant_id)
    );
    return { ...s, activated, paid };
  });

  return { days, steps, conversion, recentSignups };
}

/**
 * True the first time this tenant reaches a step. Used where a milestone should
 * fire once (activation) rather than on every save.
 */
export function isFirstFunnelEvent(tenantId: string, step: FunnelStep): boolean {
  return !row("SELECT 1 AS x FROM funnel_events WHERE tenant_id = ? AND step = ?", tenantId, step);
}