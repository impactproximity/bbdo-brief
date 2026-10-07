import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The single server-side Supabase client, shared by everything that reads or writes
 * application data: users (lib/auth.ts), briefs (lib/briefs/store.ts) and the OTP
 * rate-limit ledger (lib/auth/otpRateLimit.ts).
 *
 * SERVER ONLY. This holds the service-role key, which BYPASSES row-level security —
 * every table in this project has RLS enabled with no policies, so this client is the
 * only thing that can reach them, and scoping is enforced in our own code rather than by
 * the database. Never import this into a client component.
 *
 * Deliberately NOT used by lib/auth/supabaseOtp.ts: the OTP engine creates a fresh client
 * per call, because a warm serverless instance could otherwise carry one user's
 * just-verified session into the next request.
 */

declare global {
  var _supabaseAdmin: SupabaseClient | undefined;
}

/**
 * Cached on globalThis so the client survives hot reload and warm serverless instances.
 * supabase-js is fetch-based, so there is no connection pool to exhaust — this is purely
 * to avoid rebuilding the client on every request.
 */
export function getAdminClient(): SupabaseClient {
  if (globalThis._supabaseAdmin) return globalThis._supabaseAdmin;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
        '(the Supabase integration provides both on the bbdo-brief Vercel project; ' +
        'run `vercel env pull` locally).',
    );
  }

  const client = createClient(url, key, {
    // Server-side only: there is no browser session to persist or refresh.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  globalThis._supabaseAdmin = client;
  return client;
}

/** True when Supabase is configured, so callers can degrade instead of throwing. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
