/**
 * Cookie / tracking consent (D-5).
 *
 * The published Cookie Policy promises that we "ask for your consent before
 * setting non-essential cookies" and that consent can be "withdrawn at any
 * time". Neither was true: `/api/track` recorded visitor IP, a hashed visitor
 * id, device and country on every bio page view with no consent step at all.
 *
 * Two rules make this defensible rather than cosmetic:
 *
 *  1. Nothing non-essential runs until the visitor actively opts in. The
 *     default is "no", not "yes".
 *  2. The gate is enforced **server-side** in `/api/track`, not just hidden in
 *     the browser. A hidden fetch is not a control - anyone can call the
 *     endpoint directly.
 *
 * The record itself lives in localStorage. That is deliberate: storing the
 * consent decision is itself strictly necessary (we cannot honour a withdrawal
 * otherwise), so it does not require consent, and it avoids setting a
 * non-essential cookie just to record that we must not set one.
 */

export const CONSENT_STORAGE_KEY = "creatoros_consent_v1";

export type ConsentCategory = "essential" | "analytics";

export type ConsentRecord = {
  /** Only "essential" is ever true on a fresh profile; set by explicit action. */
  essential: true;
  analytics: boolean;
  /** ISO timestamp of the decision. */
  decidedAt: string;
  /**
   * How the decision was made. Retained for accountability: consent given by
   * clicking "Accept all" is weaker evidence than a granular preference.
   */
  source: "banner" | "preferences" | "withdrawn";
};

export type ConsentState = "unknown" | "granted" | "denied";

/** New visitors have given nothing, so only the always-on category is on. */
export const DEFAULT_CONSENT: ConsentRecord = {
  essential: true,
  analytics: false,
  decidedAt: "",
  source: "banner",
};

/** Only these categories may ever be toggled by the visitor. */
export const OPTIONAL_CATEGORIES: ConsentCategory[] = ["analytics"];

export function isConsentCategory(value: unknown): value is ConsentCategory {
  return value === "essential" || value === "analytics";
}

/**
 * Validate a persisted record read from storage.
 *
 * localStorage is user-writable, so treat its contents as untrusted input: a
 * hand-edited `analytics: true` is exactly what an attacker or an over-eager
 * extension would produce. Anything unrecognised falls back to "no consent"
 * rather than to "granted".
 */
export function parseConsentRecord(raw: unknown): ConsentRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.essential !== true) return null;
  if (typeof r.analytics !== "boolean") return null;
  if (typeof r.decidedAt !== "string") return null;
  const source = r.source;
  if (source !== "banner" && source !== "preferences" && source !== "withdrawn") return null;
  return {
    essential: true,
    analytics: r.analytics,
    decidedAt: r.decidedAt,
    source,
  };
}

/**
 * Whether a given category may run. Absent or malformed state means only
 * strictly necessary processing, which is the correct default under
 * UK GDPR + PECR + eConsent.
 */
export function isCategoryAllowed(category: ConsentCategory, record: ConsentRecord | null): boolean {
  if (category === "essential") return true;
  return record?.analytics === true;
}

/** True once the visitor has made any decision at all. */
export function hasDecided(record: ConsentRecord | null): boolean {
  return record !== null;
}

export function buildConsentRecord(opts: {
  analytics: boolean;
  source: ConsentRecord["source"];
  now?: Date;
}): ConsentRecord {
  return {
    essential: true,
    analytics: opts.analytics,
    decidedAt: (opts.now ?? new Date()).toISOString(),
    source: opts.source,
  };
}

/**
 * The subset of a record that is safe to send to the server for the
 * authorisation decision. Deliberately excludes `decidedAt`/`source` so the
 * gate is a pure boolean check rather than something a client can forge into a
 * richer claim.
 */
export function toConsentSignal(record: ConsentRecord | null): { analytics: boolean } {
  return { analytics: record?.analytics === true };
}