import { createHash } from 'crypto';
import { getAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';
import { getClientConfig } from '@/lib/clients';
import { isBriefTypeAllowedForClient } from '@/lib/questions/agency';
import { ApiFailure } from './errors';

/**
 * API-key authentication for /api/v1.
 *
 * This is the SECOND auth scheme in the app and it is completely parallel to the first.
 * proxy.ts lets /api/v1/* through without a session — it runs on the edge and cannot read
 * the database — and the real check happens here, in Node. That is the same division the
 * project already uses for admin: the proxy answers "signed in or not" and nothing more,
 * and roles are checked in-route (see lib/auth.ts requireAdmin and the note in CLAUDE.md).
 *
 * Nothing in this file can affect session auth: it reads no cookies and writes no session.
 */

export const API_KEY_PREFIX = 'bbdo_sk_';
const PREFIX_LENGTH = 12;

export interface ApiKeyRecord {
  id: string;
  name: string;
  key_prefix: string;
  allowed_clients: string[] | null;
  allowed_tiers: string[] | null;
  is_active: boolean;
  rate_limit_per_hour: number;
  revoked_at: string | null;
}

/** SHA-256 of the plaintext key. The plaintext is never stored, only compared by hash. */
export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/** The identifying, non-secret leading segment — safe to log and display. */
export function apiKeyPrefix(plaintext: string): string {
  return plaintext.slice(0, PREFIX_LENGTH);
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Resolve the caller's API key, or throw an ApiFailure the route turns into JSON.
 *
 * Lookup is by hash equality on an indexed unique column, so there is no secret-dependent
 * branch to time: an attacker learns only "exists or not", which is what any key-based
 * scheme leaks. The key itself is never logged — only key_prefix.
 */
export async function requireApiKey(req: Request): Promise<ApiKeyRecord> {
  if (!isSupabaseConfigured()) {
    throw new ApiFailure('internal_error', 'API key store unavailable.');
  }

  const token = bearerToken(req);
  if (!token) {
    throw new ApiFailure('unauthorized', 'Missing API key. Send "Authorization: Bearer <key>".');
  }

  const { data, error } = await getAdminClient()
    .from('api_keys')
    .select('id, name, key_prefix, allowed_clients, allowed_tiers, is_active, rate_limit_per_hour, revoked_at')
    .eq('key_hash', hashApiKey(token))
    .maybeSingle();

  if (error) {
    console.warn('[api/v1] key lookup failed:', error.message);
    throw new ApiFailure('internal_error', 'Could not verify the API key.');
  }

  // Same message whether the key is unknown, revoked or deactivated — distinguishing them
  // tells an attacker which keys exist.
  const key = data as ApiKeyRecord | null;
  if (!key || !key.is_active || key.revoked_at) {
    throw new ApiFailure('unauthorized', 'Invalid or revoked API key.');
  }

  return key;
}

/** Fire-and-forget; a failed stamp must never fail the request. */
export function stampKeyUsed(keyId: string): void {
  if (!isSupabaseConfigured()) return;
  void (async () => {
    try {
      await getAdminClient().from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyId);
    } catch {
      /* ignore — telemetry must not break a working call */
    }
  })();
}

/** The clients this key may use, resolved against the live registry. */
export function clientsForKey(key: ApiKeyRecord, allClientIds: string[]): string[] {
  if (!key.allowed_clients || key.allowed_clients.length === 0) return allClientIds;
  return allClientIds.filter((id) => key.allowed_clients!.includes(id));
}

/**
 * Validate a client + tier pair for this key.
 *
 * Order matters for the status code: an unknown client or tier is a 404 (the caller asked
 * for something that does not exist), while a real client outside the key's scope is a 403
 * (it exists, you may not use it).
 */
export function assertClientAndTierAllowed(key: ApiKeyRecord, clientId: string, briefType: string): void {
  const client = getClientConfig(clientId);
  if (!client) {
    throw new ApiFailure('not_found', `Unknown client: ${clientId}`);
  }

  if (key.allowed_clients && key.allowed_clients.length > 0 && !key.allowed_clients.includes(clientId)) {
    throw new ApiFailure('forbidden', `This API key is not scoped to client: ${clientId}`);
  }

  // Reuses the same guard the UI uses for hand-typed URLs, so the API can never reach a
  // tier the product does not offer that client.
  if (!isBriefTypeAllowedForClient(briefType, clientId)) {
    throw new ApiFailure('not_found', `Brief type "${briefType}" is not available for client "${clientId}".`);
  }

  if (key.allowed_tiers && key.allowed_tiers.length > 0 && !key.allowed_tiers.includes(briefType)) {
    throw new ApiFailure('forbidden', `This API key is not scoped to brief type: ${briefType}`);
  }
}
