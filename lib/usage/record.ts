import { getAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';
import { priceEvent, RATES_VERSION } from './rates';
import type { SessionPayload } from '@/lib/session';

/**
 * Records one row in `usage_events` per model call.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────
 *  THE ONE RULE: recording must NEVER break a working AI call.
 *
 *  A brief that generated fine but failed to log is a small gap in a report. A brief that
 *  FAILED because logging broke is a broken product, and the user loses real work. So
 *  `recordUsage` returns void rather than a Promise — on purpose, so that no caller can
 *  await it, forget to catch it, or have it reject into their request path. Every error is
 *  swallowed after a warn.
 *
 *  This mirrors how brief autosave already degrades (see app/agency/brief/[tier]/page.tsx:
 *  "losing autosave must never block someone from finishing a brief").
 * ────────────────────────────────────────────────────────────────────────────────────────
 *
 * SERVER ONLY — goes through the service-role client.
 */

export type UsageRoute = 'agency/prefill' | 'agency/chat' | 'chat' | 'transcribe';
export type UsageProvider = 'anthropic' | 'openai';

export interface RecordUsageInput {
  route: UsageRoute;
  provider: UsageProvider;

  /** The RESOLVED model id from the response, not the alias requested. */
  model: string;

  /**
   * The caller, from getSession(). Null is tolerated rather than fatal: proxy.ts already
   * guarantees these routes are authenticated, so null means something unexpected went
   * wrong — and an unattributed cost record is far better than no cost record.
   */
  session: SessionPayload | null;

  clientId?: string | null;
  tier?: string | null;
  briefId?: string | null;

  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;

  /** Whisper only. Null means "counted but not costed". */
  audioSeconds?: number | null;
}

export function recordUsage(input: RecordUsageInput): void {
  // Degrade silently when there is no database to write to — local dev without env vars
  // must still be able to run a brief end to end.
  if (!isSupabaseConfigured()) return;

  void (async () => {
    try {
      const cost = priceEvent({
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        cacheReadTokens: input.cacheReadTokens,
        cacheWriteTokens: input.cacheWriteTokens,
        audioSeconds: input.audioSeconds,
      });

      const { error } = await getAdminClient().from('usage_events').insert({
        user_id: input.session?.userId ?? null,
        user_email: input.session?.email ?? null,
        brief_id: input.briefId ?? null,
        route: input.route,
        provider: input.provider,
        model: input.model,
        client_id: input.clientId ?? null,
        tier: input.tier ?? null,
        input_tokens: input.inputTokens ?? 0,
        output_tokens: input.outputTokens ?? 0,
        cache_read_tokens: input.cacheReadTokens ?? 0,
        cache_write_tokens: input.cacheWriteTokens ?? 0,
        audio_seconds: input.audioSeconds ?? null,
        // Null, not 0, when the model is unknown — see priceEvent.
        cost_usd: cost,
        rates_version: RATES_VERSION,
      });

      if (error) console.warn(`[usage] failed to record ${input.route}: ${error.message}`);
    } catch (err) {
      console.warn('[usage] failed to record:', err instanceof Error ? err.message : err);
    }
  })();
}

/** Anthropic's usage block, as much of it as we care about. */
interface AnthropicLikeUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/**
 * Pull the four-way token split out of an Anthropic response.
 *
 * All four matter. `input_tokens` EXCLUDES cached tokens, so for prefill — where the corpus
 * is by far the largest block and always lands in one of the cache counters — reading only
 * input + output would under-report spend dramatically.
 */
export function anthropicUsage(response: { model?: string; usage?: AnthropicLikeUsage | null }) {
  const u = response.usage ?? {};
  return {
    model: response.model ?? 'unknown',
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
  };
}

/** OpenAI chat-completions usage. Cached prompt tokens are reported inside prompt_tokens. */
interface OpenAiLikeUsage {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  prompt_tokens_details?: { cached_tokens?: number | null } | null;
}

export function openAiUsage(response: { model?: string; usage?: OpenAiLikeUsage | null }) {
  const u = response.usage ?? {};
  const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
  const prompt = u.prompt_tokens ?? 0;
  return {
    model: response.model ?? 'unknown',
    // Subtract cached tokens so they are not billed twice at the full input rate — OpenAI
    // includes them inside prompt_tokens, unlike Anthropic which reports them separately.
    inputTokens: Math.max(0, prompt - cached),
    outputTokens: u.completion_tokens ?? 0,
    cacheReadTokens: cached,
    cacheWriteTokens: 0,
  };
}
