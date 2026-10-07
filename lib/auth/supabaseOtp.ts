import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Auth (GoTrue) used purely as an OTP engine.
 *
 * GoTrue generates, hashes, expires, single-uses and emails the code. It is NOT the
 * identity: `bbdo_users` remains the allowlist and the identity that `session.userId`
 * and `briefs.user_id` refer to. The GoTrue user and the bbdo_users row are two
 * different records for the same person, joined only on lowercased email.
 * We read GoTrue's verdict from verifyOtp() and discard the Supabase session it returns.
 *
 * SERVER ONLY. The admin client here holds the service-role key.
 */

function assertServer() {
  if (typeof window !== 'undefined') {
    throw new Error('lib/auth/supabaseOtp must never be imported into client code.');
  }
}

/**
 * Next.js replaces globalThis.fetch with an instrumented wrapper that RETRIES.
 * For a POST to /auth/v1/otp that is actively harmful: GoTrue mints a brand new code on
 * every attempt and each new code invalidates the last, so one sign-in request produces
 * two or three emails and the first one the user opens is already dead.
 *
 * `next: { internal: true }` opts out of that instrumentation; `cache: 'no-store'` keeps
 * the request out of the data cache. Do not remove either.
 */
function uninstrumentedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    cache: 'no-store',
    // @ts-expect-error — `next` is a Next.js extension to RequestInit, not in lib.dom.
    next: { internal: true },
  });
}

const AUTH_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: uninstrumentedFetch },
} as const;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set. Pull it from Vercel (\`vercel env pull\`) — the Supabase ` +
        `integration provides it on the bbdo-brief project.`,
    );
  }
  return v;
}

/** True when OTP login can work at all, so callers can fail cleanly instead of throwing. */
export function isOtpConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

/**
 * Client for the two unauthenticated OTP calls.
 *
 * Uses the ANON key deliberately, not the service-role key: with the service key GoTrue
 * treats the caller as privileged and its own 60s-per-user throttle stops applying.
 *
 * A NEW client per call, never a module singleton — a warm serverless instance could
 * otherwise carry one user's just-verified session into the next request. This is the
 * opposite of the globalThis caching in lib/briefs/store.ts, on purpose.
 */
function otpClient(): SupabaseClient {
  assertServer();
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), AUTH_OPTIONS);
}

/** Admin client — service-role key. Must never be reachable from an unauthenticated path. */
function adminClient(): SupabaseClient {
  assertServer();
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), AUTH_OPTIONS);
}

export type SendResult =
  | { ok: true }
  | { ok: false; reason: 'throttled'; retryAfter: number }
  | { ok: false; reason: 'failed' };

/**
 * Ask GoTrue to email a 6-digit code.
 *
 * `shouldCreateUser: false` means GoTrue will not invent an account for an unknown
 * address — the caller must have already checked our own allowlist.
 * No `emailRedirectTo`: this is a code, not a magic link.
 */
export async function sendLoginCode(email: string): Promise<SendResult> {
  const { error } = await otpClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (!error) return { ok: true };

  // GoTrue's own throttle. Mirror it rather than hiding it.
  //
  // Log the real reason: the caller only ever sees a generic "too many requests" (telling
  // them more would disclose that the address is registered, since we only reach this
  // call for registered addresses). Without this line the server log shows a bare 429 and
  // "my 60s cooldown" is indistinguishable from "custom SMTP isn't configured, so the
  // built-in sender's ~2/hour project-wide cap is exhausted" — which is the far more
  // likely cause and needs a dashboard fix, not patience.
  if (error.status === 429) {
    console.warn(`[otp] GoTrue refused to send (429): ${error.message}`);
    return { ok: false, reason: 'throttled', retryAfter: 60 };
  }

  console.error('[otp] signInWithOtp failed:', error.message);
  return { ok: false, reason: 'failed' };
}

/**
 * Verify a code. Returns true only if GoTrue accepts it.
 *
 * Must run in the same request that consumes the code — it is single-use, so anything
 * that checked it beforehand would burn it.
 *
 * The try/catch is load-bearing: verifyOtp returns `{ error }` for a bad code but THROWS
 * on network failure or missing config. An uncaught throw would skip the caller's
 * attempt recording, silently disabling brute-force protection during a Supabase outage.
 */
export async function verifyLoginCode(email: string, code: string): Promise<boolean> {
  try {
    const { data, error } = await otpClient().auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) return false;
    return Boolean(data?.user);
  } catch (err) {
    console.error('[otp] verifyOtp threw:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Give an address a GoTrue credential row so it can receive codes. Idempotent.
 *
 * `email_confirm: true` is load-bearing, not cosmetic: without it the user is
 * unconfirmed and GoTrue sends the "Confirm signup" template instead of the Magic Link
 * one, so the recipient gets a link and never a code — login silently fails for exactly
 * the users you just created.
 *
 * No password is passed, so the GoTrue row has no credential of its own.
 */
export async function ensureAuthUser(email: string): Promise<{ created: boolean }> {
  const { error } = await adminClient().auth.admin.createUser({ email, email_confirm: true });
  if (!error) return { created: true };

  const msg = (error.message || '').toLowerCase();
  if (error.status === 422 || msg.includes('already been registered') || msg.includes('email_exists')) {
    return { created: false };
  }
  throw new Error(`Failed to register ${email} with Supabase Auth: ${error.message}`);
}

/** Every email known to GoTrue, paginated — supabase-js v2 has no getUserByEmail. */
export async function listAuthUserEmails(): Promise<Set<string>> {
  const admin = adminClient();
  const emails = new Set<string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Failed to list Supabase Auth users: ${error.message}`);
    const users = data?.users ?? [];
    for (const u of users) if (u.email) emails.add(u.email.toLowerCase());
    if (users.length < 1000) break;
  }
  return emails;
}

/**
 * Break-glass: produce a code without sending email, for when SMTP is down.
 *
 * The token carries verification_type 'magiclink'; verifyOtp({ type: 'email' }) normally
 * accepts it, but that is GoTrue-version dependent. TEST THIS BEFORE YOU NEED IT —
 * an untested escape hatch is not one.
 */
export async function generateLoginCode(email: string): Promise<string> {
  const { data, error } = await adminClient().auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw new Error(`Failed to generate a login code for ${email}: ${error.message}`);
  const otp = data?.properties?.email_otp;
  if (!otp) throw new Error(`Supabase returned no email_otp for ${email}.`);
  return otp;
}
