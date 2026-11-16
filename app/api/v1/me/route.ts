import { NextResponse } from 'next/server';
import { getAllClientConfigs } from '@/lib/clients/registry';
import { requireApiKey, clientsForKey } from '@/lib/api/auth';
import { countRequestsThisHour } from '@/lib/api/briefs-store';
import { withApiErrorHandling } from '@/lib/api/errors';

export const runtime = 'nodejs';

/**
 * GET /api/v1/me — who this key is and what quota it has left.
 *
 * The cheapest possible integration smoke test: it proves the key, the network path and
 * the gate all work without spending a single model token.
 */
export async function GET(req: Request) {
  return withApiErrorHandling(async () => {
    const key = await requireApiKey(req);
    const used = await countRequestsThisHour(key.id);
    // Both registries, so the resolved list matches what /catalog will actually serve.
    const all = await getAllClientConfigs();

    return NextResponse.json({
      name: key.name,
      keyPrefix: key.key_prefix,
      scopes: {
        // null means unrestricted; the resolved list is what the key can actually reach today.
        clients: key.allowed_clients ?? null,
        briefTypes: key.allowed_tiers ?? null,
        resolvedClients: clientsForKey(key, all.map((c) => c.id)),
      },
      rateLimit: {
        perHour: key.rate_limit_per_hour,
        usedThisHour: used,
        remaining: used == null ? null : Math.max(0, key.rate_limit_per_hour - used),
      },
    });
  });
}
