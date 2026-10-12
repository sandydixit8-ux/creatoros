import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { isVerifiedPlatformAdmin } from "@/lib/admin/access";
import { setOrgPlan } from "@/lib/admin/engine";

const schema = z.object({ plan: z.string().min(1) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!isVerifiedPlatformAdmin(s.user)) return err.forbidden();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);
  try {
    setOrgPlan(s.user.id, id, parsed.data.plan);
    return ok({ updated: true });
  } catch (e) {
    return err.conflict(e instanceof Error ? e.message : "bad request");
  }
}