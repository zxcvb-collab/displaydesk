# DisplayDesk — Product Requirements Document

**Status:** Live in production (Vercel + Supabase). Core product (auth,
screens, video upload/playback) and Stripe subscription billing are both
live and verified end-to-end. Free-tier lifecycle automation (warnings,
disable, deletion) is designed but not yet built. This document reflects
the actual as-built system, not the original single-HTML-file concept —
the product was rearchitected as a full multi-tenant SaaS during
implementation. See [BILLING_PRD.md](BILLING_PRD.md) for the billing/
lifecycle spec in detail; it's summarized here for completeness.

## 1. Product Overview

DisplayDesk is a multi-tenant SaaS for restaurant/cafe operators to display
looping video menus on smart TVs. Operators manage screens and videos from a
web dashboard; each screen is identified by a PIN that a TV visits directly
to start fullscreen looping playback. Supports both YouTube-hosted videos
and direct file uploads (Canva-exported MP4s being the primary real-world
use case).

### 1.1 Target Users
- Restaurant/cafe owner or manager — configures screens, uploads videos,
  manages billing
- Front-of-house staff — opens the TV URL and taps to start playback

## 2. Architecture

| Layer | Technology |
|---|---|
| Frontend/Backend | Next.js (App Router), deployed on Vercel |
| Database + Auth | Supabase (Postgres + Supabase Auth) |
| File storage | Supabase Storage (public `videos` bucket) |
| Video playback | YouTube IFrame API (YouTube URLs) + HTML5 `<video>` (uploads) |

Multi-tenancy is enforced via Postgres Row Level Security (RLS) — every
table scopes access by `organisations.owner_id = auth.uid()`, with a
narrow, function-gated exception for anonymous TV playback (see §5).

## 3. Data Model

- **`organisations`** — one per signed-up user (auto-created via a
  `handle_new_user` DB trigger on `auth.users` insert). Holds `owner_id`,
  `name`, `plan`, `stripe_customer_id`, `stripe_subscription_id`,
  `default_schedule` (org-wide business-hours default, see §4.5).
- **`screens`** — belongs to an org. Holds `pin` (unique, TV-facing
  identifier), `name`, `slides` (JSON array of `{ url, type }`, where
  `type` is `'youtube' | 'video'`), `last_seen_at` + `current_slide_index`
  (live status, see §4.4), `schedule_mode` + `schedule` (business-hours
  override, see §4.5).
- **`screen_activity`** — append-only log of video upload/delete events per
  screen, with actor email and timestamp.

## 4. Core Features (Implemented)

### 4.1 Auth & Onboarding
- Email/password signup via Supabase Auth, email confirmation required
- Organisation auto-created on signup (DB trigger, with an app-level
  fallback on first dashboard load in case the trigger path is ever missed)
- Sign-out via POST to `/auth/signout`, redirects to `/login`

### 4.2 Screen Management (Dashboard)
- Create a screen (generates a unique 4-digit PIN via `generate_unique_pin`)
- Rename a screen inline
- Add videos via YouTube URL or direct file upload (uploaded directly
  browser → Supabase Storage, bypassing Vercel's serverless body-size limit)
- Reorder videos (move up/down)
- Remove a single video — uploaded files are confirmed and permanently
  deleted from Storage, not just unlinked; YouTube links are removed
  instantly since there's no associated file
- Delete a screen — warns if it has uploaded videos and cleans up their
  Storage files before removing the screen row
- Per-screen activity log showing who uploaded/deleted what and when

### 4.3 TV Playback (`/tv/[pin]`)
- Anonymous, PIN-only access (no login required on the TV)
- "Tap to start" overlay — requests fullscreen on the resulting user
  gesture (browsers block programmatic fullscreen on page load)
- Auto-advances between videos, loops back to the first after the last
- Polls for content changes every 60s without interrupting current playback
- Uploaded videos use `object-contain` scaling — never crops content, even
  at the cost of letterboxing on aspect-ratio mismatches (deliberate,
  since menu text/prices at the edges must never be cut off)
- Falls back to the next slide on a playback error instead of hanging

### 4.4 Live Screen Status (Dashboard)
- TVs report a heartbeat + current slide index on every 60s content poll,
  via a PIN-scoped `SECURITY DEFINER` function (`report_screen_heartbeat`)
  — same anonymous-access model as playback itself
- Dashboard shows a status dot per screen: **Online** (polled within the
  last 2 minutes) with what's currently playing, **Offline** with a
  last-seen time, or **Not connected yet** for screens with no heartbeat
  ever recorded
- TV player fires an immediate poll on mount (not just after the first 60s
  interval), so status reflects reality quickly after a TV taps "start"

### 4.5 Business-Hours Scheduling
- Screens can be restricted to business hours instead of playing 24/7.
  **Important caveat: we don't control TV power directly** (no smart-plug
  or CEC integration) — "closed" means the TV shows a black screen and
  stops playing, not that the physical display powers off
- Three scopes, admin's choice:
  - **Always on** — no restriction (default, matches pre-scheduling
    behavior)
  - **Use business hours** — inherits `organisations.default_schedule`,
    a single org-wide weekly schedule set on the dashboard
  - **Custom hours** — per-screen override (`screens.schedule`), useful
    when e.g. a patio screen has different hours than an indoor counter
    screen
- Schedule shape: one entry per day of week, each either `null` (closed
  all day) or `{ open: "HH:MM", close: "HH:MM" }` in 24h local time;
  overnight windows (close time before open time) wrap past midnight
- Evaluated **entirely client-side on the TV**, using the TV's own system
  clock — no server cron job. The TV re-checks locally every 15s (no
  network call) and also picks up schedule changes on its normal 60s
  content poll
- On close: pauses any playing video/YouTube player and renders a plain
  black screen. On reopen: resumes automatically from the current slide
- Assumes the TV's system clock/timezone is correctly set to local time
  (typical for a TV physically located at the business) — there is no
  explicit timezone field in the schema

### 4.6 Plan Limits
- Screens per org capped by `organisations.plan` (`free` = 1, `starter` = 2,
  `pro` = 5, `business` = 15, enforced at screen-creation time in the API
  route)

### 4.7 Billing (Implemented, tested end-to-end in production)
- Stripe Checkout (hosted) for Starter/Pro/Business subscriptions — a
  Stripe customer is created on first upgrade and linked via
  `stripe_customer_id`
- Dashboard shows current plan and per-tier upgrade/switch buttons
- Stripe webhook (`/api/billing/webhook`) syncs `organisations.plan` from
  `checkout.session.completed`, `customer.subscription.updated`, and
  `customer.subscription.deleted` events, using a service-role Supabase
  client (webhooks have no user session)
- Stripe Customer Portal (`/api/billing/portal`) for self-service plan
  changes/cancellation — **built but not yet click-tested**
- Verified live: Checkout → test-mode payment → webhook fires → plan
  updates → screen limit reflects new tier, confirmed via manual test with
  Stripe's test card
- Per-screen add-on billing beyond a tier's included count is **deferred**
  — screens stay hard-capped at the tier limit for now, matching the
  pre-billing behavior, to keep the first integration shippable

## 5. Security Model

- RLS enabled and enforced on all tables holding tenant data
- Verified via a scripted two-account cross-tenant test: writes to another
  org's screen are blocked (0 rows affected); reads were **found to leak**
  via a legacy `screen_public_read` policy (`USING (true)`) that allowed
  reading any screen by ID, not just by PIN — this has been fixed
- Public/anonymous screen lookup now goes through a dedicated
  `get_screen_by_pin(pin)` `SECURITY DEFINER` function that only supports
  exact-match PIN lookups, exposing just the columns the TV needs — there
  is no longer any path to enumerate or browse other orgs' screen data
- `handle_new_user` and `rls_auto_enable` (a safety-net event trigger that
  auto-enables RLS on any newly created table) have had their default
  `PUBLIC` execute grants revoked — they only ever run via trigger/event
  trigger context, never as direct client-callable RPCs
- `service_role` was found to be missing basic table grants on
  `organisations`/`screens` (distinct from RLS bypass — bypassing RLS
  doesn't substitute for the underlying GRANT). Fixed as part of the
  billing schema migration, since the webhook depends on service-role
  writes

## 6. Billing (Summary — see BILLING_PRD.md for full detail)

- Pricing: Free (1 screen, 3-month trial) / Starter $9 (2 screens, +$5/ea)
  / Pro $24 (5 screens, +$4/ea) / Business $59 (15 screens, +$3/ea) —
  priced at the low end of market to prioritize customer acquisition
- **Stripe Checkout, webhook, and Customer Portal are implemented and
  live in production** — see §4.7 for detail
- Free-tier lifecycle: warning email (~month 3) → soft-disable (month 3,
  data retained) → warning email (~month 9) → hard delete (month 9) —
  **not yet built**. A full 7-email sequence covering this lifecycle
  (welcome, activation nudge, trial-ending warning, disable confirmation,
  mid-window re-engagement, final deletion warning, deletion confirmation)
  has been drafted and is parked for review, not yet wired to an email
  provider
- **Still not built**: email provider integration (Resend planned),
  scheduled lifecycle job (Vercel Cron candidate), and the
  `trial_started_at`/`trial_warning_sent_at`/`deletion_warning_sent_at`
  schema additions the lifecycle job depends on

## 7. Known Gaps / Deferred

- No remote TV pairing (staff manually visit `/tv/[pin]`; a phone-based
  PIN-pairing flow was considered but deferred)
- No multi-user per organisation (one owner account per org)
- No video transcoding — uploads must already be browser-playable (H.264
  MP4 recommended)
- Free-tier lifecycle automation (warnings, disable, hard delete) not yet
  built — see §6
- Per-screen add-on billing beyond a tier's included count not yet built
  — see §4.7
- Leaked-password protection unavailable (gated behind Supabase's paid
  tier, not fixable in application code)
- Storage files uploaded before the deletion-cleanup fix landed may still
  be orphaned in the bucket; new uploads/deletions are handled correctly

## 8. Testing Status

See [PHASE1_CHECKLIST.md](PHASE1_CHECKLIST.md) for the detailed, itemized
test log (what's verified end-to-end vs. still pending — e.g. real TV
hardware testing, multi-video sequencing edge cases).
