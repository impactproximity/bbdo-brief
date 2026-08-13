'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { Upload, FileText, X, Loader2, Sparkles, Mic, ArrowRight } from 'lucide-react';
import type { PrefillResult } from '@/lib/questions/agency';
import {
  FILE_ACCEPT_ATTR,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  SUPPORTED_FORMATS_LABEL,
  resolveFileKind,
} from '@/lib/uploads/supported-files';

interface AgencyIntakeProps {
  briefType: string;
  clientId?: string;
  documentTitle: string;
  onPrefillComplete: (params: { corpus: string; voiceTranscript: string; textNotes: string; answers: PrefillResult }) => void;
  onSkip: () => void;
}

interface UploadedFile {
  file: File;
  status: 'pending' | 'parsing' | 'done' | 'error';
  text?: string;
  error?: string;
}

export function AgencyIntake({ briefType, clientId, documentTitle, onPrefillComplete, onSkip }: AgencyIntakeProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [textNotes, setTextNotes] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = (selected: FileList | null) => {
    if (!selected) return;
    const next: UploadedFile[] = [];
    for (const f of Array.from(selected)) {
      const resolved = resolveFileKind(f.name, f.type);
      if (!resolved.ok) {
        next.push({ file: f, status: 'error', error: resolved.error });
        continue;
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        next.push({ file: f, status: 'error', error: `File exceeds ${MAX_UPLOAD_LABEL} limit` });
        continue;
      }
      next.push({ file: f, status: 'pending' });
    }
    setFiles((prev) => [...prev, ...next]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVoice = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const fd = new FormData();
      fd.append('file', blob);
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Transcription failed');
      const data = await res.json();
      setVoiceTranscript((prev) => (prev ? `${prev}\n\n${data.text}` : data.text));
    } catch (err) {
      console.error(err);
      alert('Voice transcription failed.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleProcess = async () => {
    const valid = files.filter((f) => f.status !== 'error');
    if (valid.length === 0 && !textNotes.trim() && !voiceTranscript.trim()) {
      alert('Upload at least one document, or add voice/text notes, before processing.');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatusText('Preparing…');

    const parsedTexts: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        if (item.status === 'error') continue;

        setStatusText(`Parsing ${item.file.name}…`);
        setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: 'parsing' } : f)));

        const fd = new FormData();
        fd.append('file', item.file);

        const res = await fetch('/api/parse-document', { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: 'error', error: err.error || 'Parse failed' } : f)));
          continue;
        }
        const data = await res.json();
        parsedTexts.push(`# ${item.file.name}\n${data.text}`);
        setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: 'done', text: data.text } : f)));
        setProgress(Math.round(((i + 1) / Math.max(files.length, 1)) * 70));
      }

      const corpus = parsedTexts.join('\n\n---\n\n');

      setStatusText('Drafting answers from your materials…');
      setProgress(80);

      const prefillRes = await fetch('/api/agency/prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefType, clientId, corpus, voiceTranscript, textNotes }),
      });

      if (!prefillRes.ok) {
        const err = await prefillRes.json().catch(() => ({}));
        throw new Error(err.detail || err.error || 'Pre-fill failed');
      }

      const { answers } = (await prefillRes.json()) as { answers: PrefillResult };
      setProgress(100);
      setStatusText('Done.');

      onPrefillComplete({ corpus, voiceTranscript, textNotes, answers });
    } catch (err) {
      console.error(err);
      alert(`Processing failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-5 md:space-y-7">
      <div className="text-center">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-1">Have materials? Drop them in.</h2>
        <p className="text-sm md:text-base text-slate-600">
          Decks, transcripts, client emails, scripts, data sheets — any {SUPPORTED_FORMATS_LABEL}. Optional voice or text notes too. We&apos;ll draft a starting {documentTitle}.
        </p>
        <p className="text-xs md:text-sm text-slate-500 mt-1.5 italic">
          No documents? No problem — skip below and answer each question manually with voice or text.
        </p>
      </div>

      {/* Uploader */}
      <div
        className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 md:p-8 text-center hover:border-orange-400 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('border-orange-500');
        }}
        onDragLeave={(e) => e.currentTarget.classList.remove('border-orange-500')}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('border-orange-500');
          handleFilesSelected(e.dataTransfer.files);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_ACCEPT_ATTR}
          multiple
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
          disabled={isProcessing}
        />
        <Upload className="h-8 w-8 md:h-10 md:w-10 mx-auto mb-2 text-slate-400" />
        <p className="font-bold text-slate-700 text-sm md:text-base">Click or drop files</p>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">{SUPPORTED_FORMATS_LABEL}, up to {MAX_UPLOAD_LABEL} each</p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border-2 border-slate-200 bg-white">
              <FileText className="h-5 w-5 text-slate-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{f.file.name}</div>
                <div className="text-xs text-slate-500">
                  {f.status === 'pending' && `${(f.file.size / 1024).toFixed(0)} KB · ready`}
                  {f.status === 'parsing' && 'Parsing…'}
                  {f.status === 'done' && `${(f.file.size / 1024).toFixed(0)} KB · parsed`}
                  {f.status === 'error' && <span className="text-red-600">{f.error}</span>}
                </div>
              </div>
              {f.status === 'parsing' && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
              {!isProcessing && (
                <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500 p-1" aria-label="Remove">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Voice */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Mic className="h-4 w-4 text-slate-600" />
          <h3 className="text-sm md:text-base font-bold text-slate-800">Voice notes (optional)</h3>
        </div>
        <VoiceRecorder onRecordingComplete={handleVoice} isProcessing={isTranscribing} />
        {voiceTranscript && (
          <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs md:text-sm text-slate-700 whitespace-pre-wrap">
            {voiceTranscript}
          </div>
        )}
      </div>

      {/* Text notes */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 md:p-5">
        <h3 className="text-sm md:text-base font-bold text-slate-800 mb-2">Text notes (optional)</h3>
        <Textarea
          placeholder="Add any context, links, quotes or notes you want the AI to weave in…"
          value={textNotes}
          onChange={(e) => setTextNotes(e.target.value)}
          className="min-h-[100px] border-2 border-slate-200 focus:border-orange-400"
          disabled={isProcessing}
        />
      </div>

      {/* Progress */}
      {isProcessing && (
        <div>
          <Progress value={progress} className="h-3" />
          <p className="text-xs md:text-sm text-slate-600 mt-2 text-center">{statusText}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        <Button
          size="lg"
          onClick={handleProcess}
          disabled={isProcessing}
          className="w-full bg-gradient-to-br from-orange-600 via-orange-500 to-orange-600 hover:from-orange-700 hover:via-orange-600 hover:to-orange-700 text-white font-bold shadow-xl rounded-xl md:rounded-2xl py-5 md:py-6 border-2 md:border-3 border-orange-700 text-sm md:text-base disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 md:h-5 md:w-5 mr-2 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 md:h-5 md:w-5 mr-2" />
              Process & Pre-fill
            </>
          )}
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-slate-400">or</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <Button
          size="lg"
          variant="outline"
          onClick={onSkip}
          disabled={isProcessing}
          className="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl md:rounded-2xl py-5 md:py-6 border-2 md:border-3 border-slate-400 hover:border-slate-600 text-sm md:text-base disabled:opacity-50"
        >
          Skip — Answer Manually
          <ArrowRight className="h-4 w-4 md:h-5 md:w-5 ml-2" />
        </Button>
        <p className="text-center text-[11px] md:text-xs text-slate-500">
          You&apos;ll be taken to the review step with empty answers. Use voice or text to fill each one.
        </p>
      </div>
    </div>
  );
}
