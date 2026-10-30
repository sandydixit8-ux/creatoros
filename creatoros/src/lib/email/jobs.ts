import { all, run, row } from "@/lib/db/db";
import { newId, nowIso } from "@/lib/db/db";
import { sendEmail } from "@/lib/email/mailer";

/**
 * Durable outbox for lifecycle and transactional email (Gap 4).
 *
 * Why a queue instead of sending inline:
 *  - a payment webhook must acknowledge fast; the provider retries anything slow
 *  - a mail provider outage must delay a reminder, not lose it
 *  - a re-delivered webhook must not send the same reminder twice
 *
 * Guarantees:
 *  - `idempotency_key` is UNIQUE, so enqueueing the same logical message twice
 *    inserts once and returns false the second time
 *  - failures back off exponentially and become `dead` after `max_attempts`
 *  - marketing templates respect the unsubscribe list; transactional ones do
 *    not, because "you were charged" is not a marketing message
 *
 * This is intentionally small: one table, one drain function, one cron route.
 * A workflow engine would be more code than the problem needs.
 */

export type EmailKind = "transactional" | "marketing";

export interface EnqueueEmailInput {
  tenantId?: string;
  to: string;
  toName?: string;
  template: string;
  subject: string;
  html: string;
  idempotencyKey: string;
  /** Delay before the first attempt. Defaults to immediate. */
  delayMs?: number;
  maxAttempts?: number;
  kind?: EmailKind;
}

export interface EnqueueResult {
  enqueued: boolean;
  reason: "inserted" | "duplicate" | "suppressed";
}

/** Exponential backoff in seconds, capped at six hours. */
export function backoffSeconds(attempts: number): number {
  const base = 60;
  const cap = 6 * 60 * 60;
  return Math.min(base * Math.pow(2, Math.max(0, attempts)), cap);
}

function suppressed(tenantId: string, email: string): boolean {
  if (!tenantId) return false;
  const hit = row("SELECT 1 AS x FROM unsubscribes WHERE tenant_id = ? AND lower(email) = lower(?)", tenantId, email);
  return Boolean(hit);
}

export function enqueueEmail(input: EnqueueEmailInput): EnqueueResult {
  const kind = input.kind ?? "transactional";
  if (kind === "marketing" && suppressed(input.tenantId ?? "", input.to)) {
    return { enqueued: false, reason: "suppressed" };
  }

  const now = nowIso();
  const next = new Date(Date.now() + (input.delayMs ?? 0)).toISOString();
  const result = run(
    `INSERT OR IGNORE INTO email_jobs
       (id, tenant_id, to_email, to_name, template, subject, html, idempotency_key,
        status, attempts, max_attempts, next_attempt_at, last_error, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, '', ?, ?)`,
    newId("emj"),
    input.tenantId ?? "",
    input.to,
    input.toName ?? "",
    input.template,
    input.subject,
    input.html,
    input.idempotencyKey,
    Math.max(1, input.maxAttempts ?? 5),
    next,
    now,
    now
  );

  return result.changes > 0
    ? { enqueued: true, reason: "inserted" }
    : { enqueued: false, reason: "duplicate" };
}

interface JobRow {
  id: string;
  tenant_id: string;
  to_email: string;
  to_name: string;
  template: string;
  subject: string;
  html: string;
  attempts: number;
  max_attempts: number;
  idempotency_key: string;
}

export interface DrainResult {
  attempted: number;
  sent: number;
  retrying: number;
  dead: number;
}

/**
 * Send due jobs. Safe to run on a schedule and safe to run twice: each job is
 * claimed with a conditional UPDATE so a concurrent drain skips it.
 */
export async function runEmailJobs(opts: { limit?: number; now?: number } = {}): Promise<DrainResult> {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 200));
  const nowMs = opts.now ?? Date.now();
  const now = new Date(nowMs).toISOString();

  const due = all<JobRow>(
    `SELECT id, tenant_id, to_email, to_name, template, subject, html, attempts, max_attempts, idempotency_key
     FROM email_jobs
     WHERE status = 'queued' AND next_attempt_at <= ?
     ORDER BY next_attempt_at ASC
     LIMIT ?`,
    now,
    limit
  );

  const out: DrainResult = { attempted: 0, sent: 0, retrying: 0, dead: 0 };

  for (const job of due) {
    const claim = run(
      "UPDATE email_jobs SET status = 'sending', updated_at = ? WHERE id = ? AND status = 'queued'",
      nowIso(),
      job.id
    );
    if (claim.changes === 0) continue;
    out.attempted += 1;

    try {
      const res = await sendEmail({
        to: job.to_email,
        toName: job.to_name || undefined,
        subject: job.subject,
        html: job.html,
      });
      run(
        "UPDATE email_jobs SET status = 'sent', attempts = attempts + 1, sent_at = ?, last_error = '', updated_at = ? WHERE id = ?",
        nowIso(),
        nowIso(),
        job.id
      );
      out.sent += 1;
      // Keep the provider id for support lookups without widening the schema.
      run("UPDATE email_jobs SET last_error = ? WHERE id = ?", `provider:${res.provider}:${res.providerId}`, job.id);
    } catch (e) {
      const attempts = Number(job.attempts ?? 0) + 1;
      const isDead = attempts >= Number(job.max_attempts ?? 5);
      const next = new Date(nowMs + backoffSeconds(attempts) * 1000).toISOString();
      run(
        `UPDATE email_jobs SET status = ?, attempts = ?, next_attempt_at = ?, last_error = ?, updated_at = ? WHERE id = ?`,
        isDead ? "dead" : "queued",
        attempts,
        next,
        (e instanceof Error ? e.message : String(e)).slice(0, 500),
        nowIso(),
        job.id
      );
      if (isDead) out.dead += 1;
      else out.retrying += 1;
      console.error(`[email.jobs] ${job.template} -> ${job.to_email} failed (attempt ${attempts}):`, e);
    }
  }

  return out;
}

/** Operational visibility for support: recent jobs, newest first. */
export function recentEmailJobs(limit = 50): Array<Record<string, unknown>> {
  return all<Record<string, unknown>>(
    `SELECT id, tenant_id, to_email, template, status, attempts, max_attempts,
            next_attempt_at, last_error, sent_at, created_at
     FROM email_jobs ORDER BY created_at DESC LIMIT ?`,
    Math.max(1, Math.min(limit, 200))
  );
}
