# CreatorOS — Complete User Manual

Version 1.0 · English · Covers every module in the web application

---

## Table of Contents

1. [What is CreatorOS?](#1-what-is-creatoros)
2. [Core concepts](#2-core-concepts)
3. [Getting started](#3-getting-started)
   - 3.1 [Create an account](#31-create-an-account)
   - 3.2 [Log in](#32-log-in)
   - 3.3 [Forgot / reset password](#33-forgot--reset-password)
   - 3.4 [The dashboard](#34-the-dashboard)
4. [Plans and limits](#4-plans-and-limits)
5. [Roles and permissions](#5-roles-and-permissions)
6. [Bio Pages (link-in-bio)](#6-bio-pages-link-in-bio)
7. [Templates](#7-templates)
8. [Leads and contacts](#8-leads-and-contacts)
9. [Email center](#9-email-center)
10. [Store](#10-store)
11. [Courses and My Learning](#11-courses-and-my-learning)
12. [Community](#12-community)
13. [Booking](#13-booking)
14. [Analytics](#14-analytics)
15. [AI Coach](#15-ai-coach)
16. [Billing and plan upgrades](#16-billing-and-plan-upgrades)
17. [Settings, privacy, and support](#17-settings-privacy-and-support)
18. [Notifications](#18-notifications)
19. [Platform admin](#19-platform-admin)
20. [Public pages reference](#20-public-pages-reference)
21. [Configuration reference](#21-configuration-reference)
22. [Troubleshooting and FAQ](#22-troubleshooting-and-faq)
23. [Security and privacy](#23-security-and-privacy)

---

## 1. What is CreatorOS?

CreatorOS is an all-in-one operating system for creators to turn an audience into a
business. From a single dashboard you get:

- **Link-in-bio pages** — a mobile-optimized public page for links, products, bookings,
  courses, lead capture, and socials.
- **Templates** — ready-made bio-page layouts for social, business, marketing, creator,
  PMO, career, and AI use cases.
- **Store** — sell digital, physical, or service products with hosted checkout.
- **Courses** — build and sell multi-section courses with text, video, audio, PDF, quiz,
  and external lessons, plus certificates.
- **Community** — run a simple social feed with posts, reactions, and comments.
- **Booking** — publish bookable services with availability windows and timezone-aware slots.
- **Leads** — capture consenting contacts from your pages and export them as CSV.
- **Email center** — broadcast campaigns to contact lists with reusable templates.
- **Analytics** — first-party traffic, leads, conversions, sources, and revenue.
- **AI Coach** — a growth analysis that scores your business and suggests quick wins.
- **Team roles** — invite and manage owners, admins, editors, and viewers.

Everything is multi-tenant: each account is an **organization** (workspace) that owns its
own data.

---

## 2. Core concepts

| Concept | Meaning |
|---|---|
| **Organization (tenant)** | Your workspace. All data — pages, contacts, products, courses, orders — belongs to one organization. Created automatically when you sign up. |
| **User** | A person who can log in. A user has a name, email, and password. |
| **Membership** | Links a user to an organization with a role (`owner`, `admin`, `editor`, `viewer`). |
| **Profile** | Your public identity: username (slug), display name, bio, avatar, website, timezone, socials. Powers your bio page and public `/u/<username>` URLs. |
| **Plan** | Your organization's subscription tier (`free`, `starter`, `creator`, `pro`, `business`). Determines limits and feature access. |
| **Platform admin** | A user whose email is listed in `ADMIN_EMAILS`. Can access `/app/admin` across all organizations. |

---

## 3. Getting started

### 3.1 Create an account

**Path:** `/auth/register`

1. Open the CreatorOS home page (`/`) and click **Get started free**, or go directly to
   `/auth/register`.
2. Fill in:
   - **Name** — your name or brand (max 100 characters). This becomes your display name
     and the basis for your username slug.
   - **Email** — must be a valid, unused email address.
   - **Password** — minimum 8 characters (max 128).
3. Click **Create account**.

**What happens automatically:**

- A **user** is created with a securely hashed password (scrypt).
- A new **organization** is created on the **free** plan.
- You are added as the organization's **owner**.
- A **profile** is created with a unique username derived from your name
  (e.g. "Jane Doe" → `jane-doe`; collisions become `jane-doe-2`, etc.).
- A default published **bio page** is created with the title `"<Name>'s page"`.
- You are logged in and redirected to `/app`.

**Edge cases / notes:**

- Emails are stored lowercase; registering the same email twice returns
  "An account with this email already exists" (HTTP 409).
- Signup is rate-limited to **10 attempts per IP**.
- Usernames are lowercased and stripped of non-alphanumeric characters.

### 3.2 Log in

**Path:** `/auth/login`

1. Enter your **email** and **password**.
2. Click **Log in**. On success you are redirected to `/app`.

A session cookie is set. Visiting `/app` without a valid session redirects to
`/auth/login`. The root URL `/login` is not valid (404) — always use `/auth/login`.

### 3.3 Forgot / reset password

**Forgot password page:** `/auth/forgot-password`

1. Enter your account email and submit.
2. If the email exists, a reset link is emailed to you. For security, the form never
   reveals whether an email is registered (no account enumeration).

**Reset password page:** `/auth/reset-password?token=...`

1. Open the link from the email (valid for a limited time, single-use).
2. Enter and confirm your new password (minimum 8 characters).
3. On success, all existing sessions for that user are revoked, and you can log in with
   the new password.

**Rate limits:** 5 requests per 15 minutes per IP and 3 per 30 minutes per email.

**If email is not configured** on the server, reset emails are written to the server's
log/mail store instead of being sent. See [Configuration reference](#21-configuration-reference).

### 3.4 The dashboard

**Path:** `/app`

The dashboard gives an at-a-glance view of your business:

- **Summary cards** — key metrics for the selected period.
- **Traffic over time** — a chart of views and leads.
- **Traffic sources** — a donut chart of referrers.
- **Recent leads** — the five most recent contacts.
- **Upcoming bookings** — confirmed bookings sorted by start time.
- Quick actions: **View bio page** and **Build bio page**.

If you have no username yet, a "Let's set up your public page" prompt links to Settings.

---

## 4. Plans and limits

Every organization is on one of five plans. Limits marked `-1` are **unlimited**.

| Feature | Free | Starter | Creator | Pro | Business |
|---|---|---|---|---|---|
| Price (USD / month) | $0 | $9 | $19 | $49 | $99 |
| Price (INR / month) | ₹0 | ₹749 | ₹1,599 | ₹3,499 | ₹7,499 |
| Bio pages | 1 | 1 | 3 | 10 | ∞ |
| Links | 5 | 25 | 100 | ∞ | ∞ |
| Contacts | 10 | 500 | 2,000 | 10,000 | ∞ |
| Booking services | 1 | 3 | 10 | ∞ | ∞ |
| Products | 5 | 25 | 100 | ∞ | ∞ |
| Courses | 1 | 3 | 10 | 50 | ∞ |
| Views / month | 1,000 | 10,000 | 50,000 | 250,000 | ∞ |
| AI credits | 10 | 50 | 200 | 800 | ∞ |
| Emails / month | 100 | 1,000 | 5,000 | 20,000 | ∞ |
| Custom domain | ✗ | ✗ | ✓ | ✓ | ✓ |
| Email automation | ✗ | ✗ | ✓ | ✓ | ✓ |

**Important behaviours:**

- **Soft view quota:** if you exceed your monthly views limit, your public pages still
  render — tracking simply stops counting further views for the rest of the period.
- **Hard limits:** organizations are blocked from creating more of an item once the
  limit is reached (for example, contacts and bio pages). Upgrade to raise a limit.
- **Premium templates** require **Creator** or higher.
- **Email automation** (sending campaigns) requires a paid plan with automation; Free and
  Starter cannot send.
- **Custom domain** is available on Creator and above (configuration depends on your
  deployment).

Plan prices and the full limit table live in `src/lib/plans.ts`.

---

## 5. Roles and permissions

Each member of an organization has exactly one role. Roles are ranked:

`viewer (0) < editor (1) < admin (2) < owner (3)`

| Permission | Viewer | Editor | Admin | Owner |
|---|---|---|---|---|
| Bio read | ✓ | ✓ | ✓ | ✓ |
| Bio write | ✗ | ✓ | ✓ | ✓ |
| Booking read/write | read | ✓ | ✓ | ✓ |
| Leads read/write | read | ✓ | ✓ | ✓ |
| Analytics read | ✓ | ✓ | ✓ | ✓ |
| AI Coach | ✗ | ✗ | ✓ | ✓ |
| Email read/write | read | ✓ | ✓ | ✓ |
| Store read/write | read | ✓ | ✓ | ✓ |
| Courses read/write | read | ✓ | ✓ | ✓ |
| Community read/write | read | ✓ | ✓ | ✓ |
| Billing read/write | ✗ | ✗ | ✗ | ✓ |
| Settings read/write | ✗ | ✗ | ✓ | ✓ |

**Owner** has everything, including billing. **Admin** manages content and settings but
not billing. **Editor** creates and edits content. **Viewer** is read-only.

> **Note on "master admin":** there is no "master admin" role inside an organization.
> Cross-organization platform administration is a separate concept — a user is a
> **platform admin** only if their email is in the `ADMIN_EMAILS` environment variable.
> Platform admins see an extra **Admin** item in the sidebar.

---

## 6. Bio Pages (link-in-bio)

**Path:** `/app/bio` (list), `/app/bio/<pageId>` (editor)

A bio page is a mobile-friendly public page at `/u/<username>` (or
`/u/<username>/<slug>` for additional pages).

### 6.1 Listing pages

The **Bio Pages** screen lists your pages with their publish status and public URLs. Use
**New page** to create one, or start from a template (see section 7).

### 6.2 Editing a page

Open a page to reach the editor. The editor has two columns: the **editor** and a live
**preview**.

**Page settings:**

- **Title** — an internal/label title.
- **Slug (optional)** — appended to your public URL for extra pages (lowercase letters,
  numbers, hyphens only). Leave empty for the main page.
- **Publish this page** — when checked, the page is publicly visible.

**Toolbar actions:**

- **Preview on/off** — toggle the live preview pane.
- **Open** — open the public page in a new tab.
- **QR** — open a QR code image (`/api/bio/<pageId>/qr`) to share or print.
- **Save changes** — saves blocks and page settings together. Disabled until there are
  changes.

**Blocks** can be added from the catalog, reordered by drag-and-drop, toggled
**Active/Hidden**, and deleted.

### 6.3 Block types

| Block | Fields | Purpose |
|---|---|---|
| **Profile** | Name, Subtitle | Header with avatar/name. |
| **Bio** | Bio text | A short paragraph. |
| **Link** | Label, URL | A tappable link button (tracked). |
| **Product** | Name, Price, Buy URL | Promote a product (external link). |
| **Booking** | Service | Links to a booking service page. |
| **Email capture** | Headline, Button label | Collects consenting leads. |
| **CTA button** | Text, URL | A bold call-to-action button. |
| **Socials** | (automatic) | A compact row of social icons. |

**Your profile socials** (Instagram, YouTube, Twitter/X, LinkedIn, TikTok, and your
website) render automatically at the top of the page — set these in **Settings**.

### 6.4 How email capture works

The email-capture block renders a form collecting **name (optional)**, **email**, and a
required **consent checkbox**. On submit it creates or updates a contact for your
organization. Consent is required by design (GDPR-friendly). Duplicate submissions are
suppressed; the form also enforces an in-flight guard against double submits.

### 6.5 Tracking

Page views and link clicks are tracked **first-party** (no third-party pixels). Visitor
IDs are hashed and not stored long-term. Tracking never blocks or breaks page rendering.

### 6.6 API endpoints (for reference)

- `PUT /api/bio/<pageId>/blocks` — save blocks (id, type, position, payload, active).
- `PUT /api/bio/<pageId>` — save title, slug, published.
- `GET /api/bio/<pageId>/qr` — QR code image.
- `POST /api/track` — page view / link click events (public, rate-limited).

---

## 7. Templates

**Path:** `/app/templates`

Templates are pre-built bio pages you can apply in one click.

- **Categories:** `social`, `business`, `marketing`, `creator`, `pmo`, `career`, `ai`.
- **Search:** filter by name, description, or category.
- **Premium templates** (marked) require the **Creator** plan or higher.

Applying a template creates a new (unpublished) bio page pre-filled with the template's
blocks and theme. You can then edit it like any other page.

**Requirements / edge cases:**

- Applying a template consumes a **bio page slot** against your plan limit. If you've hit
  your bio-page limit, the action is blocked with an upgrade prompt.
- Slugs are auto-uniquified per profile.

---

## 8. Leads and contacts

**Path:** `/app/leads`

This screen lists contacts collected from email-capture blocks and store checkouts.

- **Search** by email or name.
- **CSV export** via `/api/leads/export`.
- Each row shows **Contact** (name/email), **Consent** (Opted in / Pending), **Source**,
  **Campaign** (UTM campaign), and **Captured** date.
- The header shows total contacts and your usage against the plan limit.

When you reach your plan's contact limit, a banner prompts you to upgrade; new captures
stop until you do.

**Capture endpoint:** `POST /api/leads/capture` (public, invoked by bio-page email
capture forms).

---

## 9. Email center

**Path:** `/app/email`

Three tabs: **Campaigns**, **Lists**, and **Templates**.

### 9.1 Campaigns

- Click **New campaign**.
- Choose a **List** (or "All subscribed contacts"), optionally a **Template**, a **From
  name**, a **Subject**, and an **HTML Body**.
- **Create draft** saves it. Click **Send** to broadcast.
- After sending, you see stats: recipients, opened, clicked, failed.
- Statuses: `draft`, `sending`, `sent`, `scheduled`, `failed`, `canceled`.

> Sending requires **email automation**, available on Creator and above. On Free/Starter
> the Send action is disabled with a notice.

### 9.2 Lists

- Create named lists (e.g. "Newsletter").
- Select a list, then tick subscribed contacts to **Add selected**.
- The member panel shows current members.

### 9.3 Templates

- Create reusable templates with a name, subject, and HTML body.
- Use placeholders in subject/body:
  - `{{name}}` — contact name
  - `{{email}}` — contact email
  - `{{unsubscribe_url}}` — one-click unsubscribe link

> Always include an unsubscribe link in marketing emails. The unsubscribe URL is tracked
> by the platform.

**Email provider:** the server supports `log`, `resend`, `mailgun`, and `brevo`. With
`log`, messages are written to the server's mail store rather than delivered. See
[Configuration reference](#21-configuration-reference).

---

## 10. Store

**Path:** `/app/store`

### 10.1 Products

- Click **New product** and fill in:
  - **Name** (max 120), **Description** (max 2000), **Price (USD)**,
  - **Type** — `digital`, `service`, or `physical`,
  - **Media URL** (optional).
- Toggle a product **Live/Hidden** at any time.
- Delete a product; past orders keep their receipts.

Products appear on your bio page in the **Store** section and can be bought by visitors.

### 10.2 Checkout flow (buyer)

1. Visitor taps **Buy now**, then enters their **email** and **phone**.
2. Server creates a pending order and a payment session.
3. The buyer is redirected to the hosted checkout (Cashfree) to pay.
4. On success, the order is fulfilled (status `paid`), a contact is created/updated, and
   a receipt is available.

**Order statuses:** `pending`, `paid`, `failed`, `refunded`, `canceled`. Recent orders
are listed under **Recent orders**.

### 10.3 Receipts

Public receipts are available at `/store/receipt/<token>` where `<token>` is a per-order
opaque token.

### 10.4 Fulfillment and idempotency

Fulfillment is idempotent: both the success route and the provider webhook can safely
attempt to mark an order paid, but only a `pending` order can transition to `paid` once.

---

## 11. Courses and My Learning

**Paths:** `/app/courses` (list), `/app/courses/<id>` (builder), `/app/learn` (learner),
`/app/learn/<enrollmentId>` (lesson player), `/app/learn/<enrollmentId>/certificate`.

### 11.1 Course builder

Open a course to edit details and curriculum.

**Course details:** Title, Description, Price (USD; `0` = free). Save details, or
**Publish/Unpublish** the course.

**Curriculum:** courses are organized into **sections**; each section contains
**lessons**.

**Lesson types:**

| Type | Content field |
|---|---|
| `video` | Video URL (YouTube/Vimeo/mp4) |
| `audio` | Audio URL |
| `pdf` | PDF URL |
| `text` | Text content |
| `quiz` | JSON: `{"question":"...","options":["a","b"],"answerIndex":1}` |
| `external` | External link |

Each lesson has a **title**, optional **duration (minutes)**, and a **Published** flag
(drafts are hidden from learners).

> When you choose the **quiz** type, the content box is pre-filled with an example JSON
> structure — edit the question, options, and the zero-based `answerIndex`.

### 11.2 Enrollment

- **Free courses:** learners enroll directly.
- **Paid courses:** a pending order is created; enrollment is granted on payment.
- Enrollments are unique per course + email and are **idempotent**.

### 11.3 Learning experience

- **My Learning** (`/app/learn`) lists your enrollments and progress.
- Open an enrollment to view lessons. Mark lessons complete to advance.
- **Quiz lessons:** pick an answer and submit. A correct answer (score 100) marks the
  lesson complete; you can retry.
- When all published lessons are complete, the course is stamped completed and a
  **certificate** becomes available at `/app/learn/<enrollmentId>/certificate`.

**Access control:** an enrollment is accessible only to a session whose email matches the
enrollment email.

---

## 12. Community

**Path:** `/app/community` (list), `/app/community/<id>` (feed)

A lightweight community feed for your audience.

- **Create a community** with a name, description, and optional **public** flag.
- Inside a community you can **post** updates, **react** (👍), and **comment**.
- Managers can delete any post; authors can delete their own.
- Reactions and comments on your posts generate **notifications**.

---

## 13. Booking

**Path:** `/app/booking`

### 13.1 Services

Create bookable services with:

- **Name**, **Slug** (URL), **Duration (minutes, 5–480)**, **Price (USD, 0 = free)**,
  and **Description**.

### 13.2 Availability

For each service, set **repeat availability**:

- Toggle the weekdays (Sun–Sat).
- Set **From** and **To** times.
- **Save availability** replaces that service's weekly windows.

Availability windows are defined in the **owner's timezone** (from your profile, default
`UTC`).

### 13.3 Public booking

Share a booking link directly (`/u/<username>/book/<serviceSlug>`) or add a **Booking**
block to your bio page. Visitors see open slots in **their own timezone**. Existing
confirmed/rescheduled bookings block overlapping slots.

### 13.4 Managing bookings

The **Upcoming & recent bookings** panel shows attendee name, service, time, email, and
status (`confirmed`, `cancelled`, `rescheduled`).

---

## 14. Analytics

**Path:** `/app/analytics`

- **Date ranges:** Last 7, 14, or 30 days (query param `?days=`).
- **Traffic & conversions** chart (views vs. leads).
- **Traffic sources** donut, plus a sources explorer breaking down UTM source, device,
  and country.
- **Leads captured** and **Bookings** summary tiles.
- **Revenue** section: MRR, active subscriptions, last charge, a monthly revenue chart,
  and a breakdown by source.

Tracking is first-party; see section 6.5. Events include `page_view`, `link_click`,
`checkout_started`, `purchase`, `course_started`, and `course_completed`.

If you have no pages, an empty state prompts you to create a bio page.

---

## 15. AI Coach

**Path:** `/app/coach`

The AI Coach analyzes your last 30 days of traffic, leads, bookings, and services and
returns:

- A **growth score** (colour-coded: ≥70 green, 40–69 amber, <40 red).
- A **summary**.
- **What's working**, **Opportunities**, and **Quick wins** lists.
- A **30-day headline target**.

Click **Analyze my business** (or **Re-analyze**).

**Configuration:** the Coach requires an AI API key. If not configured, a banner explains
that `AI_API_KEY` (or `OPENAI_API_KEY`) must be set. It uses `AI_BASE_URL` (default
`https://api.openai.com/v1`) and `AI_MODEL` (default `gpt-4o-mini`).

**API:** `GET /api/coach/analyze`.

---

## 16. Billing and plan upgrades

**Path:** `/app/billing`

- Shows your current plan and, if present, your active subscription (provider, status,
  next charge date).
- **Usage this month** meters for bio pages, contacts, booking services, products,
  courses, AI credits, emails sent, and views/month. Meters turn amber at ≥80% with an
  "Upgrade for headroom" hint.
- **Plan cards** for all five plans with an upgrade action.
- If a subscription exists, a **Cancel subscription** button is shown.

**Currency:** visitors pick their checkout currency with the picker on the billing
page. The choice (a `cc` cookie) sets the prices shown *and* the currency charged.
INR is billed through Cashfree, USD through Dodo Payments; the picker only offers
currencies a configured gateway can actually settle. `BILLING_CURRENCY` remains the
fallback default (what a visitor sees before they choose) — `usd` or `inr`.
GBP/EUR plan pricing is not offered yet (see PAYMENTS-DODO.md §5).

**Provider:** the active provider is resolved from `PAYMENT_PROVIDER`
(`cashfree`, `stripe`, `dodo`, or `mock`). Which gateway actually settles a checkout is
picked per currency: Cashfree for INR, **Dodo Payments** (Merchant of Record) for
USD/GBP/EUR, Stripe when configured. In development with no keys, a **mock** provider
simulates upgrades (marked "simulated"). When no configured gateway supports the billing
currency, upgrades are disabled until keys are set.

**Plan-upgrade fallback:** every checkout records the mandate as `pending`. When the
customer returns (`/app/billing?upgraded=…`), the app re-checks the Cashfree subscription
status and applies the plan if it is `ACTIVE` — so paid plans activate even if the
Cashfree **Subscriptions** webhook has not been enabled in the dashboard. Enabling that
webhook (events `SUBSCRIPTION_STATUS_CHANGE`, `SUBSCRIPTION_PAYMENT_SUCCESS`,
`SUBSCRIPTION_PAYMENT_FAILED`, `SUBSCRIPTION_CANCELLED` → `https://usecreatoros.co/api/webhooks/stripe`)
makes upgrades apply instantly without the return hop.

**Cashfree note:** Cashfree subscription mandates require an **Indian phone number**, so
the checkout form asks for a phone when Cashfree is active.

- `POST /api/billing/cancel` — cancel the active subscription.
- Upgrades are applied via the provider **webhook** after payment.

---

## 17. Settings, privacy, and support

**Path:** `/app/settings`

### 17.1 Profile

Edit your public profile, which powers your bio page:

- **Username** — your public slug (`/u/<username>`).
- **Display name**, **Bio**, **Avatar URL**, **Website**, **Timezone**.
- **Socials** — Instagram, YouTube, Twitter/X, LinkedIn, TikTok.

Timezone affects booking availability math.

### 17.2 Privacy (GDPR)

- **Export your data** — download a JSON copy of everything the account stores
  (`GET /api/account/export`).
- **Delete account** — type `DELETE` to confirm and permanently remove your organization
  and all associated data (leads, pages, courses, orders, bookings). This cannot be undone
  (`POST /api/account/delete`).

### 17.3 Support

Submit a **support ticket** with a subject and message (`POST /api/support`). The team
replies via your account; open tickets are visible to platform admins.

---

## 18. Notifications

A **notification bell** in the top navigation shows unread count. **Path:** `/app/notifications`.

- Notifications are generated by events such as reactions and comments on your posts.
- You can mark one as read or **mark all read**.
- Helpers: `listNotifications`, `unreadCount`, `markNotificationRead`, `markAllRead`.

---

## 19. Platform admin

**Path:** `/app/admin` (visible only to users whose email is in `ADMIN_EMAILS`)

Platform admins are cross-organization. Non-admins see a "Platform admin only" message.

Sections:

- **Organizations** — a table of all organizations with plan management and a plan cursor.
- **Feature flags** — toggle platform feature flags.
- **Support tickets** — view and update open tickets (`VALID_TICKET_STATUSES`).

Guard logic lives in `src/lib/admin/access.ts` (`isPlatformAdmin(email)`), and engine
functions in `src/lib/admin/engine.ts`.

---

## 20. Public pages reference

| URL | Description |
|---|---|
| `/` | Marketing home page with features and pricing. |
| `/pricing` | Standalone pricing page. |
| `/u/<username>` | Public bio page (main). |
| `/u/<username>/<slug>` | Additional bio pages. |
| `/u/<username>/courses/<courseSlug>` | Public course landing/enrollment. |
| `/u/<username>/book/<serviceSlug>` | Public booking page. |
| `/store/receipt/<token>` | Public order receipt. |
| `/auth/login`, `/auth/register` | Authentication. |
| `/auth/forgot-password`, `/auth/reset-password` | Password recovery. |
| `/app/*` | Authenticated dashboard. |

---

## 21. Configuration reference

Environment variables (see `.env.example`). Never commit real secrets.

### Core / database

| Variable | Purpose |
|---|---|
| `DATABASE_PATH` | SQLite database file (production: `/home/ubuntu/data/creatoros.db`). |
| `SITE_URL` | Public site base URL (used in tracking and links). |
| `NODE_ENV` | `production` / `development`. |

### Auth

| Variable | Purpose |
|---|---|
| `ADMIN_EMAILS` | Comma-separated emails granted platform-admin access. |

### AI

| Variable | Purpose |
|---|---|
| `AI_API_KEY` / `OPENAI_API_KEY` | Enables the AI Coach. |
| `AI_BASE_URL` | API base (default `https://api.openai.com/v1`). |
| `AI_MODEL` | Model name (default `gpt-4o-mini`). |

### Payments

| Variable | Purpose |
|---|---|
| `PAYMENT_PROVIDER` | `cashfree`, `stripe`, `dodo`, or `mock`. |
| `BILLING_CURRENCY` | Fallback default currency (`usd` or `inr`) until a visitor picks; the per-visitor `cc` cookie overrides it. |
| `CASHFREE_ENV` | `live` or `sandbox`. |
| `CASHFREE_CLIENT_ID` / `CASHFREE_CLIENT_SECRET` | Cashfree API credentials. |
| `CASHFREE_API_VERSION` | e.g. `2025-01-01`. |
| `STRIPE_SECRET_KEY` | Stripe credentials when using Stripe. |
| `DODO_PAYMENTS_API_KEY` | Dodo Payments API key (test `dodo_test_*` / live). |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Dodo Standard-Webhooks signing secret (`whsec_…`). |
| `DODO_ENV` | `test` (default) or `live`. |
| `DODO_CURRENCIES` | Gateway allows this checkout currency (`usd,gbp,eur`). Per-country, not per-key. |
| `DODO_PRODUCT_<PLANKEY>` | Dodo dashboard product id for each plan (e.g. `DODO_PRODUCT_CREATOR`). |

### Email

| Variable | Purpose |
|---|---|
| `EMAIL_PROVIDER` | `log` (default), `resend`, `mailgun`, or `brevo`. |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | Sender address and display name. |
| `BREVO_API_KEY` | Brevo REST API key (when `EMAIL_PROVIDER=brevo`). |
| `RESEND_API_KEY` / `MAILGUN_*` | Credentials for other providers. |

---

## 22. Troubleshooting and FAQ

**I can't log in.**
Check you're on `/auth/login` (not `/login`). Use `/auth/forgot-password` to reset.

**I didn't receive a password-reset email.**
The server may not have a live email provider configured (`EMAIL_PROVIDER=log`). Ask the
operator to configure Brevo/Resend/Mailgun and check spam.

**My bio page changes aren't visible.**
Click **Save changes**, and ensure **Publish this page** is checked. Open the public URL
to confirm.

**My views stopped counting.**
You may have hit your monthly view limit (soft quota). Analytics still works; the count
pauses. Upgrade for a higher limit.

**I can't create another bio page / contact.**
You've reached a hard plan limit. Check **Billing → Usage** and upgrade.

**A premium template is locked.**
Premium templates need the **Creator** plan or higher.

**I can't send an email campaign.**
Sending requires **email automation** (Creator+). On Free/Starter, Send is disabled.

**AI Coach says not configured.**
Set `AI_API_KEY` (or `OPENAI_API_KEY`) and restart the app.

**Plan upgrade fails / checkout unavailable.**
Payments may be unconfigured, or the provider is inactive. For Cashfree,
**Subscriptions** must be enabled on the account; an Indian phone number is also required
for mandates.

**Course certificate not available.**
Complete all **published** lessons (including passing quizzes). Only then is the course
marked complete.

**Booking slots look wrong.**
Confirm your **timezone** in Settings. Availability is defined in the owner's timezone and
shown to visitors in theirs.

---

## 23. Security and privacy

- Passwords are hashed with **scrypt** (never stored in plain text).
- Sessions are cookie-based; password reset revokes existing sessions.
- Password-reset tokens are hashed, single-use, and time-limited.
- Public forms have **rate limits** (registration, password reset, tracking).
- Lead capture requires **explicit consent**.
- **Data portability and deletion** are available under Settings → Privacy.
- **First-party analytics only** — no third-party tracking pixels.
- Payment webhooks are **signature-verified** and **idempotent**.
- Keep secrets in `.env` (mode `600`), never in git. Rotate any credential that has been
  exposed.

---

*End of manual. For architecture details, see `ARCHITECTURE.md`. For environment
variables, see `.env.example`.*
