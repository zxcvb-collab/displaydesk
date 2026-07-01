# Phase 1 MVP — Status & Test Plan

Last updated after fixing: localhost redirects in production, direct-to-storage
video upload, storage RLS column bug, TV player not starting on video-only
screens, and RLS/security advisor warnings.

## ✅ Verified Working (tested end-to-end)

- [x] Signup → org auto-created (via `handle_new_user` DB trigger)
- [x] Email confirmation link lands on production domain (after Site URL fix)
- [x] Dashboard loads screens for the logged-in org
- [x] "+ Add screen" creates a screen with a unique PIN, redirects correctly
- [x] Free plan caps at 1 screen — button disables at the limit
- [x] Video upload goes directly browser → Supabase Storage (bypasses Vercel's
      4.5MB serverless body limit entirely)
- [x] Uploaded video shows "Uploaded" badge with thumbnail icon
- [x] YouTube URL adds with thumbnail preview
- [x] `/tv/[pin]` shows "Tap to start" overlay, requests fullscreen on tap
- [x] Uploaded video plays and autoplays on TV (first-slide init bug fixed)
- [x] Storage RLS policies enforce org-folder ownership correctly (ambiguous
      column bug fixed)
- [x] RLS enabled + enforced on `organisations` and `screens`
- [x] No public/anon execution of `handle_new_user` / `rls_auto_enable` RPCs

## 🧪 Not Yet Tested — Run These Next

### Admin flow
- [ ] **Reorder videos** (up/down arrows) with a mix of YouTube + uploaded slides
- [ ] **Delete a single video** from the list — confirm it's removed from the
      slides array (note: this does NOT delete the file from Storage — see
      "Known gap" below)
- [ ] **Rename a screen** — blur the name field, refresh, confirm it persists
- [ ] **Delete a whole screen** — confirm it disappears from dashboard and
      that a free-plan account can then add a new one again
- [ ] **Sign out** → confirm redirect to `/login` and that `/dashboard` then
      redirects back to `/login` when visited directly

### TV flow
- [ ] **YouTube-first, video-second** (and reverse order) — confirm
      auto-advance works correctly in both directions
- [ ] **Multiple uploaded videos in sequence** — not just one
- [ ] **Loop back to first slide** after the last one ends
- [ ] **Live update while TV is playing** — change slides in the admin, wait
      up to 60s, confirm the TV picks up changes without a manual refresh
      (this is the polling mechanism — verify it doesn't restart the currently
      playing video mid-playback)
- [ ] **Exit fullscreen mid-playback** (e.g. remote's back button) — confirm
      the small "Enter fullscreen" button appears and works
- [ ] **Bad/broken video URL** — confirm it skips to the next slide instead
      of hanging
- [ ] **Screen with zero slides** — confirm the "No videos added yet" + PIN
      screen shows correctly
- [ ] **Actual TV hardware** (Tizen / webOS / Fire TV Silk) — Fullscreen API
      and video codec support can behave differently than desktop Chrome

### Security / access control
- [ ] **Cross-org isolation** — while logged in as Org A, try `PATCH`/`DELETE`
      on a screen ID belonging to Org B directly via the API (e.g. curl or
      browser devtools) → should get 401/no rows affected, never another
      org's data
- [ ] **Anonymous access** — confirm `/tv/[pin]` works logged out, but the
      dashboard/admin routes reject anonymous access
- [ ] **Re-run Supabase Security Advisor** after all fixes — confirm the list
      is fully clear (leaked-password-protection warning aside, which is a
      free-tier limitation, not fixable in code)

## ⚠️ Known Gaps (not bugs, just unbuilt)

- **Orphaned storage files**: deleting a video slide or an entire screen does
  not delete the underlying file from the `videos` Storage bucket. Files
  accumulate silently. Low priority until storage costs matter, but worth a
  cleanup job eventually.
- **No remote pairing** — TVs must manually visit `/tv/[pin]`, no phone-based
  pairing flow (that's the Phase 2 concept from the original PRD).
- **No plan upgrade path** — `plan` field exists and is enforced, but there's
  no billing/checkout flow to actually move a user from free → starter/pro.
- **No video transcoding** — uploads must already be in a browser-playable
  format (H.264 MP4 is safest); TV browsers vary in codec support.
- **Leaked password protection** — disabled, gated behind Supabase Pro plan.

## 🔧 Troubleshooting Reference

**Upload fails silently** — check the browser console for a Supabase Storage
RLS error. If you see one, verify the policies from `supabase-storage-fix.sql`
are applied (not the older, buggy ones from `supabase-storage-setup.sql`).

**Auth links go to localhost** — Supabase Dashboard → Authentication → URL
Configuration → confirm Site URL is your production domain, not localhost.

**TV shows blank YouTube logo, nothing plays** — should be fixed as of the
first-slide-initialization patch; if it recurs, check browser console for
YouTube IFrame API load failures (network/ad-blocker issues).

**"Add screen" redirects to localhost** — should be fixed (uses request
origin now, not an env var fallback); if it recurs, check for any remaining
hardcoded `localhost` references in API routes.
