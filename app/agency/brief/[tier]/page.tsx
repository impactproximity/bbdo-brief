'use client';

import React, { useState, use, useEffect, useRef, useCallback, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { getAgencyBriefConfig, isBriefTypeAllowedForClient, type PrefillResult } from '@/lib/questions/agency';
import { getClientConfig } from '@/lib/clients';
import { AgencyIntake } from '@/components/agency/AgencyIntake';
import { AgencyReview, type SaveState } from '@/components/agency/AgencyReview';
import type { BriefStatus } from '@/lib/briefs/store';

type Step = 'intake' | 'review';

const AUTOSAVE_DEBOUNCE_MS = 2000;

/** questions[0].id is always brief_name and always required, so this is a reliable title. */
function deriveTitle(answers: PrefillResult, firstQuestionId: string | undefined): string {
  const raw = firstQuestionId ? answers[firstQuestionId]?.value : '';
  return (raw || '').trim().slice(0, 200) || 'Untitled brief';
}

function AgencyBriefInner({ tier }: { tier: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get('client') ?? undefined;
  const resumeId = searchParams.get('brief') ?? undefined;
  const clientConfig = clientId ? getClientConfig(clientId) : undefined;
  const config = getAgencyBriefConfig(tier);
  // The tier must also be one this client is actually scoped to raise.
  const tierAllowed = isBriefTypeAllowedForClient(tier, clientId);

  const [step, setStep] = useState<Step>('intake');
  const [corpus, setCorpus] = useState('');
  const [answers, setAnswers] = useState<PrefillResult>({});
  // voiceTranscript / textNotes are not held in state: nothing renders them, and the
  // PATCH helper only writes fields it is given, so omitting them preserves the stored
  // values. They are passed straight through to the create call below — previously they
  // were destructured away at this boundary and lost entirely.

  // Persistence state. briefId is null until the row exists (created on prefill, or
  // loaded on resume). Everything below degrades quietly if storage is unavailable —
  // losing autosave must never block someone from finishing a brief.
  const [briefId, setBriefId] = useState<string | null>(null);
  const [status, setStatus] = useState<BriefStatus>('in_progress');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [isResuming, setIsResuming] = useState(Boolean(resumeId));

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const briefIdRef = useRef<string | null>(null);
  briefIdRef.current = briefId;

  // A brief must be reached with a valid client AND a tier that client is scoped to;
  // otherwise send the user back to pick one. Resume runs only after this passes, so a
  // brief whose tier is no longer allowed for its client bounces instead of half-rendering.
  useEffect(() => {
    if (!config || !clientConfig || !tierAllowed) router.replace('/agency');
  }, [config, clientConfig, tierAllowed, router]);

  // Resume an existing brief from ?brief=<id>.
  useEffect(() => {
    if (!resumeId || !config || !clientConfig || !tierAllowed) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/briefs/${resumeId}`);
        if (!res.ok) throw new Error(`Could not load brief (${res.status})`);
        const { brief } = await res.json();
        if (cancelled || !brief) return;
        setBriefId(brief.id);
        setStatus(brief.status);
        setAnswers(brief.answers ?? {});
        setCorpus(brief.corpus ?? '');
        setStep('review');
      } catch (err) {
        console.error('Failed to resume brief:', err);
        if (!cancelled) router.replace('/agency/briefs');
      } finally {
        if (!cancelled) setIsResuming(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resumeId, config, clientConfig, tierAllowed, router]);

  // Clear any pending autosave on unmount so it cannot fire against a stale brief.
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  const persist = useCallback(
    async (body: Record<string, unknown>) => {
      const id = briefIdRef.current;
      if (!id) return;
      setSaveState('saving');
      try {
        const res = await fetch(`/api/briefs/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`PATCH failed (${res.status})`);
        const { brief } = await res.json();
        if (brief?.status) setStatus(brief.status);
        setSaveState('saved');
      } catch (err) {
        console.error('Failed to save brief:', err);
        setSaveState('error');
      }
    },
    [],
  );

  // Debounced autosave, driven by actual edits rather than a state effect — that way
  // the row created at prefill time is not immediately re-saved with identical content.
  const scheduleAutosave = useCallback(
    (next: PrefillResult) => {
      setAnswers(next);
      if (!briefIdRef.current) return;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        // corpus is deliberately omitted: it never changes after intake and is the large field.
        void persist({ answers: next, title: deriveTitle(next, config?.questions[0]?.id) });
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [persist, config],
  );

  const handleSaveDraft = useCallback(async () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    await persist({
      answers,
      title: deriveTitle(answers, config?.questions[0]?.id),
      status: 'saved',
    });
  }, [persist, answers, config]);

  const handleGenerated = useCallback(async () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    await persist({
      answers,
      title: deriveTitle(answers, config?.questions[0]?.id),
      status: 'submitted',
    });
  }, [persist, answers, config]);

  // Create the row once the prefill lands. A failure here is logged but not surfaced —
  // the user keeps working, just without history for this brief.
  const createBriefRow = useCallback(
    async (payload: {
      answers: PrefillResult;
      corpus: string;
      voiceTranscript: string;
      textNotes: string;
    }) => {
      if (!clientId || !config) return;
      try {
        const res = await fetch('/api/briefs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            tier,
            title: deriveTitle(payload.answers, config.questions[0]?.id),
            answers: payload.answers,
            corpus: payload.corpus,
            voiceTranscript: payload.voiceTranscript,
            textNotes: payload.textNotes,
          }),
        });
        if (!res.ok) throw new Error(`POST /api/briefs failed (${res.status})`);
        const { brief } = await res.json();
        setBriefId(brief.id);
        setStatus(brief.status);
        setSaveState('saved');
      } catch (err) {
        console.error('Brief history unavailable for this session:', err);
      }
    },
    [clientId, tier, config],
  );

  if (!config || !clientConfig || !tierAllowed) return null;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start p-4 md:p-8 lg:p-16" style={{ backgroundColor: '#d9d8d8' }}>
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 mb-6 md:mb-8 z-10">
        <Image src="/impact-bbdo-logo.png" alt="IMPACT BBDO" width={315} height={131} priority className="h-[34px] md:h-[52px] w-auto" />
        <div className="flex items-center gap-2 md:gap-3">
          <div className="h-8 md:h-10 w-px bg-slate-400"></div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <p className="text-xs md:text-sm text-slate-700 font-bold tracking-wide">Powered by</p>
            <Image src="/impact-logo.svg" alt="ImpactProximity Logo" width={100} height={24} priority className="drop-shadow-sm w-[70px] md:w-[100px] h-auto" />
          </div>
        </div>
      </div>

      <Card className="w-full max-w-6xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border-2 md:border-3 border-slate-300 overflow-hidden rounded-2xl md:rounded-3xl">
        <CardHeader className="text-center border-b-2 md:border-b-3 border-slate-300 bg-white pb-4 md:pb-6 pt-5 md:pt-8 px-4">
          <div className="flex items-center justify-center gap-3 mb-2 md:mb-3">
            <Link href="/agency">
              <Button variant="ghost" size="sm" className="rounded-full border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-100 text-xs md:text-sm">
                <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1" />
                Back
              </Button>
            </Link>
          </div>
          <p className="text-[11px] md:text-sm font-bold uppercase tracking-wider text-orange-600 mb-1">
            {clientConfig.label}
          </p>
          <CardTitle className="text-xl md:text-4xl font-bold text-slate-800 mb-1.5 md:mb-3">
            {config.documentTitle}
          </CardTitle>
          <CardDescription className="text-xs md:text-lg text-slate-600 max-w-2xl mx-auto font-medium">
            {step === 'intake' ? 'Upload your materials. We’ll draft answers from them.' : 'Review and refine each answer. Use the chat to push for sharper thinking.'}
          </CardDescription>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 md:gap-3 mt-3 md:mt-5">
            <div className={`flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold uppercase tracking-wider ${step === 'intake' ? 'text-orange-600' : 'text-green-600'}`}>
              <div className={`h-6 w-6 md:h-7 md:w-7 rounded-full flex items-center justify-center text-white text-xs ${step === 'intake' ? 'bg-orange-500' : 'bg-green-500'}`}>1</div>
              Intake
            </div>
            <div className="h-px w-8 md:w-12 bg-slate-300"></div>
            <div className={`flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold uppercase tracking-wider ${step === 'review' ? 'text-orange-600' : 'text-slate-400'}`}>
              <div className={`h-6 w-6 md:h-7 md:w-7 rounded-full flex items-center justify-center text-white text-xs ${step === 'review' ? 'bg-orange-500' : 'bg-slate-300'}`}>2</div>
              Review & Refine
            </div>
            <div className="h-px w-8 md:w-12 bg-slate-300"></div>
            <div
              className={`flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold uppercase tracking-wider ${
                status === 'submitted' ? 'text-green-600' : status === 'saved' ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              <div
                className={`h-6 w-6 md:h-7 md:w-7 rounded-full flex items-center justify-center text-white text-xs ${
                  status === 'submitted' ? 'bg-green-500' : status === 'saved' ? 'bg-blue-500' : 'bg-slate-300'
                }`}
              >
                3
              </div>
              {status === 'submitted' ? 'Submitted' : status === 'saved' ? 'Saved' : 'Generate'}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 md:p-8 bg-white">
          {isResuming ? (
            <p className="py-10 text-center text-sm md:text-base text-slate-500 font-medium">Loading your brief…</p>
          ) : step === 'intake' ? (
            <AgencyIntake
              briefType={tier}
              clientId={clientId}
              documentTitle={config.documentTitle}
              onPrefillComplete={({ corpus: c, answers: a, voiceTranscript: v, textNotes: n }) => {
                setCorpus(c);
                setAnswers(a);
                setStep('review');
                void createBriefRow({ answers: a, corpus: c, voiceTranscript: v, textNotes: n });
              }}
              onSkip={() => {
                setCorpus('');
                setAnswers({});
                setStep('review');
                void createBriefRow({ answers: {}, corpus: '', voiceTranscript: '', textNotes: '' });
              }}
            />
          ) : (
            <AgencyReview
              briefType={tier}
              clientId={clientId}
              briefId={briefId}
              config={config}
              corpus={corpus}
              initialAnswers={answers}
              onAnswersChange={scheduleAutosave}
              onSaveDraft={briefId ? handleSaveDraft : undefined}
              onGenerated={handleGenerated}
              saveState={saveState}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export default function AgencyBriefPage({ params }: { params: Promise<{ tier: string }> }) {
  const { tier } = use(params);
  return (
    <Suspense fallback={null}>
      <AgencyBriefInner tier={tier} />
    </Suspense>
  );
}
