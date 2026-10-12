---
name: add-client
description: Add a new agency client to the Brief Creator, or update an existing client's brand context. Use when onboarding a brand, when the user supplies brand guidelines, a brand toolkit, a proposition or a prompt document for a client, or when asked why a client card looks wrong (missing icon, wrong accent colour, missing logo).
---

# Add a client

A client is one `ClientConfig` object wired into four places. Miss any of them and the
failure is quiet rather than loud — the app keeps building and the card keeps rendering, just
wrongly. This has been done seven times (Starbucks, Sadia, Internal, Social, P&O, Google
Gemini, McVitie's); the steps below are the contract.

## Before you start — ask, don't assume

**Which brief types should this client get?** Omitting `briefTypes` gives them the four
standard tiers (Big Idea, Task, Social, Production), which is right for most clients.

Do not infer a custom set from a passing remark. On the P&O round the user said "for social
we choose a different format", which sounded like a custom set — but when shown the two
actual formats side by side they chose the standard four tiers. Show the options, then ask.

You also need the brand material: proposition, brand guidelines, and any per-client prompt
document. Without them you can still create a working stub (see "Stub clients" below).

## The six steps

### 1. `lib/clients/<id>.ts`

Export a `ClientConfig` (shape in `lib/clients/types.ts`). Use `lib/clients/p-and-o.ts` as
the fullest worked example — it has all three content fields authored from real brand docs.

The `id` is url-safe and appears in `?client=<id>`, so keep it lowercase and hyphenated.

Three content fields carry the brand into the AI:

| Field | What goes in it |
|---|---|
| `proposition` | Strategic positioning, masterbrand line, key markets |
| `brandGuidelines` | Tension/insight/truth, pillars, tone of voice, do's and don'ts |
| `promptGuidance` | The per-client prompt doc, applied across all brief categories |

These are injected into the prefill and chat system prompts by `buildClientContextBlock`
(`lib/clients/index.ts`) and are **prompt-cached**, so they can be long — P&O's file is
around 11 KB. Write them as prose the model can act on, not bullet fragments.

### 2. Register it in `lib/clients/index.ts`

Two edits, both required:

```ts
import { acmeConfig } from './acme';          // 1. the import
const clients: Record<string, ClientConfig> = {
  // ...
  acme: acmeConfig,                            // 2. the registry entry
};
```

This is the step people forget. `CLIENTS` is derived from this record, so without it the
client simply does not exist — no card, no error.

### 3. Logo — wire it only once the file is actually on disk

Put it at `public/clients/<id>.png` and set:

```ts
logo: 'clients/acme.png',   // path is relative to public/
logoWidth: 38,
logoHeight: 35,
```

Used in the DOCX header via `ImageRun`. Set the dimensions to the real aspect ratio or the
logo will look squashed in the generated document.

**It must be a `.png` or `.jpg`.** `app/api/generate-document/route.ts` labels every non-jpg
as png, so a `.webp` renamed to `.png` **corrupts the DOCX header**.

**All three are optional.** Omit them and the DOCX header falls back to a text run of the
client name — `social-impact-bbdo` does exactly this and has no file in `public/clients/`.

**THE TRAP: the two consumers do not fail the same way.** The DOCX header reads the file
inside a try/catch and falls back to a text run, so a missing file is harmless there. The
dashboard card does **not** — `app/agency/page.tsx` renders

```tsx
{c.logo ? (<Image src={`/${c.logo}`} … />) : (iconMap[c.icon] || iconMap.Building2)}
```

so a `logo` pointing at a file that is not there yet is truthy, the lucide icon is never
reached, and `/agency` ships a **broken image** to every user. The icon is a fallback for
"no logo configured", not for "logo configured but missing".

So when the brand material arrives before the artwork does, **comment the three fields out**
rather than wiring them ahead of the file, and leave the filename and format requirements in
the comment so enabling them later is a one-line change. `lib/clients/mcvities.ts` and
`lib/clients/google-gemini.ts` both do exactly this. Commented out, the card shows the icon
and the DOCX header shows the label — both correct.

### 4. `icon` — a silent trap

Must be one of these thirteen keys, which are the lucide icons imported in
`app/agency/page.tsx`:

```
Lightbulb  Zap  Share2  Clapperboard  Coffee  Beef
Building2  Repeat  Megaphone  Radio  Ship
Sparkles   Cookie
```

The lookup is `iconMap[c.icon] || iconMap.Building2`. **Any name not on this list silently
renders a generic building icon.** No error, no blank space — just the wrong icon, which is
easy to miss in review.

Need something not on the list? Import it in `app/agency/page.tsx` and add it to `iconMap`
first.

### 5. `color` — the other silent trap

Must be one of eight keys in `accentMap` (`app/agency/page.tsx`):

```
purple  orange  pink  teal  yellow  red  blue  navy
```

The lookup is `accentMap[c.color] || accentMap.purple`, so **an unknown colour silently
becomes purple.** This drives the card's top bar gradient, hover glow and hover text colour.

Pick something not already used by a neighbouring card if you can — the colour is the main
way people tell the cards apart at a glance. All eight are now taken once, so a new client
usually means adding a key. Add it to `accentMap` **and** to `colorMap` directly above it,
which uses the same key names for the brief-tier cards.

Values are Tailwind utility strings, so a new accent must use real Tailwind palette names
(`from-blue-700 to-blue-900`) — they are scanned out of this file at build time. Invented
colour names produce no CSS and the bar renders empty.

### 6. `briefTypes` — only if genuinely different

```ts
briefTypes: ['social-btim-standard', 'social-btim-lite'],   // custom
// or omit entirely for the four standard tiers
```

It is deliberately typed `string[]` rather than the tier-id union, because importing that
union from `lib/questions/agency` would invert the dependency between the two modules. Don't
"fix" that.

See `lib/clients/social-impact-bbdo.ts` for the only client that currently overrides it.

## Stub clients are safe

Every content field left as an empty string is omitted from the injected context, and
`buildClientContextBlock` returns `null` when all three are empty. A client config with no
authored content therefore changes AI behaviour by **exactly nothing** — so it is safe to
commit a stub and fill in the brand material later.

## Authoring content from incomplete brand material

Brand packs are usually missing something, and the supplied documents are sometimes not what
their filenames claim — on the Gemini round the "Gemini Information" document turned out to be
a byte-identical copy of the Spark document, so there was no brand or tone-of-voice material
at all. Check for duplicates (`md5`) before trusting a set of files.

Two patterns handle this, and both are proven to work:

**State the gaps inside `brandGuidelines` as an instruction.** A `DOCUMENTED GAPS — DO NOT
INVENT AROUND THEM` block naming exactly what was not supplied, and telling the model to say
so and ask rather than fabricate. This works: asked for tone on a Gemini brief, the model
elevated the client's own words and flagged "none was supplied and it is a material gap"
instead of inventing Google brand voice. An honest gap is useful; a plausible invention
presented as brand policy is not.

**Fence off reference campaigns as register only.** Follow `lib/clients/starbucks.ts` —
include the platform language under `CAMPAIGN REFERENCE (register only — DO NOT copy
verbatim)` with an explicit instruction not to reproduce it. Without the fence the model
recycles the client's existing endline instead of generating new thinking.

Also record any factual conflict between documents rather than silently picking one. The
McVitie's deck dates the brand to 1830 while the guidelines booklet makes "Established in
1839" a Distinctive Brand Asset; the config names both, picks the sanctioned one, and forbids
asserting a founding year as a campaign claim.

## Verify

1. `npx tsc --noEmit` and `npm run build` clean.
2. The card appears on `/agency` with the **right icon** and the **right accent colour** —
   check both explicitly, since both fail silently rather than erroring.
3. Selecting the client shows the expected brief tiers.
4. Run one brief end to end and confirm the generated DOCX header shows the logo (or the name
   fallback if no logo was supplied).
5. If brand content was authored, confirm it is reaching the model: a prefill answer should
   reflect the client's proposition and tone, not generic copy.

### Checking the two silent traps without logging in

`/agency` is behind the session gate, so there is often no quick way to eyeball the card.
Both silent failures can be checked mechanically against the build output instead, which is
more reliable than eyeballing anyway:

```sh
npm run build
H=.next/server/app/agency.html
grep -o 'lucide-[a-z0-9-]*' $H | sort -u      # expect your icon; lucide-building-2 means the icon key is wrong
grep -c 'from-blue-700 to-blue-900' $H         # your accent gradient must appear in the markup
grep -o 'url=%2Fclients%2F[a-z-]*\.png' $H    # every logo listed here MUST exist in public/clients/
```

`/agency` is prerendered at build time, so the registry is fully evaluated and every card's
real classes land in the HTML. The third command is the broken-image check from step 3.

### Running a brief end to end locally

The login is email OTP, and `recordUsage` writes to the **live** database. Both are avoidable:

- **Blank the Supabase vars** when starting the dev server. `recordUsage` returns early when
  `isSupabaseConfigured()` is false — by design, so a brief can run end to end without a
  database — so nothing is written and no usage is attributed to the wrong person:
  `SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= DATABASE_URL= npx next dev -p 3100`
- **Mint a session cookie** instead of waiting for an OTP. `proxy.ts` only verifies the JWT
  signature, so an HS256 token signed with `AUTH_SECRET` carrying `{ userId, email }` is
  accepted. Then `POST /api/agency/prefill` with `{ briefType, clientId, corpus }`.
- Give the corpus **no brand language at all**. Any brand fidelity in the answers then has to
  have come from the injected client context, which is the thing actually being tested.
- Confirm afterwards that `usage_events` and `briefs` row counts are unchanged.

Note that running `npm run build` and `next dev` against the same `.next` corrupts the
Turbopack dev cache (`Failed to lookup task id`). `rm -rf .next/dev .next/cache` fixes it.
