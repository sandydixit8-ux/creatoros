import { sign, verify } from "@/lib/auth/session";

/**
 * Server-held consent receipt (D-5 follow-up).
 *
 * Why this exists: the first version of the consent gate trusted an
 * `{ analytics: true }` flag in the request body. That is default-deny and it
 * refuses malformed input, but the caller is the one asserting consent, so a
 * visitor who has withdrawn (or never agreed) can still have their request
 * honoured by hand-crafting the body. Nothing recorded that a decision had ever
 * been made, so there was no evidence to point at afterwards.
 *
 * A signed HttpOnly cookie fixes that. The decision is captured server-side at
 * the moment it is expressed, carried in a cookie the page cannot read or
 * forge, and `/api/track` authorises from the receipt rather than from anything
 * the caller sends. The cookie is strictly necessary to remember the choice, so
 * setting it needs no consent of its own.
 *
 * Reuses the session module's HMAC helpers rather than duplicating the crypto.
 */

export const CONSENT_COOKIE_NAME = "creatoros_consent";
const TTL_SECONDS = 400 * 24 * 60 * 60;
const VERSION = "1";

export type ConsentSource = "banner" | "preferences" | "withdrawn";

export interface ConsentReceipt {
  analytics: boolean;
  decidedAt: string;
  source: ConsentSource;
}

function isSource(value: string | undefined): value is ConsentSource {
  return value === "banner" || value === "preferences" || value === "withdrawn";
}

export function buildConsentToken(analytics: boolean, source: ConsentSource, at = new Date()): string {
  return sign({
    a: analytics ? "1" : "0",
    d: at.toISOString(),
    s: source,
    v: VERSION,
  });
}

export function setConsentCookie(analytics: boolean, source: ConsentSource): string {
  const token = buildConsentToken(analytics, source);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${CONSENT_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL_SECONDS}${secure}`;
}

/**
 * Parse and authenticate a consent cookie.
 *
 * Returns `null` for a missing, malformed, wrongly-versioned or tampered
 * cookie. Callers must treat `null` as "no receipt", i.e. no consent.
 */
export function readConsentReceipt(cookieHeader: string | null): ConsentReceipt | null {
  if (!cookieHeader) return null;

  const raw = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((c) => c.startsWith(`${CONSENT_COOKIE_NAME}=`));
  if (!raw) return null;

  const token = raw.slice(CONSENT_COOKIE_NAME.length + 1);
  const payload = verify(token);
  if (!payload || payload.v !== VERSION) return null;
  if (payload.a !== "0" && payload.a !== "1") return null;
  if (!isSource(payload.s)) return null;
  if (!payload.d || Number.isNaN(Date.parse(payload.d))) return null;

  return { analytics: payload.a === "1", decidedAt: payload.d, source: payload.s };
}

/**
 * The single question `/api/track` asks.
 *
 * Strict on purpose: an absent, forged or expired receipt is a "no". Only a
 * receipt the server itself minted, carrying an affirmative analytics flag,
 * authorises recording.
 */
export function analyticsGranted(cookieHeader: string | null): boolean {
  return readConsentReceipt(cookieHeader)?.analytics === true;
}