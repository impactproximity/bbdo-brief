'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, X, Sparkles, AlertCircle, CheckCircle2, Lightbulb, MessageSquare, Mic, Square, Loader2 } from 'lucide-react';
import type { AgencyQuestion, PrefillAnswer } from '@/lib/questions/agency';

interface AnswerCardProps {
  question: AgencyQuestion;
  index: number;
  total: number;
  answer: PrefillAnswer | undefined;
  onSave: (value: string) => void;
  onOpenChat: () => void;
  chatOpen: boolean;
}

export function AnswerCard({ question, index, total, answer, onSave, onOpenChat, chatOpen }: AnswerCardProps) {
  const isEmpty = !answer?.value;
  // Auto-edit when there is no draft yet — so users can type immediately.
  const [editing, setEditing] = useState(isEmpty);
  const [draft, setDraft] = useState(answer?.value || '');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  React.useEffect(() => {
    setDraft(answer?.value || '');
    setEditing(!answer?.value);
    setSaveError(null);
  }, [answer?.value, question.id]);

  const isMissing = answer?.missing || !answer?.value;
  const hasSuggestion = !!answer?.suggestion;

  const confidenceStyles: Record<string, string> = {
    high: 'bg-green-100 text-green-700 border-green-300',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    low: 'bg-orange-100 text-orange-700 border-orange-300',
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);
        try {
          const fd = new FormData();
          fd.append('file', blob);
          const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
          if (!res.ok) throw new Error('Transcription failed');
          const data = await res.json();
          setDraft((prev) => (prev ? `${prev} ${data.text}`.trim() : data.text));
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Voice transcription failed.');
        } finally {
          setIsTranscribing(false);
        }
      };
      mr.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      alert('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-100 via-slate-100 to-slate-100 border-2 md:border-3 border-slate-500 rounded-2xl md:rounded-3xl p-4 md:p-7 space-y-3 md:space-y-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2 md:mb-3">
            <div className="inline-block px-3 py-1.5 bg-gradient-to-r from-slate-600 to-slate-600 text-white text-[10px] md:text-xs font-extrabold rounded-xl uppercase tracking-wider shadow-lg">
              Question {index + 1} of {total}
            </div>
            {isEmpty && question.required && (
              <span className="px-2.5 py-1 text-[10px] md:text-xs font-bold rounded-md bg-red-100 text-red-700 border border-red-300 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Needs an answer
              </span>
            )}
            {isEmpty && !question.required && (
              <span className="px-2.5 py-1 text-[10px] md:text-xs font-bold rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                Optional — you can skip
              </span>
            )}
            {!isEmpty && answer?.confidence && (
              <span className={`px-2.5 py-1 text-[10px] md:text-xs font-bold rounded-md border flex items-center gap-1 ${confidenceStyles[answer.confidence] || ''}`}>
                <Sparkles className="h-3 w-3" /> AI draft · {answer.confidence}
              </span>
            )}
          </div>
          <h3 className="text-lg md:text-2xl font-extrabold text-slate-900 mb-1 md:mb-2 leading-tight">{question.title}</h3>
          <p className="text-slate-700 text-xs md:text-sm bg-white p-2.5 md:p-3 rounded-xl border-2 border-slate-300 italic font-medium shadow-sm">
            {question.prompt}
          </p>
          {question.placeholder && editing && (
            <p className="text-slate-500 text-[11px] md:text-xs mt-1.5 italic px-1">{question.placeholder}</p>
          )}
        </div>
      </div>

      {/* Answer body */}
      <div className="bg-white rounded-xl md:rounded-2xl border-2 md:border-3 border-slate-300 shadow-md p-3 md:p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            {isEmpty ? (
              <>
                <Pencil className="h-3 w-3 text-slate-600" /> Your Answer
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 text-orange-500" /> {editing ? 'Editing' : 'AI-Drafted Answer'}
              </>
            )}
          </div>
          {!editing && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setDraft(answer?.value || ''); setEditing(true); }}
              className="text-xs border-2 border-slate-300 hover:border-orange-400 hover:bg-orange-50 text-slate-700 h-8"
            >
              <Pencil className="h-3 w-3 mr-1.5" /> Edit
            </Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (saveError) setSaveError(null);
              }}
              placeholder={question.placeholder || 'Type your answer here…'}
              className={`min-h-[140px] text-xs md:text-base border-2 focus:border-orange-500 ${saveError ? 'border-red-500' : 'border-orange-400'}`}
              autoFocus={!isEmpty}
              disabled={isTranscribing}
            />
            {saveError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border-2 border-red-300 px-3 py-2">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs md:text-sm font-semibold text-red-700">{saveError}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Voice input — round black icon button */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isTranscribing}
                  aria-label={isRecording ? 'Stop recording' : 'Speak your answer'}
                  className={`flex items-center justify-center h-11 w-11 md:h-12 md:w-12 rounded-full shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isRecording
                      ? 'bg-red-600 hover:bg-red-700 animate-pulse ring-4 ring-red-200'
                      : isTranscribing
                      ? 'bg-slate-700'
                      : 'bg-black hover:bg-slate-800 hover:scale-105 ring-2 ring-slate-200'
                  }`}
                >
                  {isTranscribing ? (
                    <Loader2 className="h-5 w-5 md:h-6 md:w-6 text-white animate-spin" />
                  ) : isRecording ? (
                    <Square className="h-4 w-4 md:h-5 md:w-5 text-white fill-current" />
                  ) : (
                    <Mic className="h-5 w-5 md:h-6 md:w-6 text-white" />
                  )}
                </button>
                <div className="text-[11px] md:text-xs leading-tight">
                  <div className="font-bold text-slate-800">
                    {isTranscribing ? 'Transcribing…' : isRecording ? 'Recording — tap to stop' : 'Speak your answer'}
                  </div>
                  {!isRecording && !isTranscribing && (
                    <div className="text-slate-500">Appends to the text above</div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {!isEmpty && (
                  <button
                    onClick={() => { setEditing(false); setDraft(answer?.value || ''); }}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-semibold px-2 py-1"
                    disabled={isRecording || isTranscribing}
                  >
                    <X className="h-3 w-3" /> Cancel
                  </button>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    if (!draft.trim() && question.required) {
                      setSaveError('This question is mandatory. Type an answer, tap the mic to speak it, or click another question to skip for now.');
                      return;
                    }
                    setSaveError(null);
                    onSave(draft);
                    setEditing(false);
                  }}
                  disabled={isRecording || isTranscribing}
                  className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 h-auto"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className={`text-xs md:text-base leading-relaxed whitespace-pre-wrap ${isMissing ? 'text-slate-400 italic' : 'text-slate-900 font-medium'}`}>
            {answer?.value || 'No answer yet.'}
          </p>
        )}

        {hasSuggestion && answer?.suggestion && !editing && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] md:text-xs text-amber-900">
              <span className="font-bold">Good to have:</span> {answer.suggestion}
            </div>
          </div>
        )}

        {!editing && (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenChat}
              disabled={chatOpen}
              className="text-xs border-2 border-slate-300 hover:border-orange-400 hover:bg-orange-50 text-slate-700 h-8"
            >
              <MessageSquare className="h-3 w-3 mr-1.5" />
              {chatOpen ? 'Chat open' : 'Refine with AI'}
            </Button>
          </div>
        )}
      </div>

      {!isMissing && !editing && (
        <div className="flex items-center gap-1.5 text-xs md:text-sm text-green-600 font-bold">
          <CheckCircle2 className="h-4 w-4" />
          <span>Saved</span>
        </div>
      )}
    </div>
  );
}
