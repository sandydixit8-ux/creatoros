import { NextRequest } from "next/server";
import { ok, err } from "@/lib/http";
import { authorizedCron } from "@/lib/cron";
import { runEmailJobs } from "@/lib/email/jobs";

export const dynamic = "force-dynamic";

/**
 * Drain the lifecycle-email outbox (Gap 4).
 *
 * Safe to call on a schedule and safe to call concurrently: each job is claimed
 * with a conditional UPDATE, so a second runner skips rows the first one took.
 * The response reports what actually happened so a failing scheduler is visible
 * instead of silent.
 */
async function handle(req: NextRequest) {
  if (!(await authorizedCron(req))) return err.forbidden("Not authorized");

  const url = req.nextUrl;
  const limit = Number(url.searchParams.get("limit") || "25");
  const result = await runEmailJobs({ limit: Number.isFinite(limit) ? limit : 25 });
  return ok(result);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
