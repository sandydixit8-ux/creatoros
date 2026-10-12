import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { isVerifiedPlatformAdmin } from "@/lib/admin/access";
import { updateTicketStatus } from "@/lib/admin/engine";

const schema = z.object({ status: z.string().min(1) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!isVerifiedPlatformAdmin(s.user)) return err.forbidden();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation({ status: ["required"] });
  try {
    updateTicketStatus(s.user.id, id, parsed.data.status);
    return ok({ updated: true });
  } catch (e) {
    return err.conflict(e instanceof Error ? e.message : "bad request");
  }
}