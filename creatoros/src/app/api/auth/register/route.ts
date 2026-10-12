import { NextRequest } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { createVerifyToken } from "@/lib/auth/email-verify";
import { sendEmail, defaultFromEmail } from "@/lib/email/mailer";
import { SITE_URL } from "@/lib/constants";
import { ok, fail, readJson, getClientIp } from "@/lib/http";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";
import { run, row, newId, nowIso, tx } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { recordFunnelEvent } from "@/lib/funnel";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return base || "creator";
}

function uniqueUsername(base: string): string {
  if (!row("SELECT id FROM profiles WHERE username = ?", base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!row("SELECT id FROM profiles WHERE username = ?", candidate)) return candidate;
  }
  return `${base}-${newId("u").slice(-6)}`;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("register", ip), 10);
  if (!rl.allowed) return fail("Too many signups. Try again later.", 429, "rate_limited");

  const body = await readJson(req);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid signup data", 400, "validation");

  const { email, password, name } = parsed.data;
  const existing = row("SELECT id FROM users WHERE email = ?", email.toLowerCase());
  if (existing) return fail("An account with this email already exists", 409, "conflict");

  try {
    const user = tx(() => {
      const uid = newId("usr");
      run(
        "INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        uid,
        email.toLowerCase(),
        hashPassword(password),
        name,
        nowIso(),
        nowIso()
      );

      const orgId = newId("org");
      const slug = `${slugify(name)}-${orgId.slice(0, 6)}`;
      run(
        "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, ?, ?, 'free', ?, ?)",
        orgId,
        name,
        slug,
        nowIso(),
        nowIso()
      );

      run(
        "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)",
        newId("mem"),
        orgId,
        uid,
        nowIso()
      );

      const profileId = newId("prf");
      run(
        "INSERT INTO profiles (id, tenant_id, user_id, username, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        profileId,
        orgId,
        uid,
        uniqueUsername(slugify(name)),
        name,
        nowIso(),
        nowIso()
      );

      // default bio page for the profile
      const pageId = newId("bio");
      run(
        "INSERT INTO bio_pages (id, tenant_id, profile_id, slug, title, published, created_at, updated_at) VALUES (?, ?, ?, '', ?, 1, ?, ?)",
        pageId,
        orgId,
        profileId,
        `${name}'s page`,
        nowIso(),
        nowIso()
      );

      audit({ tenantId: orgId, userId: uid, action: "auth.register", resource: "user", meta: { email }, ip });
      return { uid, orgId };
    });

    const cookie = setSessionCookie(user.uid, user.orgId);

    // Prove the mailbox. Without this an allow-listed admin email could be
    // claimed by whoever registers it first (D-15). A failed send must not fail
    // the signup — the account is already committed — so it is best-effort and
    // the user can request a new link later.
    const verification = createVerifyToken(user.uid);
    if (verification) {
      const link = `${SITE_URL}/auth/verify-email?token=${encodeURIComponent(verification.token)}`;
      try {
        await sendEmail({
          to: email.toLowerCase(),
          toName: name,
          fromEmail: defaultFromEmail(),
          subject: "Verify your CreatorOS email",
          html: `<div style="font:15px/1.6 sans-serif;max-width:520px">
        <h2 style="margin:0 0 12px">Confirm your email</h2>
        <p>Welcome to CreatorOS, ${name}. Confirm this address to finish setting up your account.</p>
        <p><a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Verify email</a></p>
        <p style="color:#888;font-size:13px">If you did not create an account, you can ignore this message.</p>
      </div>`,
        });
      } catch (e) {
        console.error("[auth/register] verification email", e);
      }
    }

    // Acquisition source, read off the query string so the landing page can carry
    // utm tags through to signup. Recorded after commit so a funnel write can
    // never roll back the account it is describing.
    recordFunnelEvent({
      step: "signup_completed",
      tenantId: user.orgId,
      userId: user.uid,
      source: req.nextUrl.searchParams.get("utm_source") || "direct",
      meta: {
        utm_medium: req.nextUrl.searchParams.get("utm_medium") || "",
        utm_campaign: req.nextUrl.searchParams.get("utm_campaign") || "",
      },
    });

    return ok({ userId: user.uid, orgId: user.orgId, emailVerificationRequired: true }, { headers: { "Set-Cookie": cookie } });
  } catch (e) {
    console.error("[auth/register]", e);
    return fail("Could not create account", 500, "server_error");
  }
}