import { describe, it, expect } from "vitest";
import {
  CONSENT_COOKIE_NAME,
  analyticsGranted,
  buildConsentToken,
  readConsentReceipt,
  setConsentCookie,
} from "@/lib/consent-receipt";
import { sign } from "@/lib/auth/session";

/**
 * The receipt is the thing the server actually trusts, so these tests treat it
 * as a security boundary rather than as bookkeeping.
 */

function cookieHeader(value: string): string {
  return `${CONSENT_COOKIE_NAME}=${value}`;
}

describe("consent receipt: minting", () => {
  it("round-trips an affirmative decision", () => {
    const token = buildConsentToken(true, "banner", new Date("2026-10-04T12:00:00Z"));
    const receipt = readConsentReceipt(cookieHeader(token));

    expect(receipt).not.toBeNull();
    expect(receipt?.analytics).toBe(true);
    expect(receipt?.source).toBe("banner");
    expect(receipt?.decidedAt).toBe("2026-10-04T12:00:00.000Z");
  });

  it("round-trips a refusal and a withdrawal as 'not granted'", () => {
    const refused = buildConsentToken(false, "banner");
    expect(readConsentReceipt(cookieHeader(refused))?.analytics).toBe(false);
    expect(analyticsGranted(cookieHeader(refused))).toBe(false);

    const withdrawn = buildConsentToken(false, "withdrawn");
    expect(readConsentReceipt(cookieHeader(withdrawn))?.source).toBe("withdrawn");
    expect(analyticsGranted(cookieHeader(withdrawn))).toBe(false);
  });

  it("emits an HttpOnly, SameSite=Lax cookie so page scripts cannot read it", () => {
    const header = setConsentCookie(true, "banner");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/");
    expect(header).toMatch(/Max-Age=\d+/);
  });
});

describe("consent receipt: forgery is refused", () => {
  it("returns null when there is no cookie at all", () => {
    expect(readConsentReceipt(null)).toBeNull();
    expect(analyticsGranted(null)).toBe(false);
    expect(analyticsGranted("")).toBe(false);
  });

  it("returns null for an empty or structurally broken cookie", () => {
    for (const bad of ["", "abc", ".", "a.b", "onlyonepart"]) {
      expect(readConsentReceipt(cookieHeader(bad))).toBeNull();
      expect(analyticsGranted(cookieHeader(bad))).toBe(false);
    }
  });

  it("refuses a payload whose signature does not match", () => {
    const token = buildConsentToken(true, "banner");
    const [body, sig] = token.split(".");

    // Flip the FIRST signature character, not the last. In base64url the final
    // character can encode padding bits alone, so rewriting it may decode to the
    // very same bytes - which left this test passing or failing depending on the
    // random signature it happened to be handed.
    const tamperedSig = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    expect(tamperedSig).not.toBe(sig);

    // Guard the guard: confirm the tamper really does change the signature bytes.
    expect(Buffer.from(tamperedSig, "base64url").equals(Buffer.from(sig, "base64url"))).toBe(false);

    expect(readConsentReceipt(cookieHeader(`${body}.${tamperedSig}`))).toBeNull();
    expect(analyticsGranted(cookieHeader(`${body}.${tamperedSig}`))).toBe(false);
  });

  it("refuses an unsigned hand-rolled 'analytics granted' payload", () => {
    // Exactly what an attacker would try: claim consent with no signature.
    const forged = Buffer.from(
      JSON.stringify({ a: "1", d: new Date().toISOString(), s: "banner", v: "1" })
    ).toString("base64url");

    expect(readConsentReceipt(cookieHeader(forged))).toBeNull();
    expect(analyticsGranted(cookieHeader(forged))).toBe(false);
  });

  it("refuses a re-signed payload with an unexpected source", () => {
    const bad = sign({ a: "1", d: new Date().toISOString(), s: "forged", v: "1" });
    expect(readConsentReceipt(cookieHeader(bad))).toBeNull();
    expect(analyticsGranted(cookieHeader(bad))).toBe(false);
  });

  it("refuses a re-signed payload with an unrecognised analytics value", () => {
    for (const a of ["true", "yes", "2", ""]) {
      const bad = sign({ a, d: new Date().toISOString(), s: "banner", v: "1" });
      expect(readConsentReceipt(cookieHeader(bad))).toBeNull();
    }
  });

  it("refuses a re-signed payload with a missing or unparseable timestamp", () => {
    const noDate = sign({ a: "1", s: "banner", v: "1" });
    expect(readConsentReceipt(cookieHeader(noDate))).toBeNull();

    const badDate = sign({ a: "1", d: "not-a-date", s: "banner", v: "1" });
    expect(readConsentReceipt(cookieHeader(badDate))).toBeNull();
  });

  it("refuses a receipt minted for a future schema version", () => {
    const future = sign({ a: "1", d: new Date().toISOString(), s: "banner", v: "2" });
    expect(readConsentReceipt(cookieHeader(future))).toBeNull();
    expect(analyticsGranted(cookieHeader(future))).toBe(false);
  });
});

describe("consent receipt: cookie header parsing", () => {
  it("finds the consent cookie among other cookies", () => {
    const token = buildConsentToken(true, "preferences");
    const header = `creatoros_session=abc; ${cookieHeader(token)}; other=1`;
    expect(readConsentReceipt(header)?.analytics).toBe(true);
  });

  it("ignores a same-named cookie that is not the consent cookie", () => {
    expect(readConsentReceipt("creatoros_consent_extra=nope")).toBeNull();
  });
});