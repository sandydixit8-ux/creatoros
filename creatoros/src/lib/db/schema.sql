-- CreatorOS — PostgreSQL-portable schema (runs on node:sqlite)
-- All PKs are text UUID-like ids. Tenant rows carry tenant_id (org id).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  role            TEXT NOT NULL DEFAULT 'user',        -- user | admin
  email_verified  INTEGER NOT NULL DEFAULT 0,
  -- Bumped on password reset. Signed session cookies carry the value they were
  -- issued at; getSession rejects a cookie whose version is stale, which is how
  -- a stateless cookie is revoked without a server-side session table.
  auth_version    INTEGER NOT NULL DEFAULT 0,
  -- TOTP two-factor. `totp_secret` may hold a not-yet-confirmed secret: it is
  -- only trusted once `totp_enabled` is 1, which is set after the first code
  -- verifies. A disabled account must never be asked for a code.
  totp_secret       TEXT,
  totp_enabled      INTEGER NOT NULL DEFAULT 0,
  totp_confirmed_at TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT '',
  slug        TEXT NOT NULL UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free',   -- free | starter | creator | pro | business
  trial_ends  TEXT,
  settings    TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'owner',   -- owner | admin | editor | viewer
  created_at      TEXT NOT NULL,
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Single-use password reset tokens. Stored hashed so a database leak cannot be
-- replayed as a password reset; used_at makes each link one-shot.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

-- Single-use email verification tokens, stored hashed and one-shot like password
-- resets. Proving control of the mailbox is what unlocks platform-admin access
-- for an allow-listed email, so the token is what stands in for ownership.
CREATE TABLE IF NOT EXISTS email_verify_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_verify_user ON email_verify_tokens(user_id);

-- One-time TOTP backup codes. Stored hashed like every other credential, and a
-- code is spent by stamping `used_at`, so a leaked list entry works at most once.
CREATE TABLE IF NOT EXISTS mfa_backup_codes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mfa_backup_user ON mfa_backup_codes(user_id);

-- Pending login-email changes. A change only lands when BOTH the current and the
-- new mailbox confirm, so a stolen session cannot silently move the login to an
-- attacker's address, and a typo cannot lock the owner out. Both raw tokens are
-- emailed and only their SHA-256 hashes are stored; consuming either side clears
-- the whole request, and an unconfirmed request never touches users.email.
CREATE TABLE IF NOT EXISTS email_change_requests (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_email         TEXT NOT NULL,
  new_email             TEXT NOT NULL,
  current_token_hash    TEXT NOT NULL UNIQUE,
  new_token_hash        TEXT NOT NULL UNIQUE,
  current_confirmed_at  TEXT,
  new_confirmed_at      TEXT,
  expires_at            TEXT NOT NULL,
  used_at               TEXT,
  created_at            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_change_user ON email_change_requests(user_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL DEFAULT 'stripe',
  provider_id     TEXT,
  customer_id     TEXT,
  status          TEXT NOT NULL DEFAULT 'active',  -- active | trialing | past_due | canceled
  plan            TEXT NOT NULL,
  current_period_end TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans_usage (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric     TEXT NOT NULL,                -- views | contacts | services | ai_credits ...
  period     TEXT NOT NULL,                -- YYYY-MM
  used       INTEGER NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, metric, period)
);

CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL DEFAULT '',
  bio           TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT NOT NULL DEFAULT '',
  website       TEXT NOT NULL DEFAULT '',
  timezone      TEXT NOT NULL DEFAULT 'UTC',
  socials       TEXT NOT NULL DEFAULT '{}',     -- JSON {instagram, twitter, youtube, ...}
  settings      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bio_pages (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,                  -- page slug ("" default = profile username)
  title         TEXT NOT NULL DEFAULT '',
  published     INTEGER NOT NULL DEFAULT 1,
  theme         TEXT NOT NULL DEFAULT '{}',     -- JSON {accent, bg, radius}
  custom_domain TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (profile_id, slug)
);

CREATE TABLE IF NOT EXISTS bio_blocks (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_id     TEXT NOT NULL REFERENCES bio_pages(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,                    -- profile | bio | link | product | booking | email_capture | cta | social
  payload     TEXT NOT NULL DEFAULT '{}',       -- JSON {title, url, price, icon, ...}
  position    INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_id       TEXT REFERENCES bio_pages(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price_cents   INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'usd',
  kind          TEXT NOT NULL DEFAULT 'digital',  -- digital | service | physical
  media_url     TEXT NOT NULL DEFAULT '',
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  duration_min  INTEGER NOT NULL DEFAULT 30,
  price_cents   INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'usd',
  buffer_min    INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1,
  slug          TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS availability_windows (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_id  TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,               -- 0=Sun .. 6=Sat
  start_min   INTEGER NOT NULL,               -- minutes from midnight local
  end_min     INTEGER NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  consent     INTEGER NOT NULL DEFAULT 0,     -- GDPR double-opt-in flag; ONLY set by explicit opt-in
  consent_at  TEXT,                           -- when consent was given (provenance)
  consent_source TEXT NOT NULL DEFAULT '',    -- where consent was captured, e.g. bio_capture
  source      TEXT NOT NULL DEFAULT '',       -- bio page / campaign / qr
  page_id     TEXT REFERENCES bio_pages(id) ON DELETE SET NULL,
  utm_source  TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  tags        TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS bookings (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_id     TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  contact_id     TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  attendee_name  TEXT NOT NULL,
  attendee_email TEXT NOT NULL,
  starts_at      TEXT NOT NULL,               -- ISO UTC
  ends_at        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'confirmed',  -- confirmed | canceled | completed | rescheduled
  timezone       TEXT NOT NULL DEFAULT 'UTC',
  notes          TEXT NOT NULL DEFAULT '',
  reminder_sent  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_id      TEXT REFERENCES bio_pages(id) ON DELETE SET NULL,
  event_type   TEXT NOT NULL,                -- page_view | lead | booking | link_click | checkout_started | purchase | course_started | course_completed
  event_name   TEXT NOT NULL DEFAULT '',     -- optional finer label (e.g. cta_click, social_click)
  visitor_id   TEXT NOT NULL DEFAULT '',     -- salted hash, privacy-safe
  session_id   TEXT NOT NULL DEFAULT '',     -- salted hash of a per-visit session, privacy-safe
  ref          TEXT NOT NULL DEFAULT '',
  utm_source   TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  device       TEXT NOT NULL DEFAULT '',
  country      TEXT NOT NULL DEFAULT '',
  engagement_ms INTEGER NOT NULL DEFAULT 0,  -- active time on page (page_view events)
  properties   TEXT NOT NULL DEFAULT '{}',   -- allow-listed JSON metadata
  created_at   TEXT NOT NULL
);

-- Campaign + short-link registry. A creator defines a campaign (UTM set) and
-- mints one or more short links; the public `/l/<slug>` endpoint records a
-- consent-gated click and redirects to the destination with the campaign's UTM
-- parameters attached. The click is stored in analytics_events (event_type
-- 'link_click', properties.linkId) so the existing reports pick it up too.
CREATE TABLE IF NOT EXISTS campaigns (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  utm_source   TEXT NOT NULL DEFAULT '',
  utm_medium   TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  UNIQUE (tenant_id, name)
);

-- `slug` is globally unique, not per-tenant: a short link is resolved from the
-- slug alone, so the same slug in two tenants would be ambiguous.
CREATE TABLE IF NOT EXISTS tracked_links (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id  TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  label        TEXT NOT NULL DEFAULT '',
  slug         TEXT NOT NULL,
  destination  TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- Analytics alerts. A creator defines a rule over one metric (traffic, clicks,
-- leads, bookings) with a threshold and a rolling window; the scheduled job
-- (/api/cron/alerts) evaluates each active rule and, when it fires outside its
-- cooldown, records an alert_event and optionally emails the owner. Fired events
-- are retained so the dashboard can show a notification feed.
CREATE TABLE IF NOT EXISTS alert_rules (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  metric           TEXT NOT NULL,                 -- page_views | visitors | link_clicks | leads | bookings
  comparator       TEXT NOT NULL,                 -- gt | lt | pct_up | pct_down
  threshold        REAL NOT NULL DEFAULT 0,
  window_days      INTEGER NOT NULL DEFAULT 1,
  channel          TEXT NOT NULL DEFAULT 'email', -- email | inapp
  cooldown_minutes INTEGER NOT NULL DEFAULT 360,
  active           INTEGER NOT NULL DEFAULT 1,
  last_fired_at    TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_events (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id        TEXT REFERENCES alert_rules(id) ON DELETE SET NULL,
  rule_name      TEXT NOT NULL DEFAULT '',
  metric         TEXT NOT NULL DEFAULT '',
  value          REAL NOT NULL DEFAULT 0,
  baseline       REAL NOT NULL DEFAULT 0,
  threshold      REAL NOT NULL DEFAULT 0,
  message        TEXT NOT NULL DEFAULT '',
  channel        TEXT NOT NULL DEFAULT 'inapp',
  delivery       TEXT NOT NULL DEFAULT 'inapp',   -- inapp | sent | failed | skipped
  delivery_error TEXT NOT NULL DEFAULT '',
  read_at        TEXT,
  created_at     TEXT NOT NULL
);

-- Platform-side acquisition funnel: signup -> activation -> checkout -> paid.
--
-- Deliberately NOT analytics_events. That table is consent-gated behavioural
-- tracking of *page visitors*, shown to the creator on their own dashboard, and
-- its tenant_id cascades on org delete. Internal funnel steps must never appear
-- in a customer's analytics, and must survive the org deletion that *is* the
-- churn signal. tenant_id is therefore a plain string with no foreign key, and
-- no consent gate applies: this records what an account holder did, not how a
-- visitor browsed.
CREATE TABLE IF NOT EXISTS funnel_events (
  id           TEXT PRIMARY KEY,
  step         TEXT NOT NULL,                 -- signup_completed | activation_reached | checkout_started | purchase_completed | subscription_canceled
  tenant_id    TEXT NOT NULL DEFAULT '',      -- no FK on purpose: keep history after org delete
  user_id      TEXT NOT NULL DEFAULT '',
  plan         TEXT NOT NULL DEFAULT '',
  currency     TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  source       TEXT NOT NULL DEFAULT '',      -- utm_source / referrer at signup
  meta         TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_lists (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_list_members (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  list_id    TEXT NOT NULL REFERENCES email_lists(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE (list_id, contact_id)
);

CREATE TABLE IF NOT EXISTS email_templates (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  list_id      TEXT REFERENCES email_lists(id) ON DELETE SET NULL,
  template_id  TEXT REFERENCES email_templates(id) ON DELETE SET NULL,
  subject      TEXT NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  from_name    TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'draft',  -- draft | scheduled | sending | sent | partial | failed | canceled
  scheduled_at TEXT,
  sent_at      TEXT,
  stats        TEXT NOT NULL DEFAULT '{}',     -- JSON {sent, opened, clicked, unsubscribed, failed}
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_sends (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  contact_id  TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  email       TEXT NOT NULL,
  subject     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'queued',  -- queued | sent | failed | bounced | unsubscribed
  provider_id TEXT NOT NULL DEFAULT '',
  error       TEXT NOT NULL DEFAULT '',
  opened_at   TEXT,
  clicked_at  TEXT,
  sent_at     TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS unsubscribes (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  reason     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,               -- social | business | marketing | creator | pmo | career | ai
  content     TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  premium     INTEGER NOT NULL DEFAULT 0,
  icon        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS communities (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  public_flag INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  community_id TEXT REFERENCES communities(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS post_comments (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  post_id     TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS post_reactions (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  post_id     TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '👍',
  created_at  TEXT NOT NULL,
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS automation_workflows (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  trigger     TEXT NOT NULL,               -- lead | booking | purchase
  steps_json  TEXT NOT NULL DEFAULT '{}',
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  read_flag   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL DEFAULT 'stripe',
  provider_id  TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'usd',
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending | succeeded | failed | refunded
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT,
  user_id    TEXT,
  action     TEXT NOT NULL,
  resource   TEXT NOT NULL DEFAULT '',
  meta       TEXT NOT NULL DEFAULT '{}',
  ip         TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id      TEXT PRIMARY KEY,
  flag    TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT,
  user_id    TEXT,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bio_pages_tenant ON bio_pages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_blocks_page ON bio_blocks(page_id);
-- NOTE: indexes on the analytics columns added by migration 18 (session_id,
-- event_name, engagement_ms, properties) are created inside that migration, not
-- here. migrate() runs schema.sql before the migrations, so an index referencing
-- a column an older database has not added yet would make the whole schema exec
-- fail. Only indexes over columns present since the original schema belong here.
CREATE INDEX IF NOT EXISTS idx_events_tenant_time ON analytics_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_page ON analytics_events(page_id, event_type);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tracked_links_tenant ON tracked_links(tenant_id);
-- Global uniqueness on purpose: `/l/<slug>` has no tenant context to disambiguate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracked_links_slug ON tracked_links(slug);
CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_tenant ON alert_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON bookings(tenant_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_funnel_step_time ON funnel_events(step, created_at);
CREATE INDEX IF NOT EXISTS idx_funnel_tenant ON funnel_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_avail_service ON availability_windows(service_id);
-- ============ Store: orders (payments for products/courses) ============
CREATE TABLE IF NOT EXISTS orders (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id  TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  email       TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | failed | refunded | canceled
  amount_cents INTEGER NOT NULL DEFAULT 0,
  refunded_cents INTEGER NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'usd',
  provider    TEXT NOT NULL DEFAULT 'mock',
  provider_session_id TEXT NOT NULL DEFAULT '',
  course_id   TEXT DEFAULT '',
  token       TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id   TEXT NOT NULL,
  product_id  TEXT REFERENCES products(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0
);

-- Refund intents (D-10). A row is written *before* the gateway is called, so an
-- in-flight or crashed refund is visible rather than silently lost, and a
-- concurrent second refund is refused instead of double-refunding.
CREATE TABLE IF NOT EXISTS refunds (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount_cents  INTEGER NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'usd',
  provider      TEXT NOT NULL DEFAULT 'mock',
  provider_refund_id TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | succeeded | failed
  reason        TEXT NOT NULL DEFAULT '',
  admin_email   TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
-- At most one in-flight refund per order.
CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_one_pending ON refunds(order_id) WHERE status = 'pending';

-- Payment provider webhook events (idempotency ledger)
-- Gateway event receipts.
--
-- `processed_at` is null until the work actually succeeds. It used to be set at
-- insert time, which meant a failed delivery was on file as done and was then
-- never retried, so a paid order could stay pending for ever.
--
-- status: received -> processing -> processed | failed. `updated_at` is the lease
-- clock: a row left in `processing` by a crashed worker is reclaimable once it
-- goes stale, instead of wedging the event forever.
CREATE TABLE IF NOT EXISTS webhook_events (
  id           TEXT PRIMARY KEY,  -- provider event id
  provider     TEXT NOT NULL DEFAULT 'stripe',
  type         TEXT NOT NULL,
  payload      TEXT NOT NULL DEFAULT '{}',
  received_at  TEXT NOT NULL DEFAULT '',
  processed_at TEXT,
  status       TEXT NOT NULL DEFAULT 'received',
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  updated_at   TEXT NOT NULL DEFAULT ''
);

-- No index on status here on purpose. schema.sql runs *before* the migrations,
-- so on an upgrade this table still has its old shape and an index over the new
-- columns fails outright. The index is created by migration 14 instead, which is
-- the only place that knows the table has just been rebuilt.

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(provider_session_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ============ Module C: course builder ============
CREATE TABLE IF NOT EXISTS courses (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id  TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'usd',
  cover_url   TEXT NOT NULL DEFAULT '',
  published   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS course_sections (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  course_id  TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  course_id    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  section_id   TEXT NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'text',  -- video | audio | pdf | text | quiz | external
  content      TEXT NOT NULL DEFAULT '',
  duration_min INTEGER NOT NULL DEFAULT 0,
  position     INTEGER NOT NULL DEFAULT 0,
  published    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  course_id    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  contact_id   TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  order_id     TEXT,
  email        TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'free',  -- free | purchase | admin
  completed_at TEXT,
  created_at   TEXT NOT NULL,
  UNIQUE (tenant_id, course_id, email)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  lesson_id     TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed     INTEGER NOT NULL DEFAULT 0,
  score         INTEGER NOT NULL DEFAULT -1,
  updated_at    TEXT NOT NULL,
  UNIQUE (enrollment_id, lesson_id)
);

-- First-party traffic for the product's OWN marketing site (the pages a
-- prospective customer reads before signing up), shown only to platform admins.
-- Deliberately its own table: `analytics_events` is tenant-scoped and its
-- tenant_id cascades on org delete, so it cannot hold platform-level rows.
-- Country comes from the CDN header, and the visitor id is a salted one-way
-- hash that rotates daily - no cookie, no cross-site id, nothing that needs a
-- consent gate. See lib/site/traffic.ts.
CREATE TABLE IF NOT EXISTS site_visits (
  id         TEXT PRIMARY KEY,
  path       TEXT NOT NULL,                 -- normalized path, e.g. / or /pricing
  country    TEXT NOT NULL DEFAULT '',      -- ISO-3166 alpha-2 from the CDN header
  device     TEXT NOT NULL DEFAULT '',      -- desktop | mobile
  ref        TEXT NOT NULL DEFAULT '',      -- external referrer host, '' for direct/self
  visitor_id TEXT NOT NULL DEFAULT '',      -- daily-rotating salted hash, privacy-safe
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_site_visits_time ON site_visits(created_at);
CREATE INDEX IF NOT EXISTS idx_site_visits_country ON site_visits(country, created_at);
CREATE INDEX IF NOT EXISTS idx_site_visits_path ON site_visits(path, created_at);
CREATE INDEX IF NOT EXISTS idx_site_visits_visitor ON site_visits(visitor_id, created_at);

CREATE INDEX IF NOT EXISTS idx_courses_tenant ON courses(tenant_id, published);
CREATE INDEX IF NOT EXISTS idx_sections_course ON course_sections(course_id, position);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id, position);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
