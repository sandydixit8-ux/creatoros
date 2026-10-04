import { NextResponse } from "next/server";
import { z } from "zod";

export function ok(data: unknown, init?: { headers?: Record<string, string> }): NextResponse {
  return NextResponse.json({ ok: true, data }, { headers: init?.headers });
}

export function fail(message: string, status = 400, code = "error"): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export const err = {
  auth: () => fail("Not authenticated", 401, "auth_required"),
  forbidden: (message = "You don't have permission") => fail(message, 403, "forbidden"),
  notFound: () => fail("Not found", 404, "not_found"),
  conflict: (message = "Conflict") => fail(message, 409, "conflict"),
  validation: (details: unknown) =>
    NextResponse.json({ ok: false, error: { code: "validation", message: "Validation failed", details } }, { status: 400 }),
  server: () => fail("Internal server error", 500, "server_error"),
  rateLimited: () => fail("Too many requests. Please slow down.", 429, "rate_limited"),
};

export function parseBody<T extends z.ZodTypeAny>(body: unknown, schema: T):
  | { success: true; data: z.infer<T> }
  | { success: false; error: z.ZodError } {
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { success: false, error: parsed.error };
  return { success: true, data: parsed.data };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

/**
 * Country code from the edge/CDN in front of the app (Cloudflare sends
 * `cf-ipcountry`). Returns an uppercase ISO-3166 alpha-2 code, or "" when the
 * value is missing or not a real country (XX = unknown, T1 = Tor).
 */
export function clientCountry(req: Request): string {
  const raw =
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-country-code") ||
    "";
  const code = raw.trim().toUpperCase();
  if (!code || code === "XX" || code === "T1") return "";
  return code;
}

export function userAgentInfo(req: Request): { device: string; ref: string } {
  const ua = req.headers.get("user-agent") || "";
  const device = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
  const ref = req.headers.get("referer") || "";
  return { device, ref };
}