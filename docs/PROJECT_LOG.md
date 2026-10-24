# Project log — BBDO Brief Creator

Running record of what has been built, what state it is in, and what is still open.
Written as a handover: anyone (or any new session) should be able to read this and know
where things stand without re-reading the code.

**Last updated:** 2026-10-24
**Live at:** https://bbdo.briefomnicom.com
**Repo:** `impactproximity/bbdo-brief` · **Deploy:** Vercel, auto-deploys on merge to `main`

---

## Current state at a glance

| | |
|---|---|
| Branch | `feat/public-brief-api` (HEAD `546ee08`) — merged to `main` as `0938745` |
| Uncommitted | None tracked. ~13 **untracked** password-era leftovers on disk — see Gotchas below. |
| Last merged PR | **#17** — public Brief Generation API (merged 2026-10-21, live) |
| Dev server | Run `npm run dev` → http://localhost:3000 |
| Databases | **One** — Supabase Postgres. SQL Server dependency removed. Migrations 0001–**0006** applied. |
| Users | **82** rows in `bbdo_users` |
| API keys | 1 active (`bbdo_sk_MP98…`, Impact BBDO Pulse, 20/hour), 2 revoked |

**Standing instruction from the user: never push, open a PR, or deploy without asking first
and getting a clear yes in the current conversation.** Merging a PR to `main` auto-deploys to
production for ~82 staff, so pushing is not a low-stakes action here. Local commits, builds,
dev server and migrations are fine.

---

## Completed and in production

### 1. Stacked Impact BBDO lockup + favicon
Replaced the horizontal lockup with the stacked one across the app. Shipped in PR #11.

**Gotcha that bit twice:** `app/icon.tsx` and `app/agency/icon.tsx` both generated favicons,
producing two competing icons. Both were deleted — then **OneDrive restored them**, silently
re-introducing the bug. If the favicon ever looks wrong again, check whether those two files
have reappeared.

### 2. P&O Ferries client — PR #11, merged
`lib/clients/p-and-o.ts`, built from the supplied brand toolkit and prompt doc.
`logo: 'clients/p-and-o.png'`, `logoWidth: 38`, `logoHeight: 35`.

Deliberately has **no `briefTypes`**, so it inherits the four standard tiers. The user
initially said "for social we choose a different format", but on being shown the two actual
formats chose the standard four tiers — so this is intentional, not an omission.

### 3. Brief history on Supabase — PR #12, merged
Briefs persist with three statuses: `in_progress` (autosaved) · `saved` (user clicked Save) ·
`submitted` (DOCX generated).

- `db/supabase/0001_briefs.sql` — the `briefs` table.
- `lib/briefs/store.ts` — **read the security header before touching it.** It uses the
  service-role key, which bypasses RLS entirely, so user scoping is enforced in app code:
  every exported function takes `userId` **first** and filters on it. Never add a function
  that looks a brief up by id alone.
- `app/agency/briefs/page.tsx` — the history list. Also the closest thing to a precedent for
  any future report page: it already solves the loading / not-configured / error / empty
  four-state render.

RLS is enabled on every table with **no policies** — a deliberate backstop so a leaked anon
key reaches nothing. All access goes through the service-role key from our own routes.

---

## Completed and in production — the OTP login migration (PR #13)

**Working locally, never pushed** — roughly 33 of the 47 uncommitted files. Password login is gone;
users are pre-registered, marked active, and receive only a 6-digit code by email.

### Architecture decision worth preserving

**Supabase Auth (GoTrue) is used purely as an OTP engine, not as the identity.**
`bbdo_users` remains the allowlist and the identity that `session.userId` and
`briefs.user_id` refer to. The GoTrue user and the `bbdo_users` row are two records for the
same person, joined only on lowercased email.

This was a correction to an earlier, wrong framing: adopting GoTrue as the identity would
have meant migrating integer ids to UUIDs and **logging out all 25 users**. Avoided.

### Files

| File | Role |
|---|---|
| `lib/auth/supabaseOtp.ts` | The OTP engine. Heavily commented — the comments are load-bearing, see below. |
| `lib/auth/otpRateLimit.ts` | Postgres-backed rate limiting (in-process is meaningless on serverless). |
| `lib/supabase/admin.ts` | Shared service-role client cached on `globalThis._supabaseAdmin`. |
| `lib/auth.ts` | Rewritten twice — bcrypt removed, then pointed at Supabase. |
| `app/api/auth/otp/request/route.ts` | Sends a code. Anti-enumeration. |
| `app/api/auth/verify/route.ts` | Verifies and mints the jose session cookie. |
| `app/login/page.tsx` | Two-step form. |
| `db/supabase/0002_otp_attempts.sql` | Rate-limit ledger. |
| `db/supabase/0003_bbdo_users.sql` | Users, moved out of SQL Server. |
| `db/supabase/0004_bbdo_users_constraints.sql` | Sequence + the `briefs_user_id_fkey` that was impossible before. |
| `scripts/_otp-lib.mjs` + 4 scripts | Provisioning: create user, activate, sync to GoTrue, break-glass. |

**Deleted:** `lib/db.ts`, `db/schema.sql`, `scripts/db-setup.mjs`, `scripts/db-migrate.mjs`,
`app/signup/`, `app/change-password/`, `app/api/auth/{signup,change-password,login}/`.

### Four non-obvious things that will break if changed

1. **`uninstrumentedFetch`** (`lib/auth/supabaseOtp.ts:30`) — Next.js replaces
   `globalThis.fetch` with a wrapper that **retries**. For a POST to `/auth/v1/otp` that is
   actively harmful: GoTrue mints a new code per attempt and each one invalidates the last,
   so one sign-in produces two or three emails and the first one the user opens is dead.
   `next: { internal: true }` opts out. **Do not remove it.**

2. **The anon key, not the service key** (`otpClient()`) — with the service key GoTrue treats
   the caller as privileged and its own per-user throttle stops applying.

3. **A new client per call, never a module singleton** — a warm serverless instance could
   otherwise carry one user's just-verified session into the next request. This is the
   deliberate opposite of the `globalThis` caching in `lib/supabase/admin.ts`.

4. **`email_confirm: true`** in `ensureAuthUser` — without it the user is unconfirmed and
   GoTrue sends the "Confirm signup" template instead of Magic Link, so the recipient gets a
   **link and never a code**. Login then fails silently for exactly the users just created.

### Supabase dashboard config (not in code — set by hand)

- Custom SMTP enabled, sender `noreply@impactbbdo.ae`.
- **Host is `mail.smtp2go.com`**, not `smtp.oneomnicom.com`. See the TLS fix below.
- Magic Link template emits `{{ .Token }}`, **not** `{{ .ConfirmationURL }}`.
- Email OTP length set to **6** (default was 8, which would have mismatched the UI copy).
- "Minimum interval per user" lowered from 60s to **10s**.

> ⚠️ The SMTP password was shared in plain text in a chat transcript. **It should be rotated.**
> It is deliberately not recorded in this file or anywhere in the repo.

### Rate limits, after a long debugging session

```
requestPerEmailHour: 10     requestPerEmailDay: 30      requestPerIpHour: 200
resendCooldownSec: 10       verifyFailPerEmail15Min: 8  verifyPerIpHour: 400
```

Fails **open** on DB error — a telemetry outage must not lock everyone out.
`hashIp = sha256(ip + AUTH_SECRET)`. `RETENTION_DAYS = 7`, `SWEEP_PROBABILITY = 0.02`.

The starting numbers were all wrong in the same direction — too tight:

- **25/hour per IP** would have locked out the **entire office**, which shares one corporate
  NAT address. → 200.
- **5/hour per email** locked people out of their own accounts. → 10/hour, 30/day.

### Login page branding
Final DOM order, arrived at over three rounds of user correction:
**Brief Creator → logo → Powered by → ImpactProximity → Sign in.**

### Unregistered addresses are now told so — anti-enumeration deliberately removed

An address with no access gets **403** and
*"Email not registered. Please contact your administrator for access."*, shown on the email
step. It no longer advances to the code screen. One message covers both unregistered and
deactivated accounts — the required action is the same, and it avoids distinguishing an
ex-employee from an address that never existed.

**This reversed a security property that was built on purpose.** The route used to return an
identical 200 for unknown, deactivated and successful requests, padded to a fixed 2s so even
the response time gave nothing away. The login page is now an email-enumeration oracle:
anyone can probe addresses and learn who has access.

The trade was raised with the user and accepted: every user is `firstname.lastname@omc.com`,
so the addresses are guessable without the login page at all, and confirming an address still
grants no way in. The UX cost was real — someone without an account was sent to the code
screen to wait for an email that would never arrive.

**Do not "restore" the generic response without checking this first.** The route's own
comment block documents the decision; it was rewritten rather than left asserting a rule that
no longer holds.

Side effects, both good: `RESPONSE_FLOOR_MS` / `holdUntilFloor` are gone (they existed only
to mask the timing difference), so **unregistered lookups dropped from ~2.0s to ~0.8s**. No
client change was needed — `app/login/page.tsx` already stayed on step 1 and rendered
`data.error` for any non-OK, non-429 response.

Still true: every attempt, including unknown addresses, is recorded in `otp_attempts` with a
hashed IP, so harvesting is auditable after the fact. Nothing blocks it in the moment beyond
the existing 200/hour per-IP cap. A dedicated cap on unknown-address attempts is ~15 lines in
`lib/auth/otpRateLimit.ts` if it ever matters — deliberately not built, at the user's request.

---

## Bugs found and fixed (worth not re-introducing)

| Symptom | Real cause |
|---|---|
| SMTP: `certificate is valid for *.smtp2go.com, not smtp.oneomnicom.com` | DNS CNAMEs to `mail.smtp2go.com`. Changed the host. **Not a password problem** — easy to misdiagnose. |
| Break-glass codes rejected | GoTrue's break-glass token is **8** chars; verify hard-validated `/^\d{6}$/`. → `/^\d{6,8}$/`. The code comment had literally warned "TEST THIS BEFORE YOU NEED IT". |
| Anti-enumeration defeated by timing | Registered ~1.9s vs unknown ~0.6s. Added `RESPONSE_FLOOR_MS = 2000` + `holdUntilFloor()` on all four exits. Both now 2.01s. |
| Anti-enumeration defeated by cooldown | Cooldown counted only **successful** sends, so registered got 429 and unknown got 200. Now counts all attempts. |
| "Code isn't valid" using the code just sent | A **consumed** code still held the cooldown, so after logout the user was told to reuse a spent code and blocked from a new one. Added a `lastConsumed` check. |
| Still blocked after that fix | Supabase's own 60s per-user interval. Lowered to 10s in the dashboard. |
| Magic Link email contained a link, not a code | Template used `{{ .ConfirmationURL }}`. |
| Supabase dashboard form silently reverted on reload | Programmatic form-setting didn't stick. Redone with real keyboard input. |
| `gh pr create` fails | It shells out to a broken `/usr/bin/git`. Fix: `export PATH="/Library/Developer/CommandLineTools/usr/bin:$PATH"`. |

**Verification lesson:** a 200 response proves nothing about anti-enumeration. What proved it
was the ledger row showing `success=True`, which demonstrates a mixed-case lookup actually
matched. Verify empirically, not by reasoning about the code.

---

---

## Completed and in production — usage & cost reporting (PR #13)
Answers "who is using the platform, how many briefs each person made, what it costs".
Migration **0005 is already applied to the production database** (purely additive, so the
live app was unaffected).

- `db/supabase/0005_usage.sql` — `is_admin` + `last_login_at` on `bbdo_users`, and the
  `usage_events` table.
- `lib/usage/rates.ts` — the editable price table. **`RATES_LAST_VERIFIED` is null**, so the
  admin page shows an "unverified estimates" banner until a human checks the numbers against
  Anthropic's and OpenAI's pricing pages. The figures in there were written from memory and
  are explicitly not authoritative.
- `lib/usage/record.ts` — `recordUsage()` returns **void, not a Promise**, so no caller can
  await it into their request path. Verified: with the recorder pointed at a non-existent
  table, a chat call still succeeded normally and wrote nothing.
- `lib/usage/report.ts` — cross-user aggregates. Kept **out of** `lib/briefs/store.ts` on
  purpose: that file's contract is "every function takes userId first and filters on it", and
  a reporting query is unscoped by definition.
- `app/agency/admin/page.tsx` — a **server** component (unlike the rest of `/agency`) so the
  admin check runs before anything renders. `components/agency/UsageReportView.tsx` is the UI.
- `scripts/db-admin.mjs` — `node --env-file=.env.local scripts/db-admin.mjs <email> true`.
  Run with no arguments to list current admins. **mohammad.sakib@omc.com is currently the
  only admin.**

**Why four token columns, not two** — proven empirically during testing. One chat call
recorded `input_tokens=10` but `cache_write_tokens=3279`. Summing only input+output would
have under-reported that call by **27x**, because `input_tokens` excludes cached tokens and
the corpus always lands in a cache column.

**Prompt caching confirmed working**: call 1 wrote the cache (3279 tokens, $0.0140); call 2
read it (3279 tokens, $0.0025) — 5.6x cheaper for the same corpus.

**What it deliberately cannot do:** cost per individual brief. Prefill — the most expensive
call — runs *before* the brief row exists (`briefId is null until the row exists`), so its
spend is attributed to user x client x tier instead. Reshaping that persistence flow to suit
telemetry was judged not worth it. `brief_id` is populated for question chat only.

**Transcription is counted but not costed** — whisper bills per minute and returns no
duration; capturing it would mean changing a working route's `response_format` purely for
telemetry.

---

## Bulk user import — 2026-10-07

Registered the 75 addresses from `~/Downloads/OMC email ID.xlsx`. **This was a production
data change, already applied** — it is not waiting on a deploy.

| | |
|---|---|
| In the file | 75 unique, all `@omc.com`, 0 malformed, 0 duplicates |
| Created | **54**, active |
| Skipped (already registered) | 21 |
| Result | **81 users · 79 active · 1 admin** |

`scripts/otp-import-xlsx.mjs` does this and is reusable:

```
node --env-file=.env.local scripts/otp-import-xlsx.mjs "<file.xlsx>" --dry-run
node --env-file=.env.local scripts/otp-import-xlsx.mjs "<file.xlsx>"
```

It auto-detects the email column (by counting valid addresses per column, so a header row can
never become a user), normalises and de-duplicates, and creates the GoTrue credential
**before** the `bbdo_users` row — same order as `otp-create-user.mjs`, so a GoTrue failure
leaves nothing behind rather than a user who looks fine in the database but can never receive
a code.

**It is INSERT-ONLY, and that is the entire safety model.** It skips any address that already
exists and never issues an update, so it is structurally incapable of changing someone's
`is_active` or `is_admin`. `setActive` and `setAdmin` are deliberately not imported. Changing
access stays a deliberate one-person-at-a-time act via `db-activate.mjs` / `db-admin.mjs`.

### Decisions taken (all additive — nobody lost access)

- **`muhammad.zaman@omc.com`** is in the file but was already deactivated. **Left deactivated** —
  a deliberate block should not be undone by a mailing list. Reverse with `db-activate.mjs` if
  that was wrong.
- **6 users are in the DB but not in the file** (`asgar.inamdar`, `sheldon.rodrigues`,
  `santoshkumar.suvarna`, `robert.nammour`, `akshay.shankar`, plus the already-inactive
  `m.ghaleb`). **Left untouched** — the import is additive, not a roster sync.
- **Admin is still `mohammad.sakib@omc.com` only.**

All three were asserted after the run, not assumed. `otp-sync-users.mjs --dry-run` reports
`to create: 0`, which is the check that actually matters: a `bbdo_users` row without a GoTrue
credential looks correct in the database and silently fails at login.

One pre-existing orphan: `m.ghaleb@omc.com` has a GoTrue credential but is inactive in
`bbdo_users`. Harmless — the request route checks `is_active` first, so they still cannot sign
in. Reported, never auto-deleted.

**No test sign-in emails were sent to colleagues.** Verification confirmed the two
preconditions the login route actually checks (active row + GoTrue credential) rather than
putting unexpected login codes in real people's inboxes.

---

## Header toolbar — 2026-10-07

"My briefs", "Usage" and "Log out" were invisible: they sat in an absolutely-positioned strip
**outside** the white card, on the `#d9d8d8` grey background, as transparent pills with a
`border-slate-300` outline. Moved into the white card header and restyled.

`components/agency/AgencyToolbar.tsx` is now the single source of truth. The pill class string
had been **copy-pasted 13 times across 7 files**, which is exactly why these drifted — import
`TOOLBAR_PILL` rather than adding a fourteenth copy.

### The first attempt was wrong, and the reason is worth keeping

Version one mirrored the existing Back button: `absolute right-3 top-3`, opposite the
`absolute left-3 top-3` every card header already had. It looked tidier and matched the
design language — but the card titles are **centred and grow with their content**, so a long
one ("Internal — Impact BBDO") slid straight underneath the pills. Not a mobile edge case:
it was visibly broken at full desktop width.

No amount of padding fixes that reliably, because title length is data, not layout. Replaced
with a real flex **row** — back button left, pills right, title below. It cannot collide at
any width or any title length. A mobile-only `pt-12` workaround added for the absolute
version was removed as moot.

Verified programmatically rather than by eye: a bounding-box intersection test between the
title and every pill returns zero overlaps on all three pages, with no horizontal overflow.

### Also fixed by moving the lookup into the shared component

The `isAdmin` fetch previously lived only in `app/agency/page.tsx`, so `/agency/briefs` and
`/agency/admin` had **no Usage link at all**. It now lives in `AgencyToolbar`, so the link
appears consistently everywhere. Pages omit their own link via `showBriefs` / `showUsage`.

Still presentational only — `requireAdmin()` remains the real gate. Re-verified after the
move: a non-admin sees only "My briefs" and "Log out", and `/agency/admin` still blocks them.

## Public Brief Generation API — PR #17, merged 2026-10-21

Machine-to-machine access so another platform (**Impact BBDO Pulse**, the Trend Application)
can generate briefs with an API key instead of a human session. Contract: `docs/API.md`.
Published integration guide for the consuming team:
https://claude.ai/code/artifact/f6508277-032f-438f-8aed-dad8232f9c50

### Shape — a second auth scheme that shares nothing but the generation core

- `proxy.ts` exempts `api/v1/` from the **session** gate only. The key is verified in-route in
  Node (`lib/api/auth.ts` `requireApiKey`), because the proxy runs on the edge with no database
  — the same division the admin role check already uses. The regex is anchored, so it can only
  ever exempt `/api/v1/*`.
- Keys are SHA-256 hashed. Plaintext is shown **once** at creation and never stored; a lost key
  is revoked and replaced, never recovered. `key_prefix` (first 12 chars) is deliberately
  loggable and **not** sufficient to authenticate.
- API briefs go to a **new `api_briefs` table, never `briefs`** — so no user's history in
  `/agency/briefs` is touched and the `store.ts` "every function takes `userId` first" invariant
  is untouched.
- `api_requests` is its own rate-limit ledger, separate from `otp_attempts`, so machine traffic
  cannot throttle real people out of signing in.
- `usage_events.api_key_id` (nullable, added by 0006) attributes API spend. `user_email` is
  filled with `api:<key name>` so the admin report shows the integration by name rather than
  lumping it into "unattributed".

### Endpoints

`POST /briefs` (synchronous, `maxDuration = 300`) · `GET /catalog` · `GET /clients` ·
`GET /brief-types/{tier}` · `GET /me`. All `runtime = 'nodejs'`.

### The only two changes to existing code — both verbatim extractions

Done so the human UI and the API cannot drift into producing different briefs from the same
inputs:

- `app/api/agency/prefill/route.ts` → prompt assembly and the model call moved to
  **`lib/briefs/generate.ts`**. Verified byte-identical: same model, `max_tokens`, the same three
  system blocks with identical `cache_control` placement, same operational-rules text, same tool
  schema, same `tool_choice`, same corpus template.
- `app/api/parse-document/route.ts` → the parser switch moved to
  **`lib/uploads/extract-text.ts`**. Same four parsers, same order.

If you change a prompt string in `generate.ts` you change it for **both** surfaces. That is the point.

### Migration 0006

`db/supabase/0006_api_access.sql` — three new tables (`api_keys`, `api_briefs`, `api_requests`),
each with RLS enabled and **zero policies**, plus the nullable `usage_events.api_key_id` and five
indexes. Applied to live 2026-10-21 and verified against `pg_class`.

### Verified end to end (2026-10-21)

Local dev against the live database, then production after merge:

- Read-only endpoints 200 with correct scopes; four auth rejections all 401; unknown tier 404.
- One real generation: 200 in 84s, 15 questions answered, $0.069.
- `"P&O"` resolved to `p-and-o` — first real exercise of `lib/clients/resolve.ts`.
- Idempotent replay: same `briefId`, 0.59s vs 84s, no second model call, quota not consumed.
- Isolation: brief landed in `api_briefs`; `briefs` unchanged at 14 rows.
- Session gating unchanged: human pages still 307 to `/login`, gated APIs 401, and **an API key
  does not unlock `/api/admin/usage`**.
- Revocation effective on the very next request.

### `answers` key order is NOT stable — commit `546ee08`

Found by actually running a replay. `api_briefs.answers` is `jsonb`, which does not preserve
object key order, so a **replayed** brief comes back with its questions re-sorted (`confidence`
and `missing` swap places too). Content is identical — `deepStrictEqual` passes — only order
differs.

`546ee08` therefore makes a replay return the same field set as a fresh response, including the
**`questions` array, which is the only authoritative record of sequence**. Consumers must iterate
`questions[]` and look up `answers[id]`, never walk `answers` directly. A renderer that gets this
wrong looks correct on first generation and scrambles on retry — the nastiest kind of bug to
diagnose. `model` comes back `null` on a replay because no model call was made.

---

## Running migrations without the Supabase SQL editor — new capability, 2026-10-21

Supabase project ref **`oqpcdkkofjkxzilhpxvc`**. `SUPABASE_ACCESS_TOKEN` now lives in
`.env.local` — a **scoped** personal access token: that one project only, `Database → Full
Access`, everything else `No Access`. Migrations can be applied directly:

```
POST https://api.supabase.com/v1/projects/oqpcdkkofjkxzilhpxvc/database/query
Authorization: Bearer $SUPABASE_ACCESS_TOKEN
{"query": "<sql>"}
```

`Read Access` is **not** enough — that endpoint is a write endpoint even for a `select`. Scoped
tokens cannot be edited after creation; changing scope means delete and recreate. The token still
permits **any** SQL on this database, including `drop table` — it is not a sandbox.

**What does not work, so do not retry it:** `psql` is not installed; `pg`/`postgres` are not in
`node_modules`; `DATABASE_URL` is the dead SQL Server string; the service-role key only reaches
PostgREST, which cannot do DDL; and the installed `supabase` CLI is logged into a different
account that cannot see this project.

**Verify schema with `pg_class`, never PostgREST.** `supabase-js`
`.select("*", {count:"exact", head:true})` returns `count: null` with a **null error** for a table
that does not exist — so it silently reports missing tables as present. This produced a false
"migration partially applied" diagnosis before `pg_class` showed the truth: nothing had been
applied at all.

---

## API keys and the Pulse consumer

### Ledger as of 2026-10-24

| Name | Prefix | State | Rate | Note |
|---|---|---|---|---|
| Local verification | `bbdo_sk_Ds0p` | revoked | 60/h | throwaway, used for first verification |
| Impact BBDO Pulse | `bbdo_sk_qIpZ` | revoked | 20/h | rotated out after local testing, 2026-10-22 |
| Impact BBDO Pulse | `bbdo_sk_MP98` | **active** | 20/h | all clients, all tiers. In use since 2026-10-22 |

Scope and rate are plain columns — both can be changed with SQL **without** reissuing the key.
Only the secret itself is unrecoverable. 20/hour was chosen as a spend cap, not a throttle: a
brief takes minutes to generate, so realistic throughput is far below it.

### The consumer lives in a different repo

`BBDO_Trend_Application/bbdo-trends-platform` — note the **nested** directory; running scripts
from `BBDO_Trend_Application/` itself fails with `MODULE_NOT_FOUND`.

- `scripts/set-brief-key.mjs` stores the key **pgcrypto-encrypted** in `scraper_credentials`
  under key `brief_api_key`, then proves it with a free `GET /me`. Prompts with terminal echo
  off; never accepts the key as an argument (shell history, process table).
- `apps/web/lib/briefApi.js` and `apps/web/lib/briefClientResolution.js` are the client side.
- **Gotcha:** that script **hardcodes** `EXPECTED_PREFIX` at line 50. Every rotation therefore
  needs that one line updated to the new prefix, or it refuses the new key. `EXPECTED_LENGTH = 51`
  never changes (8 chars of prefix + 43 of base64url).

---

## Gotchas found 2026-10-21 (local only — none affect production)

- **~13 untracked password-era files sit on disk**: `app/api/auth/{login,signup,change-password}`,
  `app/signup`, `app/change-password`, `lib/db.ts`, `db/schema.sql`, old `scripts/db-*.mjs`. Deleted
  from git when OTP replaced passwords, then restored locally by OneDrive. They break
  `npm run build` and `tsc --noEmit` **locally** while being invisible to Vercel, which builds from
  git. A local build failure in these files is not a real breakage — confirmed by building a clean
  `git worktree`, which produced no `/signup` or `/api/auth/login` routes.
- **`.next` corrupts under OneDrive sync.** Turbopack panicked in
  `turbo-persistence/src/static_sorted_file.rs` ("range start index … out of range") and the dev
  server died on startup. `rm -rf .next` fixed it instantly.
- **`node_modules` is effectively uncopyable out of OneDrive** — `rsync` managed ~2 MB in 7 minutes
  on a 608 MB tree. To build in a worktree, run `npm ci --prefer-offline` inside it (local disk,
  seconds). Reading `node_modules` in place is fine; only copying out stalls. Turbopack also rejects
  a symlinked `node_modules` pointing outside the project root.
- **Production returns `401` for `/api/*` paths that do not exist**, because `proxy.ts` answers
  before Next can 404. The two 401s are distinguishable: the proxy's is flat
  `{"error":"Unauthorized"}`, the API's is nested `{"error":{"code":"unauthorized",…}}`. Useful when
  checking whether a route is actually deployed.
- **Local `main` was 7 commits stale** at PR #10 while `origin/main` was at PR #16. Always
  `git fetch` and diff against `origin/main`, never local `main`.

---

## Open / next

### 1. ~~Commit + PR everything~~ — done
Shipped across PRs #13–#17. Working tree is clean of tracked changes as of 2026-10-24.

### 2. Verify the AI rates
`lib/usage/rates.ts` ships deliberately unverified. Until someone checks it and sets
`RATES_LAST_VERIFIED`, every cost figure on the admin page carries a warning banner.

### 3. Two test usage_events rows
The two `agency/chat` events in the table are from end-to-end verification, attributed to
mohammad.sakib. Real spend (~$0.017), but not real work — delete them if the report should
start clean.

### 4. Follow-ups, lower priority
- **Session revocation:** `verifySession` never hits the DB, so `is_active = false` takes up
  to 7 days to lock someone out. Note `is_admin` does *not* have this problem — `requireAdmin()`
  re-reads the row on every request.
- **Remove `DATABASE_URL` from `.env.local` and Vercel.** OTP is long deployed; the value
  still sitting there is the old SQL Server connection string **with its password in plaintext**,
  for a service that is no longer used. Confirmed stale 2026-10-21.
- Drop the SQL Server `bbdo_users` table — deliberately left intact as a rollback path.
  User's call.
- `otp_attempts` is swept at 7 days, so it cannot answer "who logged in last month".
  `last_login_at` on `bbdo_users` is now the durable alternative — but it only starts
  populating from the next sign-in, so the report currently shows "never" for everyone.
- Optionally add the "Brief Creator" line to signed-in pages.
- `Ramadan Brief 2025 - BBDO.docx` sits untracked in the repo root — a stray test file that
  should probably be removed or ignored, not committed.

### 5. Still unconfirmed by the user
That the login email arrives from `noreply@impactbbdo.ae`, contains a **6-digit code not a
link**, and that **exactly one** email arrives per request — the last of which is what
validates the `uninstrumentedFetch` guard.

### 6. Open from the public API work — raised 2026-10-21

- **`extractText` has had no runtime coverage.** The API verification sent a `prompt`, not
  documents (`api_briefs.corpus_len = 0`), so the upload path is verbatim-by-inspection only.
  Closing this is one action: sign in and upload a PDF **and** a DOCX on a brief. The larger
  refactor, `generateBriefAnswers`, *was* exercised end to end and produced a correct brief.
- **`docs/API.md` still says the rate limit default is 60.** The live Pulse key is 20/hour. It
  also does not yet state the `questions[]`-vs-`answers`-key-order rule, which consumers must
  follow — that is currently only in the published integration guide.
- **Two near-identically-titled integration artifacts exist.** The current one is
  *Pulse Integration Guide* (`f6508277…`, 2026-10-21). An older *Pulse Integration Contract*
  (`821540bb…`, 2026-10-15) documents **no rate limit at all** and lacks the key-order rule and
  the credential-handling guidance. Recommend retiring the older one — if Pulse integrates against
  it they will hit 429s with no explanation. Its embedded `bbdo_sk_xxxx…` is a placeholder, so
  there is no credential in it.
- **A share URL the user intended to send Pulse (`claude.ai/artifact/XR8JTH9s9Ks3bpe1sGsgFh`)
  could not be identified** — it matches none of the 33 artifacts owned by or shared with the
  account, and fetching it returned only the page shell. Unresolved; confirm before sending.
- **One test row sits in `api_briefs`** (P&O social brief, `external_id = pulse-test-001`) plus one
  `usage_events` row at $0.069 from the same verification. Real spend, not real work — delete if
  the API tables should start clean.
- **Artifacts are private until shared.** Sending an artifact link without using the page's share
  menu gets the recipient a permission error.

---

## Reference

**Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 · shadcn/ui
Route gating is `proxy.ts` (**not** `middleware.ts`). Session is a jose JWT cookie with
`SessionPayload { userId: number; email: string }`.

**Models:** `claude-sonnet-4-6` (agency prefill + chat, with prompt caching) ·
`gpt-4o` (Shamal chat) · `whisper-1` (transcription).
Prompt caching uses 3 of the 4 available breakpoints on both Anthropic routes.

**Users:** **82** rows in `bbdo_users` (as counted 2026-10-21). Ids are the
original SQL Server integers, carried over. User rows are **never deleted** — access is
revoked with `is_active = false` — so historical brief attribution stays intact permanently.

**Scripts** — all run as `node --env-file=.env.local scripts/<name>.mjs`:
`otp-create-user.mjs` · `db-activate.mjs` · `otp-sync-users.mjs` · `otp-breakglass.mjs` ·
`otp-import-xlsx.mjs`

**API-key scripts** (same invocation) — see the `manage-access` skill for traps:
`api-key-create.mjs --name "…" [--clients a,b] [--tiers big-idea] [--rate 20]` ·
`api-key-list.mjs [--all]` · `api-key-revoke.mjs (--id <uuid> | --prefix bbdo_sk_xxxx)`

**Rotating the Pulse key** is a four-step sequence, in this order so there is no window where
neither key works: mint the new key → verify it with `GET /me` on production → revoke the old
one by id → update `EXPECTED_PREFIX` in the consumer's `scripts/set-brief-key.mjs` and re-run it.
