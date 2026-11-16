import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  deleteClientDocument,
  getClientDocumentWithText,
  getPulseClientByBrandId,
  isPulseStoreConfigured,
  updateClientDocument,
} from '@/lib/clients/pulse-store';

export const runtime = 'nodejs';

/**
 * PATCH/DELETE /api/admin/pulse-brands/{brandId}/documents/{docId}
 *
 * PATCH is the review step: the admin edits the distillation, and ticks `isIncluded` to let it
 * start reaching prompts. Until that tick the document contributes nothing (db/supabase/0008).
 *
 * Both verbs check the document actually belongs to this brand. The ids are uuids rather than
 * guessable integers, but an admin route is no reason to skip the check — a mistyped id would
 * otherwise edit another brand's context, and the resulting wrongness would be silent and
 * would only ever surface inside a brief.
 */

const MAX_DISTILLED_CHARS = 30_000;

async function resolveDocument(brandId: string, docId: string) {
  const client = await getPulseClientByBrandId(brandId);
  if (!client) {
    return { error: NextResponse.json({ error: 'That brand is not onboarded.' }, { status: 404 }) };
  }
  const document = await getClientDocumentWithText(docId);
  if (!document || document.client_id !== client.id) {
    // Same 404 for "no such document" and "belongs to another brand" — distinguishing them
    // would confirm the existence of a row the caller addressed by guess.
    return { error: NextResponse.json({ error: 'No such document for this brand.' }, { status: 404 }) };
  }
  return { client, document };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ brandId: string; docId: string }> },
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!isPulseStoreConfigured()) {
    return NextResponse.json({ error: 'The synced client store is not configured.' }, { status: 503 });
  }

  const { brandId, docId } = await params;

  let body: { distilledText?: unknown; isIncluded?: unknown };
  try {
    body = (await req.json()) as { distilledText?: unknown; isIncluded?: unknown };
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const patch: { distilled_text?: string; is_included?: boolean } = {};

  if (body.distilledText !== undefined) {
    if (typeof body.distilledText !== 'string') {
      return NextResponse.json({ error: '"distilledText" must be a string.' }, { status: 400 });
    }
    if (body.distilledText.length > MAX_DISTILLED_CHARS) {
      return NextResponse.json(
        { error: `"distilledText" is longer than ${MAX_DISTILLED_CHARS} characters.` },
        { status: 400 },
      );
    }
    patch.distilled_text = body.distilledText;
  }

  if (body.isIncluded !== undefined) {
    if (typeof body.isIncluded !== 'boolean') {
      return NextResponse.json({ error: '"isIncluded" must be a boolean.' }, { status: 400 });
    }
    patch.is_included = body.isIncluded;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    const resolved = await resolveDocument(brandId, docId);
    if ('error' in resolved) return resolved.error;

    // Including a document whose distillation is empty would emit a filename heading with
    // nothing under it. Refused here rather than silently dropped at compose time, so the
    // admin learns why the tick did not take.
    const nextText = patch.distilled_text ?? resolved.document.distilled_text;
    if (patch.is_included === true && !nextText.trim()) {
      return NextResponse.json(
        { error: 'This document has no distilled text, so there is nothing to include.' },
        { status: 400 },
      );
    }

    const document = await updateClientDocument(docId, patch);
    if (!document) return NextResponse.json({ error: 'No such document for this brand.' }, { status: 404 });
    return NextResponse.json({ document });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/pulse-brands] document update failed:', err);
    return NextResponse.json({ error: 'Could not update that document.', detail: message }, { status: 500 });
  }
}

export async function DELETE(
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
    const resolved = await resolveDocument(brandId, docId);
    if ('error' in resolved) return resolved.error;

    const deleted = await deleteClientDocument(docId);
    if (!deleted) return NextResponse.json({ error: 'No such document for this brand.' }, { status: 404 });
    return NextResponse.json({ deleted: true, id: docId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/pulse-brands] document delete failed:', err);
    return NextResponse.json({ error: 'Could not delete that document.', detail: message }, { status: 500 });
  }
}
