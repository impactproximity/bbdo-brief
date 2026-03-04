'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentUploaderProps {
  onUploadComplete: (userInput: string, enhancedResponse: string) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
  questionTitle: string;
}

export function DocumentUploader({
  onUploadComplete,
  isProcessing,
  setIsProcessing,
  questionTitle,
}: DocumentUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [statusText, setStatusText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setStatusText('');
  };

  const handleProcess = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setStatusText('Extracting text from document...');

    try {
      // 1. Parse the document
      const formData = new FormData();
      formData.append('file', selectedFile);

      const parseRes = await fetch('/api/parse-document', {
        method: 'POST',
        body: formData,
      });

      if (!parseRes.ok) {
        const err = await parseRes.json().catch(() => ({}));
        throw new Error(err.error || 'Document parsing failed');
      }

      const { text } = await parseRes.json();

      if (!text?.trim()) {
        throw new Error('No text could be extracted from the document');
      }

      // 2. Enhance via LLM
      setStatusText('Enhancing with AI...');

      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionTitle,
          userResponse: text,
        }),
      });

      if (!chatRes.ok) throw new Error('Enhancement failed');

      const data = await chatRes.json();

      onUploadComplete(text, data.enhancedResponse);
      setStatusText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStatusText('');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-3 md:space-y-4 p-2 w-full max-w-sm">
      {/* Drop zone / file picker */}
      <div
        className={cn(
          'w-full border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-colors',
          selectedFile
            ? 'border-slate-500 bg-slate-50'
            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
        )}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
      >
        {selectedFile ? (
          <>
            <FileText className="h-10 w-10 text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 text-center break-all">{selectedFile.name}</p>
            <p className="text-xs text-slate-500">Click to choose a different file</p>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-slate-400" />
            <p className="text-sm font-semibold text-slate-600">Click to select a file</p>
            <p className="text-xs text-slate-400">PDF or DOCX only</p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleFileChange}
        disabled={isProcessing}
      />

      {/* Process button */}
      <Button
        size="lg"
        onClick={handleProcess}
        disabled={!selectedFile || isProcessing}
        className="w-full font-bold rounded-xl shadow-md bg-slate-700 hover:bg-slate-800 text-white disabled:opacity-40"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Process Document
          </>
        )}
      </Button>

      {isProcessing && statusText && (
        <p className="text-sm font-bold text-muted-foreground animate-pulse">{statusText}</p>
      )}
    </div>
  );
}
