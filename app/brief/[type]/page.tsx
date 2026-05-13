'use client';

import React, { useState, use, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { DocumentUploader } from '@/components/DocumentUploader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, ChevronLeft, ChevronRight, CheckCircle2, ArrowLeft, Pencil, X } from 'lucide-react';
import { getBriefConfig, QuestionResponse } from '@/lib/questions';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';

export default function BriefPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = use(params);
  const briefConfig = getBriefConfig(type);
  const router = useRouter();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputMode, setInputMode] = useState<'voice' | 'upload'>('voice');
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [paginationPage, setPaginationPage] = useState(0);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    if (!briefConfig) {
      router.replace('/');
    }
  }, []);

  if (!briefConfig) return null;

  const QUESTIONS = briefConfig.questions;

  const currentQuestion = QUESTIONS[currentQuestionIndex];
  const currentResponse = responses[currentQuestion.id];
  const progress = (Object.keys(responses).length / QUESTIONS.length) * 100;
  const allQuestionsAnswered = Object.keys(responses).length === QUESTIONS.length;
  const canGenerateDocument = !!responses[QUESTIONS[0]?.id];

  // Pagination logic - show 5 buttons at a time
  const BUTTONS_PER_PAGE = 5;
  const totalPages = Math.ceil(QUESTIONS.length / BUTTONS_PER_PAGE);
  const startIdx = paginationPage * BUTTONS_PER_PAGE;
  const endIdx = Math.min(startIdx + BUTTONS_PER_PAGE, QUESTIONS.length);
  const visibleQuestions = QUESTIONS.slice(startIdx, endIdx);

  const handleAudioRecording = async (audioBlob: Blob) => {
    setIsProcessing(true);

    try {
      // 1. Transcribe Audio
      const formData = new FormData();
      formData.append('file', audioBlob);

      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!transcribeRes.ok) throw new Error('Transcription failed');

      const { text } = await transcribeRes.json();

      // 2. Get LLM enhanced response
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionTitle: currentQuestion.title,
          userResponse: text,
        }),
      });

      if (!chatRes.ok) throw new Error('Enhancement failed');

      const data = await chatRes.json();

      // 3. Save response
      setResponses(prev => ({
        ...prev,
        [currentQuestion.id]: {
          questionId: currentQuestion.id,
          userInput: text,
          enhancedResponse: data.enhancedResponse,
        }
      }));

} catch (error) {
      console.error('Error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateDocument = async () => {
    setIsGeneratingDoc(true);

    try {
      // Build responses object dynamically from question IDs
      const docResponses: Record<string, string> = {};
      for (const q of QUESTIONS) {
        docResponses[q.id] = responses[q.id]?.enhancedResponse || '';
      }

      const response = await fetch('/api/generate-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefType: type,
          responses: docResponses,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Document generation failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${briefConfig.documentTitle.replace(/\s+/g, '_')}_${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Document generation error:', error);
      alert(`Failed to generate document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingDoc(false);
    }
  };

  const navigateToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    const newPage = Math.floor(index / BUTTONS_PER_PAGE);
    setPaginationPage(newPage);
    setInputMode('voice');
  };

  const handleDocumentUpload = (userInput: string, enhancedResponse: string) => {
    setResponses(prev => ({
      ...prev,
      [currentQuestion.id]: {
        questionId: currentQuestion.id,
        userInput,
        enhancedResponse,
      }
    }));
  };

  const handlePaginationPrev = () => {
    if (paginationPage > 0) {
      setPaginationPage(paginationPage - 1);
    }
  };

  const handlePaginationNext = () => {
    if (paginationPage < totalPages - 1) {
      setPaginationPage(paginationPage + 1);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 md:p-8 lg:p-24" style={{ backgroundColor: '#d9d8d8' }}>
      {/* Logos centered above the card */}
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 mb-6 md:mb-8 z-10">
        <div className="flex items-center gap-3 md:gap-6">
          <Image
            src="/shamal-logo.svg"
            alt="Shamal Logo"
            width={160}
            height={44}
            priority
            className="drop-shadow-md w-[100px] md:w-[160px] h-auto"
          />
          <span className="drop-shadow-md text-[22px] md:text-[34px] leading-none tracking-tight" style={{ fontFamily: 'sans-serif' }}>
            <span className="font-bold text-black">Omnicom</span><span className="font-normal text-black">Group</span>
          </span>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="h-8 md:h-10 w-px bg-slate-400"></div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <p className="text-xs md:text-sm text-slate-700 font-bold tracking-wide">
              Powered by
            </p>
            <Image
              src="/impact-logo.svg"
              alt="ImpactProximity Logo"
              width={100}
              height={24}
              priority
              className="drop-shadow-sm w-[70px] md:w-[100px] h-auto"
            />
          </div>
        </div>
      </div>

      <Card className="w-full max-w-6xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border-2 md:border-3 border-slate-300 overflow-hidden rounded-2xl md:rounded-3xl">
        <CardHeader className="text-center border-b-2 md:border-b-3 border-slate-300 bg-white pb-4 md:pb-6 pt-5 md:pt-8 px-4">
          <div className="flex items-center justify-center gap-3 mb-2 md:mb-3">
            <Link href="/shamal">
              <Button variant="ghost" size="sm" className="rounded-full border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-100 text-xs md:text-sm">
                <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1" />
                Back
              </Button>
            </Link>
          </div>
          <CardTitle className="text-xl md:text-4xl font-bold text-slate-800 mb-1.5 md:mb-3">
            {briefConfig.documentTitle}
          </CardTitle>
          <CardDescription className="text-xs md:text-lg text-slate-600 max-w-2xl mx-auto font-medium">
            Answer questions with your voice to create a professional brief document
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 md:space-y-5 p-3 md:p-8 bg-white">
          {/* Progress Bar & Question Navigation Combined */}
          <div className="space-y-2 md:space-y-3">
            {/* Progress Section */}
            <div className="w-full">
              <div className="flex justify-between items-center mb-1.5 md:mb-2">
                <span className="text-[10px] md:text-xs font-extrabold text-slate-600 uppercase tracking-widest">Your Progress</span>
                <div className="flex items-center gap-1 md:gap-1.5">
                  <span className="text-xl md:text-3xl font-extrabold text-orange-600">{Object.keys(responses).length}</span>
                  <span className="text-sm md:text-lg text-slate-500 font-bold">/ {QUESTIONS.length}</span>
                </div>
              </div>
              <Progress value={progress} className="h-4 md:h-6 bg-slate-200/50" />
            </div>

            {/* Question Navigation Pills with Pagination */}
            <div className="flex items-center justify-center gap-1.5 md:gap-3 py-1 md:py-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handlePaginationPrev}
                disabled={paginationPage === 0}
                className="h-9 w-9 md:h-12 md:w-12 p-0 rounded-full border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
              </Button>

              <div className="flex gap-1.5 md:gap-2">
                {visibleQuestions.map((q, visibleIdx) => {
                  const actualIdx = startIdx + visibleIdx;
                  return (
                    <Button
                      key={q.id}
                      size="lg"
                      variant={currentQuestionIndex === actualIdx ? "default" : responses[q.id] ? "outline" : "ghost"}
                      onClick={() => navigateToQuestion(actualIdx)}
                      className={`relative min-w-[40px] h-10 md:min-w-[52px] md:h-12 font-bold text-sm md:text-base transition-all duration-300 rounded-lg md:rounded-xl ${
                        currentQuestionIndex === actualIdx
                          ? 'bg-gradient-to-br from-slate-600 to-slate-700 shadow-xl shadow-slate-400/60 scale-110 border-2 md:border-3 border-slate-700 text-white'
                          : responses[q.id]
                          ? 'border-2 md:border-3 border-green-500 text-green-700 hover:bg-green-50 shadow-md bg-green-50/30'
                          : 'border-2 border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-600'
                      }`}
                    >
                      {responses[q.id] && (
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
                onClick={handlePaginationNext}
                disabled={paginationPage === totalPages - 1}
                className="h-9 w-9 md:h-12 md:w-12 p-0 rounded-full border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all"
              >
                <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </div>

            {/* Pagination Indicator Dots */}
            <div className="flex justify-center gap-2">
              {Array.from({ length: totalPages }).map((_, pageIdx) => (
                <button
                  key={pageIdx}
                  onClick={() => setPaginationPage(pageIdx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    pageIdx === paginationPage
                      ? 'w-8 bg-orange-600'
                      : 'w-2 bg-slate-300 hover:bg-slate-400'
                  }`}
                  aria-label={`Go to page ${pageIdx + 1}`}
                />
              ))}
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
          </div>

          {/* Current Question Card */}
          <div className="bg-gradient-to-br from-slate-100 via-slate-100 to-slate-100 border-2 md:border-3 border-slate-500 rounded-2xl md:rounded-3xl p-4 md:p-8 space-y-3 md:space-y-4 shadow-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="inline-block px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-slate-600 to-slate-600 text-white text-[10px] md:text-xs font-extrabold rounded-xl md:rounded-2xl mb-2 md:mb-3 uppercase tracking-wider shadow-lg">
                  Question {currentQuestionIndex + 1} of {QUESTIONS.length}
                </div>
                <h3 className="text-lg md:text-3xl font-extrabold text-slate-900 mb-2 md:mb-3 leading-tight">
                  {currentQuestion.title}
                </h3>
                <p className="text-slate-700 text-xs md:text-base bg-white p-2.5 md:p-3 rounded-xl md:rounded-2xl border-2 border-slate-300 italic font-medium shadow-sm">
                  {currentQuestion.placeholder}
                </p>
              </div>
            </div>

            {/* Show Response if exists */}
            {currentResponse && (
              <div className="mt-3 md:mt-4 p-3 md:p-6 bg-white rounded-xl md:rounded-2xl border-2 md:border-3 border-slate-300 shadow-md space-y-3 md:space-y-4">
                <div>
                  <div className="text-[10px] md:text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-1.5 md:mb-2">Your Response</div>
                  <p className="text-slate-800 italic text-xs md:text-base bg-slate-50 p-2.5 md:p-3 rounded-lg md:rounded-xl border-2 border-slate-200 font-medium">
                    &quot;{currentResponse.userInput}&quot;
                  </p>
                </div>

                <div className="pt-2 md:pt-3 border-t-2 border-slate-200">
                  <div className="flex items-center justify-between mb-1.5 md:mb-2">
                    <div className="text-[10px] md:text-xs font-extrabold text-slate-900 uppercase tracking-wider">Enhanced Version</div>
                    {editingQuestionId !== currentQuestion.id && (
                      <button
                        onClick={() => { setEditingQuestionId(currentQuestion.id); setEditingValue(currentResponse.enhancedResponse); }}
                        className="flex items-center gap-1 text-[10px] md:text-xs text-slate-500 hover:text-slate-800 font-semibold"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    )}
                  </div>

                  {editingQuestionId === currentQuestion.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="text-xs md:text-base text-slate-900 font-medium min-h-[80px] border-2 border-orange-400 focus:border-orange-500"
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingQuestionId(null)}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-semibold px-2 py-1"
                        >
                          <X className="h-3 w-3" /> Cancel
                        </button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setResponses(prev => ({
                              ...prev,
                              [currentQuestion.id]: { ...prev[currentQuestion.id], enhancedResponse: editingValue },
                            }));
                            setEditingQuestionId(null);
                          }}
                          className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 h-auto"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-900 leading-relaxed text-xs md:text-base font-medium">{currentResponse.enhancedResponse}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 md:gap-2 pt-1.5 md:pt-2 text-xs md:text-sm text-green-600 font-bold">
                  <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5" />
                  <span>Saved Successfully</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area: Voice or Upload */}
          <div className="flex flex-col items-center py-2 md:py-4 gap-3">
            {currentQuestion.allowUpload && (
              <div className="flex rounded-xl border-2 border-slate-300 overflow-hidden shadow-sm">
                <button
                  onClick={() => setInputMode('voice')}
                  disabled={isProcessing}
                  className={`px-4 py-2 text-xs md:text-sm font-bold transition-colors ${
                    inputMode === 'voice'
                      ? 'bg-slate-700 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Voice
                </button>
                <button
                  onClick={() => setInputMode('upload')}
                  disabled={isProcessing}
                  className={`px-4 py-2 text-xs md:text-sm font-bold transition-colors ${
                    inputMode === 'upload'
                      ? 'bg-slate-700 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Upload Document
                </button>
              </div>
            )}

            {inputMode === 'voice' ? (
              <VoiceRecorder
                onRecordingComplete={handleAudioRecording}
                isProcessing={isProcessing}
              />
            ) : (
              <DocumentUploader
                onUploadComplete={handleDocumentUpload}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
                questionTitle={currentQuestion.title}
              />
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center pt-3 md:pt-4 border-t-2 md:border-t-3 border-slate-200 gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigateToQuestion(currentQuestionIndex - 1)}
              disabled={currentQuestionIndex === 0}
              className="font-bold border-2 md:border-3 border-slate-400 hover:bg-slate-50 hover:border-slate-500 disabled:opacity-40 rounded-xl md:rounded-2xl px-3 md:px-6 py-4 md:py-6 shadow-md text-xs md:text-base"
            >
              <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 mr-1 md:mr-2" />
              Previous
            </Button>

            {currentQuestionIndex < QUESTIONS.length - 1 ? (
              <Button
                size="lg"
                onClick={() => navigateToQuestion(currentQuestionIndex + 1)}
                className="bg-gradient-to-br from-slate-600 via-slate-600 to-slate-600 hover:from-slate-700 hover:via-slate-700 hover:to-slate-700 font-bold shadow-xl shadow-slate-400/50 rounded-xl md:rounded-2xl px-3 md:px-6 py-4 md:py-6 border-2 md:border-3 border-slate-700 text-white text-xs md:text-base"
              >
                Next
                <ChevronRight className="h-4 w-4 md:h-5 md:w-5 ml-1 md:ml-2" />
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={handleGenerateDocument}
                disabled={!canGenerateDocument || isGeneratingDoc}
                className="bg-gradient-to-br from-green-600 via-green-500 to-green-600 hover:from-green-700 hover:via-green-600 hover:to-green-700 font-bold shadow-xl shadow-green-400/50 disabled:opacity-40 rounded-xl md:rounded-2xl px-3 md:px-6 py-4 md:py-6 border-2 md:border-3 border-green-700 text-white text-xs md:text-base"
              >
                <Download className="h-4 w-4 md:h-5 md:w-5 mr-1 md:mr-2" />
                {isGeneratingDoc ? 'Generating...' : 'Generate Document'}
              </Button>
            )}
          </div>

          {/* Skip to Download hint — shown on intermediate pages once first question is answered */}
          {canGenerateDocument && currentQuestionIndex < QUESTIONS.length - 1 && (
            <div className="mt-3 md:mt-4 text-center">
              <button
                onClick={() => navigateToQuestion(QUESTIONS.length - 1)}
                className="text-xs md:text-sm text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2"
              >
                Ready to download? Skip to the end
              </button>
            </div>
          )}

          {/* Completion Message — shown only on the last question */}
          {canGenerateDocument && currentQuestionIndex === QUESTIONS.length - 1 && (
            <div className={`mt-3 md:mt-4 p-3 md:p-4 border-2 rounded-xl md:rounded-2xl text-center shadow-md animate-in fade-in ${allQuestionsAnswered ? 'bg-gradient-to-br from-green-100 via-emerald-100 to-green-100 border-green-500' : 'bg-gradient-to-br from-blue-50 via-blue-50 to-blue-50 border-blue-400'}`}>
              <CheckCircle2 className={`h-6 w-6 md:h-8 md:w-8 mx-auto mb-1.5 md:mb-2 drop-shadow-md ${allQuestionsAnswered ? 'text-green-600' : 'text-blue-500'}`} />
              <p className={`font-bold text-sm md:text-base mb-0.5 md:mb-1 ${allQuestionsAnswered ? 'text-green-900' : 'text-blue-900'}`}>
                {allQuestionsAnswered ? 'All Questions Completed!' : 'Ready to Download'}
              </p>
              <p className={`text-xs md:text-sm font-medium ${allQuestionsAnswered ? 'text-green-700' : 'text-blue-700'}`}>
                {allQuestionsAnswered
                  ? 'Your brief is complete. Generate your document below.'
                  : 'Unanswered sections will show as "Not provided". You can always update and re-download.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
