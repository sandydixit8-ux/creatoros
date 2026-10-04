import { describe, it, expect } from "vitest";
import { isSafeUrl, sanitizeUrl, isHttpUrl, hasDangerousScheme, payloadHasDangerousScheme } from "./url-safety";

describe("isSafeUrl", () => {
  it("accepts ordinary web, mail and tel links", () => {
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("http://example.com/path?q=1")).toBe(true);
    expect(isSafeUrl("mailto:hi@example.com")).toBe(true);
    expect(isSafeUrl("tel:+911234567890")).toBe(true);
  });

  it("rejects script-capable schemes", () => {
    // z.string().url() accepts all of these; rendering them into href is XSS.
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("JaVaScRiPt:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeUrl("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeUrl("blob:https://example.com/x")).toBe(false);
  });

  it("rejects relative, protocol-relative and empty values", () => {
    expect(isSafeUrl("/u/someone")).toBe(false);
    expect(isSafeUrl("//evil.example.com")).toBe(false);
    expect(isSafeUrl("\\\\evil.example.com")).toBe(false);
    expect(isSafeUrl("")).toBe(false);
    expect(isSafeUrl("   ")).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(42)).toBe(false);
    expect(isSafeUrl({ href: "https://example.com" })).toBe(false);
  });

  it("rejects schemes obfuscated with control characters or spaces", () => {
    expect(isSafeUrl("java\tscript:alert(1)")).toBe(false);
    expect(isSafeUrl("java\nscript:alert(1)")).toBe(false);
    expect(isSafeUrl("  javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("java\u0000script:alert(1)")).toBe(false);
  });
});

describe("sanitizeUrl", () => {
  it("returns the URL when safe and an empty string otherwise", () => {
    expect(sanitizeUrl("  https://example.com  ")).toBe("https://example.com");
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeUrl(undefined)).toBe("");
  });
});

describe("isHttpUrl", () => {
  it("is true only for http and https", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("mailto:hi@example.com")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("hasDangerousScheme", () => {
  it("detects dangerous schemes after normalising obfuscation", () => {
    expect(hasDangerousScheme("javascript:alert(1)")).toBe(true);
    expect(hasDangerousScheme("java\tscript:alert(1)")).toBe(true);
    expect(hasDangerousScheme("DATA:text/html,x")).toBe(true);
    expect(hasDangerousScheme("https://example.com")).toBe(false);
    expect(hasDangerousScheme("just some text")).toBe(false);
  });

  it("does not misfire on ordinary text containing a colon", () => {
    // Clock times and prose must not be mistaken for a scheme.
    expect(hasDangerousScheme("10:30")).toBe(false);
    expect(hasDangerousScheme("Note: bring your portfolio")).toBe(false);
  });
});

describe("payloadHasDangerousScheme", () => {
  it("finds a dangerous scheme nested anywhere in a bio block payload", () => {
    expect(payloadHasDangerousScheme({ url: "https://ok.example" })).toBe(false);
    expect(payloadHasDangerousScheme({ url: "javascript:alert(1)" })).toBe(true);
    expect(payloadHasDangerousScheme({ style: { bg: "javascript:alert(1)" } })).toBe(true);
    expect(payloadHasDangerousScheme({ links: [{ href: "https://a" }, { href: "javascript:x" }] })).toBe(true);
  });

  it("ignores non-strings and stops at a sane depth", () => {
    expect(payloadHasDangerousScheme({ n: 1, b: true, z: null })).toBe(false);
    expect(payloadHasDangerousScheme(undefined)).toBe(false);
    let deep: Record<string, unknown> = { url: "javascript:alert(1)" };
    for (let i = 0; i < 20; i++) deep = { nested: deep };
    expect(payloadHasDangerousScheme(deep)).toBe(false);
  });
});
