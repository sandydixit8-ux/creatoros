/**
 * IndexNow key file: https://usecreatoros.co/<key>.txt
 *
 * Bing, Yandex, Seznam and Naver fetch this file to prove we own the host
 * before accepting URL submissions. The body must be exactly the key, so this
 * route serves plain text and nothing else. See marketing/seo/indexnow.mjs for
 * the submitter that reads the same key from src/lib/indexnow.ts.
 */
import { INDEXNOW_KEY } from "@/lib/indexnow";

export const dynamic = "force-static";

export function GET() {
  return new Response(INDEXNOW_KEY, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
