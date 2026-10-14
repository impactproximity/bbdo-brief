import { NextResponse } from 'next/server';
import { getAgencyBriefConfig, type PrefillResult } from '@/lib/questions/agency';
import { generateBriefAnswers } from '@/lib/briefs/generate';
import { getSession } from '@/lib/auth';
import { anthropicUsage, recordUsage } from '@/lib/usage/record';

export async function POST(req: Request) {
  try {
    const { briefType, clientId, corpus, voiceTranscript, textNotes } = await req.json();

    const config = getAgencyBriefConfig(briefType);
    if (!config) {
      return NextResponse.json({ error: `Unknown agency brief type: ${briefType}` }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      // Mock response so the UI is testable without a key.
      const answers: PrefillResult = {};
      for (const q of config.questions) {
        answers[q.id] = {
          value: `[mock] No ANTHROPIC_API_KEY configured. ${q.title} would be drafted from the uploaded corpus.`,
          confidence: 'low',
          missing: true,
          suggestion: 'Add ANTHROPIC_API_KEY to enable real pre-fill.',
        };
      }
      return NextResponse.json({ answers });
    }

    // Prompt assembly and the model call live in lib/briefs/generate.ts, shared with the
    // public API so the two surfaces cannot drift. Everything below — session, metering,
    // the mock short-circuit above — stays owned by this route.
    const { answers, response } = await generateBriefAnswers({
      config,
      clientId,
      corpus,
      voiceTranscript,
      textNotes,
    });

    // Meter the call. Deliberately placed AFTER the mock short-circuit above, so a run
    // without an API key — which never reaches the model — records no cost.
    //
    // No brief_id: prefill runs before the brief row is created (see the brief page, where
    // "briefId is null until the row exists"), so this spend is attributed to
    // user x client x tier instead. That is the one dimension this report cannot give you.
    recordUsage({
      route: 'agency/prefill',
      provider: 'anthropic',
      session: await getSession(),
      clientId: clientId ?? null,
      tier: briefType ?? null,
      ...anthropicUsage(response),
    });

    if (!answers) {
      return NextResponse.json({ error: 'Model did not return structured answers.' }, { status: 502 });
    }

    return NextResponse.json({ answers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Agency prefill error:', error);
    return NextResponse.json({ error: 'Prefill failed', detail: message }, { status: 500 });
  }
}
