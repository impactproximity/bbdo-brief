import { getAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';
import type { ApiKeyRecord } from './auth';

/**
 * Per-key hourly quota for /api/v1.
 *
 * Modelled on lib/auth/otpRateLimit.ts — same sliding-window-by-timestamp count and the
 * same probabilistic sweep — but against its own `api_requests` table. Deliberately NOT
 * sharing otp_attempts: that ledger is keyed by email and IP and its limits exist to keep
 * real people able to sign in. A busy integration must never be able to throttle a human
 * out of the product, and the two must be tunable independently.
 */

const TABLE = 'api_requests';
const HOUR_SECONDS = 3600;
const RETENTION_DAYS = 7;
const SWEEP_PROBABILITY = 0.02;

export interface RateVerdict {
  allowed: boolean;
  /** Calls used in the trailing hour. Null when the count could not be read. */
  used: number | null;
  limit: number;
  /** Seconds the caller should wait, for the Retry-After header. */
  retryAfter: number;
}

function isoAgo(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

/**
 * Count this key's calls in the trailing hour and compare against its limit.
 *
 * Fails OPEN. If the ledger cannot be read we allow the call: this is a commercial quota,
 * not a security control, and the auth check has already happened. Refusing real work
 * because a counter is unavailable is the worse failure.
 */
export async function checkApiRateLimit(key: ApiKeyRecord): Promise<RateVerdict> {
  const limit = key.rate_limit_per_hour;
  if (!isSupabaseConfigured() || limit <= 0) {
    return { allowed: true, used: null, limit, retryAfter: 0 };
  }

  try {
    const { count, error } = await getAdminClient()
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('api_key_id', key.id)
      .gte('created_at', isoAgo(HOUR_SECONDS));

    if (error) return { allowed: true, used: null, limit, retryAfter: 0 };

    const used = count ?? 0;
    return {
      allowed: used < limit,
      used,
      limit,
      // Without per-request timestamps the honest answer is "try within the hour".
      retryAfter: used < limit ? 0 : HOUR_SECONDS,
    };
  } catch {
    return { allowed: true, used: null, limit, retryAfter: 0 };
  }
}

/** Record one call. Fire-and-forget: a failed ledger write must not fail the request. */
export function recordApiRequest(keyId: string, route: string): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      await getAdminClient().from(TABLE).insert({ api_key_id: keyId, route });
      maybeSweep();
    } catch {
      /* ignore */
    }
  })();
}

/** Occasionally drop rows past the retention window, as otpRateLimit does. */
function maybeSweep(): void {
  if (Math.random() > SWEEP_PROBABILITY) return;
  void (async () => {
    try {
      await getAdminClient().from(TABLE).delete().lt('created_at', isoAgo(RETENTION_DAYS * 86_400));
    } catch {
      /* ignore */
    }
  })();
}
