import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { BrandContextEditor } from '@/components/agency/BrandContextEditor';

/**
 * Admin-only editor for one synced brand's context: what Pulse sent, what we have added, and
 * the documents we have uploaded for it.
 *
 * A SERVER component, like its parent and like /agency/admin, and unlike the rest of /agency
 * which is all 'use client'. Same reason: the admin check needs a database read, so it cannot
 * live in proxy.ts (edge, no DB), and doing it here means a non-admin is redirected before any
 * of the page renders.
 *
 * Both gates exist: this one, and requireAdmin() inside every route the editor calls.
 *
 * A PAGE rather than a dialog, because the content is two long textareas plus one more per
 * uploaded document, and a modal that scrolls past the viewport is a worse place to read brand
 * strategy than a page is.
 */

export const metadata = { title: 'Brand context — Brief Creator' };

export default async function BrandContextPage({ params }: { params: Promise<{ brandId: string }> }) {
  const session = await requireAdmin();
  if (!session) redirect('/agency');

  // Pulse's brand id, matching every /api/admin/pulse-brands route, so the dashboard links
  // straight here without resolving our slug first.
  const { brandId } = await params;

  return <BrandContextEditor brandId={brandId} />;
}
