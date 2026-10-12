import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Gate for scheduler-triggered jobs. The scheduler may carry no session, so a
 * shared CRON_SECRET is the primary gate (Bearer header or `?secret=`). When it
 * is unset the endpoint is still never open: it falls back to an authenticated
 * owner/admin session for a manual run.
 */
export async function authorizedCron(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET || "";
  if (secret) {
    const header = req.headers.get("authorization") || "";
    const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
    const query = req.nextUrl.searchParams.get("secret") || "";
    return safeEqual(bearer, secret) || safeEqual(query, secret);
  }
  const s = await getSession();
  return Boolean(s && can(s.role as never, "settings:write"));
}
