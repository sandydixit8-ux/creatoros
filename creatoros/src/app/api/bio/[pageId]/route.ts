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

const BLOCK_TYPES = ["profile", "bio", "link", "product", "booking", "email_capture", "cta", "social"] as const;

const pageUpdateSchema = z.object({
  title: z.string().max(120).optional(),
  slug: z.string().regex(/^[a-z0-9-]{0,50}$/).optional(),
  published: z.boolean().optional(),
  theme: z.record(z.string(), z.string()).optional(),
});

const blockSchema = z.object({
  type: z.enum(BLOCK_TYPES),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ pageId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  const { pageId } = await ctx.params;

  const page = row<{ id: string; tenant_id: string; profile_id: string; slug: string; title: string; published: number; theme: string }>(
    "SELECT id, tenant_id, profile_id, slug, title, published, theme FROM bio_pages WHERE id = ? AND tenant_id = ?",
    pageId,
    s.org.id
  );
  if (!page) return err.notFound();

  const blocks = all<{ id: string; type: string; payload: string; position: number; active: number }>(
    "SELECT id, type, payload, position, active FROM bio_blocks WHERE page_id = ? ORDER BY position ASC",
    pageId
  );

  const profile = row("SELECT * FROM profiles WHERE id = ?", page.profile_id);
  const services = all("SELECT id, name, slug, duration_min FROM services WHERE tenant_id = ? AND active = 1", s.org.id);
  const products = all("SELECT id, name, price_cents, currency FROM products WHERE tenant_id = ? AND active = 1", s.org.id);

  return ok({
    page: { ...page, theme: safeJson(page.theme), published: !!page.published },
    blocks: blocks.map((b) => ({ ...b, payload: safeJson(b.payload), active: !!b.active })),
    profile,
    services,
    products,
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ pageId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "bio:write")) return err.forbidden();
  const { pageId } = await ctx.params;
  const page = row<{ id: string }>("SELECT id FROM bio_pages WHERE id = ? AND tenant_id = ?", pageId, s.org.id);
  if (!page) return err.notFound();

  const body = await readJson(req);
  const parsed = pageUpdateSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const { title, slug, published, theme } = parsed.data;
  if (title !== undefined) run("UPDATE bio_pages SET title = ?, updated_at = ? WHERE id = ?", title, nowIso(), pageId);
  if (slug !== undefined) {
    const dup = row("SELECT id FROM bio_pages WHERE tenant_id = ? AND slug = ? AND id != ?", s.org.id, slug, pageId);
    if (dup) return err.conflict("Another page uses this slug");
    run("UPDATE bio_pages SET slug = ?, updated_at = ? WHERE id = ?", slug, nowIso(), pageId);
  }
  if (published !== undefined) run("UPDATE bio_pages SET published = ?, updated_at = ? WHERE id = ?", published ? 1 : 0, nowIso(), pageId);
  if (theme !== undefined) run("UPDATE bio_pages SET theme = ?, updated_at = ? WHERE id = ?", JSON.stringify(theme), nowIso(), pageId);

  audit({ tenantId: s.org.id, userId: s.user.id, action: "bio.update", resource: pageId, meta: parsed.data, ip: req.headers.get("x-forwarded-for") || undefined });
  return ok({ pageId });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ pageId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "bio:write")) return err.forbidden();
  const { pageId } = await ctx.params;
  const page = row<{ id: string }>("SELECT id FROM bio_pages WHERE id = ? AND tenant_id = ?", pageId, s.org.id);
  if (!page) return err.notFound();
  run("DELETE FROM bio_blocks WHERE page_id = ?", pageId);
  run("DELETE FROM bio_pages WHERE id = ?", pageId);
  audit({ tenantId: s.org.id, userId: s.user.id, action: "bio.delete", resource: pageId, ip: req.headers.get("x-forwarded-for") || undefined });
  return ok({ deleted: true });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ pageId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "bio:write")) return err.forbidden();
  const { pageId } = await ctx.params;
  const page = row<{ id: string }>("SELECT id FROM bio_pages WHERE id = ? AND tenant_id = ?", pageId, s.org.id);
  if (!page) return err.notFound();

  const body = await readJson(req);
  const parsed = blockSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  // Free-form payload: reject script-capable schemes before they reach an href.
  if (payloadHasDangerousScheme(parsed.data.payload ?? {})) {
    return err.validation({ payload: "Unsupported URL scheme in block content" });
  }

  const nextPos = (all<{ m: number }>("SELECT COALESCE(MAX(position), -1) AS m FROM bio_blocks WHERE page_id = ?", pageId)[0]?.m ?? -1) + 1;
  if (parsed.data.type === "link") {
    const limits = getLimits(s.org.plan);
    const linkCount = getUsage(s.org.id, "links");
    if (!withinLimit(linkCount, limits.links)) {
      return err.conflict(`Link limit reached for the ${s.org.plan} plan. Upgrade to add more links.`);
    }
  }
  const blockId = newId("blk");
  run(
    "INSERT INTO bio_blocks (id, tenant_id, page_id, type, payload, position, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
    blockId,
    s.org.id,
    pageId,
    parsed.data.type,
    JSON.stringify(parsed.data.payload ?? {}),
    nextPos,
    nowIso(),
    nowIso()
  );
  if (parsed.data.type === "link") bumpUsage(s.org.id, "links");
  audit({ tenantId: s.org.id, userId: s.user.id, action: "bio.block_add", resource: blockId, meta: { type: parsed.data.type }, ip: req.headers.get("x-forwarded-for") || undefined });
  return ok({ blockId, position: nextPos });
}

function safeJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}