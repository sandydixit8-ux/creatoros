import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { all, row, run, newId, nowIso } from "@/lib/db/db";
import { getLimits, withinLimit } from "@/lib/plans";
import { getUsage, bumpUsage } from "@/lib/usage";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";
import { payloadHasDangerousScheme } from "@/lib/url-safety";
import { recordFunnelEvent, isFirstFunnelEvent } from "@/lib/funnel";

const BLOCK_TYPES = ["profile", "bio", "link", "product", "booking", "email_capture", "cta", "social"] as const;

const updateSchema = z.object({
  blocks: z
    .array(
      z.object({
        id: z.string().min(1),
        type: z.enum(BLOCK_TYPES).optional(),
        position: z.number().int().min(0),
        payload: z.record(z.string(), z.unknown()).optional(),
        active: z.boolean().optional(),
      })
    )
    .max(200),
});

export async function PUT(req: NextRequest, ctx: { params: Promise<{ pageId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "bio:write")) return err.forbidden();
  const { pageId } = await ctx.params;

  const page = row<{ id: string }>("SELECT id FROM bio_pages WHERE id = ? AND tenant_id = ?", pageId, s.org.id);
  if (!page) return err.notFound();

  const body = await readJson(req);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  // Block payloads are free-form JSON whose URL-bearing keys vary by block type,
  // so reject the whole request if any string carries a script-capable scheme.
  // Rendering these payloads into href makes that stored XSS.
  for (const b of parsed.data.blocks) {
    if (b.payload !== undefined && payloadHasDangerousScheme(b.payload)) {
      return err.validation({ blocks: "Unsupported URL scheme in block content" });
    }
  }

  // Tenant & page ownership check for each block id to prevent cross-tenant writes
  const validIds = new Set(
    all<{ id: string }>("SELECT id FROM bio_blocks WHERE page_id = ? AND tenant_id = ?", pageId, s.org.id).map((b) => b.id)
  );

  let changed = 0;
  let added = 0;
  for (const b of parsed.data.blocks) {
    if (!validIds.has(b.id)) {
      const type = b.type ?? "link";
      if (type === "link") {
        const limits = getLimits(s.org.plan);
        const linkCount = getUsage(s.org.id, "links");
        if (!withinLimit(linkCount, limits.links)) return err.conflict("Link limit reached for this plan. Delete some links or upgrade.");
      }
      run(
        "INSERT INTO bio_blocks (id, tenant_id, page_id, type, position, active, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        newId("blk"),
        s.org.id,
        pageId,
        type,
        b.position,
        b.active === false ? 0 : 1,
        JSON.stringify(b.payload ?? {}),
        nowIso(),
        nowIso()
      );
      if (type === "link") bumpUsage(s.org.id, "links");
      added++;
      changed++;
      continue;
    }
    if (b.payload !== undefined) {
      run("UPDATE bio_blocks SET payload = ?, position = ?, updated_at = ? WHERE id = ?", JSON.stringify(b.payload), b.position, nowIso(), b.id);
    } else {
      run("UPDATE bio_blocks SET position = ?, updated_at = ? WHERE id = ?", b.position, nowIso(), b.id);
    }
    if (b.active !== undefined) {
      run("UPDATE bio_blocks SET active = ?, updated_at = ? WHERE id = ?", b.active ? 1 : 0, nowIso(), b.id);
    }
    changed++;
  }

  audit({ tenantId: s.org.id, userId: s.user.id, action: "bio.blocks_update", resource: pageId, meta: { changed }, ip: req.headers.get("x-forwarded-for") || undefined });

  // Activation milestone: the first block this account adds is the first time a
  // visitor could do anything on their page. Not "published" - the signup flow
  // already creates the page with published = 1, so that would be satisfied before
  // the user had done anything at all.
  if (added > 0 && isFirstFunnelEvent(s.org.id, "activation_reached")) {
    recordFunnelEvent({ step: "activation_reached", tenantId: s.org.id, userId: s.user.id, meta: { pageId, blocks: added } });
  }

  return ok({ changed });
}