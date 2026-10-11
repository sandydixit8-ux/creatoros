import { describe, expect, it } from "vitest";
import { sign } from "../session";
import { createFlow, resolveFlow, sanitizeRedirectTo } from "./flow";

describe("OAuth flow cookie", () => {
  const uri = "https://rankpilot.example/api/auth/oauth/google/callback";

  it("produces a signed value; verifier lives only inside the cookie", () => {
    const flow = createFlow({ redirectTo: "/app", redirectUri: uri });
    expect(flow.cookieValue).toContain(".");
    expect(flow.state).toHaveLength(43);
    expect(flow.codeChallenge).toHaveLength(43);
    // The verifier must not be returned to the calling route; it may only be
    // recovered from the signed cookie, so a leaked cookie cannot be replayed
    // for a different flow without also leaking the HMAC key.
    expect("verifier" in flow).toBe(false);
    expect(flow.state).not.toBe(flow.codeChallenge);
  });

  it("completes when the presented state matches", () => {
    const flow = createFlow({ redirectTo: "/reports", redirectUri: uri });
    const result = resolveFlow(flow.cookieValue, flow.state);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.flow.verifier).toHaveLength(43);
      expect(result.flow.verifier).not.toBe(flow.state);
      expect(result.flow.redirectUri).toBe(uri);
      expect(result.flow.redirectTo).toBe("/reports");
    }
  });

  it("rejects a missing or wrong state", () => {
    const flow = createFlow({ redirectTo: "/app", redirectUri: uri });
    expect(resolveFlow(null, flow.state).ok).toBe(false);
    expect(resolveFlow("", flow.state).ok).toBe(false);
    expect(resolveFlow(flow.cookieValue, "").ok).toBe(false);
    const other = createFlow({ redirectTo: "/app", redirectUri: uri });
    expect(resolveFlow(flow.cookieValue, other.state).ok).toBe(false);
  });

  it("rejects a tampered cookie", () => {
    const flow = createFlow({ redirectTo: "/app", redirectUri: uri });
    // Flip the first signature character. Every bit of a base64url character is
    // significant there, unlike the final character whose low bits are padding —
    // tampering the last char can decode to the identical signature.
    const dot = flow.cookieValue.lastIndexOf(".");
    const sig = flow.cookieValue.slice(dot + 1);
    const tamperedSig = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    const tampered = `${flow.cookieValue.slice(0, dot + 1)}${tamperedSig}`;
    expect(resolveFlow(tampered, flow.state).ok).toBe(false);
  });

  it("rejects an expired cookie even with the right state", () => {
    const state = "the-issued-state-00000000000000000000000000";
    // A flow signed in the past: the signature and state are perfectly valid,
    // only the TTL has passed. This is exactly what a replay after 10 minutes
    // looks like, so it must be indistinguishable from a forged cookie.
    const expired = sign({
      state,
      verifier: "v".repeat(43),
      redirectTo: "/app",
      redirectUri: uri,
      expiresAt: String(Date.now() - 1000),
    });
    expect(resolveFlow(expired, state).ok).toBe(false);
    const live = sign({
      state,
      verifier: "v".repeat(43),
      redirectTo: "/app",
      redirectUri: uri,
      expiresAt: String(Date.now() + 60_000),
    });
    expect(resolveFlow(live, state).ok).toBe(true);
  });

  it("falls back to /app for any non-local destination", () => {
    expect(sanitizeRedirectTo("/reports")).toBe("/reports");
    expect(sanitizeRedirectTo("//evil.example")).toBe("/app");
    expect(sanitizeRedirectTo("https://evil.example/x")).toBe("/app");
    expect(sanitizeRedirectTo("")).toBe("/app");
    expect(sanitizeRedirectTo("/a\\b")).toBe("/app");
  });

  it("truncates absurdly long redirects", () => {
    const long = "/" + "a".repeat(5000);
    expect(sanitizeRedirectTo(long).length).toBeLessThanOrEqual(512);
  });
});