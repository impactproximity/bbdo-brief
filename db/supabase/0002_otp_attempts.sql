-- Rate-limit / brute-force ledger for email-OTP login (Supabase / Postgres).
-- Run once in the Supabase SQL editor.
--
-- This table does NOT store codes. Supabase Auth (GoTrue) owns generation, hashing,
-- expiry and single-use; we only record that an attempt happened, so we can throttle.
--
-- Postgres-backed rather than in-process on purpose: on serverless, a throttle that
-- concurrent instances cannot see is not a throttle.
--
-- Purely additive and invisible to the deployed app, so it can be applied to production
-- BEFORE the new code ships, with no window in which anybody is locked out.

create table if not exists otp_attempts (
  id         uuid        primary key default gen_random_uuid(),
  kind       text        not null check (kind in ('request', 'verify')),
  email      text        not null,
  ip_hash    text        not null,   -- sha256(ip + AUTH_SECRET); never the raw address
  success    boolean     not null default false,
  created_at timestamptz not null default now()
);

-- One index per window the limiter counts over.
create index if not exists otp_attempts_kind_email_created_idx on otp_attempts (kind, email, created_at);
create index if not exists otp_attempts_kind_ip_created_idx    on otp_attempts (kind, ip_hash, created_at);
create index if not exists otp_attempts_created_idx            on otp_attempts (created_at);

-- Same backstop as `briefs`: all access is via the service-role key from our own routes,
-- which bypasses RLS. Enabling it with no policies means a leaked anon key reaches nothing
-- here — which matters, because the anon key is now shipped to the OTP request path.
alter table otp_attempts enable row level security;
