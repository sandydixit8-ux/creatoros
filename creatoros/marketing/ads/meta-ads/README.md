# CreatorOS — Meta Ads kit (US + UK)

Paid social on **Facebook + Instagram** for the launch, **United States and
United Kingdom only**. Uses the same 9:16 hook cuts as the organic calendar
(`marketing/factory/out/creatoros-hook-9x16-*.mp4`).

## Campaign structure

| Level | Setup |
|---|---|
| Campaign | `CreatorOS — Launch US/UK`, objective **Sales** (or Traffic until the pixel has 50 conversions) |
| Ad set US | Geo **United States**, advantage+ placements, broad + interests below |
| Ad set UK | Geo **United Kingdom**, advantage+ placements, broad + interests below |
| Ads | 3–5 9:16 hook videos per ad set, 1 primary text each, "Start free" CTA |

Split budget roughly 50/50 (adjust to signup cost). Start $15–25/day per market.

## Geo & language

- Locations: **United States**, **United Kingdom**. No other markets.
- Exclude nothing else at launch; add exclusions once data arrives.
- Age 18–44, all genders. Language English.
- Currency: the site shows **$** to US and **£** to UK (site already holds both).

## Interests / audiences (start broad, then layer)

- Creators & creator economy, Content creation, Video editing.
- Small business owners, Entrepreneurship, Shopify / Shopify admins.
- Page admins of: Gumroad, Kajabi, Teachable, Beacons, Linktree.
- Later: 1–3% lookalikes of signups/purchasers once 50+ events.

## Placement

- Advantage+ (automatic) on: Facebook Feed/Reels, Instagram Feed/Reels/Stories,
  Reels + Stories.
- Creative must be 9:16, hook in the first 3 seconds, captions burned in.

## Creative & copy

- Pull hooks/captions from the calendar (US rows for the US ad set, UK rows for
  the UK row — British spelling, `£`).
- Primary text (US): *"Bio pages, store, courses, bookings, email. One link, one
  workspace. Start free — no card required."*
- Headline: `Your creator business. One link.` · CTA: **Sign up**.

## Links & attribution

Use the same UTM scheme as organic, per ad set:

```
https://usecreatoros.co/?utm_source=meta&utm_medium=paid&utm_campaign=launch_us_uk&utm_content=us
https://usecreatoros.co/?utm_source=meta&utm_medium=paid&utm_campaign=launch_us_uk&utm_content=uk
```

## Measurement & rules

- Install the Meta pixel + Conversions API (see `marketing/ads/google-ads/README.md`
  for the site-side import approach) before scaling.
- Success metric: **cost per free signup**, then trial→paid rate.
- Kill any creative under ~1% CTR after ~$200 spend.
- Currency on the site must be USD/GBP at checkout before scaling spend.
