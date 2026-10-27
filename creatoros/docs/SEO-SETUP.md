# CreatorOS — SEO Setup & Per-Page Metadata Strategy

Applies to `https://usecreatoros.co` (deployed 2026-10-11, BUILD_ID `BV3YuJAAPxGWHGqw6E3Mm`).

## 1. Applied infra changes (2026-10-11)

| Item | Status | Where |
|---|---|---|
| `www` → apex **301 permanent redirect** | DONE, live | `caddy.service` on origin; edge through Cloudflare |
| Single `Content-Security-Policy` header (no duplicates) | Verified live | app `proxy`/middleware |
| `x-powered-by` suppressed | Verified live | Next config |
| robots.txt: `/auth/` disallowed, others allowed | Verified live | `src/app/robots.ts` |
| sitemap: 2 public URLs (`/`, `/pricing`), legal/contact + `/auth` + `/u/*` excluded | Verified live | `src/app/sitemap.ts` |
| Runtime `SITE_URL = https://usecreatoros.co` (canonicals absolute) | Build-time `NEXT_PUBLIC_SITE_URL` | `src/lib/constants.ts` |

Caddy change specifics (`/etc/caddy/Caddyfile`):
```
www.usecreatoros.co {
    tls /home/ubuntu/certs/origin.pem /home/ubuntu/certs/origin.key
    redir https://usecreatoros.co{uri} permanent
}
```
Applied via admin API `POST /load` (graceful, zero downtime). Note: `systemctl reload caddy` alone does **not** swap config on this box (Caddy 2.8.4 logs `SIGUSR1 not implemented`) — use `caddy reload` or the admin endpoint, then re-verify.

## 2. Per-page metadata strategy

Pattern: `title.template = "%s | CreatorOS"`; default title = `CreatorOS — Create. Grow. Sell. Automate. All in One Place.`

| Route | Title (H1 / <title>) | Meta description | Canonical | Index |
|---|---|---|---|---|
| `/` | CreatorOS — Create. Grow. Sell. Automate. All in One Place. | "The all-in-one creator & business monetization operating system: link-in-bio store, booking, courses, analytics, AI growth coach, email and more." | `https://usecreatoros.co/` | index |
| `/pricing` | Pricing | "Simple, transparent pricing for creators. Start free, upgrade when you grow. Cancel anytime." | `/pricing` | index |
| `/terms` `/privacy` `/refund-policy` `/cookie-policy` `/contact` | {```Legal page```} | from `legalMetadata()` helper | — | **noindex** until counsel-approved copy lands (then flip to index) |
| `/auth/login` `/auth/register` `/auth/forgot-password` `/auth/reset-password` | Log in / Create account / Reset password | short | — | **noindex** (robots disallow + metadata) |
| `/u/{username}` | generated from creator page title | generated | generated | index (creator value) |
| `/u/{username}/{slug}` | generated | generated | generated | index |
| `/u/{username}/courses/{slug}` | generated | generated | generated | index |
| `/u/{username}/book/{service}` | generated | generated | generated | index |
| `/store/receipt/{token}` | generated | generated | generated | noindex (private) |
| `/app/**` dashboard | — | — | — | noindex (auth-guarded SPA) |

### 3. Recommendations (chasing more queries)

- Add **JSON-LD**: `Organization` + `SoftwareApplication` on `/`; `OfferCatalog`/`ItemList` on `/pricing`; `BreadcrumbList` on `/u` pages (skip on noindex legal drafts).
- `/pricing` primary keywords: `link in bio with payments`, `sell digital products`, `creator monetization`.
- Homepage: keep H1 keyword-light but ensure `link-in-bio`, `sell`, `email` appear in visible copy (they do in the four pillars).
- Public creator pages index as themselves; add `noindex` only for non-published pages (already handled by `generateMetadata` publish check).

## 4. Owner Actions (need your account access)

1. **Google Search Console**: add property `usecreatoros.co` (Domain, via DNS TXT), submit `https://usecreatoros.co/sitemap.xml`, request indexing for `/` and `/pricing`. Rebuild proof: `curl -s https://usecreatoros.co/sitemap.xml`.
2. After Search Console: submit sitemap again post-www-redirect so Google collapses `www` host into apex.
3. Set `Host` canonical preference in GSC *before* heavy content.
4. Optional: `ahrefs`/`screaming frog` crawl to confirm zero `localhost` and outdated `www` URLs in the index.

## 5. Verification commands

```bash
curl -sI https://usecreatoros.co/ | grep -i content-security-policy   # exactly 1
curl -sI https://www.usecreatoros.co/pricing | grep -i location        # https://usecreatoros.co/pricing
curl -s https://usecreatoros.co/robots.txt
curl -s https://usecreatoros.co/sitemap.xml
curl -s https://usecreatoros.co/api/health
```

## 6. Free tool + IndexNow (2026-10-27)

**`/etsy-fee-calculator`** is the first link-earning asset: a static page with a
client-side calculator (GBP/USD), `FAQPage` + `WebApplication` JSON-LD, and an
internal link from `/blog/how-much-does-etsy-take-uk`. Rates live in
`src/lib/etsy-fees.ts` and `etsy-fees.test.ts` asserts the same numbers the blog
post quotes, so the tool and the article cannot drift apart. A rate change on
Etsy's side must update `ETSY_RATES`, the blog post and the tests together.

**IndexNow** pushes every sitemap URL to Bing, Yandex, Naver and Seznam without
waiting for a crawl (Bing also feeds several AI answer engines). The key file is
served by `src/app/<key>.txt/route.ts` from `src/lib/indexnow.ts`.

```bash
node marketing/seo/indexnow.mjs --dry   # list the URLs that would go
node marketing/seo/indexnow.mjs         # submit (200 or 202 = accepted)
curl -s https://usecreatoros.co/c7f1a4e9b28d43a6b9e0f1d2a3c4b5e6.txt   # must echo the key
```

Run IndexNow after every content deploy. It is not a ranking lever on its own —
it only shortens time-to-crawl on Bing/Yandex, which Google does not control.
