import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  getPulseClientByBrandId,
  isPulseStoreConfigured,
  setPulseClientActive,
} from '@/lib/clients/pulse-store';

export const runtime = 'nodejs';

/**
 * PATCH /api/admin/pulse-brands/{brandId} — activate or deactivate a synced brand.
 *
 * Needs no Pulse call at all: this is purely about whether WE offer the brand, so it works
 * even when the partner API is unreachable. That matters — "stop offering this brand" is
 * exactly the thing an admin may need to do while something upstream is broken.
 *
 * DEACTIVATE, NEVER DELETE. Briefs carry client_id as free-form text with no foreign key, so
 * deleting the row would leave every brief ever written for that brand rendering a raw slug
 * where its client name belongs. Deactivating hides it from the picker and from the public
 * catalog while keeping the history readable — the same reason bbdo_users rows are
 * deactivated rather than removed.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!isPulseStoreConfigured()) {
    return NextResponse.json({ error: 'The synced client store is not configured.' }, { status: 503 });
  }

  const { brandId } = await params;

  let body: { isActive?: unknown };
  try {
    body = (await req.json()) as { isActive?: unknown };
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: '"isActive" is required and must be a boolean.' }, { status: 400 });
  }

  try {
    // Addressed by Pulse's brand id, like its sibling routes, so the dashboard never has to
    // hold two identifiers for one row.
    const existing = await getPulseClientByBrandId(brandId);
    if (!existing) {
      return NextResponse.json({ error: 'That brand is not onboarded.' }, { status: 404 });
    }

    const row = await setPulseClientActive(existing.id, body.isActive);
    if (!row) {
      return NextResponse.json({ error: 'That brand is not onboarded.' }, { status: 404 });
    }

    return NextResponse.json({ client: { id: row.id, label: row.label, isActive: row.is_active } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/pulse-brands] activate/deactivate failed:', err);
    return NextResponse.json({ error: 'Could not update the brand.', detail: message }, { status: 500 });
  }
}
