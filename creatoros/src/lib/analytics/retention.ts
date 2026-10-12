import { run } from "@/lib/db/db";

/**
 * Raw analytics events are personal data (visitor hashes, countries, referrers),
 * so they are kept for a bounded window and then dropped. A 400-day default
 * covers a full year-over-year comparison while staying inside the "no longer
 * than necessary" rule the privacy policy commits to.
 */
export function analyticsRetentionDays(): number {
  const raw = Number(process.env.ANALYTICS_RETENTION_DAYS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 400;
}

export interface PruneResult {
  deleted: number;
  cutoff: string;
  retentionDays: number;
}

const DEFAULT_BATCH = 5000;

/**
 * Hard-deletes events older than the retention window. Deletion runs in bounded
 * batches so a large backlog never holds a long write lock against live
 * ingestion. `created_at` is always stored as an ISO-8601 UTC string
 * (`nowIso`), so a lexical comparison against the cutoff is safe.
 */
export function pruneAnalyticsEvents(opts: { days?: number; now?: Date; batchSize?: number } = {}): PruneResult {
  const retentionDays = opts.days && opts.days > 0 ? Math.floor(opts.days) : analyticsRetentionDays();
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const batchSize = opts.batchSize && opts.batchSize > 0 ? opts.batchSize : DEFAULT_BATCH;

  let deleted = 0;
  for (;;) {
    const res = run(
      "DELETE FROM analytics_events WHERE rowid IN (SELECT rowid FROM analytics_events WHERE created_at < ? LIMIT ?)",
      cutoff,
      batchSize
    );
    deleted += res.changes;
    if (res.changes < batchSize) break;
  }

  return { deleted, cutoff, retentionDays };
}
