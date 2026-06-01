'use client';

import React, { useState, use, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { getAgencyBriefConfig, type PrefillResult } from '@/lib/questions/agency';
import { getClientConfig } from '@/lib/clients';
import { AgencyIntake } from '@/components/agency/AgencyIntake';
import { AgencyReview } from '@/components/agency/AgencyReview';

type Step = 'intake' | 'review';

function AgencyBriefInner({ tier }: { tier: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get('client') ?? undefined;
  const clientConfig = clientId ? getClientConfig(clientId) : undefined;
  const config = getAgencyBriefConfig(tier);

  const [step, setStep] = useState<Step>('intake');
  const [corpus, setCorpus] = useState('');
  const [answers, setAnswers] = useState<PrefillResult>({});

  // A brief must be reached with a valid client; otherwise send the user back to pick one.
  useEffect(() => {
    if (!config || !clientConfig) router.replace('/agency');
  }, [config, clientConfig, router]);

  if (!config || !clientConfig) return null;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start p-4 md:p-8 lg:p-16" style={{ backgroundColor: '#d9d8d8' }}>
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 mb-6 md:mb-8 z-10">
        <Image src="/impact-bbdo-logo.png" alt="IMPACT BBDO" width={464} height={67} priority className="h-[22px] md:h-[34px] w-auto" />
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
            <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-400">
              <div className="h-6 w-6 md:h-7 md:w-7 rounded-full flex items-center justify-center text-white text-xs bg-slate-300">3</div>
              Generate
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 md:p-8 bg-white">
          {step === 'intake' ? (
            <AgencyIntake
              briefType={tier}
              clientId={clientId}
              documentTitle={config.documentTitle}
              onPrefillComplete={({ corpus: c, answers: a }) => {
                setCorpus(c);
                setAnswers(a);
                setStep('review');
              }}
              onSkip={() => {
                setCorpus('');
                setAnswers({});
                setStep('review');
              }}
            />
          ) : (
            <AgencyReview briefType={tier} clientId={clientId} config={config} corpus={corpus} initialAnswers={answers} />
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
