import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Rate limiting for email-OTP login, backed by Postgres.
 *
 * Deliberately NOT in-process: on serverless, a throttle that concurrent instances
 * cannot see is not a throttle. Every limit below is counted from the shared
 * `otp_attempts` table (db/supabase/0002_otp_attempts.sql).
 *
 * Two trade-offs, both chosen on purpose:
 *
 *  - FAILS OPEN on database error. Failing closed would mean a Postgres blip locks every
 *    user out of the product, and with passwords gone there is no fallback to rescue
 *    them. A brief window of unthrottled attempts is the lesser harm.
 *  - NOT TRANSACTIONAL. Two concurrent requests can both read a stale count; the
 *    overshoot is one extra email, which is not worth a lock for.
 */

const TABLE = 'otp_attempts';

export type AttemptKind = 'request' | 'verify';

// --- Windows (seconds) and limits -------------------------------------------------
const HOUR = 3600;
const DAY = 86_400;
const FIFTEEN_MIN = 900;

// Per-EMAIL limits are the real protection: they stop one account being targeted and
// stop the endpoint being used to spam one person. Keep them tight.
//
// Per-IP limits are a blunt instrument here, because everyone in the office shares one
// public IP behind corporate NAT. With ~27 users on one address, a 25/hour IP cap means
// the 26th person to sign in on a Monday morning is locked out by their colleagues, with
// no way to tell why. They are set high enough to be invisible to a real office while
// still stopping a script enumerating thousands of addresses from one machine.
// A code is only ever emailed to an address that is already registered AND active, so
// the "email bomb" vector is bounded to known staff rather than arbitrary addresses.
// That materially lowers the risk and lets these sit at values a real person will never
// notice. 5/hour was tight enough that logging out and back in a few times locked people
// out of their own account — the limiter was doing more damage than the abuse it prevents.
const LIMITS = {
  requestPerEmailHour: 10,
  requestPerEmailDay: 30,
  requestPerIpHour: 200,
  // Mirrors Supabase's own "Minimum interval per user" (now 10s). Keep the two in step:
  // if ours is longer we block requests GoTrue would have allowed, and if ours is shorter
  // we pass requests straight into a GoTrue 429. 60s was too long for the common case of
  // logging out and straight back in.
  resendCooldownSec: 10,
  verifyFailPerEmail15Min: 8,
  verifyPerIpHour: 400,
} as const;

const RETENTION_DAYS = 7;
const SWEEP_PROBABILITY = 0.02;

const db = getAdminClient;

/**
 * Hash the caller's IP rather than storing it. Salted with AUTH_SECRET so the table is
 * not a lookup list of who tried to log in; rotating AUTH_SECRET resets the buckets.
 */
export function hashIp(req: Request): string {
  const h = req.headers;
  const raw =
    h.get('x-vercel-forwarded-for') ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'local';
  return createHash('sha256').update(raw + (process.env.AUTH_SECRET ?? '')).digest('hex');
}

function isoAgo(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

async function countRows(
  filter: (q: ReturnType<SupabaseClient['from']>) => unknown,
): Promise<number | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = (await (filter(db().from(TABLE)) as any)) as {
      count: number | null;
      error: unknown;
    };
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export interface LimitVerdict {
  allowed: boolean;
  /** Seconds the caller should wait. Only meaningful when `allowed` is false. */
  retryAfter: number;
}

const ALLOW: LimitVerdict = { allowed: true, retryAfter: 0 };

/**
 * Check whether a code may be sent to this email from this IP.
 * Returns the cooldown remaining when refused, so the UI can show a real countdown.
 */
export async function checkRequestAllowed(email: string, ipHash: string): Promise<LimitVerdict> {
  const [lastSend, lastConsumed, emailHour, emailDay, ipHour] = await Promise.all([
    // Most recent request for this address, for the 60s resend cooldown.
    //
    // Counts ALL attempts, not just successful sends. If it only counted successes, a
    // registered address would 429 on a rapid second request while an unregistered one
    // returned 200 — which discloses exactly what the generic response exists to hide.
    (async () => {
      try {
        const { data, error } = await db()
          .from(TABLE)
          .select('created_at')
          .eq('kind', 'request')
          .eq('email', email)
          .gte('created_at', isoAgo(LIMITS.resendCooldownSec))
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) return null;
        return (data as { created_at: string } | null)?.created_at ?? null;
      } catch {
        return null;
      }
    })(),
    // Most recent SUCCESSFUL verify. A code is single-use, so once it has logged someone
    // in it no longer exists to be reused — and holding the resend cooldown against it
    // strands anyone who logs out and back in: the code they were told to reuse is dead,
    // and they are blocked from getting a live one.
    (async () => {
      try {
        const { data, error } = await db()
          .from(TABLE)
          .select('created_at')
          .eq('kind', 'verify')
          .eq('email', email)
          .eq('success', true)
          .gte('created_at', isoAgo(LIMITS.resendCooldownSec))
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) return null;
        return (data as { created_at: string } | null)?.created_at ?? null;
      } catch {
        return null;
      }
    })(),
    countRows((q) =>
      q.select('id', { count: 'exact', head: true }).eq('kind', 'request').eq('email', email).gte('created_at', isoAgo(HOUR)),
    ),
    countRows((q) =>
      q.select('id', { count: 'exact', head: true }).eq('kind', 'request').eq('email', email).gte('created_at', isoAgo(DAY)),
    ),
    countRows((q) =>
      q.select('id', { count: 'exact', head: true }).eq('kind', 'request').eq('ip_hash', ipHash).gte('created_at', isoAgo(HOUR)),
    ),
  ]);

  // Any null means the database did not answer — fail open (see file header).
  if (emailHour === null || emailDay === null || ipHour === null) return ALLOW;

  // Skip the cooldown when the last code has already been spent on a successful login.
  // The hourly and daily caps still apply, so this cannot be used to pump out emails.
  const consumed =
    lastSend && lastConsumed && new Date(lastConsumed).getTime() > new Date(lastSend).getTime();

  if (lastSend && !consumed) {
    const elapsed = Math.floor((Date.now() - new Date(lastSend).getTime()) / 1000);
    const remaining = LIMITS.resendCooldownSec - elapsed;
    if (remaining > 0) return { allowed: false, retryAfter: remaining };
  }
  if (emailHour >= LIMITS.requestPerEmailHour) return { allowed: false, retryAfter: HOUR };
  if (emailDay >= LIMITS.requestPerEmailDay) return { allowed: false, retryAfter: DAY };
  if (ipHour >= LIMITS.requestPerIpHour) return { allowed: false, retryAfter: HOUR };

  return ALLOW;
}

/** Brute-force gate on the verify endpoint. Counts FAILED attempts per email. */
export async function checkVerifyAllowed(email: string, ipHash: string): Promise<LimitVerdict> {
  const [emailFails, ipAll] = await Promise.all([
    countRows((q) =>
      q.select('id', { count: 'exact', head: true }).eq('kind', 'verify').eq('email', email).eq('success', false).gte('created_at', isoAgo(FIFTEEN_MIN)),
    ),
    countRows((q) =>
      q.select('id', { count: 'exact', head: true }).eq('kind', 'verify').eq('ip_hash', ipHash).gte('created_at', isoAgo(HOUR)),
    ),
  ]);

  if (emailFails === null || ipAll === null) return ALLOW;

  if (emailFails >= LIMITS.verifyFailPerEmail15Min) return { allowed: false, retryAfter: FIFTEEN_MIN };
  if (ipAll >= LIMITS.verifyPerIpHour) return { allowed: false, retryAfter: HOUR };
  return ALLOW;
}

/**
 * Record an attempt as FAILED up front, returning its id.
 *
 * Writing before doing the work is deliberate: a crash or a Supabase timeout then costs
 * the caller an attempt, rather than handing out a free unmetered retry.
 */
export async function beginAttempt(kind: AttemptKind, email: string, ipHash: string): Promise<string | null> {
  try {
    const { data, error } = await db()
      .from(TABLE)
      .insert({ kind, email, ip_hash: ipHash, success: false })
      .select('id')
      .single();
    if (error) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}

/** Promote an attempt to success — only once the thing actually happened. */
export async function markAttemptSucceeded(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await db().from(TABLE).update({ success: true }).eq('id', id);
  } catch {
    /* best effort — never block the user on bookkeeping */
  }
}

/** Opportunistic retention sweep, on a small fraction of requests. Fire and forget. */
export function maybeSweep(): void {
  if (Math.random() >= SWEEP_PROBABILITY) return;
  void (async () => {
    try {
      await db().from(TABLE).delete().lt('created_at', isoAgo(RETENTION_DAYS * DAY));
    } catch {
      /* ignore */
    }
  })();
}
