import type { Question, BriefType, BriefConfig } from '../types';

export interface AgencyQuestion extends Question {
  hint?: string;
  required?: boolean;

  /**
   * A group heading this question sits under, rendered in the review screen and the .docx.
   *
   * Questions sharing a section must be CONTIGUOUS in the array — both renderers emit the
   * heading when the value changes from the previous question, so interleaving two sections
   * would print each heading twice.
   */
  section?: string;

  /**
   * The model writes this answer from its own knowledge instead of extracting it from the
   * uploaded corpus.
   *
   * Set only where a template genuinely asks for generated content — Etihad's destination
   * mini-guide is the first. It has three effects, all keyed off this one flag: the prefill
   * prompt gains a clause exempting these ids from "do not fabricate", the answer card shows
   * an "AI-written · verify" badge, and the .docx prints a caution under the heading.
   *
   * Do NOT also mark such a question `required`: a required field hard-blocks the Generate
   * button, so a generation that came back thin would trap the user.
   */
  generated?: boolean;

  /**
   * Render as a row in its section's table (title | answer) rather than its own
   * heading-and-paragraph.
   *
   * A contiguous run of these inside one `section` becomes a SINGLE table, which is how a
   * checklist drawn as a table in the client's own document comes out as one table rather
   * than several. Unrelated to the legacy PEOPLE_TABLE_IDS / SIGNOFF_TABLE_IDS behaviour in
   * the .docx route, which keys off hardcoded question ids and is left alone.
   */
  tableRow?: boolean;
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
