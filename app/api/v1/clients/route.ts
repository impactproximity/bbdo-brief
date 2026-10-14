import { NextResponse } from 'next/server';
import { CLIENTS } from '@/lib/clients';
import { getBriefTypesForClient } from '@/lib/questions/agency';
import { requireApiKey } from '@/lib/api/auth';
import { withApiErrorHandling } from '@/lib/api/errors';

export const runtime = 'nodejs';

/**
 * GET /api/v1/clients — what this key may actually call.
 *
 * Derived live from the same registries the UI uses, so onboarding a client (one
 * ClientConfig in lib/clients) publishes it here with no API work at all.
 */
export async function GET(req: Request) {
  return withApiErrorHandling(async () => {
    const key = await requireApiKey(req);

    const scoped = CLIENTS.filter(
      (c) => !key.allowed_clients || key.allowed_clients.length === 0 || key.allowed_clients.includes(c.id),
    );

    const clients = scoped.map((c) => {
      const tiers = getBriefTypesForClient(c.id).filter(
        (t) => !key.allowed_tiers || key.allowed_tiers.length === 0 || key.allowed_tiers.includes(t.id),
      );
      return {
        clientId: c.id,
        label: c.label,
        description: c.description,
        briefTypes: tiers.map((t) => ({ id: t.id, label: t.label, description: t.description })),
      };
    });

    return NextResponse.json({ clients });
  });
}
