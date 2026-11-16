import { NextResponse } from 'next/server';
import { getAllClientConfigs } from '@/lib/clients/registry';
import { DEFAULT_AGENCY_BRIEF_TYPE_IDS } from '@/lib/questions/agency';
import { isPulseStoreConfigured } from '@/lib/clients/pulse-store';
import type { ClientCard } from '@/lib/clients/card';

export const runtime = 'nodejs';

/**
 * GET /api/clients — the client picker's data, for signed-in users.
 *
 * proxy.ts already session-gates everything under /api except /api/auth/* and /api/v1/*, so
 * this needs no gate of its own. There is no role check: every signed-in user may raise a
 * brief for any client, which is how the picker has always worked.
 *
 * WHY A ROUTE AND NOT AN IMPORT. The three pages under /agency are all 'use client' and used
 * to `import { CLIENTS }`, which pulled every config's module into the browser bundle —
 * including proposition, brandGuidelines and promptGuidance, which is ~11 KB of client-
 * confidential brand strategy for P&O alone, shipped to anyone who loaded the dashboard.
 * Brands synced from Pulse could not be imported at all, so a route was needed regardless;
 * moving the existing seven behind the same route closes that leak as a side effect.
 *
 * CARD FIELDS ONLY. Nothing here is prose. If you find yourself adding `proposition` to this
 * response, the thing that needs it is running in the browser and should not be.
 */


export async function GET() {
  try {
    const clients = await getAllClientConfigs();

    const cards: ClientCard[] = clients.map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description,
      icon: c.icon,
      color: c.color,
      logoSrc: c.logoUrl ?? (c.logo ? `/${c.logo}` : null),
      briefTypes: c.briefTypes ?? DEFAULT_AGENCY_BRIEF_TYPE_IDS,
      source: c.source ?? 'static',
    }));

    // `configured` mirrors the brief-history and usage routes so the picker can tell "no
    // synced brands yet" from "the synced store is switched off". getAllClientConfigs()
    // already degrades to static-only on a failure, so the list is never empty either way.
    return NextResponse.json({ configured: isPulseStoreConfigured(), clients: cards });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Client registry unavailable:', error);
    return NextResponse.json({ error: 'Could not load clients', detail: message }, { status: 500 });
  }
}
