# BBDO Brief Creator

AI-assisted creative brief tool. Live at `bbdo.briefomnicom.com` for ~79 Impact BBDO staff.

Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Supabase Postgres.

## Invariants

These are always true. Violating one breaks something that is not obvious from the diff.

**Route gating is `proxy.ts`, not `middleware.ts`.** It runs on the edge and imports only
`lib/session` — it has no database access, so it can answer "signed in or not" and nothing
more. Role checks happen in-route.

**One database.** Supabase Postgres holds users, briefs, the rate-limit ledger and usage
events. The old SQL Server dependency was removed; there is no second store.

**Every table has RLS enabled with no policies.** A deliberate backstop: it means a leaked
anon key reaches nothing. All access goes through the service-role key from our own routes,
so scoping is enforced in app code, not by the database.

**`lib/briefs/store.ts` — every exported function takes `userId` first and filters on it.**
Never add one that looks a brief up by id alone. Cross-user queries are unscoped by
definition and belong in `lib/usage/report.ts`, behind `requireAdmin()`.

**Supabase Auth (GoTrue) is the OTP engine, not the identity.** `bbdo_users` is the identity
that `session.userId` and `briefs.user_id` refer to. The two records are joined only on
lowercased email. Do not migrate to GoTrue ids — it would mean uuid ids and signing out every
user.

**`is_active` is the complete definition of "may sign in."** There is no password.
`is_admin` is separate and controls the usage report and the Pulse brand-sync dashboard.

**A client brand comes from one of two registries, and server code must read both.** The
compile-time configs in `lib/clients/<id>.ts` are no longer the whole truth: brands onboarded
from Pulse are rows in `pulse_clients`. `lib/clients/registry.ts` is the only correct source —
`getAllClientConfigs()` / `resolveClientConfig()` / `resolveClientByName()`, all async. The
synchronous `CLIENTS` and `getClientConfig()` still exist and still see only the seven
compile-time clients, so reaching for them in a route silently excludes every synced brand —
which looks like "that brand isn't onboarded" rather than like a bug.

**Brand prose must not reach the browser.** `proposition`, `brandGuidelines` and
`promptGuidance` are client-confidential strategy. Pages get card fields from
`GET /api/clients` (see `lib/clients/card.ts`); importing `@/lib/clients` into a `'use client'`
file puts every brand's full strategy into a public JS chunk — measured, not theoretical: it
did exactly that until 2026-11-09.

**Migrations run before the code that needs them.** `db/supabase/` is numbered and applied by
hand in the Supabase SQL editor. Prefer additive changes (`add column if not exists`).

**Pulse brand sync needs `PULSE_API_BASE_URL` + `PULSE_PARTNER_TOKEN`, and never
`TRENDS_API_TOKEN`.** Pulse rejects that second value on `/api/partner/*` by design, so the two
sides revoke independently. Unset either of ours and the dashboard renders its
"not configured" state rather than failing.

**`lib/usage/rates.ts` prices are unverified.** `RATES_LAST_VERIFIED` is null, so the admin
page warns on every cost figure. Token counts are measured and accurate; dollars are derived
from a hand-maintained table that nobody has checked yet.

## Shipping

**Merging to `main` auto-deploys to production** via the Vercel GitHub integration. A merge
*is* a deploy to ~79 live users.

Ask before pushing, opening a PR, or deploying. Building, running the dev server, local
commits and database migrations are fine as normal work — it is the outward-facing steps that
need a check.

`gh` shells out to a broken `/usr/bin/git`. If `gh pr create` fails:
`export PATH="/Library/Developer/CommandLineTools/usr/bin:$PATH"`.

## Scripts

All run from the project root as `node --env-file=.env.local scripts/<name>.mjs`. They talk
to the **live** database — there is no separate dev instance.

See the `manage-access` skill for what each one does and the traps.

## Skills

- **`add-client`** — onboarding a brand by hand, or fixing a client card that renders wrongly.
  Note there are now two ways to onboard: that one, and `/agency/admin/pulse` for a brand that
  already exists on Pulse.
- **`manage-access`** — users, admin rights, bulk import, "I can't log in"
