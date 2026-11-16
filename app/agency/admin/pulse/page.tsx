import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { PulseBrandsView } from '@/components/agency/PulseBrandsView';

/**
 * Admin-only Pulse brand sync: every brand live on Impact BBDO Pulse, which of them are
 * briefable here, and a button to onboard one.
 *
 * A SERVER component, like /agency/admin and unlike the rest of /agency which is all
 * 'use client'. Same reason: the admin check needs a database read, so it cannot live in
 * proxy.ts (edge, no DB), and doing it here means a non-admin is redirected before any of the
 * page renders. A client-side check would flash the shell first and leave the gate entirely
 * in the API route.
 *
 * Both gates exist: this one, and requireAdmin() inside every /api/admin/pulse-brands route.
 */

export const metadata = { title: 'Pulse brands — Brief Creator' };

export default async function PulseBrandsPage() {
  const session = await requireAdmin();

  // Not an admin, not signed in, or deactivated — all look the same from here, and all go
  // back to the dashboard rather than to an error page. proxy.ts has already handled the
  // genuinely-signed-out case before this runs.
  if (!session) redirect('/agency');

  return <PulseBrandsView />;
}
