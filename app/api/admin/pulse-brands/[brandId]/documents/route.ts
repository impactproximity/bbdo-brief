import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, resolveFileKind } from '@/lib/uploads/supported-files';
import { extractText } from '@/lib/uploads/extract-text';
import { distilBrandDocument } from '@/lib/pulse/distil';
import { anthropicUsage, recordUsage } from '@/lib/usage/record';
import {
  getPulseClientByBrandId,
  insertClientDocument,
  isPulseStoreConfigured,
  listClientDocuments,
} from '@/lib/clients/pulse-store';

export const runtime = 'nodejs';
// The distillation is the slow part: a long brand toolkit is a real model call over up to
// 150k characters. 300s matches app/api/v1/briefs, the other route in this app that waits on
// a model rather than a database.
export const maxDuration = 300;

/**
 * GET/POST /api/admin/pulse-brands/{brandId}/documents — brand documents for a synced client.
 *
 * POST does three things in sequence: extract the text, distil it into brand context, store
 * both. All three are reused rather than reinvented — lib/uploads/supported-files.ts for
 * validation, lib/uploads/extract-text.ts for the four parsers, lib/pulse/distil.ts for the
 * model call. There is deliberately no second parser and no second size constant anywhere in
 * this feature.
 *
 * THE ROW IS WRITTEN WITH is_included = false, ALWAYS. A distillation is model-written text
 * about to become always-on brand context for every brief this client raises, so it reaches no
 * prompt until an admin has read it and ticked it. Writing the row immediately means the paid
 * distillation survives the admin closing the tab; the flag means it cannot leak into a brief
 * before anyone has looked at it. insertClientDocument() does not accept is_included as an
 * argument, so this cannot be undone by a careless caller.
 */

// Multipart framing plus the filename and field headers. Same allowance and same reasoning as
// app/api/parse-document/route.ts.
const MULTIPART_OVERHEAD_ALLOWANCE = 1024 * 1024;

export async function GET(_req: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!isPulseStoreConfigured()) {
    return NextResponse.json({ error: 'The synced client store is not configured.' }, { status: 503 });
  }

  const { brandId } = await params;

  try {
    const client = await getPulseClientByBrandId(brandId);
    if (!client) return NextResponse.json({ error: 'That brand is not onboarded.' }, { status: 404 });
    return NextResponse.json({ documents: await listClientDocuments(client.id) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/pulse-brands] document list failed:', err);
    return NextResponse.json({ error: 'Could not load documents.', detail: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!isPulseStoreConfigured()) {
    return NextResponse.json({ error: 'The synced client store is not configured.' }, { status: 503 });
  }

  const { brandId } = await params;

  // BEFORE reading the body, and that order is load-bearing. proxy.ts runs on /api/*, so Next
  // buffers the request body to allow a second read; past next.config.ts's 20 MB ceiling the
  // body arrives truncated and formData() throws an opaque parse error instead of anything a
  // user could act on. Same pre-check, same reason, as app/api/parse-document/route.ts.
  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_ALLOWANCE) {
    return NextResponse.json({ error: `File size exceeds ${MAX_UPLOAD_LABEL} limit.` }, { status: 413 });
  }

  try {
    const client = await getPulseClientByBrandId(brandId);
    if (!client) return NextResponse.json({ error: 'That brand is not onboarded.' }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `File size exceeds ${MAX_UPLOAD_LABEL} limit.` }, { status: 400 });
    }

    // Extension wins over MIME inside the resolver — .csv is routinely reported as an Excel
    // type — and legacy .doc/.xls come back with re-save advice rather than a bare rejection.
    const resolved = resolveFileKind(file.name ?? '', file.type);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    let extracted: string;
    try {
      extracted = await extractText(buffer, resolved.kind);
    } catch (err) {
      // extractText has no error handling of its own by design — it throws whatever the parser
      // throws. A password-protected or malformed PDF lands here, and that is the admin's
      // problem to fix, so unlike /api/parse-document (which swallows the parser message) the
      // detail is passed through to the one person who can act on it.
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Could not read ${file.name}.`, detail: message },
        { status: 422 },
      );
    }

    if (!extracted.trim()) {
      // A real and common outcome for a scanned PDF: the parse succeeds and yields nothing,
      // because the pages are images. Said plainly, because "it worked but produced nothing"
      // is otherwise indistinguishable from a bug.
      return NextResponse.json(
        {
          error: `No text could be read from ${file.name}.`,
          detail:
            'The file parsed but contained no text. A scanned or image-only PDF has no text layer — ' +
            'there is no OCR here, so it would need re-exporting from its source.',
        },
        { status: 422 },
      );
    }

    const distilled = await distilBrandDocument({
      brandLabel: client.label,
      filename: file.name,
      extractedText: extracted,
    });

    // Metered only when a model call actually happened. `response` is null on the mock path,
    // which is how a keyless environment records nothing — the same placement as the mock
    // short-circuit in app/api/agency/prefill/route.ts.
    if (distilled.response) {
      recordUsage({
        route: 'admin/distil-document',
        provider: 'anthropic',
        session,
        clientId: client.id,
        ...anthropicUsage(distilled.response),
      });
    }

    const document = await insertClientDocument({
      client_id: client.id,
      filename: file.name,
      kind: resolved.kind,
      byte_size: file.size,
      extracted_text: extracted,
      extracted_chars: extracted.length,
      distilled_text: distilled.text,
      distilled_model: distilled.model,
      distilled_at: distilled.model ? new Date().toISOString() : null,
      distill_truncated: distilled.truncated,
      uploaded_by_email: session.email,
    });

    return NextResponse.json({
      document,
      // So the UI can say what actually landed rather than just "done" — the same reasoning as
      // the `stored` block on the onboard route.
      stored: {
        extractedChars: extracted.length,
        distilledChars: distilled.text.length,
        truncated: distilled.truncated,
        distilled: Boolean(distilled.model),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/pulse-brands] document upload failed:', err);
    return NextResponse.json({ error: 'Could not add that document.', detail: message }, { status: 500 });
  }
}
