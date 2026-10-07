import { cookies } from 'next/headers';
import { getAdminClient } from './supabase/admin';
import { SESSION_COOKIE, verifySession, type SessionPayload } from './session';

// Node-only auth helpers. Do NOT import this from middleware/proxy.
//
// `bbdo_users` now lives in Supabase Postgres alongside `briefs` and `otp_attempts` —
// one database, with a real foreign key from briefs.user_id. It remains the allowlist and
// the identity: `is_active` is the complete definition of "may sign in" (login is
// email-OTP, so there is no password and no second gate), and `id` is the integer carried
// in the session JWT.
//
// Supabase Auth (GoTrue) is only the OTP engine — see lib/auth/supabaseOtp.ts. It is not
// the identity, and its user ids are never persisted.

export interface UserRow {
  id: number;
  email: string;
  is_active: boolean;
  /**
   * Admin rights for the usage report only (see 0005). Deliberately NOT a login gate —
   * `is_active` remains the complete definition of "may sign in".
   */
  is_admin: boolean;
}

/**
 * Look up a user by email. Returns undefined when there is no match, which both callers
 * rely on (`if (!user || !user.is_active)`).
 *
 * Matches on lowercased email. Both callers already normalise, but this is also why the
 * table carries a unique index on lower(email): Postgres `text` is case-sensitive where
 * SQL Server's NVARCHAR was not, and a near-miss here would be invisible — the OTP route
 * returns an identical response for unknown addresses, so the user would be told a code
 * was sent and simply never receive one.
 */
export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const normalised = email.trim().toLowerCase();

  const { data, error } = await getAdminClient()
    .from('bbdo_users')
    .select('id, email, is_active, is_admin')
    .eq('email', normalised)
    .maybeSingle();

  if (error) throw new Error(`Failed to look up user: ${error.message}`);
  return (data as UserRow | null) ?? undefined;
}

/** Read and verify the session from the request cookies (server components / route handlers). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * The session, but only for an admin. Returns null for everyone else.
 *
 * Why this is a database read rather than a JWT claim: `proxy.ts` runs on the edge and
 * cannot query Postgres, so it can only answer "signed in or not" — it has no way to gate
 * on a role. Admin routes therefore check here, in Node, as a second gate on top of the
 * proxy's authentication. Reading the row (rather than trusting a claim baked into the
 * cookie) also means revoking admin takes effect on the next request instead of waiting
 * for a 7-day session to expire.
 *
 * Throws nothing on a missing user — an unknown or deactivated account is simply not an
 * admin.
 */
export async function requireAdmin(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await findUserByEmail(session.email);
  if (!user || !user.is_active || !user.is_admin) return null;

  return session;
}

/**
 * Stamp `last_login_at`. Fire-and-forget by design: this is reporting data, and a failure
 * to record it must never be able to fail a login that otherwise succeeded. Returns void
 * so no caller can await it into their request path.
 *
 * This exists because otp_attempts cannot answer "who is using the platform" — it is swept
 * at 7 days, has no user_id, and contains rows for addresses that were never users.
 */
export function stampLastLogin(userId: number): void {
  void (async () => {
    try {
      const { error } = await getAdminClient()
        .from('bbdo_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) console.warn(`[auth] failed to stamp last_login_at: ${error.message}`);
    } catch (err) {
      console.warn('[auth] failed to stamp last_login_at:', err instanceof Error ? err.message : err);
    }
  })();
}
