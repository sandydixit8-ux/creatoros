import { describe, it, expect, afterEach, vi } from "vitest";
import {
  renderTokens,
  buildUnsubscribeUrl,
  sendEmail,
  emailConfigured,
  type EmailMessage,
} from "./mailer";
import { verify } from "@/lib/auth/session";

// NODE_ENV is typed read-only by the Next.js env types, so environment
// overrides go through vi.stubEnv, which also restores them after each test.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const msg: EmailMessage = {
  to: "fan@example.com",
  subject: "Hello",
  html: "<p>Hi</p>",
};

describe("mailer renderTokens", () => {
  it("replaces {{placeholder}} with values", () => {
    expect(renderTokens("Hi {{name}}, your email is {{email}}", { name: "Aqui", email: "a@b.co" })).toBe(
      "Hi Aqui, your email is a@b.co"
    );
  });

  it("tolerates whitespace inside braces", () => {
    expect(renderTokens("Hello {{ name }}!", { name: "X" })).toBe("Hello X!");
  });

  it("empties unknown tokens", () => {
    expect(renderTokens("a {{missing}} b", {})).toBe("a  b");
  });

  it("handles numeric values", () => {
    expect(renderTokens("Count: {{count}}", { count: 12 })).toBe("Count: 12");
  });

  it("renders unsubscribe url token", () => {
    const out = renderTokens('<a href="{{unsubscribe_url}}">unsub</a>', { unsubscribe_url: "https://x/y" });
    expect(out).toContain("https://x/y");
  });
});

describe("mailer buildUnsubscribeUrl", () => {
  it("emits a signed token carrying the tenant and email", () => {
    const url = buildUnsubscribeUrl("org_abc", "fan@example.com");
    const token = new URL(url).searchParams.get("t") || "";
    const payload = verify(token);
    expect(payload?.scope).toBe("email_unsubscribe");
    expect(payload?.tenantId).toBe("org_abc");
    expect(payload?.email).toBe("fan@example.com");
  });

  it("fails to verify tampered tokens", () => {
    const payload = verify("Zm9v.eWVsbA");
    expect(payload).toBeNull();
  });
});

describe("mailer provider resolution (D-3: no silent fail-open)", () => {
  it("treats an unset provider as unconfigured in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_PROVIDER", undefined);
    expect(emailConfigured()).toBe(false);
  });

  it("treats an unrecognised provider as unconfigured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_PROVIDER", "sendgrid");
    expect(emailConfigured()).toBe(false);
  });

  it("does not report the log backend as configured in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_PROVIDER", "log");
    expect(emailConfigured()).toBe(false);
  });

  it("requires the provider's credentials before reporting configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", undefined);
    expect(emailConfigured()).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    expect(emailConfigured()).toBe(true);
  });

  it("allows the log backend outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("EMAIL_PROVIDER", "log");
    expect(emailConfigured()).toBe(true);
  });
});

describe("mailer sendEmail failure handling (D-3)", () => {
  it("throws instead of reporting a sent email when no provider is set in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_PROVIDER", undefined);
    await expect(sendEmail(msg)).rejects.toThrow(/EMAIL_PROVIDER/);
  });

  it("throws when the log backend is explicitly selected in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_PROVIDER", "log");
    await expect(sendEmail(msg)).rejects.toThrow(/refusing to report a file write/);
  });

  it("throws when a configured provider has no credentials", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_PROVIDER", "brevo");
    vi.stubEnv("BREVO_API_KEY", undefined);
    await expect(sendEmail(msg)).rejects.toThrow(/BREVO_API_KEY/);
  });

  it("propagates a provider rejection rather than falling back to a file write", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("invalid api key", { status: 401 }))
    );

    await expect(sendEmail(msg)).rejects.toThrow(/resend rejected the message \(401\)/);
  });

  it("returns the provider id on success", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ id: "msg_123" }, { status: 200 }))
    );

    const result = await sendEmail(msg);
    expect(result).toEqual({ provider: "resend", providerId: "msg_123" });
  });
});