import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { fetchPulseBrandContext, isPulseConfigured } from '@/lib/pulse/client';
import { composeBrandContext } from '@/lib/pulse/compose';
import { matchingStaticClientId, suggestCard } from '@/lib/pulse/onboard';
import { getPulseClientByBrandId, isPulseStoreConfigured } from '@/lib/clients/pulse-store';
import { pulseErrorResponse } from '@/lib/pulse/error-response';
import { isStaticClientId } from '@/lib/clients/registry';

export const runtime = 'nodejs';
// The context call can take a moment: Pulse composes its sections concurrently but a
// well-populated brand is a real query fan-out on their side.
export const maxDuration = 60;

/**
 * GET /api/admin/pulse-brands/{brandId}/preview — what onboarding this brand WOULD store.
 *
 * A GET, because it changes nothing here. It does reach out to Pulse, which is the usual
 * argument for POST, but the operation is a read with no side effect on either side and
 * calling it a GET keeps that visible.
 *
 * WHY A SEPARATE STEP AT ALL. Onboarding writes the brand context that will be injected into
 * every brief for that client from then on. Composing it from ten possible sections of
 * someone else's database, through our own mapping, is exactly the kind of thing that is
 * plausible in the abstract and wrong in the particular — a brand whose guideline is a stub,
 * a competitor list that is empty, a `systemPromptOverride` nobody remembers writing. This
 * lets an admin read the actual text before it becomes live brand context, instead of
 * clicking Onboard and finding out from a brief three days later.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!isPulseConfigured() || !isPulseStoreConfigured()) {
    return NextResponse.json({ error: 'Pulse brand sync is not configured.' }, { status: 503 });
  }

  const { brandId } = await params;

  try {
    const context = await fetchPulseBrandContext(brandId);
    const composed = composeBrandContext(context);
    const existing = await getPulseClientByBrandId(brandId);
    const suggested = suggestCard(context.brand);

    // A slug an admin would otherwise discover is taken only on submit. Checked against both
    // registries: a compile-time client, and any other synced row.
    const staticMatch = matchingStaticClientId(context.brand);
    const suggestedIdTaken = isStaticClientId(suggested.id);

    return NextResponse.json({
      brand: {
        id: context.brand.id,
        name: context.brand.name,
        clientName: context.brand.clientName,
        industries: context.brand.industries,
        regions: context.brand.regions,
        regionLabels: context.brand.regionLabels,
        briefClientId: context.brand.briefClientId,
        excludeOwnName: context.brand.excludeOwnName,
      },

      /** The exact three fields that would be stored and injected into prompts. */
      composed,

      guideline: context.guideline
        ? { version: context.guideline.version, createdAt: context.guideline.createdAt }
        : null,

      /**
       * What each requested section actually contained. A count of zero is a real and common
       * answer — Competitor.notes is a dormant column upstream and BrandConversationTheme is
       * orphaned — and seeing it here is the difference between "thin brand" and "our mapping
       * dropped it".
       */
      sections: {
        guideline: Boolean(context.guideline),
        competitors: context.competitors?.length ?? 0,
        conversationThemes: context.conversationThemes?.length ?? 0,
        opportunityThemes: context.opportunityThemes?.length ?? 0,
        trackingTerms: context.trackingTerms?.length ?? 0,
      },

      suggested,
      suggestedIdTaken,

      /** Non-null when this brand is already onboarded — i.e. this is a Refresh. */
      existing: existing
        ? {
            id: existing.id,
            label: existing.label,
            description: existing.description,
            icon: existing.icon,
            color: existing.color,
            aliases: existing.aliases,
            briefTypes: existing.brief_types,
            proposition: existing.proposition,
            propositionSource: existing.proposition_source,
            guidelineVersion: existing.guideline_version,
            isActive: existing.is_active,
            syncedAt: existing.synced_at,
          }
        : null,

      /** Non-null when the brand is already a hand-authored client and must not be onboarded. */
      staticClientId: existing ? null : staticMatch,
    });
  } catch (err) {
    return pulseErrorResponse(err);
  }
}
