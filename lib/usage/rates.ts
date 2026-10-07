/**
 * Model prices, in USD per million tokens.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────
 *  READ THIS BEFORE TRUSTING ANY NUMBER BELOW.
 *
 *  These figures were written from memory by an AI assistant and are NOT verified. Model
 *  pricing changes, and recalled prices go stale silently. They are a starting point so the
 *  report is not empty on day one — nothing more.
 *
 *  `RATES_LAST_VERIFIED` is deliberately null. While it is null the admin page shows an
 *  "unverified rates" warning on every cost figure. To clear it:
 *
 *    1. Check each rate against the provider's own pricing page (links below).
 *    2. Correct anything that is wrong.
 *    3. Set RATES_LAST_VERIFIED to today's date and bump RATES_VERSION.
 *
 *  Anthropic : https://www.anthropic.com/pricing
 *  OpenAI    : https://openai.com/api/pricing
 * ────────────────────────────────────────────────────────────────────────────────────────
 *
 * Token counts are the ground truth in this system; cost is derived and only ever as good
 * as this file. Reports should be read as "roughly this much", never as billed spend.
 */

/** Set to a 'YYYY-MM-DD' string once a human has checked the rates against the pricing pages. */
export const RATES_LAST_VERIFIED: string | null = null;

/**
 * Bumped whenever a rate changes. Stamped onto every usage_events row, so a historical
 * cost stays attributable to the table that produced it even after rates are edited.
 */
export const RATES_VERSION = '2026-10-07.unverified';

export interface TokenRates {
  /** Ordinary input tokens. Excludes anything that hit or wrote the cache. */
  inputPer1M: number;
  outputPer1M: number;
  /**
   * Writing to the prompt cache costs MORE than ordinary input (Anthropic's 5-minute
   * ephemeral cache carries a premium). Nothing in this app sets a ttl, so every write
   * here is the default 5-minute tier.
   */
  cacheWritePer1M: number;
  /** Reading from the cache is much cheaper than re-sending the same input. */
  cacheReadPer1M: number;
}

/**
 * Keyed by model family prefix, because `response.model` returns a dated snapshot
 * (e.g. 'claude-sonnet-4-6-20260514') rather than the moving alias we requested. Lookup is
 * exact-match first, then longest matching prefix — so a new snapshot of a known family
 * prices correctly without a code change, while a genuinely new family stays unpriced
 * until someone adds it deliberately.
 */
export const TOKEN_RATES: Record<string, TokenRates> = {
  // UNVERIFIED. Sonnet-class pricing.
  'claude-sonnet-4-6': {
    inputPer1M: 3.0,
    outputPer1M: 15.0,
    cacheWritePer1M: 3.75, // ~1.25x input for the 5-minute cache
    cacheReadPer1M: 0.3,   // ~0.1x input
  },

  // UNVERIFIED. gpt-4o, used by /api/chat to polish a single answer (max_tokens 200).
  'gpt-4o': {
    inputPer1M: 2.5,
    outputPer1M: 10.0,
    cacheWritePer1M: 0, // OpenAI does not bill for cache writes
    cacheReadPer1M: 1.25,
  },
};

/**
 * UNVERIFIED. Whisper bills per minute of audio, not per token.
 *
 * Currently unused: /api/transcribe records the invocation but leaves audio_seconds null,
 * because obtaining the duration would mean changing a working route's response_format
 * purely for telemetry. Kept here so that costing is a one-line change when it matters.
 */
export const WHISPER_PER_MINUTE = 0.006;

/** What pricing needs to know about an event. Mirrors the usage_events columns. */
export interface PriceableEvent {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  audioSeconds?: number | null;
}

/** Exact match, else the longest matching family prefix, else undefined. */
export function findRates(model: string): TokenRates | undefined {
  if (TOKEN_RATES[model]) return TOKEN_RATES[model];

  let best: string | undefined;
  for (const key of Object.keys(TOKEN_RATES)) {
    if (model.startsWith(key) && (!best || key.length > best.length)) best = key;
  }
  return best ? TOKEN_RATES[best] : undefined;
}

/**
 * Price an event, or return null when it cannot be priced.
 *
 * NULL IS NOT ZERO, and this distinction matters more than it looks. Returning 0 for an
 * unknown model would quietly understate total spend while looking like real data — the
 * worst failure mode for a cost report. Null surfaces in the UI as "unpriced", which
 * prompts someone to add the missing rate.
 */
export function priceEvent(event: PriceableEvent): number | null {
  // Audio-only events (whisper): priced solely by duration, and only if we captured one.
  const isAudio = event.audioSeconds != null;
  if (isAudio) {
    return (event.audioSeconds! / 60) * WHISPER_PER_MINUTE;
  }

  const rates = findRates(event.model);
  if (!rates) return null;

  const perMillion = (tokens: number | undefined, rate: number) => ((tokens ?? 0) / 1_000_000) * rate;

  return (
    perMillion(event.inputTokens, rates.inputPer1M) +
    perMillion(event.outputTokens, rates.outputPer1M) +
    perMillion(event.cacheWriteTokens, rates.cacheWritePer1M) +
    perMillion(event.cacheReadTokens, rates.cacheReadPer1M)
  );
}
