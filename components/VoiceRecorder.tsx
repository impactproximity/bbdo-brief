'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  isProcessing?: boolean;
}

export function VoiceRecorder({ onRecordingComplete, isProcessing = false }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(blob);
        stopTimer();
        setRecordingTime(0);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      startTimer();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-2 md:space-y-3 p-2">
      <div className={cn(
        "relative rounded-full p-2 md:p-3 transition-all duration-300",
        isRecording ? "bg-red-100 animate-pulse" : "bg-transparent"
      )}>
        <Button
          size="lg"
          variant={isRecording ? "destructive" : "default"}
          className={cn(
            "h-20 w-20 md:h-32 md:w-32 rounded-full shadow-lg transition-all",
             isRecording ? "scale-110" : "hover:scale-105"
          )}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="h-10 w-10 md:h-16 md:w-16 animate-spin" />
          ) : isRecording ? (
            <Square className="h-8 w-8 md:h-14 md:w-14 fill-current" />
          ) : (
            <Mic className="h-10 w-10 md:h-16 md:w-16" />
          )}
        </Button>
      </div>

      {isRecording && (
        <div className="text-sm md:text-base font-bold text-red-500 animate-in fade-in">
          Recording {formatTime(recordingTime)}
        </div>
      )}

      {!isRecording && isProcessing && (
        <div className="text-sm md:text-base font-bold text-muted-foreground animate-pulse">
          Processing audio...
        </div>
      )}

      {!isRecording && !isProcessing && (
        <div className="text-center space-y-0.5 md:space-y-1 animate-in fade-in">
          <div className="text-sm md:text-base font-bold text-slate-700">
            Tap to Record Your Response
          </div>
          <div className="text-xs md:text-sm text-slate-500 font-medium">
            Speak clearly into your microphone
          </div>
        </div>
      )}
    </div>
  );
}
