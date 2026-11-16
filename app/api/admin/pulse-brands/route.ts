import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { isPulseConfigured, fetchPulseBrands } from '@/lib/pulse/client';
import { buildDashboardRows } from '@/lib/pulse/onboard';
import { countDocumentsByClient, isPulseStoreConfigured, listPulseClients } from '@/lib/clients/pulse-store';
import { pulseErrorResponse } from '@/lib/pulse/error-response';
import { CLIENT_COLOR_KEYS, CLIENT_ICON_KEYS } from '@/lib/clients/card-vocabulary';
import { AGENCY_BRIEF_TYPES } from '@/lib/questions/agency';

export const runtime = 'nodejs';

/**
 * GET /api/admin/pulse-brands — every brand live on Pulse, joined against what we hold.
 *
 * proxy.ts already blocks unauthenticated requests, but it cannot check a role — it runs on
 * the edge with no database access. requireAdmin() is therefore the real gate, and it returns
 * 403 rather than 404 only because the caller is already known to be signed in. Same division,
 * same reasoning as /api/admin/usage.
 *
 * Degrades rather than throwing on either half being switched off, so the page can render an
 * explanatory state instead of a stack trace — and it WILL be switched off for a while:
 * Pulse's partner endpoints have to be deployed before this is useful.
 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!isPulseConfigured() || !isPulseStoreConfigured()) {
    return NextResponse.json({
      configured: false,
      // Named precisely, because the two are fixed in completely different places: one is
      // our env vars, the other is the Supabase connection plus migration 0007.
      missing: {
        pulseApi: !isPulseConfigured(),
        syncedStore: !isPulseStoreConfigured(),
      },
      brands: [],
    });
  }

  try {
    // Concurrent: they share nothing, and the Pulse call is the slow half.
    const [brands, syncedRows] = await Promise.all([fetchPulseBrands(), listPulseClients({ includeInactive: true })]);

    // Needs the ids, so it cannot join the Promise.all above. One query for every brand.
    const documentCounts = await countDocumentsByClient(syncedRows.map((r) => r.id));

    return NextResponse.json({
      configured: true,
      brands: buildDashboardRows(brands, syncedRows, documentCounts),
      // The closed sets and the tier list, so the onboard dialog's dropdowns come from the
      // same source the POST validates against and cannot drift from it.
      vocabulary: {
        icons: CLIENT_ICON_KEYS,
        colors: CLIENT_COLOR_KEYS,
        briefTypes: AGENCY_BRIEF_TYPES.map((t) => ({ id: t.id, label: t.label })),
      },
    });
  } catch (err) {
    return pulseErrorResponse(err);
  }
}
