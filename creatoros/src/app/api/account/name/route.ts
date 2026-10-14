import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, ok, readJson, getClientIp } from "@/lib/http";
import { nowIso, run } from "@/lib/db/db";
import { rateKey, rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";

const schema = z.object({ name: z.string().trim().min(1).max(80) });

/** Update the account holder's display name (the login-side name, not the bio profile). */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();

  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("account-name", s.user.id), 10, 60_000);
  if (!rl.allowed) return err.rateLimited();

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  run("UPDATE users SET name = ?, updated_at = ? WHERE id = ?", parsed.data.name, nowIso(), s.user.id);
  audit({ tenantId: s.org.id, userId: s.user.id, action: "account.name_updated", ip });
  return ok({ name: parsed.data.name });
}
