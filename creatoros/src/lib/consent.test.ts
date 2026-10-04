import { describe, it, expect } from "vitest";
import {
  CONSENT_STORAGE_KEY,
  DEFAULT_CONSENT,
  OPTIONAL_CATEGORIES,
  buildConsentRecord,
  hasDecided,
  isCategoryAllowed,
  isConsentCategory,
  parseConsentRecord,
  toConsentSignal,
} from "./consent";

describe("consent defaults", () => {
  it("starts with analytics off", () => {
    // Under UK GDPR/PECR the default must be "no", never "yes".
    expect(DEFAULT_CONSENT.essential).toBe(true);
    expect(DEFAULT_CONSENT.analytics).toBe(false);
    expect(DEFAULT_CONSENT.decidedAt).toBe("");
  });

  it("exposes essential as non-optional", () => {
    expect(OPTIONAL_CATEGORIES).toEqual(["analytics"]);
    expect(OPTIONAL_CATEGORIES).not.toContain("essential");
  });

  it("uses a versioned storage key", () => {
    expect(CONSENT_STORAGE_KEY).toMatch(/_v\d+$/);
  });
});

describe("parseConsentRecord", () => {
  const valid = {
    essential: true,
    analytics: true,
    decidedAt: "2026-10-04T00:00:00.000Z",
    source: "banner",
  };

  it("accepts a well-formed record", () => {
    expect(parseConsentRecord(valid)).toEqual(valid);
  });

  it("rejects anything that is not an object", () => {
    expect(parseConsentRecord(null)).toBeNull();
    expect(parseConsentRecord(undefined)).toBeNull();
    expect(parseConsentRecord("analytics=true")).toBeNull();
    expect(parseConsentRecord(42)).toBeNull();
  });

  it("rejects a record whose types are wrong", () => {
    expect(parseConsentRecord({ ...valid, analytics: "yes" })).toBeNull();
    expect(parseConsentRecord({ ...valid, decidedAt: 123 })).toBeNull();
    expect(parseConsentRecord({ ...valid, essential: false })).toBeNull();
  });

  it("rejects an unknown source", () => {
    expect(parseConsentRecord({ ...valid, source: "somewhere-else" })).toBeNull();
  });

  it("does not let a forged record enable essential-only processing", () => {
    const parsed = parseConsentRecord({ ...valid, essential: false, analytics: true });
    expect(parsed).toBeNull();
  });

  it("ignores extra unexpected keys", () => {
    const parsed = parseConsentRecord({ ...valid, injected: "value" });
    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(valid);
  });
});

describe("isCategoryAllowed", () => {
  it("always allows essential, even with no decision on record", () => {
    expect(isCategoryAllowed("essential", null)).toBe(true);
    expect(isCategoryAllowed("essential", DEFAULT_CONSENT)).toBe(true);
  });

  it("blocks analytics when there is no record at all", () => {
    expect(isCategoryAllowed("analytics", null)).toBe(false);
  });

  it("blocks analytics when the visitor declined", () => {
    expect(isCategoryAllowed("analytics", buildConsentRecord({ analytics: false, source: "banner" }))).toBe(
      false
    );
  });

  it("allows analytics only after an explicit opt-in", () => {
    expect(isCategoryAllowed("analytics", buildConsentRecord({ analytics: true, source: "banner" }))).toBe(
      true
    );
  });
});

describe("hasDecided", () => {
  it("is false for a null record and true once a decision exists", () => {
    expect(hasDecided(null)).toBe(false);
    expect(hasDecided(buildConsentRecord({ analytics: false, source: "banner" }))).toBe(true);
  });
});

describe("buildConsentRecord", () => {
  it("stamps the decision time and keeps essential on", () => {
    const now = new Date("2026-10-04T12:00:00.000Z");
    const rec = buildConsentRecord({ analytics: true, source: "preferences", now });
    expect(rec).toEqual({
      essential: true,
      analytics: true,
      decidedAt: "2026-10-04T12:00:00.000Z",
      source: "preferences",
    });
  });
});

describe("toConsentSignal", () => {
  it("sends false when nothing is decided", () => {
    expect(toConsentSignal(null)).toEqual({ analytics: false });
  });

  it("mirrors the stored decision", () => {
    expect(toConsentSignal(buildConsentRecord({ analytics: true, source: "banner" }))).toEqual({
      analytics: true,
    });
    expect(toConsentSignal(buildConsentRecord({ analytics: false, source: "withdrawn" }))).toEqual({
      analytics: false,
    });
  });

  it("excludes provenance so the client cannot assert a richer claim", () => {
    const signal = toConsentSignal(buildConsentRecord({ analytics: true, source: "banner" }));
    expect(Object.keys(signal)).toEqual(["analytics"]);
  });
});

describe("isConsentCategory", () => {
  it("recognises only the known categories", () => {
    expect(isConsentCategory("essential")).toBe(true);
    expect(isConsentCategory("analytics")).toBe(true);
    expect(isConsentCategory("marketing")).toBe(false);
    expect(isConsentCategory(undefined)).toBe(false);
  });
});

describe("withdrawal round-trip", () => {
  it("returns the visitor to an undecided-like state", () => {
    const granted = buildConsentRecord({ analytics: true, source: "banner" });
    expect(isCategoryAllowed("analytics", granted)).toBe(true);

    const withdrawn = buildConsentRecord({ analytics: false, source: "withdrawn" });
    expect(isCategoryAllowed("analytics", withdrawn)).toBe(false);
    // Parsing the withdrawal from storage must not resurrect the old grant.
    expect(parseConsentRecord(JSON.parse(JSON.stringify(withdrawn)))).toEqual(withdrawn);
  });
});