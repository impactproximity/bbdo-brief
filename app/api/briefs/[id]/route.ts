import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  deleteBrief,
  getBrief,
  setStatus,
  updateBrief,
  isBriefStoreConfigured,
  type BriefStatus,
} from '@/lib/briefs/store';
import type { PrefillResult } from '@/lib/questions/agency';

// SECURITY: every store call below passes session.userId. A brief id alone is never
// sufficient to read or mutate a row — the service-role key bypasses RLS, so a missing
// userId filter here would expose every user's briefs to anyone who can guess an id.
// A row belonging to another user returns 404, identical to one that does not exist,
// so ids cannot be probed for existence.

const VALID_STATUSES: BriefStatus[] = ['in_progress', 'saved', 'submitted'];

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
function notConfigured() {
  return NextResponse.json({ error: 'Brief storage is not configured.' }, { status: 503 });
}
function notFound() {
  return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isBriefStoreConfigured()) return notConfigured();

  const { id } = await params;
  try {
    const brief = await getBrief(session.userId, id);
    if (!brief) return notFound();
    return NextResponse.json({ brief });
  } catch (err) {
    console.error(`GET /api/briefs/${id} failed:`, err);
    return NextResponse.json({ error: 'Failed to load brief' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isBriefStoreConfigured()) return notConfigured();

  const { id } = await params;

  let body: {
    title?: string;
    answers?: PrefillResult;
    corpus?: string;
    voiceTranscript?: string;
    textNotes?: string;
    status?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as BriefStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    let brief = null;

    // Content first, so a combined save-and-submit persists the answers before stamping.
    const hasContent =
      body.title !== undefined ||
      body.answers !== undefined ||
      body.corpus !== undefined ||
      body.voiceTranscript !== undefined ||
      body.textNotes !== undefined;

    if (hasContent) {
      brief = await updateBrief(session.userId, id, {
        title: body.title,
        answers: body.answers,
        corpus: body.corpus,
        voiceTranscript: body.voiceTranscript,
        textNotes: body.textNotes,
      });
      if (!brief) return notFound();
    }

    if (body.status !== undefined) {
      brief = await setStatus(session.userId, id, body.status as BriefStatus);
      if (!brief) return notFound();
    }

    if (!brief) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    return NextResponse.json({ brief });
  } catch (err) {
    console.error(`PATCH /api/briefs/${id} failed:`, err);
    return NextResponse.json({ error: 'Failed to update brief' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isBriefStoreConfigured()) return notConfigured();

  const { id } = await params;
  try {
    const removed = await deleteBrief(session.userId, id);
    if (!removed) return notFound();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /api/briefs/${id} failed:`, err);
    return NextResponse.json({ error: 'Failed to delete brief' }, { status: 500 });
  }
}
