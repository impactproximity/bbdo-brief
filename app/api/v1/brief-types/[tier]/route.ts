import { NextResponse } from 'next/server';
import { getAgencyBriefConfig } from '@/lib/questions/agency';
import { requireApiKey } from '@/lib/api/auth';
import { ApiFailure, withApiErrorHandling } from '@/lib/api/errors';

export const runtime = 'nodejs';

/**
 * GET /api/v1/brief-types/{tier} — the question schema for a tier.
 *
 * Lets a consuming platform build its own intake form, validate before calling, and know
 * which answer keys to expect back, without reading our source or being sent a spec.
 */
export async function GET(req: Request, { params }: { params: Promise<{ tier: string }> }) {
  return withApiErrorHandling(async () => {
    const key = await requireApiKey(req);
    const { tier } = await params;

    const config = getAgencyBriefConfig(tier);
    if (!config) throw new ApiFailure('not_found', `Unknown brief type: ${tier}`);

    if (key.allowed_tiers && key.allowed_tiers.length > 0 && !key.allowed_tiers.includes(tier)) {
      throw new ApiFailure('forbidden', `This API key is not scoped to brief type: ${tier}`);
    }

    return NextResponse.json({
      briefType: tier,
      documentTitle: config.documentTitle,
      questions: config.questions.map((q) => ({
        id: q.id,
        title: q.title,
        prompt: q.prompt,
        hint: q.hint ?? null,
        required: Boolean(q.required),
      })),
      // The shape every answer comes back in, so a consumer can model it up front.
      answerShape: {
        value: 'string',
        confidence: 'high | medium | low',
        missing: 'boolean',
        suggestion: 'string (optional)',
      },
    });
  });
}
