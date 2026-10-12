---
name: add-client
description: Add a new agency client to the Brief Creator, or update an existing client's brand context. Use when onboarding a brand, when the user supplies brand guidelines, a brand toolkit, a proposition or a prompt document for a client, or when asked why a client card looks wrong (missing icon, wrong accent colour, missing logo).
---

# Add a client

A client is one `ClientConfig` object wired into four places. Miss any of them and the
failure is quiet rather than loud — the app keeps building and the card keeps rendering, just
wrongly. This has been done five times (Starbucks, Sadia, Internal, Social, P&O); the steps
below are the contract.

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

### 3. Logo

Put it at `public/clients/<id>.png` and set:

```ts
logo: 'clients/acme.png',   // path is relative to public/
logoWidth: 38,
logoHeight: 35,
```

Used in the DOCX header via `ImageRun`. Set the dimensions to the real aspect ratio or the
logo will look squashed in the generated document.

**All three are optional.** Omit them and the DOCX header falls back to a text run of the
client name — `social-impact-bbdo` does exactly this and has no file in `public/clients/`.

### 4. `icon` — a silent trap

Must be one of these eleven keys, which are the lucide icons imported in
`app/agency/page.tsx`:

```
Lightbulb  Zap  Share2  Clapperboard  Coffee  Beef
Building2  Repeat  Megaphone  Radio  Ship
```

The lookup is `iconMap[c.icon] || iconMap.Building2`. **Any name not on this list silently
renders a generic building icon.** No error, no blank space — just the wrong icon, which is
easy to miss in review.

Need something not on the list? Import it in `app/agency/page.tsx` and add it to `iconMap`
first.

### 5. `color` — the other silent trap

Must be one of six keys in `accentMap` (`app/agency/page.tsx`):

```
purple  orange  pink  teal  yellow  red
```

The lookup is `accentMap[c.color] || accentMap.purple`, so **an unknown colour silently
becomes purple.** This drives the card's top bar gradient, hover glow and hover text colour.

Pick something not already used by a neighbouring card if you can — the colour is the main
way people tell the cards apart at a glance.

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

## Verify

1. `npx tsc --noEmit` and `npm run build` clean.
2. The card appears on `/agency` with the **right icon** and the **right accent colour** —
   check both explicitly, since both fail silently rather than erroring.
3. Selecting the client shows the expected brief tiers.
4. Run one brief end to end and confirm the generated DOCX header shows the logo (or the name
   fallback if no logo was supplied).
5. If brand content was authored, confirm it is reaching the model: a prefill answer should
   reflect the client's proposition and tone, not generic copy.
