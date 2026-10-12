import { all, row, run, newId, nowIso } from "@/lib/db/db";
import { sendEmail } from "@/lib/email/mailer";
import { SITE_URL } from "@/lib/constants";
import type { WriteResult } from "./links";

/**
 * Alerts layer. A creator defines a rule over a single metric (traffic, clicks,
 * leads, bookings) with a threshold and a rolling window. The scheduled job
 * (/api/cron/alerts) evaluates each active rule; when it fires outside its
 * cooldown an alert_event is recorded and, for `email` rules, the org owner is
 * notified. Everything here is tenant-scoped.
 */

export const ALERT_METRICS = ["page_views", "visitors", "link_clicks", "leads", "bookings"] as const;
export type AlertMetric = (typeof ALERT_METRICS)[number];

export const ALERT_COMPARATORS = ["gt", "lt", "pct_up", "pct_down"] as const;
export type AlertComparator = (typeof ALERT_COMPARATORS)[number];

export const ALERT_CHANNELS = ["email", "inapp"] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

const DAY_MS = 86_400_000;
const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const METRIC_LABEL: Record<AlertMetric, string> = {
  page_views: "Page views",
  visitors: "Visitors",
  link_clicks: "Link clicks",
  leads: "Leads",
  bookings: "Bookings",
};

// `null` means the metric counts distinct visitors rather than rows of one type.
const METRIC_EVENT: Record<AlertMetric, string | null> = {
  page_views: "page_view",
  visitors: null,
  link_clicks: "link_click",
  leads: "lead",
  bookings: "booking",
};

export interface AlertRule {
  id: string;
  tenantId: string;
  name: string;
  metric: AlertMetric;
  comparator: AlertComparator;
  threshold: number;
  windowDays: number;
  channel: AlertChannel;
  cooldownMinutes: number;
  active: boolean;
  lastFiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertEvent {
  id: string;
  tenantId: string;
  ruleId: string | null;
  ruleName: string;
  metric: string;
  value: number;
  baseline: number;
  threshold: number;
  message: string;
  channel: string;
  delivery: string;
  deliveryError: string;
  readAt: string | null;
  createdAt: string;
}

const RULE_COLS =
  "id, tenant_id, name, metric, comparator, threshold, window_days, channel, cooldown_minutes, active, last_fired_at, created_at, updated_at";
const EVENT_COLS =
  "id, tenant_id, rule_id, rule_name, metric, value, baseline, threshold, message, channel, delivery, delivery_error, read_at, created_at";

function mapRule(r: Record<string, unknown>): AlertRule {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    name: String(r.name ?? ""),
    metric: String(r.metric) as AlertMetric,
    comparator: String(r.comparator) as AlertComparator,
    threshold: num(r.threshold),
    windowDays: num(r.window_days),
    channel: String(r.channel ?? "email") as AlertChannel,
    cooldownMinutes: num(r.cooldown_minutes),
    active: Number(r.active ?? 0) === 1,
    lastFiredAt: r.last_fired_at == null ? null : String(r.last_fired_at),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

function mapEvent(r: Record<string, unknown>): AlertEvent {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    ruleId: r.rule_id == null ? null : String(r.rule_id),
    ruleName: String(r.rule_name ?? ""),
    metric: String(r.metric ?? ""),
    value: num(r.value),
    baseline: num(r.baseline),
    threshold: num(r.threshold),
    message: String(r.message ?? ""),
    channel: String(r.channel ?? "inapp"),
    delivery: String(r.delivery ?? "inapp"),
    deliveryError: String(r.delivery_error ?? ""),
    readAt: r.read_at == null ? null : String(r.read_at),
    createdAt: String(r.created_at ?? ""),
  };
}

export function listAlertRules(tenantId: string): AlertRule[] {
  return all<Record<string, unknown>>(
    `SELECT ${RULE_COLS} FROM alert_rules WHERE tenant_id = ? ORDER BY created_at DESC`,
    tenantId
  ).map(mapRule);
}

function validMetric(m: unknown): m is AlertMetric {
  return typeof m === "string" && (ALERT_METRICS as readonly string[]).includes(m);
}
function validComparator(c: unknown): c is AlertComparator {
  return typeof c === "string" && (ALERT_COMPARATORS as readonly string[]).includes(c);
}
function validChannel(c: unknown): c is AlertChannel {
  return typeof c === "string" && (ALERT_CHANNELS as readonly string[]).includes(c);
}
const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

export function createAlertRule(
  tenantId: string,
  input: {
    name: string;
    metric: AlertMetric;
    comparator: AlertComparator;
    threshold: number;
    windowDays?: number;
    channel?: AlertChannel;
    cooldownMinutes?: number;
    active?: boolean;
  }
): WriteResult<AlertRule> {
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) return { ok: false, code: "invalid", message: "Name is required" };
  if (!validMetric(input.metric)) return { ok: false, code: "invalid", message: "Unknown metric" };
  if (!validComparator(input.comparator)) return { ok: false, code: "invalid", message: "Unknown comparator" };
  const threshold = num(input.threshold);
  if (threshold < 0) return { ok: false, code: "invalid", message: "Threshold cannot be negative" };
  const channel = validChannel(input.channel) ? input.channel : "email";
  const windowDays = clampInt(input.windowDays, 1, 90, 1);
  const cooldownMinutes = clampInt(input.cooldownMinutes, 0, 100_800, 360);

  const id = newId("alr");
  const now = nowIso();
  run(
    `INSERT INTO alert_rules (id, tenant_id, name, metric, comparator, threshold, window_days, channel, cooldown_minutes, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    tenantId,
    name,
    input.metric,
    input.comparator,
    threshold,
    windowDays,
    channel,
    cooldownMinutes,
    input.active === false ? 0 : 1,
    now,
    now
  );
  return { ok: true, data: mapRule(row<Record<string, unknown>>(`SELECT ${RULE_COLS} FROM alert_rules WHERE id = ?`, id)!) };
}

export function updateAlertRule(
  tenantId: string,
  id: string,
  patch: {
    name?: string;
    metric?: AlertMetric;
    comparator?: AlertComparator;
    threshold?: number;
    windowDays?: number;
    channel?: AlertChannel;
    cooldownMinutes?: number;
    active?: boolean;
  }
): WriteResult<AlertRule> {
  const existing = row<Record<string, unknown>>("SELECT id FROM alert_rules WHERE id = ? AND tenant_id = ?", id, tenantId);
  if (!existing) return { ok: false, code: "not_found", message: "Alert rule not found" };

  const sets: string[] = [];
  const params: (string | number)[] = [];
  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, 80);
    if (!name) return { ok: false, code: "invalid", message: "Name is required" };
    sets.push("name = ?");
    params.push(name);
  }
  if (patch.metric !== undefined) {
    if (!validMetric(patch.metric)) return { ok: false, code: "invalid", message: "Unknown metric" };
    sets.push("metric = ?");
    params.push(patch.metric);
  }
  if (patch.comparator !== undefined) {
    if (!validComparator(patch.comparator)) return { ok: false, code: "invalid", message: "Unknown comparator" };
    sets.push("comparator = ?");
    params.push(patch.comparator);
  }
  if (patch.threshold !== undefined) {
    const threshold = num(patch.threshold);
    if (threshold < 0) return { ok: false, code: "invalid", message: "Threshold cannot be negative" };
    sets.push("threshold = ?");
    params.push(threshold);
  }
  if (patch.windowDays !== undefined) {
    sets.push("window_days = ?");
    params.push(clampInt(patch.windowDays, 1, 90, 1));
  }
  if (patch.channel !== undefined) {
    if (!validChannel(patch.channel)) return { ok: false, code: "invalid", message: "Unknown channel" };
    sets.push("channel = ?");
    params.push(patch.channel);
  }
  if (patch.cooldownMinutes !== undefined) {
    sets.push("cooldown_minutes = ?");
    params.push(clampInt(patch.cooldownMinutes, 0, 100_800, 360));
  }
  if (patch.active !== undefined) {
    sets.push("active = ?");
    params.push(patch.active ? 1 : 0);
  }
  if (sets.length === 0) {
    return { ok: false, code: "invalid", message: "Nothing to update" };
  }
  sets.push("updated_at = ?");
  params.push(nowIso());
  run(`UPDATE alert_rules SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, ...params, id, tenantId);
  return { ok: true, data: mapRule(row<Record<string, unknown>>(`SELECT ${RULE_COLS} FROM alert_rules WHERE id = ?`, id)!) };
}

export function deleteAlertRule(tenantId: string, id: string): boolean {
  return run("DELETE FROM alert_rules WHERE id = ? AND tenant_id = ?", id, tenantId).changes > 0;
}

export function listAlertEvents(tenantId: string, limit = 20): AlertEvent[] {
  return all<Record<string, unknown>>(
    `SELECT ${EVENT_COLS} FROM alert_events WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?`,
    tenantId,
    Math.min(Math.max(1, Math.floor(limit)), 100)
  ).map(mapEvent);
}

export function unreadAlertCount(tenantId: string): number {
  return num(row<{ c: number }>("SELECT COUNT(*) AS c FROM alert_events WHERE tenant_id = ? AND read_at IS NULL", tenantId)?.c);
}

export function markAlertRead(tenantId: string, id: string): boolean {
  const res = run("UPDATE alert_events SET read_at = ? WHERE id = ? AND tenant_id = ? AND read_at IS NULL", nowIso(), id, tenantId);
  return res.changes > 0;
}

export function markAllAlertsRead(tenantId: string): number {
  return run("UPDATE alert_events SET read_at = ? WHERE tenant_id = ? AND read_at IS NULL", nowIso(), tenantId).changes;
}

/** Distinct-visitor count or a per-event-type row count over [since, until). */
function metricValue(tenantId: string, metric: AlertMetric, since: string, until: string): number {
  const eventType = METRIC_EVENT[metric];
  // eventType comes from the fixed allow-list above, never from caller input.
  const agg =
    eventType === null
      ? "COUNT(DISTINCT CASE WHEN visitor_id != '' THEN visitor_id END)"
      : `SUM(CASE WHEN event_type = '${eventType}' THEN 1 ELSE 0 END)`;
  const r = row<{ v: number }>(
    `SELECT COALESCE(${agg}, 0) AS v FROM analytics_events
      WHERE tenant_id = ? AND created_at >= ? AND created_at < ?`,
    tenantId,
    since,
    until
  );
  return num(r?.v);
}

export interface RuleEvaluation {
  triggered: boolean;
  value: number;
  baseline: number;
  changePct: number | null;
  windowDays: number;
}

export function evaluateRule(rule: AlertRule, now: Date = new Date()): RuleEvaluation {
  const winMs = rule.windowDays * DAY_MS;
  const nowMs = now.getTime();
  const until = new Date(nowMs).toISOString();
  const since = new Date(nowMs - winMs).toISOString();
  const prevSince = new Date(nowMs - 2 * winMs).toISOString();

  const value = metricValue(rule.tenantId, rule.metric, since, until);
  const baseline = metricValue(rule.tenantId, rule.metric, prevSince, since);
  const changePct = baseline > 0 ? ((value - baseline) / baseline) * 100 : null;

  let triggered = false;
  switch (rule.comparator) {
    case "gt":
      triggered = value > rule.threshold;
      break;
    case "lt":
      triggered = value < rule.threshold;
      break;
    case "pct_up":
      triggered = changePct !== null && changePct > rule.threshold;
      break;
    case "pct_down":
      triggered = changePct !== null && changePct < -Math.abs(rule.threshold);
      break;
  }
  return { triggered, value, baseline, changePct, windowDays: rule.windowDays };
}

function describe(rule: AlertRule, ev: RuleEvaluation): string {
  const label = METRIC_LABEL[rule.metric];
  if (rule.comparator === "pct_up" || rule.comparator === "pct_down") {
    const dir = rule.comparator === "pct_up" ? "up" : "down";
    const pct = ev.changePct === null ? "n/a" : `${Math.abs(ev.changePct).toFixed(1)}%`;
    return `${label} is ${dir} ${pct} versus the previous ${ev.windowDays}-day window (now ${ev.value.toLocaleString()} vs ${ev.baseline.toLocaleString()}).`;
  }
  const cmp = rule.comparator === "gt" ? "above" : "below";
  return `${label} over the last ${ev.windowDays} day(s) is ${ev.value.toLocaleString()}, ${cmp} your threshold of ${rule.threshold.toLocaleString()}.`;
}

function cooling(rule: AlertRule, nowMs: number): boolean {
  if (!rule.lastFiredAt) return false;
  const last = Date.parse(rule.lastFiredAt);
  if (!Number.isFinite(last)) return false;
  return nowMs - last < rule.cooldownMinutes * 60_000;
}

function ownerContact(tenantId: string): { email: string; name: string } | null {
  const r = row<{ email: string; name: string }>(
    `SELECT u.email AS email, u.name AS name
       FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.tenant_id = ? AND m.role = 'owner'
      ORDER BY m.created_at ASC LIMIT 1`,
    tenantId
  );
  return r?.email ? { email: r.email, name: r.name ?? "" } : null;
}

function emailHtml(rule: AlertRule, message: string): string {
  const link = `${SITE_URL}/app/analytics`;
  return `<div style="font-family:system-ui,sans-serif;max-width:520px">
    <h2 style="margin:0 0 8px">${escapeHtml(rule.name)}</h2>
    <p style="color:#334155">${escapeHtml(message)}</p>
    <p><a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open analytics</a></p>
    <p style="color:#94a3b8;font-size:12px">You are receiving this because you set an alert in CreatorOS. Disable it under Analytics → Alerts.</p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface FireResult {
  event: AlertEvent;
  emailed: boolean;
}

/** Records a fired alert and, for email rules, notifies the owner. */
export async function fireAlert(rule: AlertRule, ev: RuleEvaluation, now: Date = new Date()): Promise<FireResult> {
  const message = describe(rule, ev);
  const id = newId("ale");
  const createdAt = now.toISOString();

  let delivery = "inapp";
  let deliveryError = "";
  if (rule.channel === "email") {
    const owner = ownerContact(rule.tenantId);
    if (!owner) {
      delivery = "skipped";
      deliveryError = "No owner email on file";
    } else {
      try {
        await sendEmail({
          to: owner.email,
          toName: owner.name,
          subject: `CreatorOS alert: ${rule.name}`,
          html: emailHtml(rule, message),
        });
        delivery = "sent";
      } catch (e) {
        delivery = "failed";
        deliveryError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  run(
    `INSERT INTO alert_events (id, tenant_id, rule_id, rule_name, metric, value, baseline, threshold, message, channel, delivery, delivery_error, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    id,
    rule.tenantId,
    rule.id,
    rule.name,
    rule.metric,
    ev.value,
    ev.baseline,
    rule.threshold,
    message,
    rule.channel,
    delivery,
    deliveryError,
    createdAt
  );
  run("UPDATE alert_rules SET last_fired_at = ?, updated_at = ? WHERE id = ?", createdAt, createdAt, rule.id);

  return {
    event: mapEvent(row<Record<string, unknown>>(`SELECT ${EVENT_COLS} FROM alert_events WHERE id = ?`, id)!),
    emailed: delivery === "sent",
  };
}

/** Evaluates every active rule that is past its cooldown. Used by the cron job. */
export async function evaluateAllAlerts(
  now: Date = new Date()
): Promise<{ evaluated: number; fired: number; skipped: number }> {
  const nowMs = now.getTime();
  const rules = all<Record<string, unknown>>(
    `SELECT ${RULE_COLS} FROM alert_rules WHERE active = 1`
  ).map(mapRule);

  let evaluated = 0;
  let fired = 0;
  let skipped = 0;
  for (const rule of rules) {
    if (cooling(rule, nowMs)) {
      skipped++;
      continue;
    }
    evaluated++;
    const ev = evaluateRule(rule, now);
    if (!ev.triggered) continue;
    await fireAlert(rule, ev, now);
    fired++;
  }
  return { evaluated, fired, skipped };
}

export function listAlertEventsForRule(tenantId: string, ruleId: string, limit = 20): AlertEvent[] {
  return all<Record<string, unknown>>(
    `SELECT ${EVENT_COLS} FROM alert_events WHERE tenant_id = ? AND rule_id = ? ORDER BY created_at DESC LIMIT ?`,
    tenantId,
    ruleId,
    limit
  ).map(mapEvent);
}
