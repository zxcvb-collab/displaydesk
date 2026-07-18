# DisplayDesk — Product Requirements Document

**Status:** Live in production (Vercel + Supabase). Core product, Stripe
billing (including per-screen add-on billing), multi-user orgs, PIN-based
remote pairing, and offline resilience (both mid-session and full-reload)
are all live and verified. Free-tier lifecycle *enforcement* (disable at
month 3, delete at month 9) is live; the emails that accompany it are not
sent yet (Resend integration deliberately on hold). This document reflects
the actual as-built system, not the original single-HTML-file concept —
the product was rearchitected as a full multi-tenant SaaS during
implementation. See [BILLING_PRD.md](BILLING_PRD.md) for the billing/
lifecycle spec in detail; it's summarized here for completeness.

## 1. Product Overview

DisplayDesk is a multi-tenant SaaS for restaurant/cafe operators to display
looping video menus on smart TVs. Operators manage screens and videos from a
web dashboard; each screen is identified by a PIN that a TV enters via a
remote-friendly on-screen keypad to start fullscreen looping playback.
Supports both YouTube-hosted videos and direct file uploads (Canva-exported
MP4s being the primary real-world use case).

### 1.1 Target Users
- Restaurant/cafe owner — configures screens, uploads videos, manages
  billing and the team
- Managers/staff (invited team members) — day-to-day screen and video
  management, no billing access
- Front-of-house staff — enters the PIN on the TV once during setup

## 2. Architecture

| Layer | Technology |
|---|---|
| Frontend/Backend | Next.js (App Router), deployed on Vercel |
| Database + Auth | Supabase (Postgres + Supabase Auth) |
| File storage | Supabase Storage (public `videos` bucket) |
| Video playback | YouTube IFrame API (YouTube URLs) + HTML5 `<video>` (uploads) |
| Billing | Stripe (Checkout, Customer Portal, webhooks) |
| Offline resilience | Cache Storage API (video caching) + a scoped Service Worker (`/tv/*` only) |

Multi-tenancy is enforced via Postgres Row Level Security (RLS) — every
table scopes access by org ownership *or* membership (`org_members`, see
§4.6), with a narrow, function-gated exception for anonymous TV playback
(see §5).

## 3. Data Model

- **`organisations`** — one per signed-up user (auto-created via a
  `handle_new_user` DB trigger on `auth.users` insert). Holds `owner_id`,
  `name`, `plan`, `stripe_customer_id`, `stripe_subscription_id`,
  `default_schedule` (org-wide business-hours default, see §4.5),
  `status` (`active`/`disabled`), `trial_started_at`,
  `trial_warning_sent_at`, `deletion_warning_sent_at` (free-tier lifecycle,
  see §6).
- **`screens`** — belongs to an org. Holds `pin` (unique, TV-facing
  identifier), `name`, `slides` (JSON array of `{ url, type, offlineThumb? }`,
  where `type` is `'youtube' | 'video'` and `offlineThumb` is an admin-picked
  index 0-3 into YouTube's auto-generated thumbnails, used as the offline
  fallback image), `last_seen_at` + `current_slide_index` + `is_open` (live
  status, see §4.4), `schedule_mode` + `schedule` (business-hours override,
  see §4.5).
- **`screen_activity`** — append-only log of video upload/delete events per
  screen, with actor email and timestamp.
- **`org_members`** — `(org_id, user_id)`, additional users with full
  day-to-day screen-management access but no billing/team-management
  (see §4.6).
- **`org_invites`** — token-based, 7-day expiry, used to onboard new team
  members via a shareable link (see §4.6).

## 4. Core Features (Implemented)

### 4.1 Auth & Onboarding
- Email/password signup via Supabase Auth, email confirmation required
- Organisation auto-created on signup (DB trigger, with an app-level
  fallback on first dashboard load in case the trigger path is ever missed)
- Sign-out via POST to `/auth/signout`, redirects to `/login`
- Login supports a `?redirect=` param (relative paths only) — used by the
  team-invite flow to send an unauthenticated visitor to log in and land
  back where they were headed

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
- Per-YouTube-slide offline fallback thumbnail picker (see §4.7)

### 4.3 TV Setup & Playback
- **PIN entry** (`/tv`) — a static, bookmarkable page with a large
  on-screen numeric keypad, designed for remote/d-pad navigation. Staff
  bookmarks this one short URL once, then only ever types the 4-digit PIN
  — no more entering a full URL character-by-character via an on-screen
  QWERTY keyboard. Validates the PIN directly via the `get_screen_by_pin`
  RPC (not the polling endpoint, which has a heartbeat side effect that
  would misreport the screen as online before it's actually loaded)
- **Playback** (`/tv/[pin]`) — anonymous, PIN-only access (no login
  required)
- "Tap to start" overlay — requests fullscreen on the resulting user
  gesture (browsers block programmatic fullscreen on page load)
- Auto-advances between videos, loops back to the first after the last
- Polls for content changes every 60s without interrupting current playback
- Uploaded videos use `object-contain` scaling — never crops content, even
  at the cost of letterboxing on aspect-ratio mismatches (deliberate,
  since menu text/prices at the edges must never be cut off)
- Falls back to the next slide on a playback error instead of hanging

### 4.4 Live Screen Status (Dashboard)
- TVs report a heartbeat + current slide index + open/closed state on
  every 60s content poll, via PIN-scoped `SECURITY DEFINER` functions
  (`report_screen_heartbeat`) — same anonymous-access model as playback
  itself
- Dashboard shows a status dot per screen: **Online** (polled within the
  last 2 minutes) with what's currently playing, **Closed** (online but
  outside business hours — distinct from Offline so a correctly-behaving
  screen never looks broken), **Offline** with a last-seen time, or **Not
  connected yet** for screens with no heartbeat ever recorded
- TV player fires an immediate poll on mount (not just after the first 60s
  interval), so status reflects reality quickly after a TV taps "start"

### 4.5 Business-Hours Scheduling
- Screens can be restricted to business hours instead of playing 24/7.
  **Important caveat: we don't control TV power directly** (no smart-plug
  or CEC integration) — "closed" means the TV shows a black screen and
  stops playing, not that the physical display powers off
- Three scopes, admin's choice: **Always on** (default) / **Use business
  hours** (inherits `organisations.default_schedule`) / **Custom hours**
  (per-screen override)
- Schedule shape: one entry per day of week, each either `null` (closed
  all day) or `{ open: "HH:MM", close: "HH:MM" }` in 24h local time;
  overnight windows wrap past midnight
- Evaluated **entirely client-side on the TV**, using the TV's own system
  clock — no server cron job. Re-checks locally every 15s, also picks up
  changes on the normal 60s content poll
- Assumes the TV's system clock/timezone is correctly set to local time —
  there is no explicit timezone field in the schema

### 4.6 Multi-User Organisations
- One org can have multiple users: the **owner** (billing, team
  management, danger-zone actions) and any number of **members** (full
  day-to-day screen/video management, no billing or team access)
- Invites work via a **shareable link**, not an automated email (Resend
  integration is on hold) — the owner generates a link on the dashboard
  and sends it manually (text, WhatsApp, etc.)
- Invite links are single-use, expire after 7 days, and redeem through a
  service-role-backed endpoint (`/api/invites/redeem`) — RLS intentionally
  only lets an org's owner INSERT into `org_members` directly, so
  redemption needs an elevated path gated entirely by the endpoint's own
  token/expiry/already-used checks
- RLS extends across `screens`, `organisations` (SELECT), `screen_activity`,
  and the `videos` Storage bucket so members get the same data access as
  owners for anything screen-related

### 4.7 Offline Resilience
Two independent layers, since YouTube and uploaded videos fail differently
when offline:

- **Uploaded videos**: opportunistically cached in the browser's Cache
  Storage as they're seen. On a network failure mid-loop, falls back to
  the cached copy and keeps actually playing — survives a brief wifi blip
  without visible interruption.
- **YouTube videos**: cannot be cached or replayed offline — they stream
  live from YouTube's own cross-origin iframe, which is a hard technical
  wall (can't read pixel data out of a cross-origin iframe; downloading
  YouTube content server-side to extract frames would violate their ToS).
  What's buildable instead: the admin picks one of YouTube's ~4
  auto-generated thumbnails (fixed points, not arbitrary) per YouTube
  slide as an **offline fallback image**. The TV tracks connectivity via
  the browser's native `online`/`offline` events (the only reliable
  signal here, since failures inside YouTube's iframe aren't observable)
  and shows that static thumbnail instead of a frozen/broken embed while
  offline, resuming normal playback on reconnect.
- **Surviving a full page reload/restart during an outage** (not just a
  mid-session blip): a Service Worker (`public/sw.js`), scoped narrowly to
  `/tv/*` so it never touches the admin dashboard on a shared device.
  Network-first, falling back to the last successfully cached response —
  covers the page shell, its static JS/CSS chunks, and the
  `/api/tv/[pin]` content-poll endpoint. Only helps once a TV has
  successfully loaded at least once while online (there's no way to
  serve a page that's never been cached), which matches the realistic
  setup flow.

### 4.8 Plan Limits & Add-On Billing
- Screens included per plan: `free` = 1 (hard cap, no add-on path —
  upgrading is the only way past 1), `starter` = 2, `pro` = 5,
  `business` = 15
- **Paid tiers are not hard-capped** — screens beyond the included count
  are billed as a metered Stripe subscription add-on (+$5/$4/$3 per extra
  screen for Starter/Pro/Business respectively)
- Add-on quantity syncs automatically on screen create/delete and on any
  plan change (e.g. downgrading Pro → Starter re-syncs since the included
  count changes)

### 4.9 Billing (Stripe)
- Stripe Checkout (hosted) for Starter/Pro/Business subscriptions — a
  Stripe customer is created on first upgrade and linked via
  `stripe_customer_id`
- Dashboard shows current plan, included vs. extra screens, and the
  applicable add-on rate (owner-only view)
- Stripe webhook (`/api/billing/webhook`) syncs `organisations.plan` from
  `checkout.session.completed`, `customer.subscription.updated`, and
  `customer.subscription.deleted` events, using a service-role Supabase
  client (webhooks have no user session). Explicitly finds the base-plan
  line item by price ID rather than assuming index 0, since subscriptions
  can now carry two items (base plan + add-on)
- Stripe Customer Portal (`/api/billing/portal`) for self-service plan
  changes/cancellation — built, not yet click-tested
- Verified live end-to-end with Stripe's test card: Checkout → payment →
  webhook fires → plan updates → screen limit reflects new tier

## 5. Security Model

- RLS enabled and enforced on all tables holding tenant data
- Verified via a scripted two-account cross-tenant test: writes to another
  org's screen are blocked (0 rows affected); reads were **found to leak**
  via a legacy `screen_public_read` policy (`USING (true)`) that allowed
  reading any screen by ID, not just by PIN — fixed
- Public/anonymous screen lookup goes through a dedicated
  `get_screen_by_pin(pin)` `SECURITY DEFINER` function that only supports
  exact-match PIN lookups, exposing just the columns the TV needs
- `handle_new_user` and `rls_auto_enable` (a safety-net event trigger that
  auto-enables RLS on any newly created table) have had their default
  `PUBLIC` execute grants revoked — they only ever run via trigger/event
  trigger context, never as direct client-callable RPCs
- `service_role` was found to be missing basic table grants on
  `organisations`/`screens` (distinct from RLS bypass) — fixed
- Two purely-redundant RLS policies (`screen_owner_all`, `org_owner_all`)
  removed — they duplicated the more specific per-command policies with
  identical effect, cosmetic only
- Invite redemption is the one place a service-role client deliberately
  bypasses an RLS restriction (see §4.6) — narrowly scoped and justified
  by the endpoint's own validation, not a general pattern

## 6. Free-Tier Lifecycle (Summary — see BILLING_PRD.md for full detail)

- Pricing: Free (1 screen, 3-month trial) / Starter $9 / Pro $24 /
  Business $59 — see §4.8/§4.9 for the full add-on structure
- **Enforcement is live**: Day ~75 flags a warning, Day 90 soft-disables
  (screens stop playing, dashboard blocks management, all data retained
  and instantly restorable on upgrade), Day ~255 flags a final warning,
  Day 270 hard-deletes the org, its screens, its uploaded videos, and the
  owner's login itself (deliberate — otherwise the dashboard's
  org-auto-create fallback would silently hand out a fresh free trial
  just by logging back in)
- Runs via Vercel Cron (`/api/cron/lifecycle`, daily, `CRON_SECRET`-gated)
  — verified working in production with a manual trigger
- **Emails are not sent yet** — Resend integration is deliberately on
  hold. The state machine (disable/delete) still executes on schedule
  regardless; a real customer could be disabled or deleted with no actual
  warning reaching their inbox until Resend is wired up. A full 7-email
  sequence covering the lifecycle (plus onboarding/engagement emails) has
  been drafted and is parked for review

## 7. Known Gaps / Deferred

- **Video transcoding** — uploads must already be browser-playable (H.264
  MP4 recommended). Building this needs a specific third-party service
  decision (real cost/vendor implications) — not picked yet, flagged for
  a deliberate choice rather than silently selecting one
- **Resend/email sending** — on hold at the user's direction; see §6 for
  what that means in practice for the lifecycle automation
- Leaked-password protection unavailable (gated behind Supabase's paid
  tier, not fixable in application code)
- Storage files uploaded before the deletion-cleanup fix landed may still
  be orphaned in the bucket; new uploads/deletions are handled correctly
- No historical uptime/status log — only current status is shown, not a
  history of when a screen went offline/online over time

## 8. Testing Status

See [PHASE1_CHECKLIST.md](PHASE1_CHECKLIST.md) for the detailed, itemized
test log (what's verified end-to-end vs. still pending — e.g. real TV
hardware testing, multi-video sequencing edge cases). Note it predates
this session's batch of features (add-on billing, multi-user, PIN pairing,
offline PWA) — those are verified via build success and code review, not
yet manually clicked through on a live deployment.
