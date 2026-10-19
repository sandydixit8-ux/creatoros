# CreatorOS — Google Ads launch kit

Ready-to-import Google Ads build for the US/UK launch: two Search campaigns and one
YouTube (Shorts) Video campaign. Everything imports **paused** so a live account
never starts spending until you review and enable it.

> **Blocker:** do not enable spend until **USD/GBP checkout is live** on
> `usecreatoros.co`. Paid traffic to a plan the visitor cannot buy converts at ~0.
> India (INR via Cashfree) is live; US/UK needs Dodo KYC + a GBP price.

## What's in this folder

| File | Import as | Notes |
| --- | --- | --- |
| `campaigns.csv` | Campaigns | Name, type, budget, bidding, geo, tracking template |
| `ad-groups.csv` | Ad groups | 8 Search ad groups + 2 Video ad groups |
| `keywords.csv` | Keywords | Phrase/Exact, with per-keyword Max CPC |
| `negative-keywords.csv` | Keywords (negative) | Campaign-level negatives |
| `responsive-search-ads.csv` | Ads | 8 RSAs (10 headlines + 4 descriptions each) |
| `sitelinks.csv` | Assets (sitelinks) | 4 sitelinks × 3 campaigns |
| `callouts.csv` | Assets (callouts) | 6 callouts × 3 campaigns |
| `structured-snippets.csv` | Assets (snippets) | "Types" snippet × 3 campaigns |
| `video-ads.csv` | Reference | YouTube video IDs for the Video campaign |
| `audiences.csv` | Reference | Custom-intent / affinity / in-market audiences to build |

## Setup order

1. **Create the account.** ads.google.com → New account. Set timezone/currency to
   **USD** (US/UK spend) and billing country to the entity that can pay Google.
2. **Verify conversion tracking first** (see below). Bidding and reporting are
   useless without it, and Google needs it to optimize.
3. **Install Google Ads Editor** (desktop app) and sign in to the account.
4. **Import each CSV** in this order: campaigns → ad-groups → keywords →
   negative-keywords → responsive-search-ads → sitelinks → callouts →
   structured-snippets. Use *File → Import → Import CSV*. Header row is
   standard, so Editor maps columns automatically; if one is unrecognized, map it
   manually in the import dialog.
5. **Video campaign:** in the Video campaign, add each video from `video-ads.csv`
   by pasting its YouTube URL. *The Shorts are currently **private*** — publish
   (or unlist) them in YouTube Studio first, or the ad cannot serve.
6. **Audiences:** build the custom-intent lists in *Audience Manager* from
   `audiences.csv`, then attach them to the Video ad groups.
7. **Review everything paused**, fix any landing-page/review flags, then enable.

## Conversion tracking (must-do)

The site is **already wired** for consent-gated tags. Set these env vars and the
signup + purchase conversions fire automatically (nothing loads until the visitor
accepts "analytics" in the cookie banner):

```
NEXT_PUBLIC_GOOGLE_ADS_ID=AW-XXXXXXXXX        # the Google Ads tag id
NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL=<label>   # from the signup conversion action
NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL=<label> # from the purchase conversion action
NEXT_PUBLIC_META_PIXEL_ID=                    # Meta pixel id (Events Manager)
```

Fired from:

- **Signup** — `src/components/auth/auth-form.tsx` on a successful registration
  (`CompleteRegistration` for Meta).
- **Store purchase** — `src/app/store/receipt/[token]/page.tsx` when the order is
  paid (value + currency + order id as `transaction_id`).
- **Plan purchase** — `src/app/app/billing/page.tsx` after `?upgraded=1`.
- Tags load only after analytics consent: `src/components/analytics/third-party-tags.tsx`
  reads the consent record; `src/lib/ads/pixels.ts` holds the event helpers.

Labels: in Google Ads, create one conversion action per event (Signup, Purchase)
and copy each `AW-XXXXXXXXX/label` tail into the matching `_LABEL` env var.

Fallback if you prefer no client script: **server-side import** — export
signups/purchases and upload to Google Ads via *Conversions → Import → from
clicks* (offline conversions). Consent-safe by default.

Then set each campaign's objective/bid strategy to *Conversions* once you have
~15–30 conversions/month.

## Budget, geo, bidding (already set in the CSVs)

- Total **$20/day**: Competitor Search $8, Intent Search $7, YouTube Video $5.
- Locations: **United States + United Kingdom**; language **English**.
- Bidding: Manual CPC for Search (per-keyword Max CPC set), Target CPV $0.02 for Video.
- Tracking template adds `utm_source=google&utm_medium=cpc&utm_campaign={campaignid}`
  `&utm_content={adgroupid}&utm_term={keyword}&gclid={gclid}`.

## Go-live checklist

- [ ] USD/GBP checkout live and tested on the site
- [ ] Google Ads account + billing active
- [ ] Signup and purchase conversions firing (tested in Tag Assistant / Editor)
- [ ] Shorts published on YouTube (not private)
- [ ] All CSVs imported and names match (Editor shows no red rows)
- [ ] Landing pages return 200: `/`, `/pricing`, `/signup`
- [ ] Review search terms weekly; add negatives to `negative-keywords.csv`
- [ ] Kill any creative under ~1% CTR after ~$300 spend
- [ ] KPI: cost per **free signup**, then cost per paid conversion

## Reference

- Brand: `usecreatoros.co` · Landing pages: `/`, `/pricing`, `/signup`
- Pitches and CTAs: `../ad-copy.md` · Keyword themes: `../keywords.csv`
- Pricing: free → ₹749 / $9 up to ₹7,499 / $99 per month
