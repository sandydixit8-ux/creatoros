import { headers } from "next/headers";

/**
 * Country of the visitor, two-letter ISO code.
 *
 * Cloudflare stamps `cf-ipcountry` on every request that reaches the origin;
 * `src/proxy.ts` copies it to `x-cr-country` so pages are not coupled to the
 * edge provider's header name. Unknown (local dev, direct-to-origin probe)
 * returns an empty string, which falls back to USD everywhere.
 */
export async function visitorCountry(): Promise<string> {
  const h = await headers();
  return (h.get("x-cr-country") || "").trim().toUpperCase();
}
