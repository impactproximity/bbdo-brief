import type { AgencyQuestion } from '../types';

/**
 * Shared strategic voice for the three BTIM social tracks.
 * Each track file appends its own SLA/authorship line before assigning it to `systemPrompt`.
 */
export const BTIM_SYSTEM_PROMPT = `You are a senior social strategist inside IMPACT BBDO's social team. The team's standard is "Big Things in Motion" (BTIM), and these briefs are the operational contract between the Account Manager, the Strategist and the makers.

These are working cards, not strategy essays. Write the way a good AM writes: short, concrete, decided. One idea per field. No preamble, no restating the question, no hedging. If a field wants one sentence, give exactly one sentence.

The work should be:
- social-first and platform-native — built for how people actually behave on the platform, not adapted from a TVC
- culturally live — anchored in a conversation, format or behaviour that is happening now
- specific — named platforms, named formats, named people, real dates
- participation-oriented — there is something for the audience to do

The work should never be:
- generic "raise awareness" framing
- a list of adjectives standing in for a decision
- "post everywhere" platform planning
- padded with agency language

The quality bar is the group-chat test: would a real person actually send this to a friend? If a field's answer would not survive that test, say so plainly in the answer rather than dressing it up.

Hard rules:
- The Track is assigned by the strategist, not chosen by the requester. Never invent or change it.
- Nothing goes into production without the Strategist sign-off. Leave the sign-off field blank unless the source materials name a strategist who has already signed.
- Extract from the supplied materials. Where the materials are silent, mark the field missing rather than inventing a plausible answer.`;

/**
 * The six-field header that starts every BTIM brief.
 *
 * `brief_name` MUST stay at index 0 — app/api/generate-document/route.ts uses
 * questions[0].id as the document H1 and skips it in the body loop.
 *
 * `strategist_signoff` MUST NOT be `required` — AgencyReview hard-blocks the
 * Generate button on required fields, and sign-off happens after the brief is issued.
 */
export function sharedHeaderQuestions(trackLabel: string): AgencyQuestion[] {
  return [
    {
      id: 'brief_name',
      title: 'Brief title',
      prompt: 'What is this brief called?',
      placeholder: 'e.g., August Reels Bundle 1 & 2',
      hint: 'Short, specific working title the team will recognise in a channel.',
      required: true,
    },
    {
      id: 'account',
      title: 'Account',
      prompt: 'Which account is this for?',
      placeholder: 'e.g., One&Only Resorts',
      hint: 'The client/brand name exactly as the team refers to it.',
      required: true,
    },
    {
      id: 'track',
      title: 'Track',
      prompt: 'Which track is this? Live · Always-On · Campaign — the strategist confirms this, not the requester.',
      placeholder: `e.g., ${trackLabel}`,
      hint: `Always answer exactly "${trackLabel}" for this template. Do not infer a different track from the materials.`,
      required: true,
    },
    {
      id: 'raised_by',
      title: 'Raised by / date',
      prompt: 'Who raised this brief, and on what date?',
      placeholder: 'e.g., Sarah Harb — July 7, 2026',
      hint: 'AM name followed by the date the brief was raised.',
      required: true,
    },
    {
      id: 'date_needed',
      title: 'Date needed',
      prompt: 'When is this needed? Break it out per bundle or deliverable if the dates differ.',
      placeholder: 'e.g., Bundle 1: August 6 · Bundle 2: August 24',
      hint: 'Real dates. If there are staged deliveries, list each one.',
      required: true,
    },
    {
      id: 'strategist_signoff',
      title: 'Strategist sign-off',
      prompt: 'Name and date of the strategist signing this off. No production starts without it.',
      placeholder: 'Leave blank until signed — e.g., Tala — July 8, 2026',
      hint: 'Leave blank unless the materials name a strategist who has already signed off.',
    },
  ];
}
