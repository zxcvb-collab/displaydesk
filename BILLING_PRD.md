# Billing & Account Lifecycle — PRD

## Status

**Subscription billing (§4 Stripe section, minus add-on billing): live in
production, verified end-to-end** with a real test-mode Checkout → webhook
→ plan-sync flow. **Free-tier lifecycle automation (§3): designed, not yet
built** — no cron job, no email sends, no schema additions applied yet. A
full 7-email sequence covering the lifecycle has been drafted separately
and is parked for review.

## 1. Overview

DisplayDesk moves from a purely feature-gated free tier to a paid subscription
model via Stripe, with a time-boxed free tier (not indefinite) and an
automated lifecycle that disables, warns, and eventually deletes accounts
that never convert.

## 2. Pricing Tiers

Infra cost analysis (Supabase Pro $25/mo + Vercel Pro $20/mo fixed floor,
near-zero marginal cost per screen up to ~600+ screens assuming proper video
caching — see "Technical Prerequisite" below) and market comparables
($8-30/screen/month typical for small-business digital signage in 2026,
$10-15/screen most common) inform the following. Pricing is deliberately set
at the low end of the market to prioritize customer acquisition over margin
per customer, since marginal infra cost per screen is near-zero at expected
scale:

| Tier | Price | Included screens | Additional screen | Effective $/screen |
|---|---|---|---|---|
| Free | $0 | 1 | — (not purchasable beyond 1) | — |
| Starter | $9/mo | 2 | +$5/screen | ~$4.50 |
| Pro | $24/mo | 5 | +$4/screen | ~$4.80 |
| Business | $59/mo | 15 | +$3/screen | ~$3.93 |

This undercuts the market's low end (~$8/screen) to prioritize market
capture; revisit upward once there's a paying customer base and real usage
data to validate the caching cost assumptions below.

Billed monthly via Stripe Checkout (hosted page — we never handle card data
directly). No annual billing in this phase.

## 3. Free Tier Lifecycle

The free tier is a **3-month trial**, not a permanent tier, followed by a
grace period before permanent deletion:

| Elapsed time | Event |
|---|---|
| Day 0 | Signup, org created, 1 free screen available |
| ~Month 3 (before cutoff) | **Warning email**: "Your free trial ends soon — upgrade to keep your screen live" |
| Month 3 | If not upgraded: **soft-disable**. TV stops playing (screen shows an "upgrade required" state instead of content), dashboard access blocked. **All data retained** — instantly reversible by upgrading. |
| ~Month 9 (before cutoff) | **Warning email**: "Your account will be permanently deleted soon — upgrade to restore access" |
| Month 9 | If still not upgraded: **hard delete**. Org, screens, and all uploaded video files in Storage are permanently removed. Irreversible. |

Upgrading at any point before Month 9 fully restores the account with no
data loss.

## 4. Technical Requirements

### Stripe
- [x] Stripe Checkout (hosted) for subscription purchase — `/api/billing/checkout`
- [x] Stripe Customer Portal for self-service plan changes/cancellation —
  `/api/billing/portal` (built, not yet click-tested)
- [x] Webhook handler for subscription lifecycle events
  (`checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`) to keep `organisations.plan` in sync —
  `/api/billing/webhook`, uses a service-role Supabase client
- [ ] Metered add-on billing for screens beyond a tier's included count
  (Stripe usage-based pricing, or a simpler quantity-based line item
  recalculated on screen add/remove) — **deferred**, screens stay
  hard-capped at the tier limit for now

### Email
- [ ] Supabase's built-in email only covers auth flows (confirmation,
  password reset) — cannot send custom lifecycle emails. Confirmed, no
  workaround
- [ ] **Needs a transactional email provider** — recommend Resend (fits the
  Next.js/Vercel stack, 3,000 free emails/month). Not yet set up
- [x] Email copy drafted — full 7-email sequence (welcome, activation
  nudge, trial-ending warning, disable confirmation, mid-window
  re-engagement, final deletion warning, deletion confirmation) drafted via
  the email-sequence skill, parked for review. Not yet templated as
  React Email/HTML or wired to a send pipeline

### Scheduling
- [ ] Needs a recurring job to scan for orgs crossing the month-3 warning,
  month-3 disable, month-9 warning, and month-9 delete thresholds. Not yet
  built
- Candidates: Vercel Cron (simple, integrates with existing Next.js API
  routes) or Supabase `pg_cron` (runs in the database directly)

### Schema additions (organisations table)
- [x] `stripe_customer_id`, `stripe_subscription_id` — added, in use
  (`supabase-billing-schema.sql`)
- [ ] `status` — enum: `active` | `disabled` | `pending_deletion` (or similar) — not yet added
- [ ] `trial_started_at` — defaults to `created_at` for free-tier orgs — not yet added
- [ ] `trial_warning_sent_at`, `deletion_warning_sent_at` — prevent duplicate
  emails on repeated cron runs — not yet added

### Technical Prerequisite (cost protection)
- [x] **Done.** Uploads now set `cacheControl: '31536000'` (1 year) on the
  Supabase Storage upload call. Previously fell back to the platform
  default (1 hour), which would have meant TVs re-validating hourly, 24/7,
  across potentially hundreds of screens. Applies to new uploads only —
  files uploaded before this fix retain their original 1-hour setting.

## 5. Open Items / Not Yet Decided

- [x] ~~Exact Stripe product/price IDs~~ — created:
  Starter `price_1ToaxC0IIn3DetD8MnxR1Sou`, Pro `price_1ToaxP0IIn3DetD89GJgfdiv`,
  Business `price_1Toaxb0IIn3DetD8KlSRK0Fv`
- [ ] Cron mechanism choice (Vercel Cron vs. `pg_cron`)
- [ ] Email template copy — drafted (see Email section above), not yet
  built as sendable templates
- [ ] Whether the month-9 deletion warning email includes a one-click
  reactivate/upgrade link vs. requiring a full login + upgrade flow
- [ ] Grace-period edge case: what happens if a customer upgrades mid-warning-
  period — do warning flags reset immediately? (Assumed yes, but not yet
  built)
