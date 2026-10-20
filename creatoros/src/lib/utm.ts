// First-party campaign attribution. Paid traffic (Google Ads for YouTube, social
// posts) lands with utm_* params and, for Google Ads, a gclid. We capture them on
// the first page view of a visit, store them in a durable cookie, and forward them
// on signup/purchase so attribution survives the redirect into the app.

export const UTM_COOKIE = "creatoros_attr";

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
] as const;

export type UtmKey = (typeof UTM_KEYS)[number];
export type UtmData = Partial<Record<UtmKey, string>>;

// 90 days: long enough to cover a YouTube ad view -> signup path.
export const UTM_MAX_AGE_DAYS = 90;

export function parseUtm(search: string): UtmData {
  const params = new URLSearchParams(search);
  const out: UtmData = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) out[key] = value.slice(0, 256);
  }
  return out;
}

export function serializeUtm(data: UtmData): string {
  return JSON.stringify(data);
}

export function deserializeUtm(raw: string | null | undefined): UtmData {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: UtmData = {};
    for (const key of UTM_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "string" && value) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function readUtmCookie(): UtmData {
  if (typeof document === "undefined") return {};
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${UTM_COOKIE}=`));
  if (!match) return {};
  return deserializeUtm(match.slice(UTM_COOKIE.length + 1));
}

export function writeUtmCookie(data: UtmData): void {
  if (typeof document === "undefined") return;
  if (Object.keys(data).length === 0) return;
  const maxAge = UTM_MAX_AGE_DAYS * 24 * 60 * 60;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${UTM_COOKIE}=${encodeURIComponent(
    serializeUtm(data)
  )}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}
