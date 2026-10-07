import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/admin';
import { buildUsageReport } from '@/lib/usage/report';

/**
 * The usage report, for admins only.
 *
 * proxy.ts already blocks unauthenticated requests, but it cannot check a role — it runs on
 * the edge with no database access. requireAdmin() is therefore the real gate here, and it
 * returns 403 rather than 404 only because the caller is already known to be signed in.
 */

export const runtime = 'nodejs';

const DEFAULT_RANGE_DAYS = 30;

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Degrade like the brief history page does, rather than throwing, so a missing env var
  // shows an explanatory empty state instead of a stack trace.
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ configured: false, report: null });
  }

  const url = new URL(req.url);
  const now = new Date();

  const to = parseDate(url.searchParams.get('to')) ?? now;
  const from =
    parseDate(url.searchParams.get('from')) ??
    new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

  // A reversed range would silently return nothing; treat it as a bad request instead.
  if (from > to) {
    return NextResponse.json({ error: '`from` is after `to`.' }, { status: 400 });
  }

  try {
    const report = await buildUsageReport(from.toISOString(), to.toISOString());
    return NextResponse.json({ configured: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/usage] failed:', err);
    return NextResponse.json({ error: 'Failed to build the usage report.', detail: message }, { status: 500 });
  }
}

/** Accepts YYYY-MM-DD or a full ISO timestamp. Returns null for anything unparseable. */
function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
