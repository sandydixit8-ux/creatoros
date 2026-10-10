import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "creatoros_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set to a strong value (32+ chars) in production");
  }
  return value || "dev-only-insecure-secret-change-me";
}

function hmac(payload: string): Buffer {
  return createHmac("sha256", secret()).update(payload).digest();
}

export function sign(payload: Record<string, string>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = hmac(body).toString("base64url");
  return `${body}.${sig}`;
}

export function verify(token: string): Record<string, string> | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = hmac(body);
  const provided = Buffer.from(sig, "base64url");
  if (expected.length !== provided.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected[i] ^ provided[i];
  if (mismatch !== 0) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export interface SessionPayload {
  userId: string;
  orgId: string;
}

export function buildSession(payload: SessionPayload): string {
  return sign({ userId: payload.userId, orgId: payload.orgId });
}

export function setSessionCookie(userId: string, orgId: string): string {
  const token = buildSession({ userId, orgId });
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(TTL_MS / 1000)}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function getSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return match ? match.slice(COOKIE_NAME.length + 1) : null;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function newJti(): string {
  return randomBytes(12).toString("hex");
}

void timingSafeEqual;