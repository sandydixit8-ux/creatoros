# YouTube metadata fixes — CreatorOS channel

Channel: `UCmOSwrdJWBbO3ILEZU0Jj1Q` · `@creatoros-z7v`
Audit: 29 Oct 2026. Total public views ≈ 8,320, of which 7,978 (96%) come from one
video whose description says "Test upload".

Apply in this order. Everything below is written to be correct if a human pastes it
into YouTube Studio, and is what `youtube.mjs` should push once the OAuth token
belongs to this channel (not to the personal `UCU1n7Mi…` channel).

---

## 1. `jBv1nOdY2OY` — 7,978 views (the whole channel's traffic)

Current title: `CreatorOS — One workspace for your whole creator business`
Current description: `Test upload from CreatorOS. Start free at usecreatoros.co`

**Title**

```
CreatorOS — bio page, store, courses and bookings in one place
```

**Description**

```
Everything a creator needs, in one workspace: bio page, digital store, courses, bookings, email and analytics.

Start free, no card required: https://usecreatoros.co/?utm_source=youtube&utm_medium=video&utm_campaign=creatoros-intro

Built for UK and US creators who sell digital products and 1:1 services and are tired of paying for nine separate tools.

- Bio page — one link that holds everything
- Store — sell downloads, bundles and memberships
- Courses — lessons, drip content and progress
- Bookings — paid 1:1 sessions with the calendar synced
- Email and analytics — the list you own

Prices include applicable taxes: Starter £7/$9, Creator £15/$19, Pro £39/$49, Business £79/$99 per month. Free tier available.
```

**Tags**

```
creatoros, all in one creator platform, link in bio, sell digital products, creator store, online courses, paid bookings, creator tools, uk creators, us creators
```

---

## 2. `pYI80vW7KV8` — 5 views, title is a keyword list

Current title: `creators, creator business, creator economy, , sell digital products, uk creators, us creators`
Current tags: `#GrowthMindset #PersonalDevelopment #Leadership #AITools …` (wrong niche)

**Title**

```
Etsy fees vs your own store: what UK creators actually keep
```

**Description**

```
On a £20 digital sale Etsy takes £2.56 — about 12.8% — before a penny of ads:
16p listing, 6.5% transaction (£1.30), 4% + 20p processing (£1.00) and the 0.48%
Regulatory Operating Fee (£0.10).
On a £5 product it is closer to 18%, because the two fixed fees do not shrink with the price.

Free calculator, no account needed:
https://usecreatoros.co/etsy-fee-calculator?utm_source=youtube&utm_medium=video&utm_campaign=etsy-fees-uk

In this video:
- the fees that stack on a UK digital sale
- why cheap products lose the biggest share
- when a monthly plan pays for itself
- what changes when you sell the same file from your own link

CreatorOS is the platform I build: bio page, store, courses, bookings and email in one workspace. Prices include applicable taxes — Starter £7/$9, Creator £15/$19, Pro £39/$49, Business £79/$99 per month, free tier available.
```

**Tags**

```
etsy fees, etsy fees uk, etsy seller uk, sell digital products uk, etsy alternative, payhip, gumroad, beacons, creatoros, uk creator, own your audience
```

---

## 3. `m33FK_Mke2Q` and `VrYSxdtDeT4` — Etsy videos with empty descriptions

Titles are already correct (`Etsy Fees Are Eating Your Profit (UK Creators)`), tags are
already correct. Only the description is missing: no link, no call to action, no hashtags.

**Description** (both videos, same text)

```
Etsy takes four separate cuts of a digital sale. On £20 that is £2.56 (12.8%) before ads; on £5 it is about 18% because two of the fees are fixed.

Work out your own price in ten seconds — free, no account:
https://usecreatoros.co/etsy-fee-calculator?utm_source=youtube&utm_medium=short&utm_campaign=etsy-fees-uk

Raise the entry price to £15–19, bundle three files into one listing so the fixed fees are paid once, and check whether you can opt out of Offsite Ads (15% of the sale when it fires).

#etsyfees #etsyuk #digitalproducts #ukcreators #sellonline
```

**Pinned comment** (post manually on the newest Short, `m33FK_Mke2Q`)

```
The calculator is free and needs no account: https://usecreatoros.co/etsy-fee-calculator?utm_source=youtube&utm_medium=comment&utm_campaign=etsy-fees-uk
Tell me your product price and I'll reply with the exact numbers for it.
```

---

## 4. Unlist — 4 videos that point the channel at the wrong audience

YouTube decides who to show a channel to from its videos. These four say "personal
development / motivation", which is not who buys CreatorOS. They have 42 views between
them, so nothing is lost by hiding them.

| Video | Title | Views |
|---|---|---|
| `c5YcF9oGYsk` | Growth Mindset Pro \| Learn, Grow, Succeed | 13 |
| `-G_1TL_KE8Q` | Growth Mindset Pro \| Learn, Grow, Succeed #personalgrowthhacker … | 7 |
| `t1in1H3OJGI` | Growth Mindset Pro \| Learn, Grow, Succeed #creatoreconomy … | 6 |
| `-dWbaYocAN0` | CreatorOS #creatoreconomy #linkinbio #personalgrowthhacker … | 16 |

`H_Y57v2DV3g` ("toolpilotpro.in", 6 views) belongs to a different product — unlist it too.

---

## 5. After the token is fixed

```bash
node marketing/publisher/youtube.mjs whoami   # must say CreatorOS (UCmOSwrd…), not Sandeep Dixit
node marketing/publisher/youtube.mjs stats    # real numbers for this channel
node marketing/publisher/youtube.mjs monitor  # resumes the 3-hourly snapshot
```

The monitor was appending the personal channel's 2018–2022 videos to
`.stats-history.jsonl` (30 snapshots, all meaningless). It now refuses to run on the
wrong channel instead of logging zeros, so the task may fail until auth is re-done —
that failure is the correct signal, not a new bug.
