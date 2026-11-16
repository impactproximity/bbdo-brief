import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { distilBrandDocument } from '@/lib/pulse/distil';
import { anthropicUsage, recordUsage } from '@/lib/usage/record';
import {
  getClientDocumentWithText,
  getPulseClientByBrandId,
  isPulseStoreConfigured,
  updateClientDocument,
} from '@/lib/clients/pulse-store';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/admin/pulse-brands/{brandId}/documents/{docId}/redistil
 *
 * Re-runs the model over the stored `extracted_text`, replacing the distillation.
 *
 * THIS IS WHY extracted_text IS STORED. The distilling prompt is the part of this feature most
 * likely to be improved once someone has read a few of its outputs, and without the raw parse
 * every already-uploaded document would have to be found and uploaded again to benefit. Keeping
 * it costs a text column; the alternative costs somebody's afternoon, every time.
 *
 * It does NOT re-include the document. If an admin had excluded it, a fresh distillation is
 * still un-reviewed text and must be read before it counts.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ brandId: string; docId: string }> },
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!isPulseStoreConfigured()) {
    return NextResponse.json({ error: 'The synced client store is not configured.' }, { status: 503 });
  }

  const { brandId, docId } = await params;

  try {
    const client = await getPulseClientByBrandId(brandId);
    if (!client) return NextResponse.json({ error: 'That brand is not onboarded.' }, { status: 404 });

    const document = await getClientDocumentWithText(docId);
    if (!document || document.client_id !== client.id) {
      return NextResponse.json({ error: 'No such document for this brand.' }, { status: 404 });
    }

    const distilled = await distilBrandDocument({
      brandLabel: client.label,
      filename: document.filename,
      extractedText: document.extracted_text,
    });

    if (distilled.response) {
      recordUsage({
        route: 'admin/distil-document',
        provider: 'anthropic',
        session,
        clientId: client.id,
        ...anthropicUsage(distilled.response),
      });
    }

    const updated = await updateClientDocument(docId, {
      distilled_text: distilled.text,
      distilled_model: distilled.model,
      distilled_at: distilled.model ? new Date().toISOString() : null,
      distill_truncated: distilled.truncated,
    });

    return NextResponse.json({
      document: updated,
      stored: {
        distilledChars: distilled.text.length,
        truncated: distilled.truncated,
        distilled: Boolean(distilled.model),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/pulse-brands] redistil failed:', err);
    return NextResponse.json({ error: 'Could not re-distil that document.', detail: message }, { status: 500 });
  }
}
