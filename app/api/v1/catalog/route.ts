import { NextResponse } from 'next/server';
import { CLIENTS } from '@/lib/clients';
import { acceptedNamesFor } from '@/lib/clients/resolve';
import { getBriefTypesForClient, getAgencyBriefConfig } from '@/lib/questions/agency';
import { requireApiKey } from '@/lib/api/auth';
import { withApiErrorHandling } from '@/lib/api/errors';
import { IDEA_SCALE_TO_BRIEF_TYPE } from '@/lib/api/idea-prompt';

export const runtime = 'nodejs';

/**
 * GET /api/v1/catalog — everything a consumer needs to build its own UI, in one call.
 *
 * /clients and /brief-types/{tier} still exist and are unchanged; this is the one-request
 * version for consumers that would otherwise make N+1 calls to show what a brief contains.
 *
 * Built live from the registries, so onboarding a client (one ClientConfig) publishes it
 * here with no API work. Everything is scoped to the calling key, exactly as /clients is:
 * a partner sees only the brands they may raise briefs for.
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
        // What this API will accept as `clientId` for this brand — id, label and any
        // declared aliases. Matching is case- and punctuation-insensitive.
        aliases: acceptedNamesFor(c.id),
        briefTypes: tiers.map((t) => {
          const config = getAgencyBriefConfig(t.id);
          return {
            id: t.id,
            label: t.label,
            description: t.description,
            documentTitle: config?.documentTitle ?? t.label,
            questions: (config?.questions ?? []).map((q) => ({
              id: q.id,
              title: q.title,
              prompt: q.prompt,
              hint: q.hint ?? null,
              required: Boolean(q.required),
            })),
          };
        }),
      };
    });

    return NextResponse.json({
      clients,
      // Trend-led consumers send an Idea whose `scale` implies the brief tier. Publishing
      // the mapping keeps that convention here rather than hardcoded in each consumer.
      ideaScaleMap: IDEA_SCALE_TO_BRIEF_TYPE,
      answerShape: {
        value: 'string',
        confidence: 'high | medium | low',
        missing: 'boolean',
        suggestion: 'string (optional)',
      },
    });
  });
}
