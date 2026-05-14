import type { Question, BriefType, BriefConfig } from '../types';

export interface AgencyQuestion extends Question {
  hint?: string;
  required?: boolean;
}

export interface AgencyBriefConfig extends Omit<BriefConfig, 'questions'> {
  questions: AgencyQuestion[];
  systemPrompt?: string;
}

export type { BriefType };

export interface PrefillAnswer {
  value: string;
  confidence: 'high' | 'medium' | 'low';
  missing: boolean;
  suggestion?: string;
}

export type PrefillResult = Record<string, PrefillAnswer>;
