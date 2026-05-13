'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Sparkles, X, Check } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestedAnswer?: string;
}

interface QuestionChatPanelProps {
  briefType: string;
  questionId: string;
  questionTitle: string;
  currentAnswer: string;
  corpus: string;
  onApplySuggestion: (text: string) => void;
  onClose: () => void;
}

export function QuestionChatPanel({
  briefType,
  questionId,
  questionTitle,
  currentAnswer,
  corpus,
  onApplySuggestion,
  onClose,
}: QuestionChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  const send = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const nextHistory = [...messages, { role: 'user' as const, content: text }];
    setMessages(nextHistory);
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch('/api/agency/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefType,
          questionId,
          currentAnswer,
          corpus,
          history: messages,
          userMessage: text,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || 'Chat request failed');
      }

      const data = (await res.json()) as { message: string; suggestedAnswer?: string };
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message, suggestedAnswer: data.suggestedAnswer }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Sorry — ${err instanceof Error ? err.message : 'something went wrong'}.` }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-2 border-slate-300 rounded-2xl shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-orange-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Refine</p>
            <p className="text-sm font-bold text-slate-800 truncate">{questionTitle}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px] max-h-[400px]">
        {messages.length === 0 && (
          <p className="text-xs md:text-sm text-slate-500 italic">
            Ask the AI to sharpen, rewrite, expand or challenge this answer. It can see your uploaded materials and the current draft.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs md:text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-800 border border-slate-200'
              }`}
            >
              {m.content}
              {m.suggestedAnswer && (
                <div className="mt-2 pt-2 border-t border-slate-300/50">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-orange-600 mb-1">Suggested update</div>
                  <div className="text-xs italic mb-2 whitespace-pre-wrap">{m.suggestedAnswer}</div>
                  <Button
                    size="sm"
                    onClick={() => onApplySuggestion(m.suggestedAnswer!)}
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-7 px-3"
                  >
                    <Check className="h-3 w-3 mr-1" /> Apply to answer
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-slate-100 text-slate-500 rounded-2xl px-3 py-2 text-xs md:text-sm flex items-center gap-2 border border-slate-200">
              <Loader2 className="h-3 w-3 animate-spin" /> thinking…
            </div>
          </div>
        )}
      </div>

      <div className="border-t-2 border-slate-200 p-3 bg-slate-50">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Make it sharper, add a stat, challenge it…"
            className="min-h-[44px] max-h-[120px] text-xs md:text-sm border-2 border-slate-200 focus:border-orange-400 resize-none"
            disabled={isSending}
          />
          <Button
            size="sm"
            onClick={send}
            disabled={isSending || !input.trim()}
            className="bg-orange-500 hover:bg-orange-600 text-white px-3 h-auto"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
