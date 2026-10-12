---
name: manage-access
description: Add, remove or inspect who can sign in to the Brief Creator, grant or revoke admin access to the usage report, bulk-import users from a spreadsheet, or diagnose why someone cannot log in or is not receiving their sign-in code.
---

# Manage access

Login is email-OTP: there is no password. Everything below runs from the project root as

```
node --env-file=.env.local scripts/<name>.mjs
```

and talks to the live Supabase database. There is no separate dev database — **a change here
affects production immediately.**

## Commands

Note the inconsistency: `db-activate` and `db-admin` take **positional** arguments, while
`otp-create-user` and `otp-breakglass` take `--email`. Copy the exact forms below.

| Task | Command |
|---|---|
| Add one person | `otp-create-user.mjs --email jane@omc.com` (add `--inactive` to create without access) |
| Grant / revoke sign-in | `db-activate.mjs jane@omc.com true` · `... false` |
| Grant / revoke the usage report | `db-admin.mjs jane@omc.com true` · `... false` |
| List current admins | `db-admin.mjs` with no arguments |
| Bulk import from a spreadsheet | `otp-import-xlsx.mjs "file.xlsx" --dry-run` then without the flag |
| **Check everyone can receive a code** | `otp-sync-users.mjs --dry-run` |
| SMTP is down, someone must get in | `otp-breakglass.mjs --email jane@omc.com` |

## Four things that have already caused real failures

### `is_active` is the complete definition of "may sign in"

There is no password and no second gate. If it is true they can sign in; if false they
cannot. `is_admin` is unrelated — it controls only whether `/agency/admin` and
`/api/admin/usage` answer, and granting it to an inactive user does nothing.

### A user row without a GoTrue credential fails silently

This is the one that looks fine and isn't. The sign-in route calls
`signInWithOtp({ shouldCreateUser: false })`, so an address with no Supabase Auth credential
gets **no code and no error**. The `bbdo_users` row looks perfectly correct in the database.

After any bulk change, prove it:

```
node --env-file=.env.local scripts/otp-sync-users.mjs --dry-run
```

`to create: 0` is the proof. Anything else means those people cannot log in. Re-run without
`--dry-run` to fix.

It also reports *orphans* — GoTrue credentials with no active `bbdo_users` row. These are
harmless (the route checks `is_active` first) and are never auto-deleted, because removing a
credential is not a decision a sync script should make alone.

### The spreadsheet importer is insert-only, by design

`otp-import-xlsx.mjs` skips any address that already exists and never issues an update. It
is structurally incapable of changing someone's `is_active` or `is_admin` — `setActive` and
`setAdmin` are deliberately not imported into it.

That means a bulk import can never quietly revoke an admin, reactivate someone who was
deliberately blocked, or deactivate a person who is simply missing from the latest
spreadsheet. **Access changes go through the one-person scripts, always.**

It auto-detects the email column by counting valid addresses per column, so a header row
cannot become a user. Always `--dry-run` first and check the counts.

### Revoking access is not instant

`verifySession` never touches the database, so an existing session cookie keeps working until
it expires — **up to 7 days** after you set `is_active = false`.

`is_admin` does *not* have this problem: `requireAdmin()` re-reads the row on every request,
so admin changes take effect immediately.

If you need someone out *now*, rotating `AUTH_SECRET` invalidates every session — but that
signs out all 79 users, so treat it as a genuine emergency measure.

## "I'm not getting a code"

Work down this list:

1. **Are they registered and active?** `db-admin.mjs` with no args lists admins; for a
   general check, query `bbdo_users`. An unregistered address now gets an explicit
   "Email not registered" message on the login screen rather than being sent to the code step.
2. **Do they have a GoTrue credential?** `otp-sync-users.mjs --dry-run`. This is the most
   common cause after a bulk add.
3. **Rate limited?** 10 requests per email per hour, 30 per day, 200 per IP per hour, and a
   10-second resend cooldown. The whole office shares one NAT address, so the per-IP cap is
   the one to suspect during a busy morning.
4. **Did they get a link instead of a code?** The Supabase Magic Link template must emit
   `{{ .Token }}`, not `{{ .ConfirmationURL }}`.
5. **Still stuck?** `otp-breakglass.mjs --email <addr>` prints a working code without sending
   email. **The token is 8 characters**, not 6 — have them use the "I already have a code"
   link on the login page to enter it.

## Checks worth running after any change

- `otp-sync-users.mjs --dry-run` → `to create: 0`
- Counts are what you expect: total users, active users, and **exactly one admin** unless you
  intended otherwise
- Anyone you deliberately left inactive is still inactive

**Never send a test sign-in code to a colleague's address to "check it works."** That puts an
unexpected login code in a real person's inbox. Verifying the two preconditions — an active
`bbdo_users` row and a GoTrue credential — proves the same thing without it.
