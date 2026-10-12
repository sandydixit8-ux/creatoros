import { describe, it, expect } from "vitest";
import {
  sign,
  verify,
  buildSession,
  setSessionCookie,
  getSessionCookie,
  sessionExpired,
  sessionVersion,
} from "./session";

describe("session signing", () => {
  it("signs and verifies a payload", () => {
    const token = sign({ userId: "usr_1", orgId: "org_1" });
    expect(verify(token)).toEqual({ userId: "usr_1", orgId: "org_1" });
  });

  it("rejects tampered tokens", () => {
    const token = sign({ userId: "usr_1", orgId: "org_1" });
    const [body, sig] = token.split(".");
    // flip a char in the signature
    const bogusSig = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(verify(`${body}.${bogusSig}`)).toBeNull();
  });

  it("rejects garbage tokens", () => {
    expect(verify("")).toBeNull();
    expect(verify("no.dots.here")).toBeNull();
    expect(verify("!!")).toBeNull();
  });

  it("builds a session carrying ids, auth version and expiry", () => {
    const before = Date.now();
    const token = buildSession({ userId: "u", orgId: "o", authVersion: 2 });
    const payload = verify(token)!;
    expect(payload.userId).toBe("u");
    expect(payload.orgId).toBe("o");
    expect(payload.av).toBe("2");
    expect(Number(payload.exp)).toBeGreaterThanOrEqual(before);
  });

  it("defaults the auth version to 0 when none is given", () => {
    expect(verify(buildSession({ userId: "u", orgId: "o" }))!.av).toBe("0");
  });
});

describe("session validity", () => {
  it("flags a payload past its expiry", () => {
    expect(sessionExpired({ exp: String(Date.now() - 1000) })).toBe(true);
    expect(sessionExpired({ exp: String(Date.now() + 60_000) })).toBe(false);
  });

  it("treats a legacy payload with no expiry as not expired", () => {
    expect(sessionExpired({})).toBe(false);
  });

  it("reads the auth version, defaulting a missing claim to 0", () => {
    expect(sessionVersion({ av: "3" })).toBe(3);
    expect(sessionVersion({})).toBe(0);
  });

  it("issues a cookie whose payload passes the expiry check", () => {
    const token = getSessionCookie(setSessionCookie("usr_1", "org_1", 0))!;
    expect(sessionExpired(verify(token)!)).toBe(false);
  });
});

describe("session cookie helpers", () => {
  it("sets and extracts the cookie", () => {
    const header = setSessionCookie("usr_1", "org_1");
    expect(header.startsWith("creatoros_session=")).toBe(true);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(getSessionCookie(header)).toBeTruthy();
  });

  it("extracts from multi-cookie headers", () => {
    const cookie = setSessionCookie("usr_1", "org_1");
    const header = `other=1; ${cookie}; foo=bar`;
    expect(getSessionCookie(header)).toBe(cookie.slice("creatoros_session=".length).split(";")[0]);
  });

  it("returns null without a session cookie", () => {
    expect(getSessionCookie(null)).toBeNull();
    expect(getSessionCookie("token=abc")).toBeNull();
  });
});