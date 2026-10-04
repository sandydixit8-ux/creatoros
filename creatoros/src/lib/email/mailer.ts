import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { SITE_URL } from "@/lib/constants";
import { sign } from "@/lib/auth/session";

export interface EmailMessage {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
}

export interface EmailResult {
  provider: string;
  providerId: string;
  previewPath?: string;
}

/** Replace {{placeholder}} tokens in a template body. */
export function renderTokens(body: string, vars: Record<string, string | number>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    if (key in vars) return String(vars[key]);
    return "";
  });
}

/** Build the unsubscribe link for a tenant + recipient email. */
export function buildUnsubscribeUrl(tenantId: string, email: string): string {
  const token = sign({ scope: "email_unsubscribe", tenantId, email });
  return `${SITE_URL}/api/email/unsubscribe?t=${token}`;
}

export function emailConfigured(): boolean {
  const provider = configuredProvider();
  if (provider === null) return false;
  if (provider === "log") return logFallbackAllowed();
  if (provider === "resend") return Boolean(process.env.RESEND_API_KEY);
  if (provider === "mailgun") return Boolean(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
  if (provider === "brevo") return Boolean(process.env.BREVO_API_KEY);
  return false;
}

type EmailProvider = "log" | "resend" | "mailgun" | "brevo";

/**
 * Resolve the active backend, or null when EMAIL_PROVIDER is unset or
 * unrecognised.
 *
 * The "log" backend is a development convenience. Returning null rather than
 * silently degrading to "log" matters: callers treat a resolved promise as a
 * delivered email, so an unset variable in production has to fail loudly
 * instead of writing a file and reporting success.
 */
function configuredProvider(): EmailProvider | null {
  const raw = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  if (raw === "resend" || raw === "mailgun" || raw === "brevo" || raw === "log") return raw;
  return null;
}

/** True when file logging is permitted. Never true in production. */
function logFallbackAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.ALLOW_EMAIL_FILE_FALLBACK !== "false";
}

export function defaultFromEmail(): string {
  return process.env.EMAIL_FROM || "no-reply@creatoros.dev";
}

/**
 * Provider-agnostic mailer. Choose a backend with EMAIL_PROVIDER:
 *   - "log"    writes rendered HTML to data/emails/ — dev preview, zero config
 *   - "resend" uses the Resend HTTP API (RESEND_API_KEY)
 *   - "mailgun" uses the Mailgun HTTP API (MAILGUN_API_KEY + MAILGUN_DOMAIN)
 *   - "brevo"  uses the Brevo (ex-Sendinblue) HTTP API (BREVO_API_KEY)
 *
 * A provider that is configured but rejects the message throws, so the caller
 * records a failed send instead of a false success. Falling back to log mode is
 * only permitted outside production.
 */
export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const provider = configuredProvider();
  const from = `${msg.fromName || process.env.EMAIL_FROM_NAME || "CreatorOS"} <${msg.fromEmail || defaultFromEmail()}>`;

  // No recognisable provider. Outside production this falls through to the log
  // preview below; in production it must not report a delivered email.
  if (provider === null && !logFallbackAllowed()) {
    throw new Error(
      "EMAIL_PROVIDER is not set to a supported provider (resend, mailgun, brevo); refusing to report a file write as a sent email"
    );
  }

  if (provider === "resend") {
    if (!process.env.RESEND_API_KEY) throw new Error("EMAIL_PROVIDER=resend but RESEND_API_KEY is not set");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [msg.toName ? `${msg.toName} <${msg.to}>` : msg.to],
        subject: msg.subject,
        html: msg.html,
        reply_to: msg.replyTo,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { id: string };
      return { provider: "resend", providerId: data.id };
    }
    throw new Error(`resend rejected the message (${res.status}): ${await safeBody(res)}`);
  }

  if (provider === "mailgun") {
    if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
      throw new Error("EMAIL_PROVIDER=mailgun but MAILGUN_API_KEY/MAILGUN_DOMAIN are not set");
    }
    const form = new FormData();
    form.set("from", from);
    form.set("to", msg.toName ? `${msg.toName} <${msg.to}>` : msg.to);
    form.set("subject", msg.subject);
    form.set("html", msg.html);
    if (msg.replyTo) form.set("h:Reply-To", msg.replyTo);
    const res = await fetch(`https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64")}` },
      body: form,
    });
    if (res.ok) {
      const data = (await res.json()) as { id: string };
      return { provider: "mailgun", providerId: data.id };
    }
    throw new Error(`mailgun rejected the message (${res.status}): ${await safeBody(res)}`);
  }

  if (provider === "brevo") {
    if (!process.env.BREVO_API_KEY) throw new Error("EMAIL_PROVIDER=brevo but BREVO_API_KEY is not set");
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: {
          name: msg.fromName || process.env.EMAIL_FROM_NAME || "CreatorOS",
          email: msg.fromEmail || defaultFromEmail(),
        },
        to: [{ email: msg.to, ...(msg.toName ? { name: msg.toName } : {}) }],
        subject: msg.subject,
        htmlContent: msg.html,
        ...(msg.replyTo ? { replyTo: { email: msg.replyTo } } : {}),
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { messageId: string };
      return { provider: "brevo", providerId: data.messageId };
    }
    throw new Error(`brevo rejected the message (${res.status}): ${await safeBody(res)}`);
  }

  if (!logFallbackAllowed()) {
    throw new Error("No email provider is configured; refusing to report a file write as a sent email");
  }

  // log provider (development only)
  const id = randomBytes(8).toString("hex");
  const dir = join(process.cwd(), "data", "emails");
  mkdirSync(dir, { recursive: true });
  const filename = `${Date.now()}-${id}.html`;
  const previewPath = join(dir, filename);
  writeFileSync(
    previewPath,
    `<!-- to: ${msg.to} -->\n<!-- subject: ${msg.subject} -->\n<div style="padding:16px;font:14px/1.5 sans-serif">${msg.html}</div>`,
    "utf8"
  );
  return { provider: "log", providerId: id, previewPath };
}

/** Provider error bodies are untrusted; keep only a short prefix for logs. */
async function safeBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 200);
  } catch {
    return "<unreadable body>";
  }
}