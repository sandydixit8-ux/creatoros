import { getDb } from "@/lib/db/db";

export const dynamic = "force-dynamic";

/**
 * Readiness, not just liveness.
 *
 * This used to answer `{ok:true}` unconditionally, which made it useless as a
 * deploy gate: `getDb()` is lazy and applies pending migrations on first use, so
 * a deploy could restart, report healthy, and leave every migration unapplied
 * until a customer happened to hit a database-backed page. That happened twice.
 *
 * Opening the database here also applies pending migrations, so `db: "ok"` means
 * the schema is current and the app can actually serve a request. The response
 * exposes nothing beyond that.
 */
export function GET() {
  try {
    getDb().prepare("SELECT 1").get();
    return Response.json({ ok: true, db: "ok" });
  } catch {
    return Response.json({ ok: false, db: "unavailable" }, { status: 503 });
  }
}