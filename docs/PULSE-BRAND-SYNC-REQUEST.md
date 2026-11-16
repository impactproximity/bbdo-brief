# Request: brand-context read API for the BBDO Brief Creator

**From:** Brief Creator team
**To:** Pulse / Trends platform team (`bbdo-trends-platform`)
**Date:** 2026-11-05
**Status:** request for review — nothing built on either side

**The ask in one line:** three additive read endpoints and one environment variable, so that a
brand you onboard on Pulse can be onboarded into the Brief Creator by an admin clicking a button,
instead of a developer hand-writing a TypeScript file and deploying.

No writes. No webhooks. No sync job. No schema migration. No change to any existing endpoint.

---

## 1. Context

### What already works

Brief Creator (`bbdo.briefomnicom.com`, ~82 Impact BBDO staff) and Pulse are already integrated
in one direction. Pulse holds a `bbdo_sk_` API key and calls our `POST /api/v1/briefs` to turn a
trend Idea into a structured brief. That shipped on our side 2026-10-21, went live on yours
2026-10-22, and is working.

**Nothing in this request changes that leg.** No existing endpoint, response shape, scope or key
is affected.

### What does not work

There is no path in the other direction. A brand that Pulse has onboarded cannot become a
briefable client in Brief Creator without a developer.

---

## 2. Why we are asking

### 2.1 Onboarding a brand in Brief Creator is a code change

In Brief Creator a client brand is **compile-time TypeScript**. Onboarding one means:

1. Writing `lib/clients/<id>.ts` — a config object carrying `proposition`, `brandGuidelines` and
   `promptGuidance` as hand-authored prose. Our P&O Ferries file is ~11 KB; McVitie's is 153
   lines.
2. Registering it in a hand-maintained record in `lib/clients/index.ts`.
3. Adding a logo asset, and picking an icon from thirteen allowed keys and an accent colour from
   eight.
4. Committing and merging to `main` — which auto-deploys to ~82 live users.

You, meanwhile, already store this material properly: a `Brand` row plus a versioned,
append-only `BrandGuideline` carrying `content` (~2–4 KB of Markdown covering positioning,
pillars, personality, guardrails), `voiceNotes[]`, `avoidTopics[]` and `systemPromptOverride`.
You onboard brands through an admin UI, with no deploy.

### 2.2 So the same brand is maintained twice, and the copies drift

Two independent brand-context stores exist for the same brands. Yours feeds idea generation; ours
feeds brief pre-fill. Nothing moves between them. An update to a brand's positioning on Pulse
never reaches a brief.

### 2.3 And that drift is visible to your users as a missing button

Pulse decides whether to show its "Create Brief" action purely from our `GET /catalog`. A brand
absent from that list gets **no button**. Your own integration doc calls this *"correct
behaviour, not a bug, and the single most common 'why is it broken' question."*

Your roster is roughly 10 live brands against our 7 clients. Your own
`apps/web/lib/briefClientResolution.js:11` records that about five of your brands *"become
available the moment their side onboards them"*. Brands named across your code and docs that are
in that state include **Etihad Airways, Lay's, Nike, Bahrain EDB, Skydive Dubai, Jotun** and
**Botim**.

Every one of those is a user who opened a brand and found the feature quietly missing.

### 2.4 What we will build once these endpoints exist

An admin page in Brief Creator that lists every brand live on Pulse, shows which are not yet
onboarded with us, and onboards one on a button click — pulling that brand's guidelines and
instructions from you and making them the brand context injected into every brief for that
client.

**Deliberately manual and admin-triggered.** We are not asking you to push to us, and we are not
polling you on a schedule. An admin decides when a brand is ready, and decides again when
guidelines have changed and should be re-pulled.

---

## 3. What we need

### 3.1 `GET /api/partner/brands`

Every brand where `deleted_at IS NULL AND disabled_at IS NULL`. No guideline text — this is a
list view and must stay small.

```jsonc
{
  "brands": [{
    "id": "uuid",
    "name": "Etihad Airways",
    "clientName": "BBDO",                 // Client.name, the parent
    "briefClientId": null,                // Brand.brief_client_id, if set
    "homeIndustryLabel": "Aviation",
    "industries": ["Travel"],             // via BrandIndustry
    "regions": ["AE", "SA"],
    "hasLogo": true,
    "guidelineVersion": 3,                // MAX(version); null when the brand has none
    "guidelineCreatedAt": "2026-10-02T09:12:33Z"
  }]
}
```

**`guidelineVersion` is the field that makes this work.** Because `brand_guidelines` is
append-only and the current row is `MAX(version)`, we can detect "guidelines have changed since
we last pulled this brand" with an integer comparison, and show the admin a Refresh badge.
Nothing else gives us that cheaply, and without it we would be re-pulling blind.

### 3.2 `GET /api/partner/brands/{brandId}/context`

The composed bundle for one brand. One call rather than six, so you own the composition and we
don't fan out across your API.

```jsonc
{
  "brand": {
    "id": "uuid", "name": "Etihad Airways", "clientName": "BBDO",
    "briefClientId": null, "homeIndustryLabel": "Aviation",
    "industries": ["Travel"], "regions": ["AE", "SA"],
    "excludedTrendTerms": ["etihad guest"], "excludeOwnName": true
  },
  "guideline": {                          // null when the brand has no guideline row yet
    "version": 3,
    "content": "# Etihad — MENA brand brief\n## Strategic positioning\n…",
    "voiceNotes": ["Voice persona: …"],   // may be null — we handle that
    "avoidTopics": ["politics", "alcohol"],
    "systemPromptOverride": null,
    "createdAt": "2026-10-02T09:12:33Z"
  },
  "competitors": [{ "name": "Emirates", "notes": "Premium, Dubai-anchored…" }],
  "conversationThemes": [{ "label": "Service", "keywords": ["crew", "lounge"] }],
  "opportunityThemes": [{ "key": "wellness_functional", "name": "…", "description": "…" }],
  "recentIdeas": [{                       // approved only, most recent ~10
    "title": "…", "trendSummary": "…", "whyRelevant": "…", "opportunity": "…",
    "scale": "social_play", "region": "AE",
    "campaignType": "…", "targetAudience": "…"
  }]
}
```

#### Why we are asking for more than the guideline

You hold materially more per-brand context than `brand_guidelines`, and a brief is a better brief
for having it:

| Source | What it adds to a brief |
|---|---|
| `competitors` (incl. free-text `notes`) | Competitive framing. **Brief Creator has no competitor data at all today** |
| `brand_conversation_themes` | What audiences actually talk about for this brand |
| `opportunity_themes` (brand-scoped rows) | Strategic territories, derived from that brand's own approved ideas |
| `ideas.targetAudience` | The nearest thing to a persona field anywhere in either system |
| `regions`, industries, `excludedTrendTerms` | Market context, and terms never to cite |

**Priority if this needs trimming.** `guideline` is essential. `competitors` and
`conversationThemes` are high value and cheap. `opportunityThemes` and `recentIdeas` are
nice-to-have — ship without them if they complicate the query.

Every section is optional in our consumer: a missing or empty section is simply omitted from the
prompt we build. So a partial implementation is immediately useful rather than blocked, and you
can add sections later without us changing anything.

### 3.3 `GET /api/partner/brands/{brandId}/logo`

The logo bytes, with a correct `Content-Type`. `404` when `logo_blob_path` is null.
`fetchBrandLogo()` from `apps/web/lib/blobStorage.js` is presumably the whole implementation.

**Why we can't reuse `/api/brand-logo/[brandId]`:** it is cookie-session gated. That is right for
an `<img src>` tag, but it returns `401` to a server-to-server caller sending a bearer token.

**Why bytes and not a URL:** two reasons. It keeps us inside your "blob paths, never URLs" and
no-signed-URLs conventions — we are not asking you to make the `brand-assets` container public or
to mint SAS tokens. And we need a buffer regardless, because the logo is embedded into a `.docx`
header via `ImageRun`.

### 3.4 One credential

A `PARTNER_API_TOKEN` environment variable, checked alongside `TRENDS_API_TOKEN` on these three
routes only.

**Please don't simply give us `TRENDS_API_TOKEN`.** That is the token your own `/api/internal/*`
proxies use to reach your public routes in-process. If Brief Creator holds the same value, then
revoking our access breaks every Pulse dashboard panel. A second accepted value makes the two
independently revocable, at the cost of one line.

If you would rather store it as a `scraper_credentials` row than an environment variable, that
works for us too — it is your established pattern and gives you `last_validated_at` visibility.
It would need an `ALLOWED_KEYS` entry.

---

## 4. Conventions we have assumed — please correct us

We read your repo so this lands as a small, in-convention change rather than something you have
to reshape:

- Routes at `apps/web/app/api/partner/.../route.js`, named handler exports, dynamic segment
  `[brandId]`
- `export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';` — matching your most
  recently written read routes
- The `isAuthorized(request)` bearer check, failing closed when the env var is unset
- Flat `{ "error": "Unauthorized" }` envelope; `401` / `404` / `500`; bare named-key success
  objects with no wrapper
- `withDbFallback` for reads; `withApiErrorLogging` plus a `const ROUTE` for error capture
- `middleware.js`'s matcher does not cover top-level `/api/*`, so these need no middleware change
- Both `deleted_at` **and** `disabled_at` filtered, always — per your "Category 1" rule
- `voice_notes` / `avoid_topics` read as `?? []`, since they are nullable `TEXT[]` with no default
- `scripts/api-snapshot.mjs` run before and after, to prove no existing response changed

**One suggestion:** `isAuthorized` is currently copy-pasted into all 17 of your public routes.
Rather than making copies 18, 19 and 20, it may be worth extracting it to `lib/partnerAuth.js`
for these three. Your call — we are not asking for a refactor of the existing 17.

---

## 5. Two decisions that are yours

### 5.1 Is a second shared token acceptable, or do you want real keyed auth?

Pulse has no per-client API key mechanism today — no key table, no hashing, no scopes, no
per-caller rate limiting. A second shared token is a one-line change.

Proper keyed inbound auth would be the first on your platform, and your own working agreements
class that as *"propose the schema/design mapping first and wait for approval"* — so we are not
assuming it. A shared token is sufficient for our use: one consumer, read-only, revocable.

If you do want keyed auth, say so and we will treat it as its own piece of work rather than
smuggling it in here.

### 5.2 This contradicts a documented decision of yours, and we would rather you resolve it than work around it

`apps/web/app/api/internal/my-brands/route.js:17-19` says:

> No external/bearer-token counterpart like `/api/trends` has — "brands THIS session's user can
> see" is meaningless without a session, so there's nothing for an external service-to-service
> caller to call here.

We think `GET /api/partner/brands` asks a genuinely different question — *"which brands are live
on this platform"*, not *"which brands can this user see"* — so that reasoning does not carry
over. But if you agree, the comment should be amended in the same change so it does not read as
a contradiction to the next person.

If you disagree, tell us and we will find another shape.

---

## 6. What this request does **not** ask for

Stated explicitly, because scope creep in a cross-platform integration is expensive for both
sides:

- No write endpoints
- No webhooks, push, or callbacks from you to us
- No sync job, cron, or scheduled task
- No schema migration, and no new table or column
- No change to `brand_guidelines`' append-only behaviour
- No change to any existing endpoint, response shape, or auth path
- No change to the existing `POST /api/v1/briefs` integration

Three additive read routes and one environment variable.

---

## 7. One thing we would like later, not now

`brand_guidelines` has no field corresponding to our `proposition` — a short, standalone
positioning line that we inject into the model prompt as its own labelled block.

Positioning does exist in your data, but inside `content` as Markdown (`## Strategic
positioning`). **We will not parse it out.** `content` is unvalidated free text with no enforced
structure, so a brand authored without that exact heading would silently produce an empty block —
a failure mode that looks like working software.

So for now our `proposition` field stays locally authored, and a pull from Pulse will never
overwrite it. That is a deliberate, documented carve-out on our side; nothing is needed from you.

A `proposition` column on `BrandGuideline` would close it cleanly. Worth considering the next time
you touch the guidelines editor — not worth a migration on its own.

---

## 8. Verification we would expect

Framed against your own *"never call a feature done without explicit live verification"*
agreement:

| Check | Expected |
|---|---|
| No `Authorization` header | `401` |
| `TRENDS_API_TOKEN` only, once the second token exists | `401` |
| A disabled brand (`disabled_at` set) | absent from the list |
| An archived brand (`deleted_at` set) | absent from the list |
| A brand with no guideline row | `"guideline": null`, not an error. Your idea generation raises `MissingGuidelinesError` for these, so they genuinely exist |
| A brand with several guideline versions | `guidelineVersion` equals `MAX(version)` |
| `scripts/api-snapshot.mjs` diff against baseline | clean — no existing response changed |
| Logo route, brand with a logo | real bytes, correct `Content-Type` |
| Logo route, brand without a logo | `404` |

---

## 9. Sequencing

Your endpoints need to be live before our admin page ships, or our page simply renders its
"not configured" state. There is no hard coupling beyond that, and nothing here is breaking — so
this can land on your normal release cadence rather than needing a coordinated deploy.

One note from your own decision log, for whoever picks this up: your migrations are applied by
hand (`prisma migrate deploy` against `DIRECT_DATABASE_URL`), and prod has silently drifted
behind the checkout before. This request needs no migration, which is partly why it is shaped
this way — but it is worth a `prisma migrate status` before assuming the live schema matches.

---

## 10. Questions back to us

Happy to adjust any of the above — the JSON shapes especially are a proposal, not a requirement.
If a different shape is cheaper for you to produce, we will consume whatever you emit.

The only genuinely load-bearing items are:

1. `guidelineVersion` in the list response (otherwise we cannot detect staleness)
2. Logo bytes reachable with a bearer token (otherwise synced brands have no logo, in the app or
   in the `.docx`)
3. A token that is not `TRENDS_API_TOKEN`

Everything else we can work around.
