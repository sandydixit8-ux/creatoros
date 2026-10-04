import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { row, run, newId, nowIso } from "@/lib/db/db";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { getLimits } from "@/lib/plans";
import { isSafeUrl } from "@/lib/url-safety";

/**
 * `z.string().url()` accepts `javascript:`, which would then be rendered into
 * an href and execute in our origin. Only allowlisted schemes may be stored.
 */
const safeUrlField = z
  .string()
  .refine((v) => v === "" || isSafeUrl(v), { message: "Unsupported URL scheme" });

const profileSchema = z.object({
  username: z.string().regex(/^[a-z0-9_]{2,30}$/),
  displayName: z.string().max(80).default(""),
  bio: z.string().max(500).default(""),
  avatarUrl: safeUrlField.default(""),
  website: safeUrlField.default(""),
  timezone: z.string().max(60).default("UTC"),
  socials: z
    .object({
      instagram: safeUrlField.default(""),
      youtube: safeUrlField.default(""),
      twitter: safeUrlField.default(""),
      linkedin: safeUrlField.default(""),
      tiktok: safeUrlField.default(""),
    })
    .default({ instagram: "", youtube: "", twitter: "", linkedin: "", tiktok: "" }),
});

export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  const p = row<{ id: string; username: string; display_name: string; bio: string; avatar_url: string; website: string; timezone: string; socials: string }>(
    "SELECT id, username, display_name, bio, avatar_url, website, timezone, socials FROM profiles WHERE tenant_id = ? AND user_id = ?",
    s.org.id,
    s.user.id
  );
  if (!p) return ok(null);
  return ok({
    username: p.username,
    displayName: p.display_name,
    bio: p.bio,
    avatarUrl: p.avatar_url,
    website: p.website,
    timezone: p.timezone,
    socials: safeJson<Record<string, string>>(p.socials),
  });
}

// Both POST (create) and PUT (update) accept the same body.
async function upsert(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "settings:write")) return err.forbidden();

  const body = await readJson(req);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);
  const d = parsed.data;
  const lower = d.username.toLowerCase();

  const existing = row<{ id: string }>("SELECT id FROM profiles WHERE tenant_id = ? AND user_id = ?", s.org.id, s.user.id);
  const clash = row("SELECT id FROM profiles WHERE username = ?", lower);
  if (clash && (!existing || clash.id !== existing.id)) return err.conflict("That username is taken");

  const org = row<{ plan: string }>("SELECT plan FROM organizations WHERE id = ?", s.org.id);
  const limits = getLimits(org?.plan ?? "free");

  if (!existing) {
    const profilePages = (row<{ c: number }>("SELECT COUNT(*) AS c FROM profiles WHERE tenant_id = ?", s.org.id) as { c: number }).c;
    if (limits.bioPages !== -1 && profilePages >= limits.bioPages) return err.conflict("This plan supports a limited number of profiles");
    const profileId = newId("prf");
    run(
      "INSERT INTO profiles (id, tenant_id, user_id, username, display_name, bio, avatar_url, website, timezone, socials, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      profileId,
      s.org.id,
      s.user.id,
      lower,
      d.displayName,
      d.bio,
      d.avatarUrl,
      d.website,
      d.timezone,
      JSON.stringify(d.socials),
      nowIso(),
      nowIso()
    );
    // Every creator starts with a bio page ready to build.
    const pageId = newId("bio");
    run(
      "INSERT INTO bio_pages (id, tenant_id, profile_id, slug, title, published, created_at, updated_at) VALUES (?, ?, ?, '', ?, 0, ?, ?)",
      pageId,
      s.org.id,
      profileId,
      `${d.displayName || lower}'s page`,
      nowIso(),
      nowIso()
    );
    audit({ tenantId: s.org.id, userId: s.user.id, action: "settings.profile_create", resource: profileId, ip: req.headers.get("x-forwarded-for") || undefined });
    return ok({ saved: true, created: true, username: lower });
  }

  run(
    "UPDATE profiles SET username = ?, display_name = ?, bio = ?, avatar_url = ?, website = ?, timezone = ?, socials = ?, updated_at = ? WHERE id = ?",
    lower,
    d.displayName,
    d.bio,
    d.avatarUrl,
    d.website,
    d.timezone,
    JSON.stringify(d.socials),
    nowIso(),
    existing.id
  );
  audit({ tenantId: s.org.id, userId: s.user.id, action: "settings.profile_update", ip: req.headers.get("x-forwarded-for") || undefined });
  return ok({ saved: true, created: false, username: lower });
}

export async function POST(req: NextRequest) {
  return upsert(req);
}
export async function PUT(req: NextRequest) {
  return upsert(req);
}

function safeJson<T>(s: string, fb: T = {} as T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fb;
  }
}