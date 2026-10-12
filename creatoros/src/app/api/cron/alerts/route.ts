import { NextRequest } from "next/server";
import { ok, err } from "@/lib/http";
import { authorizedCron } from "@/lib/cron";
import { evaluateAllAlerts } from "@/lib/analytics/alerts";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  if (!(await authorizedCron(req))) return err.forbidden("Not authorized");
  const result = await evaluateAllAlerts();
  return ok(result);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
