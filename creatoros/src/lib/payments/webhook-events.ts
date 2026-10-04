import { run, row, nowIso, tx } from "@/lib/db/db";

/**
 * Lifecycle of a gateway event receipt (D-11).
 *
 * The rule this exists to enforce: **an event is only recorded as processed once
 * the work it describes has actually succeeded.** The previous version wrote
 * `processed_at` at insert time, before any work ran, and the route returned 200
 * even when the work threw. That made a transient failure permanent in two
 * independent ways — the retry matched the duplicate check and did nothing, and
 * the 200 told the gateway to stop sending.
 *
 * So the receipt and the outcome are separate facts now:
 *
 *   received -> processing -> processed
 *                        \-> failed -> (retried: processing again)
 *
 * `failed` is a retryable state, not a terminal one. The route turns it into a
 * 5xx so the gateway comes back.
 */

export type WebhookEventStatus = "received" | "processing" | "processed" | "failed";

/**
 * How long a worker may hold an event before another delivery is allowed to take
 * it over. Without this, a process killed mid-handler would leave the row in
 * `processing` and wedge the event permanently — trading one stuck state for
 * another. Reclaimable events re-run idempotent handlers, so the cost of a wrong
 * guess here is a little duplicate work rather than a lost payment.
 */
const PROCESSING_LEASE_MS = 5 * 60 * 1000;

export interface IncomingEvent {
  id: string;
  provider: string;
  type: string;
  payload: unknown;
}

export type ClaimResult =
  | { claimed: true; attempts: number }
  | { claimed: false; reason: "already_processed" | "in_flight" };

function errorText(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 500);
  return String(e).slice(0, 500);
}

/**
 * Take ownership of an event for processing, or explain why not.
 *
 * Insert-or-claim runs in one transaction so two simultaneous deliveries of the
 * same event cannot both decide they are the first: the loser sees the winner's
 * committed row and backs off.
 */
export function claimWebhookEvent(event: IncomingEvent): ClaimResult {
  const payload = JSON.stringify(event.payload ?? {}).slice(0, 10000);
  const now = nowIso();

  return tx(() => {
    try {
      run(
        "INSERT INTO webhook_events (id, provider, type, payload, received_at, status, attempts, updated_at) VALUES (?, ?, ?, ?, ?, 'processing', 1, ?)",
        event.id,
        event.provider,
        event.type,
        payload,
        now,
        now
      );
      return { claimed: true, attempts: 1 };
    } catch {
      // A row already exists: either a duplicate delivery, or a previous attempt
      // that failed and is owed a retry.
    }

    const existing = row<{ status: string; attempts: number; updated_at: string }>(
      "SELECT status, attempts, updated_at FROM webhook_events WHERE id = ?",
      event.id
    );
    if (!existing) return { claimed: false, reason: "in_flight" };
    if (existing.status === "processed") return { claimed: false, reason: "already_processed" };

    if (existing.status === "processing") {
      const startedAt = Date.parse(existing.updated_at || "");
      const heldFor = Number.isNaN(startedAt) ? Number.POSITIVE_INFINITY : Date.now() - startedAt;
      if (heldFor < PROCESSING_LEASE_MS) return { claimed: false, reason: "in_flight" };
    }

    const updated = run(
      "UPDATE webhook_events SET status = 'processing', attempts = attempts + 1, last_error = NULL, updated_at = ? WHERE id = ?",
      nowIso(),
      event.id
    );
    if (updated.changes === 0) return { claimed: false, reason: "in_flight" };
    return { claimed: true, attempts: Number(existing.attempts ?? 0) + 1 };
  });
}

/** The work succeeded. Only now is the event done. */
export function markWebhookProcessed(eventId: string): void {
  const now = nowIso();
  run(
    "UPDATE webhook_events SET status = 'processed', processed_at = ?, last_error = NULL, updated_at = ? WHERE id = ?",
    now,
    now,
    eventId
  );
}

/**
 * The work threw. Record why and leave the event retryable — the route answers
 * 5xx so the gateway redelivers, and the next claim picks it up.
 */
export function markWebhookFailed(eventId: string, error: unknown): void {
  const now = nowIso();
  run(
    "UPDATE webhook_events SET status = 'failed', processed_at = NULL, last_error = ?, updated_at = ? WHERE id = ?",
    errorText(error),
    now,
    eventId
  );
}