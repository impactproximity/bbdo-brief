-- Public Brief Generation API: keys, briefs and the per-key rate-limit ledger.
-- Run once in the Supabase SQL editor, after 0005.
--
-- This is the second way into the brief pipeline. The first is a human with an email-OTP
-- session; this one is another platform holding an API key. The two share the generation
-- core (lib/briefs/generate.ts) and nothing else — deliberately, so that a change here
-- cannot alter what the ~79 signed-in users experience.
--
-- Nothing in this file touches `briefs`, `bbdo_users` or any existing index. The single
-- change to an existing table is one nullable column on usage_events at the bottom.

-- --- api_keys: who may call the API ---------------------------------------------------

create table if not exists api_keys (
  id                  uuid        primary key default gen_random_uuid(),

  -- Human label for the consuming platform, e.g. 'Omnicom Planning Portal'.
  name                text        not null,

  -- SHA-256 of the key. The plaintext is shown ONCE at creation and never stored, so a
  -- leak of this table cannot yield a working key. Lookup is by hash, hence the unique
  -- index rather than a scan.
  key_hash            text        not null unique,

  -- First 12 chars of the plaintext ('bbdo_sk_ab12'), so a key can be identified in logs
  -- and in `api-key-list` without ever handling the secret. NOT sufficient to authenticate.
  key_prefix          text        not null,

  -- Scope. Null means "every client / every tier the registries allow" — an explicit
  -- array narrows it. Free-form text to mirror briefs.client_id and briefs.tier: the
  -- registries in lib/clients and lib/questions/agency change, and a stale scope must
  -- degrade to "no match" rather than break the table.
  allowed_clients     text[],
  allowed_tiers       text[],

  -- Mirrors bbdo_users.is_active: the COMPLETE definition of "may call the API".
  is_active           boolean     not null default true,

  -- Per-key hourly quota, enforced in app code against api_requests below.
  rate_limit_per_hour integer     not null default 60,

  created_at          timestamptz not null default now(),
  last_used_at        timestamptz,
  revoked_at          timestamptz
);

create index if not exists api_keys_hash_idx on api_keys (key_hash);

-- --- api_briefs: what the API produced ------------------------------------------------

-- Deliberately NOT the `briefs` table. briefs.user_id is not null and every accessor in
-- lib/briefs/store.ts filters on it; an API caller has no user, and inventing a synthetic
-- one would either pollute a real person's history or force that invariant to be relaxed.
-- A separate table keeps /agency/briefs provably unchanged.
create table if not exists api_briefs (
  id               uuid        primary key default gen_random_uuid(),

  api_key_id       uuid        not null references api_keys (id) on delete cascade,

  -- Free-form, same reasoning as briefs.client_id / briefs.tier.
  client_id        text        not null,
  tier             text        not null,

  -- Denormalised from answers.brief_name, as in briefs.title.
  title            text        not null default 'Untitled brief',

  -- PrefillResult: Record<questionId, { value, confidence, missing, suggestion? }>.
  answers          jsonb       not null default '{}'::jsonb,

  -- What the caller sent. Same shape as the briefs columns so the two are comparable.
  corpus           text        not null default '',
  voice_transcript text        not null default '',
  text_notes       text        not null default '',

  -- The caller's own reference, echoed back untouched. Never used for lookup by us.
  external_id      text,

  -- Supplied by the caller in the Idempotency-Key header. The API is synchronous and a
  -- Big Idea brief takes minutes, so a consumer that times out WILL retry — without this
  -- every retry would re-spend model tokens. A repeat returns this stored row instead.
  idempotency_key  text        not null,

  created_at       timestamptz not null default now()
);

-- The idempotency guarantee, scoped per key so two consumers cannot collide on a common
-- value like 'brief-1'.
create unique index if not exists api_briefs_key_idem_idx on api_briefs (api_key_id, idempotency_key);

-- Listing a consumer's briefs, most recent first.
create index if not exists api_briefs_key_created_idx on api_briefs (api_key_id, created_at desc);

-- --- api_requests: the rate-limit ledger ----------------------------------------------

-- Modelled on otp_attempts (0002) but deliberately a SEPARATE table. otp_attempts is keyed
-- by email and IP hash and its limits exist to protect people signing in; mixing machine
-- traffic into it would let a busy integration throttle real users out of the product.
create table if not exists api_requests (
  id         uuid        primary key default gen_random_uuid(),
  api_key_id uuid        not null references api_keys (id) on delete cascade,
  route      text        not null,
  created_at timestamptz not null default now()
);

-- The only query this table serves: "how many calls has this key made since <timestamp>".
create index if not exists api_requests_key_created_idx on api_requests (api_key_id, created_at desc);

-- --- usage_events: attribute API spend ------------------------------------------------

-- The ONLY change to an existing table, and it is additive and nullable, so every existing
-- row and every existing query is unaffected. lib/usage/report.ts needs no change: its
-- keyFor() already falls back to 'unattributed' when user_id is null, and its route
-- grouping is built from whatever values exist (route is free-form text, no check
-- constraint), so 'api/v1/briefs' appears as its own group automatically.
alter table usage_events add column if not exists api_key_id uuid references api_keys (id);

-- --- RLS backstop ---------------------------------------------------------------------

-- Same as every other table in this project: RLS enabled with NO policies, so a leaked
-- anon/publishable key reaches nothing. All access goes through the service-role key from
-- our own routes, and scoping is enforced in app code (lib/api/auth.ts).
alter table api_keys     enable row level security;
alter table api_briefs   enable row level security;
alter table api_requests enable row level security;
