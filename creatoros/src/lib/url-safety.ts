/**
 * URL scheme allowlist for user-supplied links.
 *
 * `z.string().url()` accepts `javascript:` and `data:` URLs, and bio block
 * payloads are stored as free-form JSON, so any URL that ends up in an `href`
 * must be checked at the point of entry. Rendering into `href` without this is
 * stored XSS: the payload executes in our origin when a visitor clicks it,
 * including while they are authenticated.
 */

/** Schemes that are safe to place in an href. */
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/** Schemes that execute script or inline content when placed in an href. */
const DANGEROUS_SCHEMES = ["javascript:", "vbscript:", "data:", "file:", "blob:", "about:"];

/** True if the value contains C0/C1 control characters. */
function hasControlChars(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

/**
 * A URL is safe only if it parses and carries an allowlisted scheme. Anything
 * else is rejected: an empty scheme, a relative path, a protocol-relative
 * //host, or an obfuscated scheme using embedded control characters.
 */
export function isSafeUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (hasControlChars(trimmed)) return false;
  // Protocol-relative and backslash-obfuscated forms can disguise the host.
  if (/^[/\\]{2}/.test(trimmed)) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  return SAFE_SCHEMES.has(parsed.protocol.toLowerCase());
}

/** Return the URL unchanged if safe, otherwise an empty string. */
export function sanitizeUrl(value: unknown): string {
  return isSafeUrl(value) ? (value as string).trim() : "";
}

/** True when the value is a plain http(s) URL, i.e. safe to fetch server-side. */
export function isHttpUrl(value: unknown): value is string {
  if (!isSafeUrl(value)) return false;
  const protocol = new URL((value as string).trim()).protocol.toLowerCase();
  return protocol === "http:" || protocol === "https:";
}

/** Remove characters browsers ignore while resolving a scheme (C0 controls, space). */
function normalizeScheme(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x20 || (code >= 0x7f && code <= 0x9f)) continue;
    out += ch;
  }
  return out.toLowerCase();
}

/**
 * True when the string carries a script-capable or inline-content scheme.
 *
 * Browsers strip control characters and spaces while parsing a scheme, so a
 * tab-obfuscated "javascript:" still resolves. Normalising first makes the
 * check resistant to that. Used to police free-form payloads such as bio
 * blocks, where we cannot know which keys hold URLs.
 */
export function hasDangerousScheme(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = normalizeScheme(value);
  return DANGEROUS_SCHEMES.some((scheme) => normalized.startsWith(scheme));
}

/** Recursively test every string in a JSON-ish payload for a dangerous scheme. */
export function payloadHasDangerousScheme(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (typeof value === "string") return hasDangerousScheme(value);
  if (Array.isArray(value)) return value.some((v) => payloadHasDangerousScheme(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((v) =>
      payloadHasDangerousScheme(v, depth + 1)
    );
  }
  return false;
}
