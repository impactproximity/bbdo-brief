'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, CheckCircle2, Download, Loader2, AlertCircle } from 'lucide-react';
import type { AgencyBriefConfig, PrefillResult } from '@/lib/questions/agency';
import { AnswerCard } from './AnswerCard';
import { QuestionChatPanel } from './QuestionChatPanel';

interface AgencyReviewProps {
  briefType: string;
  clientId?: string;
  config: AgencyBriefConfig;
  corpus: string;
  initialAnswers: PrefillResult;
}

export function AgencyReview({ briefType, clientId, config, corpus, initialAnswers }: AgencyReviewProps) {
  const QUESTIONS = config.questions;
  const [answers, setAnswers] = useState<PrefillResult>(initialAnswers);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [paginationPage, setPaginationPage] = useState(0);
  const [chatOpenId, setChatOpenId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const BUTTONS_PER_PAGE = 5;
  const totalPages = Math.ceil(QUESTIONS.length / BUTTONS_PER_PAGE);
  const startIdx = paginationPage * BUTTONS_PER_PAGE;
  const endIdx = Math.min(startIdx + BUTTONS_PER_PAGE, QUESTIONS.length);
  const visibleQuestions = QUESTIONS.slice(startIdx, endIdx);

  const filledCount = useMemo(
    () => Object.values(answers).filter((a) => a && a.value && !a.missing).length,
    [answers],
  );
  const progress = (filledCount / QUESTIONS.length) * 100;

  const requiredMissing = useMemo(
    () => QUESTIONS.filter((q) => q.required && (!answers[q.id]?.value || answers[q.id]?.missing)),
    [QUESTIONS, answers],
  );

  const currentQuestion = QUESTIONS[currentIdx];
  const currentAnswer = answers[currentQuestion.id];

  const updateAnswer = (qid: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qid]: {
        value,
        confidence: prev[qid]?.confidence || 'high',
        missing: !value.trim(),
        suggestion: prev[qid]?.suggestion,
      },
    }));
  };

  const navigateTo = (idx: number) => {
    setCurrentIdx(idx);
    setPaginationPage(Math.floor(idx / BUTTONS_PER_PAGE));
    setChatOpenId(null);
  };

  const handleGenerate = async () => {
    if (requiredMissing.length > 0) {
      // Hard block — jump to the first missing required question.
      const firstMissingIdx = QUESTIONS.findIndex((q) => q.id === requiredMissing[0].id);
      if (firstMissingIdx >= 0) navigateTo(firstMissingIdx);
      return;
    }

    setIsGenerating(true);
    try {
      const responses: Record<string, string> = {};
      for (const q of QUESTIONS) {
        responses[q.id] = answers[q.id]?.value || '';
      }

      const res = await fetch('/api/generate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefType, clientId, responses, briefSource: 'agency' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || 'Generation failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.documentTitle.replace(/\s+/g, '_')}_${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Failed to generate document: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-3 md:space-y-5">
      {/* Progress */}
      <div className="w-full">
        <div className="flex justify-between items-center mb-1.5 md:mb-2">
          <span className="text-[10px] md:text-xs font-extrabold text-slate-600 uppercase tracking-widest">Brief Progress</span>
          <div className="flex items-center gap-1 md:gap-1.5">
            <span className="text-xl md:text-3xl font-extrabold text-orange-600">{filledCount}</span>
            <span className="text-sm md:text-lg text-slate-500 font-bold">/ {QUESTIONS.length}</span>
          </div>
        </div>
        <Progress value={progress} className="h-4 md:h-6 bg-slate-200/50" />
      </div>

      {/* Pagination Pills */}
      <div className="flex items-center justify-center gap-1.5 md:gap-3 py-1 md:py-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setPaginationPage((p) => Math.max(0, p - 1))}
          disabled={paginationPage === 0}
          className="h-9 w-9 md:h-12 md:w-12 p-0 rounded-full border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all"
        >
          <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
        </Button>

        <div className="flex gap-1.5 md:gap-2">
          {visibleQuestions.map((q, visibleIdx) => {
            const actualIdx = startIdx + visibleIdx;
            const ans = answers[q.id];
            const filled = ans?.value && !ans.missing;
            return (
              <Button
                key={q.id}
                size="lg"
                variant={currentIdx === actualIdx ? 'default' : filled ? 'outline' : 'ghost'}
                onClick={() => navigateTo(actualIdx)}
                className={`relative min-w-[40px] h-10 md:min-w-[52px] md:h-12 font-bold text-sm md:text-base transition-all duration-300 rounded-lg md:rounded-xl ${
                  currentIdx === actualIdx
                    ? 'bg-gradient-to-br from-slate-600 to-slate-700 shadow-xl shadow-slate-400/60 scale-110 border-2 md:border-3 border-slate-700 text-white'
                    : filled
                    ? 'border-2 md:border-3 border-green-500 text-green-700 hover:bg-green-50 shadow-md bg-green-50/30'
                    : 'border-2 border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-600'
                }`}
              >
                {filled && (
                  <CheckCircle2 className="absolute -top-1 -right-1 md:-top-1.5 md:-right-1.5 h-4 w-4 md:h-5 md:w-5 text-green-600 bg-white rounded-full shadow-lg border-2 border-white" />
                )}
                {actualIdx + 1}
              </Button>
            );
          })}
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setPaginationPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={paginationPage === totalPages - 1}
          className="h-9 w-9 md:h-12 md:w-12 p-0 rounded-full border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all"
        >
          <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
        </Button>
      </div>

      <div className="flex justify-center gap-2">
        {Array.from({ length: totalPages }).map((_, pageIdx) => (
          <button
            key={pageIdx}
            onClick={() => setPaginationPage(pageIdx)}
            className={`h-2 rounded-full transition-all duration-300 ${pageIdx === paginationPage ? 'w-8 bg-orange-600' : 'w-2 bg-slate-300 hover:bg-slate-400'}`}
            aria-label={`Go to page ${pageIdx + 1}`}
          />
        ))}
      </div>

      {/* Answer Card + Chat Panel */}
      <div className={`grid gap-4 ${chatOpenId === currentQuestion.id ? 'lg:grid-cols-[1.4fr_1fr]' : 'grid-cols-1'}`}>
        <AnswerCard
          question={currentQuestion}
          index={currentIdx}
          total={QUESTIONS.length}
          answer={currentAnswer}
          onSave={(value) => updateAnswer(currentQuestion.id, value)}
          onOpenChat={() => setChatOpenId(currentQuestion.id)}
          chatOpen={chatOpenId === currentQuestion.id}
        />
        {chatOpenId === currentQuestion.id && (
          <QuestionChatPanel
            briefType={briefType}
            clientId={clientId}
            questionId={currentQuestion.id}
            questionTitle={currentQuestion.title}
            currentAnswer={currentAnswer?.value || ''}
            corpus={corpus}
            onApplySuggestion={(text) => updateAnswer(currentQuestion.id, text)}
            onClose={() => setChatOpenId(null)}
          />
        )}
      </div>

      {/* Nav buttons */}
      <div className="flex justify-between items-center pt-3 md:pt-4 border-t-2 md:border-t-3 border-slate-200 gap-2">
        <Button
          variant="outline"
          size="lg"
          onClick={() => navigateTo(Math.max(0, currentIdx - 1))}
          disabled={currentIdx === 0}
          className="font-bold border-2 md:border-3 border-slate-400 hover:bg-slate-50 hover:border-slate-500 disabled:opacity-40 rounded-xl md:rounded-2xl px-3 md:px-6 py-4 md:py-6 shadow-md text-xs md:text-base"
        >
          <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 mr-1 md:mr-2" />
          Previous
        </Button>

        {currentIdx < QUESTIONS.length - 1 ? (
          <Button
            size="lg"
            onClick={() => navigateTo(currentIdx + 1)}
            className="bg-gradient-to-br from-slate-600 via-slate-600 to-slate-600 hover:from-slate-700 hover:via-slate-700 hover:to-slate-700 font-bold shadow-xl shadow-slate-400/50 rounded-xl md:rounded-2xl px-3 md:px-6 py-4 md:py-6 border-2 md:border-3 border-slate-700 text-white text-xs md:text-base"
          >
            Next
            <ChevronRight className="h-4 w-4 md:h-5 md:w-5 ml-1 md:ml-2" />
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={isGenerating || requiredMissing.length > 0}
            className="bg-gradient-to-br from-green-600 via-green-500 to-green-600 hover:from-green-700 hover:via-green-600 hover:to-green-700 font-bold shadow-xl shadow-green-400/50 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl md:rounded-2xl px-3 md:px-6 py-4 md:py-6 border-2 md:border-3 border-green-700 text-white text-xs md:text-base"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 md:h-5 md:w-5 mr-1 md:mr-2 animate-spin" /> : <Download className="h-4 w-4 md:h-5 md:w-5 mr-1 md:mr-2" />}
            {isGenerating ? 'Generating…' : 'Generate Brief'}
          </Button>
        )}
      </div>

      {/* Required-missing blocker on last question */}
      {currentIdx === QUESTIONS.length - 1 && requiredMissing.length > 0 && (
        <div className="mt-3 p-3 md:p-4 border-2 border-red-500 rounded-xl md:rounded-2xl shadow-md bg-gradient-to-br from-red-50 via-red-50 to-red-50">
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="font-bold text-sm md:text-base text-red-900">
              {requiredMissing.length} required question{requiredMissing.length === 1 ? '' : 's'} still need an answer
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 ml-6 md:ml-7">
            {requiredMissing.map((q) => {
              const idx = QUESTIONS.findIndex((x) => x.id === q.id);
              return (
                <button
                  key={q.id}
                  onClick={() => navigateTo(idx)}
                  className="text-[11px] md:text-xs font-semibold px-2.5 py-1 rounded-md bg-white border-2 border-red-300 text-red-700 hover:bg-red-100 hover:border-red-500 transition-colors"
                >
                  {idx + 1}. {q.title} →
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Skip to end shortcut */}
      {currentIdx < QUESTIONS.length - 1 && (
        <div className="text-center">
          <button
            onClick={() => navigateTo(QUESTIONS.length - 1)}
            className="text-xs md:text-sm text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2"
          >
            Skip to the end
          </button>
        </div>
      )}
    </div>
  );
}
