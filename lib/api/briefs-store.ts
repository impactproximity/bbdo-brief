import { getAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';
import type { PrefillResult } from '@/lib/questions/agency';

/**
 * Accessors for `api_briefs`.
 *
 * Intentionally NOT added to lib/briefs/store.ts. That module's invariant is that every
 * exported function takes `userId` first and filters on it; an API caller has no user, so
 * adding these there would mean either a function scoped by something else — breaking the
 * rule that makes cross-user leakage impossible to write by accident — or a synthetic user.
 * Separate table, separate accessor, same discipline: every function here takes
 * `apiKeyId` first and filters on it, so one consumer can never read another's briefs.
 */

export interface ApiBriefRecord {
  id: string;
  client_id: string;
  tier: string;
  title: string;
  answers: PrefillResult;
  external_id: string | null;
  created_at: string;
}

const COLUMNS = 'id, client_id, tier, title, answers, external_id, created_at';

/** The brief previously stored under this idempotency key, if any. */
export async function findByIdempotencyKey(apiKeyId: string, idempotencyKey: string): Promise<ApiBriefRecord | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await getAdminClient()
    .from('api_briefs')
    .select(COLUMNS)
    .eq('api_key_id', apiKeyId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) {
    console.warn('[api/v1] idempotency lookup failed:', error.message);
    return null;
  }
  return (data as ApiBriefRecord | null) ?? null;
}

export interface CreateApiBriefInput {
  apiKeyId: string;
  clientId: string;
  tier: string;
  title: string;
  answers: PrefillResult;
  corpus: string;
  voiceTranscript: string;
  textNotes: string;
  externalId: string | null;
  idempotencyKey: string;
}

/**
 * Persist a generated brief. Returns null when the row could not be written — the caller
 * still returns the answers, because the model work is done and paid for, and losing the
 * audit row is a smaller failure than losing the brief. This mirrors how recordUsage and
 * brief autosave already degrade.
 */
export async function createApiBrief(input: CreateApiBriefInput): Promise<ApiBriefRecord | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await getAdminClient()
    .from('api_briefs')
    .insert({
      api_key_id: input.apiKeyId,
      client_id: input.clientId,
      tier: input.tier,
      title: input.title,
      answers: input.answers,
      corpus: input.corpus,
      voice_transcript: input.voiceTranscript,
      text_notes: input.textNotes,
      external_id: input.externalId,
      idempotency_key: input.idempotencyKey,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    console.warn('[api/v1] failed to persist api_brief:', error.message);
    return null;
  }
  return data as ApiBriefRecord;
}

/** Calls made by this key in the trailing hour — for GET /api/v1/me. */
export async function countRequestsThisHour(apiKeyId: string): Promise<number | null> {
  if (!isSupabaseConfigured()) return null;
  const since = new Date(Date.now() - 3600 * 1000).toISOString();

  const { count, error } = await getAdminClient()
    .from('api_requests')
    .select('id', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyId)
    .gte('created_at', since);

  return error ? null : (count ?? 0);
}
