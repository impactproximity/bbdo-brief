import { NextResponse } from 'next/server';
import { getAllClientConfigs } from '@/lib/clients/registry';
import { acceptedNamesIn } from '@/lib/clients/resolve';
import { getBriefTypesForClient } from '@/lib/questions/agency';
import { requireApiKey } from '@/lib/api/auth';
import { withApiErrorHandling } from '@/lib/api/errors';

export const runtime = 'nodejs';

/**
 * GET /api/v1/clients — what this key may actually call.
 *
 * Derived live from the same registries the UI uses, so onboarding a client publishes it
 * here with no API work at all — a ClientConfig in lib/clients, or a brand an admin
 * onboarded from Pulse.
 */
export async function GET(req: Request) {
  return withApiErrorHandling(async () => {
    const key = await requireApiKey(req);

    const all = await getAllClientConfigs();
    const scoped = all.filter(
      (c) => !key.allowed_clients || key.allowed_clients.length === 0 || key.allowed_clients.includes(c.id),
    );

    const clients = scoped.map((c) => {
      const tiers = getBriefTypesForClient(c).filter(
        (t) => !key.allowed_tiers || key.allowed_tiers.length === 0 || key.allowed_tiers.includes(t.id),
      );
      return {
        clientId: c.id,
        label: c.label,
        description: c.description,
        // Every spelling this API accepts as `clientId` for this brand.
        aliases: acceptedNamesIn(all, c.id),
        briefTypes: tiers.map((t) => ({ id: t.id, label: t.label, description: t.description })),
      };
    });

    return NextResponse.json({ clients });
  });
}
