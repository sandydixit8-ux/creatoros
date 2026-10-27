# CreatorOS — Production Deploy Procedure

**Date:** 11 October 2026 (post-redesign)
**Artifact of record (this session):** `C:\Users\Ats\AppData\Local\Temp\opencode\creatoros-new.tar.gz`
- SHA256 `4AF605459347212D60464EB53DFA32A53E55F5D646EE1144C09F6F1244CDBE95`
- Compiled BUILD_ID `BV3YuJAAPxGWHGqw6E3Mm`
- Rebuilding regenerates both — record the new values when shipping a new archive.
- **Built with `NEXT_PUBLIC_SITE_URL=https://usecreatoros.co` set** — `SITE_URL`
  (`src/lib/constants.ts`) is a `NEXT_PUBLIC_*` value, inlined at build time. An archive built
  without it ships `http://localhost:3000` canonicals/sitemap/robots, exactly what the first
  verified deploy showed. Verify baked origin before shipping:
  `rg -F 'localhost:3000' .next/server/app/` → 0 hits, and canonicals contain the real host.

**Assembling the archive (important, Next 16):** `next build` with `output: "standalone"` puts the
runnable server under `.next/standalone` but does **not** include `.next/static`. Copy the top-level
`.next/static` (build output, `chunks/` + `media/` + `<BUILD_ID>/`) into the stage's `.next/static`
before tarring — the box's `deploy.sh` refuses an archive without it (`test -d app/.next/static`).

**Environment:** VM `130.210.7.48` (`usecreatoros.co`, Ubuntu). App at `/home/ubuntu/app`, env
at `/home/ubuntu/app/.env`, SQLite DB **outside the app** at `/home/ubuntu/data/creatoros.db`,
service-controlled via the box's `~/deploy.sh`.

---

## 1. What ships in this archive

The archive is the `next build` standalone output (`output: "standalone"`) plus the repo `src/`,
mirroring every previously shipped archive. Verified contents (3409 members):

- `.next/` — compiled server + static assets, `BUILD_ID` baked in
- `node_modules/` — only the build-traced packages (next, react, react-dom, sharp, etc.)
- `server.js` — standalone runtime launcher, `"poweredByHeader":false` confirmed inside
- `package.json`, `src/` — **`src/` is required**: `deploy.sh` sanity-gates on
  `test -f app/src/lib/db/schema.sql` (a `standalone`-only archive without `src/` is **rejected after
  extract**, leaving the app dir half-replaced — always include it and re-verify before shipping)
- `data/` with an **empty** `emails/` directory

Excluded by design:
- `.env` / any credentials — never shipped; the box's `/home/ubuntu/app/.env` is preserved in place
- All databases (`*.db`, `-wal`, `-shm`) — the live DB lives at `/home/ubuntu/data/creatoros.db`
- `.git/`, `test-results/`, dev/e2e dbs, rendered local email files (removed — only an empty dir ships)

Honest caveat: because `set -e` is not something this document controls, always probe the live
site after deploying rather than trusting the deploy script's success message (see incidents
D-5/D-11 in `CREATOROS_COMMERCIAL_AUDIT.md` where a script reported success while shipping a
stale build).

## 2. Before you deploy (run in repo)

1. Commit/tag the shipped state so the archive is reproducible from git, then confirm the working
   tree you built from matches the tag. Suggested tag: `post-redesign-20261011`.
2. Green gate from Phase 6 (all pass on this tree):
   - `npm run lint` → clean
   - `npx tsc --noEmit` → clean
   - `npm test` → 328/328
   - `npm run test:e2e` → 50/50
   - `npm run build` → 61 static pages, exit 0
3. Rehearse migrations on a copy, not live (from the box or with a db copy):
   `npx tsx scripts/check-migrations.ts <path-to-db-copy>` — confirm "no pending migrations"
   before shipping. This release adds no migrations; the check is to catch drift.

## 3. Deploy steps (on the VM)

1. **Snapshot the DB first** (documented convention — ISO timestamp, no colons):
   ```
   sqlite3 /home/ubuntu/data/creatoros.db ".backup '/home/ubuntu/data/creatoros.db.snapshot-2026-10-11T<TIME>'"
   sqlite3 /home/ubuntu/data/creatoros.db "PRAGMA integrity_check;"
   ```
2. **Snapshot the current app dir** (pre-deploy restore point, e.g. `~/app-pre-redesign-20261011.tar.gz`):
   ```
   tar -czf ~/app-pre-redesign-20261011.tar.gz -C /home/ubuntu app
   ```
3. Upload the archive with the **legacy** SCP protocol (`-O`): this box has no SFTP subsystem,
   and OpenSSH 9+ makes plain `scp` use SFTP, which fails with
   `client_loop: send disconnect: Connection reset`.
   ```
   scp -O creatoros-new.tar.gz ubuntu@130.210.7.48:creatoros-new.tar.gz
   ```
4. Verify the upload on the box: `sha256sum ~/creatoros-new.tar.gz` — must equal
   `4AF605459347212D60464EB53DFA32A53E55F5D646EE1144C09F6F1244CDBE95`.
5. Run the box's deploy script with the archive as `$1` (it validates the archive, unpacks,
   restarts the service, and prints sha256 + BUILD_ID):
   ```
   sudo /home/ubuntu/deploy.sh /home/ubuntu/creatoros-new.tar.gz
   ```
   If the service is managed outside `deploy.sh`, confirm the unit name before restarting —
   the repo does not record the systemd unit; discover with `systemctl list-units | rg -i creatoros`
   or `pm2 ls`, then `sudo systemctl restart <unit>` / `pm2 restart creatoros`.

### 3a. Gotchas verified on this box (26 Oct 2026)

- **`deploy.sh` must run as root.** `/home/ubuntu/app/.env` is `root:root 0600`, so the
  script's `cp .env /tmp/env.bak` fails for the `ubuntu` user and the run aborts at
  "save env" - before it touches `app/`, so nothing breaks, but nothing deploys either.
  The service itself runs as `ubuntu`; root is only needed for the script.
- **Pass the archive by absolute path under sudo.** `~/` in the argument is expanded by
  the shell that invokes `deploy.sh` (as root), not your login shell, so
  `sudo ~/deploy.sh ~/archive.tar.gz` looks for `/root/archive.tar.gz` and exits
  "archive not found".
- **Snapshotting the app dir needs `--exclude='app/.env'`.** `/home/ubuntu/app` is
  `root:root 0777` and `.env` is `root:root 0600`, so `tar -czf ... -C /home/ubuntu app`
  as `ubuntu` dies partway with `Cannot open: Permission denied`. The env is preserved by
  `deploy.sh` anyway; for an out-of-band restore point take
  `sudo cp /home/ubuntu/app/.env ~/env-backup-<date>` and `sudo chown ubuntu: ~/env-backup-<date>`.

## 4. Post-deploy verification (mandatory, never skip)

Run every probe over HTTPS; grep every header yourself. `deploy.sh` saying "=== DONE ===" is not
verification.

| Check | Command | Expected |
|---|---|---|
| Health + DB | `curl -fsS https://usecreatoros.co/api/health` | `{"ok":true,"db":"ok"}` |
| Fresh build | `curl -fsS https://usecreatoros.co/ \| grep -o '_next/static/[^/"]*' \| head -1` | `/…/BV3YuJAAPxGWHGqw6E3Mm` (matches the archive) |
| No `x-powered-by` | `curl -sSI https://usecreatoros.co/ \| rg -i 'x-powered-by'` | no line (a gateway-owned value would still not say `Next.js`) |
| Seeds/marketing | `curl -fsS https://usecreatoros.co/ \| rg -c 'offerCount'` | JSON-LD lists all 5 plans |
| Canonical | `curl -fsS https://usecreatoros.co/pricing \| rg -o 'rel="canonical"[^>]+'` | `href="https://usecreatoros.co/pricing"` (not `/`) |
| Auth noindex | `curl -fsS https://usecreatoros.co/auth/login \| rg -o 'name="robots"[^>]+'` | `content="noindex, follow"` |
| Sitemap | `curl -fsS https://usecreatoros.co/sitemap.xml \| rg -c '<loc>' \| rg '^2$'` | exactly `/` + `/pricing` — legal/contact/+`/auth/` excluded |
| Robots | `curl -fsS https://usecreatoros.co/robots.txt` | `/auth/` disallowed |
| Login path | open a private window, register/log in | lands on `/app`; mobile drawer opens `<lg` |

If a probe fails, do not leave the old build half-replaced — see `docs/ROLLBACK.md`.

## 5. History of this release

- Pre-redesign baseline: tag `pre-redesign-20261011` (= `e94b303`), BUILD_ID `gyG9buvN9lnDYg3gGYidG`.
- Staged archive from earlier in this session was rebuilt: it was a stale build (old BUILD_ID,
  `poweredByHeader:true`, traced from the recovery backup path), so it was discarded.
- Final pre-ship sweep also removed the last two blocking dialogs (community delete `confirm()`,
  booking availability `alert()`) → `U-05` fully closed; the archive was rebuilt after that fix.
- First deploy attempt was correctly **rejected by the box's own sanity gate**: the archive lacked
  `.next/static` because Next 16's standalone output does not copy it. Prod was restored from the
  pre-deploy app backup (`~/app-pre-redesign-20261011.tar.gz`), the archive rebuilt with `static`
  copied in, and redeployed cleanly. Lesson: `deploy.sh`'s `test -d .next/static` gate works.
- A second verified deploy then passed all gates but rendered `http://localhost:3000` canonicals
  and sitemap URLs (the build had no `NEXT_PUBLIC_SITE_URL`, so `SITE_URL` was inlined as
  localhost). Rebuilt with the env var set and redeployed; live probes confirmed the fix.
- The archive of record above was compiled from the verified working tree on 11 Oct 2026.
- **Follow-up (11 Oct 2026):** MARKETING/SEO hotfix archive — SHA256
  `B7C790F755322ABC512B0DFAB36F7F609A5684191EF195346DA27624B7C1AD37`, BUILD_ID
  `zH992XfRM9Ar6jl3QDfiz`. Adds Inter `display:"optional"` (font CLS), bio-editor keyboard
  reorder buttons, Business-plan copy fix, removal of unused deps, e2e `PORT` override, plus
  docs (`SEO-SETUP.md`, `SEO-CONTENT.md`, `VIDEO-SCRIPTS.md`, `EMAIL-SERIES.md`, `seed-demo.ts`).
  Gate green (lint/tsc/unit 328/e2e 50); deployed via `~/deploy.sh` (snapshot `…08-14-14`, health
  ok, probes pass). **Lesson captured:** this deploy.sh checks `app/src/lib/db/schema.sql` — the
  first (standalone-only) archive was rejected and `~/deploy.sh` had already wiped `app/`; the
  running service kept serving (loaded in memory) and a correct re-archive deployed cleanly.
- **Phase 3 security release (12 Oct 2026):** D-6 + D-15 (`feat(auth)` `33084f5`). Archive SHA256
  `CCBDA01BE3C14AEADFA427ED8731116E6D7658683680FAE33408B36C6464C8E5`, BUILD_ID
  `E5q9jqHr-PF8UTeR32lj5`. Adds `users.auth_version` + `email_verify_tokens` (migration 17), the
  `/auth/verify-email` page/API, and an admin gate that requires a verified mailbox. Deployed via
  `~/deploy.sh`; health ok, migration 17 confirmed on the live DB, probes green. The owner's
  allow-listed mailbox (`ADMIN_EMAILS`) was marked verified out-of-band to preserve admin access.
- **US/UK targeting + ad tracking (19 Oct 2026):** archive SHA256
  `DBEB4AC6F7B58F23DF56B29AC140D1DA3B7EA2A04FEBB956354379C721A554F2`, BUILD_ID `kiT6fLq18tsAsmOTbbXEe`.
  Marketing-only (no migrations). Adds DST-correct US/UK posting times (calendar `tz`+`utc`),
  UTM-tagged CTA links, consent-gated Google Ads + Meta conversion tracking (signup + purchase),
  the Facebook page-id fix + footer link. Built after clearing a corrupt Turbopack cache
  (`.next/cache` checksum panic). Deployed via `~/deploy.sh`; health ok, BUILD_ID live, canonical
  + footer social link probes green.
- **UK blog release (26 Oct 2026):** archive SHA256
  `18BA639A10C7C3BCFC1E7BDFB1BF83828D3DFBB1186B077680C68B09557DE577`, BUILD_ID
  `ITpi1O1m2DDF49-y8axHc`. Four UK commercial-intent posts (Etsy fees, Etsy alternative,
  Payhip vs Gumroad fees, UK selling guide) plus `next` 16.4.3 / `zod` 4.6.7. No migrations.
  Deployed with `sudo /home/ubuntu/deploy.sh` (see 3a); DB snapshot
  `creatoros.db.snapshot-2026-10-26T09-53-48`, app snapshot `~/app-pre-20261026.tar.gz`,
  env backup `~/env-backup-20261026`. Health ok, BUILD_ID live, all four post URLs 200 with
  correct canonicals, sitemap lists 13 blog URLs. Live DB at snapshot time: contacts=2,
  orders=0 - checkout is provisioned but has never taken an order.
- **Sitemap date fix (26 Oct 2026, follow-up):** BUILD_ID `FIxzCONvb19s-zMG8UnmD`, sha256
  `1BB862C8F3D9AF8EDF29F4A8E233BFBA053598911E0913435141F828E7A61FAA`. Nine of the thirteen
  posts were future-dated (28 Oct - 7 Nov), so `/sitemap.xml` advertised `lastmod` values
  ahead of the crawl date. Re-dated every post to 16-26 Oct, keeping newest-first order.
  Sitemap now has zero future `lastmod`. App snapshot `~/app-pre-20261026b.tar.gz`, DB
  snapshot `creatoros.db.snapshot-2026-10-26T12-48-20`.
- **Etsy fee calculator + IndexNow (27 Oct 2026):** archive SHA256
  `87EAB32C5F4B828095547242FD1FEC97C686B881830554BFD8DF9C5C227F91EA`, BUILD_ID
  `f1oxpep4lukiz7C2l0HD0`. Adds `/etsy-fee-calculator` (static, GBP/USD, FAQPage +
  WebApplication JSON-LD, linked from the UK fee post and listed in the sitemap at
  priority 0.9), the IndexNow key file at `/<key>.txt` served from `src/lib/indexnow.ts`,
  and `marketing/seo/indexnow.mjs`, which submitted all 24 sitemap URLs (202 Accepted).
  Also fixed a 17.7%/17.8% inconsistency in the £5 fee row. No migrations. DB snapshot
  `creatoros.db.snapshot-2026-10-27T09-06-47`, app snapshot `~/app-pre-20261027.tar.gz`.
  Live DB unchanged: contacts=2, orders=0.
  A throwaway signup was created to smoke-test the paid path and deleted afterwards
  (users/orgs/memberships/profiles/subscriptions/audit/funnel rows). The audit itself is
  written up in `docs/PAYMENTS-DODO.md` §8; the initial write-up misread an Indian-IP test as
  a global bug and was corrected there on 27 Oct (a US buyer pays exactly $19). The real
  findings were USD-only products, tax added on top of the advertised price, and the legal
  entity in the checkout header - all fixed via the Dodo API later the same day (see below).
- **Calculator copy fix (27 Oct 2026, follow-up):** archive SHA256
  `8773192A3DCE8938F0A178EC7FD131DBA5FB24C9C82223E64E6353BEB9FDF079`, BUILD_ID
  `HtKRSqneempxzyy5qxJco`. The "on your own store" line rendered the net payout
  (£764.80) as if it were the card fees; it now reads net vs net (£764.80 instead
  of £701.60, about £63.20 a month more) and the input card no longer stretches to
  the height of the results column. DB snapshot
  `creatoros.db.snapshot-2026-10-27T09-13-03`; still contacts=2, orders=0.
- **Tax-inclusive pricing copy (27 Oct 2026):** archive SHA256
  `672403BB183F800E2EF42CACFFD76BFC34C93FD8B3A4CC40C7FFD0724D921A12`, BUILD_ID
  `NzbQ5zr1hx_e0zbtdEjAz`. The Dodo store was switched to tax-inclusive pricing with pinned
  GBP prices and a CreatorOS brand (details and the verified totals in
  `docs/PAYMENTS-DODO.md` §8), so the public copy that said "Prices exclude ... applicable
  taxes" was wrong. `/pricing` and the landing pricing block now say prices include
  applicable taxes, list the US/UK/IN ranges, show each plan's UK price in pounds, and link
  the Refund Policy; the billing FAQ answer was corrected to drop "billed via Cashfree" and
  quote both USD and GBP. The brand logo was uploaded the same day, so checkout now renders
  "CreatorOS | Checkout" with the mark. No migrations. DB snapshot
  `creatoros.db.snapshot-2026-10-27T17-23-14`, app snapshot `~/app-pre-20261027c.tar.gz`;
  DB unchanged at contacts=2, users=4, orders=0.
