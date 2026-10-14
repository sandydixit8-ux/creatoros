import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { verifyPassword } from "@/lib/auth/password";
import { createEmailChange } from "@/lib/auth/email-change";
import { err, fail, ok, readJson, getClientIp } from "@/lib/http";
import { row } from "@/lib/db/db";
import { rateKey, rateLimit } from "@/lib/security/rate-limit";
import { sendEmail, defaultFromEmail } from "@/lib/email/mailer";
import { SITE_URL } from "@/lib/constants";
import { audit } from "@/lib/audit";

const schema = z.object({
  newEmail: z.string().email(),
  password: z.string().min(1),
});

/**
 * Start a login-email change. Two links are mailed — one to the current address,
 * one to the new one — and the change only lands when both are confirmed. The
 * current password is required so a stolen session cannot even start the dance.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();

  const ip = getClientIp(req);
  const rl = rateLimit(rateKey("account-email-change", s.user.id), 5, 15 * 60_000);
  if (!rl.allowed) return err.rateLimited();

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const newEmail = parsed.data.newEmail.toLowerCase().trim();
  if (newEmail === s.user.email.toLowerCase()) {
    return fail("That is already your email address", 400, "same_email");
  }

  const user = row<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", s.user.id);
  if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
    audit({ userId: s.user.id, action: "account.email_change_failed", meta: { reason: "bad_password" }, ip });
    return fail("Your password is incorrect", 400, "invalid_password");
  }

  const taken = row<{ id: string }>("SELECT id FROM users WHERE email = ?", newEmail);
  if (taken) return fail("That email is already in use", 409, "email_in_use");

  const change = createEmailChange(s.user.id, s.user.email, newEmail);
  const currentLink = `${SITE_URL}/account/email/confirm?token=${encodeURIComponent(change.currentToken)}`;
  const newLink = `${SITE_URL}/account/email/confirm?token=${encodeURIComponent(change.newToken)}`;
  const expiry = "60 minutes";

  // Best-effort, but the change cannot complete without both links, so a mail
  // failure just means nothing moves.
  try {
    await sendEmail({
      to: s.user.email,
      toName: s.user.name || undefined,
      fromEmail: defaultFromEmail(),
      subject: "Confirm the email change on your CreatorOS account",
      html: `<div style="font:15px/1.6 sans-serif;max-width:520px">
        <h2 style="margin:0 0 12px">Confirm your email change</h2>
        <p>We received a request to change the login email on your CreatorOS account to <strong>${escapeHtml(newEmail)}</strong>.</p>
        <p><a href="${currentLink}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Confirm this change</a></p>
        <p style="color:#666;font-size:13px">The change also needs to be confirmed from the new address, and this link expires in ${expiry}.</p>
        <p style="color:#666;font-size:13px">If you did not request this, ignore this email — nothing changes.</p>
      </div>`,
    });
    await sendEmail({
      to: newEmail,
      fromEmail: defaultFromEmail(),
      subject: "Verify your new CreatorOS email",
      html: `<div style="font:15px/1.6 sans-serif;max-width:520px">
        <h2 style="margin:0 0 12px">Verify your new email</h2>
        <p>Confirm that you want to use <strong>${escapeHtml(newEmail)}</strong> as the login email for your CreatorOS account.</p>
        <p><a href="${newLink}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Verify this address</a></p>
        <p style="color:#666;font-size:13px">This link expires in ${expiry}.</p>
        <p style="color:#666;font-size:13px">If you did not request this, ignore this email — nothing changes.</p>
      </div>`,
    });
  } catch (e) {
    console.error("[account] email change mail failed:", e);
  }

  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "account.email_change_requested",
    meta: { newEmail },
    ip,
  });
  return ok({ pending: true, newEmail });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
