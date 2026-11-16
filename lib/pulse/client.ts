import type { PulseBrandContext, PulseBrandSummary, PulseLogo } from './types';

/**
 * The outbound half of the Pulse integration: reading brand context out of Impact BBDO
 * Pulse so an admin can onboard one of their brands here without a deploy.
 *
 * SERVER ONLY. It holds a bearer token.
 *
 * This is the FIRST outbound HTTP call to an external service in this codebase. Everything
 * else goes through an SDK (Anthropic, OpenAI, supabase-js), so there was no house pattern
 * to follow and this file sets one: a configured-probe so callers degrade, an explicit
 * timeout on every call, no-store, and upstream failures mapped to a small typed error
 * rather than leaking a fetch stack into a route.
 *
 * WHY cache: 'no-store' EVERYWHERE. Next wraps globalThis.fetch with its own caching,
 * revalidating layer. These GETs are idempotent so a retry is harmless (unlike the POST in
 * lib/auth/supabaseOtp.ts, which needs the stronger `next: { internal: true }` escape
 * hatch), but a cached brand list would show an admin a roster that has since changed and a
 * cached /context would make Refresh a no-op — which is exactly the bug Refresh exists to
 * fix. The pull is admin-triggered and infrequent; there is nothing to save by caching it.
 *
 * WHY THE TOKEN IS NOT TRENDS_API_TOKEN. Pulse accepts only PARTNER_API_TOKEN here and
 * returns 401 for TRENDS_API_TOKEN deliberately — that other value is what their internal
 * proxy forwards to reach their own public routes, so holding it would mean revoking our
 * access breaks every dashboard panel in Pulse. The asymmetry is the point; a 401 when
 * someone pastes the wrong one is correct behaviour, not a misconfiguration.
 */

/** The five stable sections. See lib/pulse/types.ts for why the other four are excluded. */
export const PULSE_CONTEXT_SECTIONS = [
  'guideline',
  'competitors',
  'conversationThemes',
  'opportunityThemes',
  'trackingTerms',
] as const;

// Generous, because none of this is in a user's critical path — an admin clicked a button
// and expects a pull to take a moment. The context call is the slow one: Pulse composes
// nine sections concurrently and a well-populated brand is ~26 KB before we narrow it.
const LIST_TIMEOUT_MS = 10_000;
const CONTEXT_TIMEOUT_MS = 20_000;
const LOGO_TIMEOUT_MS = 15_000;

/** A logo big enough to be a mistake. Their brand assets are tens of KB. */
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export type PulseErrorKind = 'not_configured' | 'unauthorized' | 'not_found' | 'timeout' | 'upstream' | 'malformed';

/**
 * Carries a `kind` so a route can choose a status and a sentence without regex-matching a
 * message. `detail` is safe to show an admin; it never contains the token.
 */
export class PulseError extends Error {
  constructor(
    readonly kind: PulseErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'PulseError';
  }
}

/**
 * True when both variables are set, so a page can render "not configured" instead of
 * throwing. Mirrors isSupabaseConfigured() / isOtpConfigured(). This is the state the whole
 * feature sits in until Pulse deploys their half — their endpoints have to be live before
 * our admin page is useful, which is the one sequencing constraint in the integration.
 */
export function isPulseConfigured(): boolean {
  return Boolean(process.env.PULSE_API_BASE_URL && process.env.PULSE_PARTNER_TOKEN);
}

function config(): { baseUrl: string; token: string } {
  const baseUrl = process.env.PULSE_API_BASE_URL;
  const token = process.env.PULSE_PARTNER_TOKEN;
  if (!baseUrl || !token) {
    throw new PulseError(
      'not_configured',
      'Pulse is not configured. Set PULSE_API_BASE_URL and PULSE_PARTNER_TOKEN.',
    );
  }
  // Trailing slashes are the classic way this breaks ("…/api//partner/brands").
  return { baseUrl: baseUrl.replace(/\/+$/, ''), token };
}

/**
 * One request. Returns the raw Response so the logo path can read bytes while the JSON
 * paths read JSON — the auth, timeout and error mapping are identical either way.
 */
async function request(path: string, timeoutMs: number): Promise<Response> {
  const { baseUrl, token } = config();
  const url = `${baseUrl}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // A DNS failure, a refused connection and an abort all land here. The abort is worth
    // separating because it is the one an admin can act on by simply trying again.
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new PulseError('timeout', `Pulse did not respond within ${timeoutMs / 1000}s.`);
    }
    throw new PulseError('upstream', `Could not reach Pulse at ${baseUrl}: ${message}`);
  }

  if (res.status === 401) {
    throw new PulseError(
      'unauthorized',
      'Pulse rejected our token (401). Check PULSE_PARTNER_TOKEN — note that Pulse ' +
        'deliberately rejects their TRENDS_API_TOKEN on these routes, so that value will ' +
        'always fail here.',
      401,
    );
  }
  if (res.status === 404) {
    throw new PulseError('not_found', 'Pulse has no live brand with that id.', 404);
  }
  if (!res.ok) {
    // Their envelope is a flat { error: "..." }. Read it if it is there; never assume it is.
    const detail = await res.text().catch(() => '');
    let message = detail.slice(0, 400);
    try {
      const parsed = JSON.parse(detail) as { error?: unknown };
      if (typeof parsed.error === 'string') message = parsed.error;
    } catch {
      /* not JSON — the truncated body is more useful than nothing */
    }
    throw new PulseError('upstream', `Pulse returned ${res.status}${message ? `: ${message}` : ''}.`, res.status);
  }

  return res;
}

async function json<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new PulseError('malformed', 'Pulse returned a 200 that was not valid JSON.');
  }
}

/**
 * Every brand live on Pulse — their roster, already filtered to
 * `deleted_at IS NULL AND disabled_at IS NULL` on their side. Disabling a brand in Pulse
 * removes it from this list, so it is also how a brand stops being onboardable.
 */
export async function fetchPulseBrands(): Promise<PulseBrandSummary[]> {
  const res = await request('/api/partner/brands', LIST_TIMEOUT_MS);
  const body = await json<{ brands?: PulseBrandSummary[]; total?: number }>(res);
  if (!Array.isArray(body.brands)) {
    throw new PulseError('malformed', 'Pulse\'s brand list did not contain a "brands" array.');
  }
  return body.brands;
}

/**
 * The composed bundle for one brand, narrowed to the stable sections.
 *
 * Narrowed at the REQUEST, not after: ?sections= is their parameter and it keeps the
 * response small (a full bundle is ~26 KB, most of it social-listening text we would throw
 * away). An unknown section name is ignored by them; a value naming only unknown sections
 * is a 400 — so the constant above must stay in step with their CONTEXT_SECTIONS.
 */
export async function fetchPulseBrandContext(brandId: string): Promise<PulseBrandContext> {
  const sections = PULSE_CONTEXT_SECTIONS.join(',');
  const res = await request(
    `/api/partner/brands/${encodeURIComponent(brandId)}/context?sections=${sections}`,
    CONTEXT_TIMEOUT_MS,
  );
  const body = await json<PulseBrandContext>(res);
  if (!body?.brand?.id) {
    throw new PulseError('malformed', 'Pulse\'s context response had no "brand" object.');
  }
  return body;
}

/**
 * The logo bytes, base64-encoded for storage, or null when the brand has no logo.
 *
 * NULL IS NOT AN ERROR. Pulse answers 404 both for "no logo_blob_path on the row" and for
 * "the path no longer resolves"; the messages differ so they can diagnose one, but both
 * mean "no logo" to us, and plenty of their brands genuinely have none. An onboarding must
 * not fail because of it — the card falls back to a lucide icon and the .docx header to a
 * name TextRun, exactly as a static client with no `logo` already does.
 */
export async function fetchPulseBrandLogo(brandId: string): Promise<PulseLogo | null> {
  let res: Response;
  try {
    res = await request(`/api/partner/brands/${encodeURIComponent(brandId)}/logo`, LOGO_TIMEOUT_MS);
  } catch (err) {
    if (err instanceof PulseError && err.kind === 'not_found') return null;
    throw err;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength === 0) return null;
  if (buffer.byteLength > MAX_LOGO_BYTES) {
    throw new PulseError('upstream', `Pulse's logo for this brand is ${buffer.byteLength} bytes, over the ${MAX_LOGO_BYTES} limit.`);
  }

  // Their Content-Type comes off the blob itself (image/png, image/jpeg, image/webp,
  // image/svg+xml). Kept verbatim: it is what our logo route serves back and what decides
  // ImageRun's `type` in the .docx, and guessing from a filename is the mistake that
  // corrupts a header when a .webp is named .png.
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim();
  if (!contentType || !contentType.startsWith('image/')) {
    throw new PulseError('malformed', `Pulse served a logo with a non-image Content-Type: ${contentType ?? '(none)'}`);
  }

  return { base64: buffer.toString('base64'), contentType };
}
