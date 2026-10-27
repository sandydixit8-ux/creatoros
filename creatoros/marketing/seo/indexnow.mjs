#!/usr/bin/env node
/**
 * Submit every URL in the live sitemap to IndexNow.
 *
 * IndexNow is one API shared by Bing, Yandex, Naver and Seznam: one POST tells
 * all of them a URL changed, instead of waiting for a crawl. Bing also feeds
 * several AI answer engines, so this is the cheapest way to get new posts into
 * the index that Google does not control.
 *
 * Usage:
 *   node marketing/seo/indexnow.mjs           # submit
 *   node marketing/seo/indexnow.mjs --dry     # print the URLs only
 *
 * The key must be live at https://usecreatoros.co/<key>.txt before this runs;
 * the route is src/app/<key>.txt/route.ts and the value lives in
 * src/lib/indexnow.ts. Rotating the key means renaming that folder too.
 */

const HOST = "usecreatoros.co";
const KEY = "c7f1a4e9b28d43a6b9e0f1d2a3c4b5e6";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
const dry = process.argv.includes("--dry");

const keyRes = await fetch(KEY_LOCATION);
const keyBody = (await keyRes.text()).trim();
if (!keyRes.ok || keyBody !== KEY) {
  console.error(`Key file not live at ${KEY_LOCATION} (${keyRes.status}, body="${keyBody.slice(0, 40)}")`);
  process.exit(1);
}

const sitemap = await fetch(`https://${HOST}/sitemap.xml`).then((r) => r.text());
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter(Boolean);

if (urls.length === 0) {
  console.error("Sitemap contained no URLs");
  process.exit(1);
}

console.log(`submitting ${urls.length} URLs from sitemap.xml`);
for (const u of urls) console.log("  " + u);

if (dry) process.exit(0);

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
});

const body = await res.text();
// 200 = accepted, 202 = accepted but key still being validated.
console.log(`\nIndexNow responded ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 200)}` : ""}`);
if (![200, 202].includes(res.status)) process.exit(1);
