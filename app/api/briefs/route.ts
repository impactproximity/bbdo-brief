import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createBrief, listBriefs, isBriefStoreConfigured } from '@/lib/briefs/store';
import type { PrefillResult } from '@/lib/questions/agency';

// SECURITY: userId comes ONLY from the verified session cookie, never from the request.
// The store uses the service-role key, which bypasses RLS, so this is the only thing
// standing between one user and another user's brief history.

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isBriefStoreConfigured()) {
    // Supabase not provisioned yet — report empty history rather than 500ing the dashboard.
    return NextResponse.json({ briefs: [], configured: false });
  }

  try {
    const briefs = await listBriefs(session.userId);
    return NextResponse.json({ briefs, configured: true });
  } catch (err) {
    console.error('GET /api/briefs failed:', err);
    return NextResponse.json({ error: 'Failed to load briefs' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isBriefStoreConfigured()) {
    return NextResponse.json({ error: 'Brief storage is not configured.' }, { status: 503 });
  }

  let body: {
    clientId?: string;
    tier?: string;
    title?: string;
    answers?: PrefillResult;
    corpus?: string;
    voiceTranscript?: string;
    textNotes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.clientId || !body.tier) {
    return NextResponse.json({ error: 'clientId and tier are required' }, { status: 400 });
  }

  try {
    const brief = await createBrief(session.userId, session.email, {
      clientId: body.clientId,
      tier: body.tier,
      title: body.title,
      answers: body.answers,
      corpus: body.corpus,
      voiceTranscript: body.voiceTranscript,
      textNotes: body.textNotes,
    });
    return NextResponse.json({ brief }, { status: 201 });
  } catch (err) {
    console.error('POST /api/briefs failed:', err);
    return NextResponse.json({ error: 'Failed to create brief' }, { status: 500 });
  }
}
