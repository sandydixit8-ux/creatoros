import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { isVerifiedPlatformAdmin } from "@/lib/admin/access";
import { listFlags, setFlag } from "@/lib/admin/engine";

const schema = z.object({ flag: z.string().min(1), enabled: z.boolean() });

export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  if (!isVerifiedPlatformAdmin(s.user)) return err.forbidden();
  return ok({ flags: listFlags() });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!isVerifiedPlatformAdmin(s.user)) return err.forbidden();
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);
  setFlag(s.user.id, parsed.data.flag, parsed.data.enabled);
  return ok({ saved: true });
}