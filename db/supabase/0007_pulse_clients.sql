-- 0007_pulse_clients.sql
--
-- Brands onboarded from Impact BBDO Pulse (the Trend Application) by an admin, instead of
-- by a developer writing lib/clients/<id>.ts and merging to main.
--
-- RUN THIS BEFORE deploying the code that reads it. Nothing existing depends on this table,
-- so applying it early is safe and the app ignores it until lib/clients/registry.ts ships.
--
-- WHY A TABLE AT ALL. Until now a client brand was compile-time TypeScript: a config object
-- in lib/clients/<id>.ts, hand-registered in lib/clients/index.ts, shipped by a merge that
-- auto-deploys to ~82 live users. That is the entire reason a brand live on Pulse could not
-- be briefed here without a developer. Pulse already stores this material properly and
-- onboards brands through an admin UI with no deploy; this table is the local mirror of a
-- brand they hold, pulled on demand by an admin clicking a button.
--
-- WHAT IS OURS AND WHAT IS THEIRS. The split matters, because Refresh re-pulls.
--   Pulse owns  : brand_guidelines, prompt_guidance, guideline_version, guideline_created_at,
--                 logo_base64, logo_content_type, pulse_payload — every Refresh overwrites them.
--   We own      : label, description, icon, color, aliases, brief_types — a pull never
--                 touches them, because Pulse has no equivalent of our card vocabulary.
--   Either owns : proposition, per proposition_source. See that column.
--
-- NOT A CACHE. Nothing expires these rows and nothing re-pulls on a schedule. An admin
-- decides when a brand is ready and decides again when its guidelines have changed. If this
-- table and Pulse disagree, this table is what briefs were written against, which is the
-- behaviour we want: a brief must not change because someone edited a guideline upstream.

create table if not exists pulse_clients (
  -- Our canonical slug, e.g. 'etihad-airways'. The same namespace as the compile-time ids in
  -- lib/clients/index.ts, deliberately: briefs.client_id is free-form text and does not know
  -- which registry a client came from, so the two sets must never collide. The onboard route
  -- rejects an id that already exists statically.
  id text primary key,

  -- Their Brand.id. Unique, so one Pulse brand cannot be onboarded twice under two slugs.
  pulse_brand_id uuid not null unique,

  -- --- Card vocabulary: ours, never overwritten by a pull ---
  label text not null,
  description text not null default '',
  -- Keys into the iconMap / accentMap literals in app/agency/page.tsx. NOT free text and
  -- NOT Pulse's selectorBg hex: accentMap holds Tailwind class strings that are scanned at
  -- build time, so a runtime colour can never produce CSS. Both maps fall back silently
  -- (|| iconMap.Building2, || accentMap.purple), so a bad value here is invisible rather
  -- than loud — which is why the admin UI offers a closed list instead of an input.
  icon text not null default 'Building2',
  color text not null default 'purple',
  -- Extra spellings the public API accepts, beyond id and label. Same role as
  -- ClientConfig.aliases: Pulse posts "P&O", not "p-and-o".
  aliases text[],
  -- null = the four default tiers (DEFAULT_AGENCY_BRIEF_TYPE_IDS). An explicit array is an
  -- allow-list, exactly as ClientConfig.briefTypes is.
  brief_types text[],

  -- --- The three prose fields injected into every brief for this client ---
  -- Composed by lib/pulse/compose.ts from the bundle below, then read by
  -- buildClientContextBlock() unchanged. An empty string is omitted from the prompt, so a
  -- brand with thin context produces a thin block rather than an empty labelled section.
  proposition text not null default '',
  -- 'pulse' | 'local'. Pulse added brand_guidelines.proposition for us, so positioning is a
  -- real field rather than Markdown to parse out of `content`. But an admin may still write
  -- a better line by hand, and a Refresh must not silently discard it — so 'local' pins the
  -- value and Refresh leaves it alone while still reporting that Pulse's differs.
  proposition_source text not null default 'pulse',
  brand_guidelines text not null default '',
  prompt_guidance text not null default '',

  -- --- Logo bytes ---
  -- Base64, not a path and not a URL. Pulse serves bytes because its brand-assets container
  -- is private with AllowBlobPublicAccess=false, and we need a Buffer anyway: the logo is
  -- embedded into the .docx header via ImageRun. public/clients/ is not an option because
  -- Vercel's filesystem is read-only at runtime. Null is a real state — the brand has no
  -- logo, or Pulse 404'd for one.
  logo_base64 text,
  logo_content_type text,

  -- --- Staleness ---
  -- Pulse's brand_guidelines is append-only and the current row is MAX(version), so "their
  -- guidelines changed since we pulled" is an integer comparison against this column. Null
  -- (never 0) when the brand had no guideline at pull time: that is a real state on their
  -- side, and 0 would compare as a version we might think we already had.
  guideline_version integer,
  guideline_created_at timestamptz,

  -- The context bundle exactly as pulled. Provenance, and it lets compose.ts be re-run
  -- against the same input when the composition changes, without re-pulling from Pulse.
  pulse_payload jsonb,

  -- --- Provenance ---
  synced_at timestamptz not null default now(),
  synced_by_email text,

  -- Hides the brand from every surface — the picker, the public catalog, new briefs —
  -- without deleting the row. Same reasoning as bbdo_users.is_active: existing briefs keep
  -- their client_id and stay attributable forever, so a row is never destroyed to revoke it.
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The picker and the public catalog both read "every active brand", and the admin dashboard
-- joins on pulse_brand_id. The primary key and the unique constraint cover the rest.
create index if not exists pulse_clients_active_idx on pulse_clients (is_active, label);

-- RLS enabled with no policies, as on every other table here: a leaked anon key reaches
-- nothing, and all access goes through the service-role key from our own routes. Writes are
-- additionally gated by requireAdmin() in app/api/admin/pulse-brands/*.
alter table pulse_clients enable row level security;
