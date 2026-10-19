# CreatorOS — US & UK launch plan

Focus markets: **United States** and **United Kingdom**. Everything below
(content, timing, links, ads) is tuned to those two audiences only.

## 1. Who we're targeting

| | United States | United Kingdom |
|---|---|---|
| Primary | Solo creators & side-hustlers monetising (ecommerce, courses, coaching) | Same, plus micro-consultants |
| Tooling they already pay for | Linktree, Gumroad/Stan, Kajabi, Teachable, Calendly, Mailchimp | Same + Beacons, Payhip |
| Hook that lands | "Stop paying for 9 tools" / "one link" | "One workspace" / "less time on tools" |
| Language | US spelling, `$` | UK spelling (`colour`, `organise`), `£` |

## 2. Channels & cadence

Two posts per day, one US-local window and one UK-local window:

- Instagram Reels, TikTok, YouTube Shorts, Facebook Reels, Facebook Feed, LinkedIn (US), X (UK).
- 9:16 vertical for Reels/TikTok/Shorts; 1:1 or 16:9 for Feed/LinkedIn/X.

## 3. Posting time (the important fix)

`time` in the content calendar is **market-local**, converted to UTC in the `utc`
column. Publishers schedule off `utc`, so DST is handled automatically.

| Market | Timezone | Local time | UTC now (DST) | UTC after DST |
|---|---|---|---|---|
| US | America/New_York | 09:00 | 13:00 | 14:00 (from 1 Nov) |
| UK | Europe/London | 18:30 | 17:30 | 18:30 (from 25 Oct) |

Optional second daily window (later): US 13:00 ET, UK 12:30 local.

## 4. Links & attribution

Every caption/description link is UTM-tagged:

```
https://usecreatoros.co/?utm_source=<platform>&utm_medium=social&utm_campaign=launch_us_uk&utm_content=<market>
```

`platform` = instagram | tiktok | youtube | facebook | linkedin | x, lowercased.
Report signups by `utm_content` (us vs uk) weekly.

## 5. Content localisation

- Hooks/captions/hashtags already split US vs UK in `marketing/factory/generate.mjs`.
- US tags: `#smallbusiness #sidehustle #creatoreconomy #linkinbio`.
- UK tags: `#ukcreators #smallbusinessuk #creatoreconomy #linkinbio`.
- Keep British spelling on the UK rows, American on the US rows.

## 6. Paid acquisition (US + UK only)

Geo-restrict every campaign to **US + UK**. No India spend on these campaigns.

- **Google Ads** — Search (high intent: "linktree alternative", "kajabi
  alternative", "sell digital products") + Video (YouTube) using the 9:16 cuts.
  Kit: `marketing/ads/google-ads/`. Set geo = US, UK; language English.
- **Meta Ads** — single campaign, advantage+ placements, 9:16 hook videos,
  interests: creator economy, Gumroad/Kajabi/Teachable/Linktree page admins,
  small business owners. Start broad, add lookalikes once 50+ signups.
- Currency: show `$` to US, `£` to UK (site pricing already has both).

## 7. Measurement

- `utm_content` split (us vs uk) in site analytics.
- Weekly: signups, activation, trial→paid, CAC per channel.
- Google Ads kit README has the conversion-import steps (gtag + server-side).

## 8. Execution status

- [x] Calendar carries `market` (US/UK) with localised copy.
- [x] Calendar carries `tz` + `utc` (market-local → DST-correct UTC).
- [x] Captions UTM-tagged per platform + market.
- [x] Facebook scheduled on corrected times (10 posts, 19–30 Oct).
- [x] YouTube Shorts rescheduled on corrected times (4 private, 1 already public).
- [ ] Instagram / TikTok / LinkedIn / X publishers.
- [ ] Google/Meta ads geo-restricted to US+UK.

## 9. Instagram / TikTok / LinkedIn / X note

Those publishers don't exist yet. Until they do, hand-post the matching
`creatoros-hook-9x16-*.mp4` at the same `utc` time (or add publishers later).
