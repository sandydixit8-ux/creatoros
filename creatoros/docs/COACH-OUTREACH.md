# Coach interview outreach — draft

## Rules I wrote this against

Do not change these without checking the code:

- **Free plan is real and free**: 1 page, 5 links, 10 contacts, 1 service,
  5 products, 1 course, 1,000 views/mo, 10 AI credits, 100 emails/mo.
  No card, no trial timer.
- **INR subscriptions are live and sellable**: Cashfree e-mandate is
  activated and `BILLING_CURRENCY=inr`. Starter ₹749/mo upgrades work up to
  mandate-session creation, and one ₹1 one-time order already paid + applied
  end-to-end in production. Convincing a coach to pay ₹749 is fine *only after*
  a real charge has gone through once, so the money loop is proven before we
  advertise it.
- **USD is not sellable yet** (international gateway rejected/pending at
  Cashfree). Do not offer USD pricing or promise the sub-$9/mo international
  price yet.
- **Do not promise custom domain on free.** It is Creator ($19) and up.
- **Do not promise email automation on free.** Same — Creator and up.
- **Do not say "one tool replaces 3-4 subscriptions" as a cost claim** yet.
  It is unverified and I have no churn or retention data. It is fine as an
  opening question, not as an assertion.

Goal of the first message is **a reply**, not a demo. The single goal of the
call is to find out what they would pay for and why.

---

## Message A — cold email / DM (primary)

Subject: quick question about your coaching setup

> Hi {Name},
>
> I'm building CreatorOS — a link page, small store and email list in one
> login, aimed at coaches and consultants who sell 1:1 calls or a digital
> product.
>
> I'm not selling you anything. I'm trying to work out which part of this
> people actually want, and you'd be one of about ten people I ask. 15
> minutes, and I'll send you the summary either way.
>
> Two things I'd genuinely like your read on:
>
> 1. Right now, what's the tool you hate paying for but can't quite drop?
> 2. If a single link page + store + email list cost one flat monthly fee
>    instead of three separate subscriptions — what would make you *not*
>    switch?
>
> Question 2 matters more to me than question 1, honestly. The "no" answers
> are the useful part.
>
> {Scheduling link}
>
> — {Your name}, CreatorOS

Why it's shaped this way: Q2 is deliberately framed so that "no" is a useful
answer. People answer a question they can push back on. A "would you use
this?" question only gets politeness.

---

## Message B — warm / existing network (shorter)

> Hey {Name} — quick favour. I'm testing a small tool for coaches (link page
> + store + email in one place, free tier is genuinely free). 15 min call?
> The thing I most need is to hear what you'd *hate* about it, so please be
> blunt — I'd rather get the real objection now than build the wrong thing.

---

## Call script (15 min)

**0–2 min — set the frame.** "I'm not demoing. I want to find out what
you'd pay for. If I pitch for ten minutes you can tell me I'm wrong, but
you'll only do that if I'm honest about wanting criticism."

**2–7 min — current reality. Do not skip.**

- Walk me through how you sell right now, start to finish. Start from
  someone finding you, to money in your account.
- What tools are you paying for monthly, and roughly what does each cost?
- Where does that break or annoy you?

Write down the actual numbers. "It's expensive" is useless. "Kartra is $69/mo
and I don't use the CRM" is a finding.

**7–11 min — the wedge.**

- You sell 1:1 calls. When someone books, what happens next, manually?
- If you sell a digital product, how do people find it and pay?
- What's the last thing you paid a tool for that you mostly regret?

**11–14 min — the money question, asked directly.**

- If this did one job well — which one — what would you pay monthly for it?
- What would make you *not* switch? (Ask again. First answer is polite.)
- If the answer is "free only", that's a real answer. Say so.

**14–15 min — close.**

- I'll send you a summary and a link to try it free. If you try it and it's
  worse than what you have, tell me and I'll fix or delete it. No follow-up
  sequence unless you ask for one.

---

## What I am actually testing, and how to falsify it

| Hypothesis | Killed if |
| --- | --- |
| Coaches pay to replace tool sprawl | They only care about one feature; the rest is "nice to have" |
| 1:1 session wedge is the wedge | They say bookings are fine already and the pain is elsewhere |
| Flat fee beats per-tool pricing | They optimise on absolute cheapest option, not fewer tools |
| Free tier is enough for many | Nobody converts but also nobody complains — means free *is* the product |

The fourth row is the one I most expect to be true and least want to admit.

## Recording

Log every call against the funnel, not a spreadsheet:
`signup_completed` → `activation_reached` when they publish their first block.
Then note which of the five steps they stall on. Ten interviews is enough to
see the pattern; the funnel is what turns it into a number.

## Do not do these during outreach

- Do not run paid ads. No ad budget, and the funnel has not seen a single
  real conversion yet; a paid click today would be reading a broken or empty
  funnel at cost.
- Do not send a "just shipped" announcement. Nothing has converted yet.
- Do not promise a roadmap item (annual plans, dunning) as if it exists.

---

## Ready-to-send drafts (approved set, 10)

Compliance quick-check applied to every draft: free plan described as genuinely
free, no card, no trial timer; no USD price claimed; no custom domain on free;
no email automation on free; no "replaces 3-4 subscriptions" cost claim (only
asked as a question); the goal is a reply, not a demo.

Fill the `{platform / contact}` column before sending (handles and emails live
outside this repo). Channel decision is in the send log further down.

| # | Prospect | Market | Contact | Subject |
|---|----------|--------|---------|---------|
| 1 | Stephanie Kase | US | support@stephaniekase.com | quick question about your coaching setup |
| 2 | Ally Msangi | TZ (off-target) | ally@allymsangi.com | keep the best of your coaching stack |
| 3 | Mikayla Jai | US | hello@mikaylajai.com | what you'd keep if you cut two tools |
| 4 | Jesse Lee | US? (ambiguous) | admin@jessele.io (typo?) | the tool you pay for but couldn't drop |
| 5 | Jessica Viera | AU? (ambiguous) | NOT_PUBLIC | quick question about selling 1:1 calls |
| 6 | Alice Björkstrand | UK | hey@alicebjorkstrand.com | what you'd *not* switch away from |
| 7 | Gabrielle | ? (unidentified) | NOT_PUBLIC | 15 minutes on what's cluttering your stack |
| 8 | Coach Benny | ? (unidentified) | NOT_PUBLIC | the part of your setup that annoys you |
| 9 | Jay Clouse | US | jay@creatorscience.com | a question a creator-tool builder should ask |
| 10 | Creator Wizard / Justin Moore | US | justin@creatorwizard.com | what makes you keep a tool you dislike |

Emails above were gathered from public Contact/legal pages or public profile
listings (no pattern-guessing). Send-ready set = the 5 confirmed US/UK rows:
**Stephanie Kase, Mikayla Jai, Alice Björkstrand, Jay Clouse, Justin Moore**.
Excluded pending your call: Ally Msangi (Tanzania, off US/UK target),
Jesse Lee (name ambiguity + probable typo in address), Jessica Viera
(ambiguous + no public email), Gabrielle and Coach Benny (identity unknown).

### Template (each message = this shell, first line personalized)

Subject: `{subject}`

> Hi {Name},
>
> I noticed you work with {audience — coaches selling 1:1 calls / digital
> products}. I'm building CreatorOS — a link page, small store and email list
> in one login, aimed at exactly that.
>
> I'm not selling you anything. I'm trying to work out which part of this
> people actually want, and you'd be one of about ten people I ask. 15
> minutes, and I'll send you the summary either way.
>
> Two things I'd genuinely like your read on:
>
> 1. Right now, what's the tool you hate paying for but can't quite drop?
> 2. If a single link page + store + email list cost one flat monthly fee
>    instead of three separate subscriptions — what would make you *not*
>    switch?
>
> Question 2 matters more to me than question 1, honestly. The "no" answers
> are the useful part.
>
> {Scheduling link}
>
> — {Your name}, CreatorOS

Personalized first lines (pick per prospect, then confirm the one observation):

1. **Stephanie Kase** — "I noticed you've built a coaching audience that books 1:1 time."
2. **Ally Msangi** — "I saw you sell 1:1 coaching and I'm guessing booking is most of your workflow."
3. **Mikayla Jai** — "You post about turning an audience into paid coaching work — this is aimed exactly there."
4. **Jesse Lee** — "Selling 1:1 calls, I assume the booking→pay→list loop is where the friction lives."
5. **Jessica Viera** — "You help clients grow their coaching/gig business — curious how you keep their stack tidy."
6. **Alice Björkstrand** — "You talk about selling your expertise for 1:1 time — I'm testing a simpler way to run that."
7. **Gabrielle** — "You coach around {niche} — the 'what do I pay for monthly' question is exactly what I need."
8. **Coach Benny** — "Coaching + a small digital offer is the exact shape this tool is built for."
9. **Jay Clouse** — "You've built an audience out of analyzing creator tools — I'd love your blunt take on mine."
10. **Creator Wizard / Justin Moore** — "You break down tools for creators — I want the honest objections."

Every line above is a *question-opener*, not an assertion of their stack. Treat
unknowable facts as placeholders: if we can't verify the niche, fall back to
"coaches who sell 1:1 calls or a digital product."

### Send log (to update with every send)

- Date / prospect / channel / reply received / funnel action taken.

Channel = manual DM (Instagram/LinkedIn/email) or Brevo transactional email
(via the app's configured provider). Email requires the recipient list +
explicit go per batch; DM requires the handles. No broadcast/promo list.

- 2026-10-10 — Brevo transactional sending is disabled on the account
  (`Email not sent: Your sending platform is currently disabled`). Support
  ticket **#5610237** opened to request activation. Planned sender for the
  batch: `hello@usecreatoros.co`, reply-to `sandydixit8@gmail.com`.
- 2026-10-10 — First batch attempt (5 confirmed US/UK prospects) was accepted
  by the Brevo API but **not delivered** while the platform stays disabled.
  Re-run the same batch once activation lands, then confirm in Brevo
  Events that each recipient shows `requests`/`delivered`.
