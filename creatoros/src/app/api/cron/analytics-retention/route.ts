import { NextRequest } from "next/server";
import { ok, err } from "@/lib/http";
import { authorizedCron } from "@/lib/cron";
import { pruneAnalyticsEvents } from "@/lib/analytics/retention";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  if (!(await authorizedCron(req))) return err.forbidden("Not authorized");

  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const result = pruneAnalyticsEvents(daysParam > 0 ? { days: daysParam } : {});
  return ok(result);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
