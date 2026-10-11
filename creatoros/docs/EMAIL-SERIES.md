# CreatorOS — Welcome & Activation Email Series

Purpose: turn a free signup into an activated user (page live → first product/course/booking → reply). Drafts are generic over the email tool; wire into CreatorOS's own `email_templates` module (fields: `template`, `subject`, `body_text`).

Timing after signup:

| Day | Email | Goal |
|---|---|---|
| 0 | Welcome: your page is live | Activate (publish + share) |
| 2 | Your first product in 20 minutes | First monetization action |
| 5 | Book a call, get the email | Second monetization action |
| 9 | "Your site has views" + upgrade nudge | Habit + upgrade |

Plus **limit-triggered** upgrade emails (shown when usage hits 80% of free caps).

---

## Day 0 — Welcome

- **Subject:** Welcome to CreatorOS — your page is live 🎉
- **(no emoji unless brand uses them; keep plain:)** Welcome to CreatorOS — your page is live

Body:
```
Hi {{name}},

Your public page is live at: https://usecreatoros.co/u/{{username}}

Three things founders tell us matter in the first hour:

1. Open App → Bio pages → add a Link block pointing at your best post.
2. Add a Product block with anything you can sell today (even a $5 guide).
3. Publish, then screenshot it and post the link in your IG bio.

That's 90 seconds of work. Your page already looks clean on mobile.

If you get stuck, reply to this email — a human answers.

— The CreatorOS team
```

## Day 2 — First product

- **Subject:** Your first product in 20 minutes

Body:
```
{{name}}, quick Q: what could you sell this week?

A preset, a template, a mini-course, a 20-page guide — start small.

CreatorOS note: one-time payments are live today. Digital products deliver
themselves and the buyer gets a branded receipt.

The fastest path:
App → Store → New product → name it, price it → save.
Then add the product block to your bio page and hit publish.

That's it. Your first product is live without a website, a domain, or a
checkout plugin.

— The CreatorOS team
```

## Day 5 — Booking + email

- **Subject:** 2 buttons that pay for your whole plan

Body:
```
{{name}},

Two buttons next to each other earn more than a whole feed:
  Buy  |  Book

- Booking: App → Booking → create a 30-min call. Put your rate or
  "Free intro" on the slot.
- Email: add an Email capture block to your bio page. Every sale and
  signup lands in your list automatically.

Next week we'll show you the analytics page — views, clicks, revenue
in one screen.

— The CreatorOS team
```

## Day 9 — Views + upgrade nudge

- **Subject:** Your page's first numbers

Body:
```
{{name}},

A week in. Check your analytics tab for views and clicks on
https://usecreatoros.co/u/{{username}}

If you're approaching the free limits (views / emails / pages), here's
where the next plans start:

  Starter  $9/mo  -> 100k views, 1k contacts, 1k emails
  Creator  $19/mo -> 250k views, 5k contacts, 5k emails  (most picked)
  Pro      $49/mo -> custom domain + automation + 800 AI credits

Upgrade is instant at https://usecreatoros.co/pricing

— The CreatorOS team
```

## Upgrade trigger (limit-hit)

Fire when user crosses 80% of a free-plan cap.
- **Subject:** You're at 80% — that's a good problem

Body:
```
{{name}}, heads up: you've used 80% of your free plan's {{resource}}.

Two ways forward:
1. Trim your usage — keep the free plan.
2. Move to {{nextPlan}} (${{nextPrice}}/mo) for {{whatYouGet}}.

Upgrade in one click: https://usecreatoros.co/pricing

(If you're on a free plan and selling already — the Creator plan usually
pays for itself with one product sale.)

— The CreatorOS team
```

---

## Wiring notes
- Store sender from a real mailbox (not noreply) → better deliverability.
- Personalization: pull `{{name}}`, `{{username}}`, `{{resource}}`, `{{nextPlan}}`, `{{nextPrice}}`, `{{whatYouGet}}` from user row + plan limits.
- Suppression: one global unsubscribe; transactional receipts bypass all marketing sends.
- Subject A/B (Day 2): "Your first product in 20 minutes" vs "Sell something tonight — free plan is enough".