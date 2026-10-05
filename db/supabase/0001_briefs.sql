-- Brief history for the agency flow (Supabase / Postgres).
-- Run once in the Supabase SQL editor.
--
-- NOTE: this is a SEPARATE database from db/schema.sql, which is Microsoft SQL Server
-- and holds bbdo_users. Users have not been migrated yet, so user_id below is the
-- SQL Server bbdo_users.id (an INT IDENTITY) carried in our own session JWT. There is
-- deliberately NO foreign key — the referenced table lives in another database.

create table if not exists briefs (
  id               uuid        primary key default gen_random_uuid(),

  -- Identity. user_id is bbdo_users.id from the Azure SQL database (integer, not a uuid).
  -- user_email is a snapshot so briefs can be re-linked when users move to Supabase Auth.
  user_id          integer     not null,
  user_email       text        not null,

  -- Which brief this is. Both are free-form text, NOT enums: tier is a route segment and
  -- the client/tier registries change (see lib/clients, lib/questions/agency).
  client_id        text        not null,
  tier             text        not null,

  -- Denormalised from answers.brief_name for the history list. questions[0].id is always
  -- brief_name and is always required, so this is reliably populated after prefill.
  title            text        not null default 'Untitled brief',

  -- in_progress = autosaved while working · saved = user clicked Save · submitted = DOCX generated
  status           text        not null default 'in_progress'
                   check (status in ('in_progress', 'saved', 'submitted')),

  -- PrefillResult: Record<questionId, { value, confidence, missing, suggestion? }>.
  -- Serialises directly with no transformation.
  answers          jsonb       not null default '{}'::jsonb,

  -- Parsed document text, joined with "# <filename>" headers and \n\n---\n\n separators.
  -- Uncapped upstream and realistically 50 KB - 500 KB, worst case multi-MB.
  -- Never select this in the list query.
  corpus           text        not null default '',
  voice_transcript text        not null default '',
  text_notes       text        not null default '',

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  submitted_at     timestamptz
);

-- Drives the history list: a user's briefs, most recently touched first.
create index if not exists briefs_user_updated_idx on briefs (user_id, updated_at desc);

-- Backstop only. Every read and write goes through the service-role key from our own API
-- routes, which bypasses RLS entirely — user scoping is enforced in app/api/briefs/*.
-- Enabling RLS with NO policies means the anon/publishable key can reach nothing here,
-- so a leaked anon key does not expose brief history.
alter table briefs enable row level security;
