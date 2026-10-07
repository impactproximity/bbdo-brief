-- Usage tracking and admin reporting (Supabase / Postgres).
-- Run once in the Supabase SQL editor, after 0004.
--
-- Answers three questions that were previously unanswerable: who is using the platform,
-- how many briefs each person created, and what the AI spend is per user.
--
-- Brief counts already came for free from `briefs` (never swept, user rows never deleted).
-- What was missing was durable login activity and any record at all of model usage — every
-- response.usage object was discarded. Nothing here can be backfilled: reporting starts
-- from the moment this ships.

-- --- bbdo_users: a role, and a durable last-seen -------------------------------------

-- The first role concept in the app. Strictly additive: `is_active` remains the COMPLETE
-- definition of "may sign in" (see 0003), and this must never become a second login gate.
-- It controls one thing — whether /agency/admin and /api/admin/* will answer.
alter table bbdo_users add column if not exists is_admin boolean not null default false;

-- "Is this person actually using the tool", durably.
--
-- otp_attempts cannot answer this: it is a rate-limit ledger swept at 7 days
-- (lib/auth/otpRateLimit.ts), it has no user_id, and it carries rows for addresses that
-- were never users at all. Stamped on successful verify instead.
alter table bbdo_users add column if not exists last_login_at timestamptz;

-- --- usage_events: one row per model call --------------------------------------------

create table if not exists usage_events (
  id                 uuid        primary key default gen_random_uuid(),

  -- Attribution. Nullable on purpose: if the session lookup fails we still want the cost
  -- record, unattributed, rather than losing the fact that money was spent.
  user_id            integer     references bbdo_users (id),
  user_email         text,

  -- Null for agency/prefill BY DESIGN — prefill runs before the brief row exists
  -- (see app/agency/brief/[tier]/page.tsx, "briefId is null until the row exists"), and
  -- reshaping that flow to suit telemetry is not worth it. Also null on the two OpenAI
  -- routes, which carry no brief dimension. Populated for agency/chat.
  brief_id           uuid        references briefs (id) on delete set null,

  route              text        not null,   -- 'agency/prefill' | 'agency/chat' | 'chat' | 'transcribe'
  provider           text        not null,   -- 'anthropic' | 'openai'

  -- The RESOLVED model from response.model, not the alias we asked for:
  -- 'claude-sonnet-4-6' is a moving pointer, and a cost must stay attributable to the
  -- snapshot that actually served the request.
  model              text        not null,

  -- Free-form, mirroring briefs.client_id / briefs.tier — the registries change, so a
  -- report must tolerate values no longer in lib/clients. Null on the OpenAI routes.
  client_id          text,
  tier               text,

  -- FOUR counters, not two. Anthropic prices cache writes and cache reads differently
  -- from ordinary input, and input_tokens EXCLUDES cached tokens — so summing
  -- input + output alone would badly under-report prefill, where the corpus (the largest
  -- block by far) lands in one of the cache columns and never in input_tokens.
  input_tokens       integer     not null default 0,
  output_tokens      integer     not null default 0,
  cache_read_tokens  integer     not null default 0,
  cache_write_tokens integer     not null default 0,

  -- Whisper bills per minute of audio and returns no usage object at all. Left null: the
  -- invocation is counted but not costed. The column exists so costing can be added later
  -- (switch transcribe to response_format 'verbose_json') without another migration.
  audio_seconds      numeric(10,2),

  -- Priced at WRITE time, from lib/usage/rates.ts, so editing a rate later cannot
  -- silently rewrite history. rates_version records which table produced the figure.
  --
  -- Null means "not priced" — never "free". An unknown model must leave this null so the
  -- UI can say "unpriced" instead of showing a confident $0.00.
  cost_usd           numeric(12,6),
  rates_version      text,

  created_at         timestamptz not null default now()
);

-- Per-user reporting over a date range, and the global time series.
create index if not exists usage_events_user_created_idx on usage_events (user_id, created_at desc);
create index if not exists usage_events_created_idx      on usage_events (created_at desc);

-- Backstop only, same as every other table in this project: RLS enabled with NO policies,
-- so the anon/publishable key can reach nothing here. All access goes through the
-- service-role key from our own admin-gated routes, and the admin check lives in app code
-- (lib/auth.ts requireAdmin) because proxy.ts runs on the edge and cannot query the DB.
alter table usage_events enable row level security;
