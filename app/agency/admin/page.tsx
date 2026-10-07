import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { UsageReportView } from '@/components/agency/UsageReportView';

/**
 * Admin-only usage and cost report.
 *
 * A SERVER component, unlike the other pages under /agency which are all 'use client'.
 * That is deliberate: the admin check needs a database read, so it cannot live in proxy.ts
 * (edge, no DB), and doing it here means a non-admin is redirected before any of the page
 * renders. A client-side check would flash the shell first and leave the gate entirely in
 * the API route.
 *
 * Both gates exist: this one, and requireAdmin() inside /api/admin/usage.
 */

export const metadata = { title: 'Usage — Brief Creator' };

export default async function AdminUsagePage() {
  const session = await requireAdmin();

  // Not an admin, not signed in, or deactivated — all look the same from here, and all go
  // back to the dashboard rather than to an error page. proxy.ts has already handled the
  // genuinely-signed-out case before this runs.
  if (!session) redirect('/agency');

  return <UsageReportView />;
}
