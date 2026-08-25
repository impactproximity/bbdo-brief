import type { AgencyBriefConfig } from '../types';
import { BTIM_SYSTEM_PROMPT, sharedHeaderQuestions } from './shared';

const TRACK_LABEL = 'Always-On';

export const socialAlwaysOnConfig: AgencyBriefConfig = {
  systemPrompt: `${BTIM_SYSTEM_PROMPT}

TRACK 1 — Always-On Asset Brief. SLA 5 working days. Written by the AM, signed by the Strategist. This is the content flywheel: the workhorse that carries most of the volume. Favour clarity and speed over ambition here — the job of each asset is small and precise, and it must ladder to a content pillar. If an asset does not serve a pillar, say so.`,
  type: {
    id: 'social-always-on',
    label: 'Always-On Asset Brief',
    description: 'The content flywheel. The workhorse — most of the volume. SLA 5 working days.',
    icon: 'Repeat',
    color: 'teal',
  },
  documentTitle: 'Always-On Asset Brief',
  questions: [
    ...sharedHeaderQuestions(TRACK_LABEL),
    {
      id: 'content_pillar',
      title: 'Content pillar',
      prompt: 'Which of our pillars does this serve? If none, it doesn’t get made.',
      placeholder: 'e.g., Escape · Craft · People · Place...',
      hint: 'Name the single pillar. If the materials show no pillar fit, say that explicitly.',
      required: true,
    },
    {
      id: 'the_job',
      title: 'The job',
      prompt: 'One sentence: what is this asset for?',
      placeholder: 'e.g., Create inspiring luxury reels according to client brief across 12 resorts.',
      hint: 'Exactly one sentence. What the asset does, not what the campaign is about.',
      required: true,
    },
    {
      id: 'audience_behaviour',
      title: 'Audience + behaviour',
      prompt: 'Who is this for, and the one thing we want them to do — save, share, comment, follow?',
      placeholder: 'e.g., Aspirational travel planners in the Gulf — we want the save.',
      hint: 'Audience plus a single named behaviour. Not a list of four behaviours.',
      required: true,
    },
    {
      id: 'cultural_hook',
      title: 'Cultural / platform hook',
      prompt: 'Why now, and why this platform?',
      placeholder: 'e.g., Peak summer-escape search behaviour; Reels is where the discovery happens.',
      hint: 'The timing reason and the platform reason — both, briefly.',
    },
    {
      id: 'platform_format',
      title: 'Platform + format',
      prompt: 'TikTok / Reels / etc. — give ratio, duration and spec.',
      placeholder: 'e.g., Instagram feed, 16–20s, 9:16',
      hint: 'Platform, placement, duration and aspect ratio. Be exact.',
      required: true,
    },
    {
      id: 'message',
      title: 'Message',
      prompt: 'The single thing it says.',
      placeholder: 'e.g., There is a version of summer you have not had yet.',
      hint: 'One line. If it is two things, it is not done.',
      required: true,
    },
    {
      id: 'mandatories',
      title: 'Mandatories',
      prompt: 'Logos, legal, claims and brand guardrails.',
      placeholder: 'e.g., End frame lockup, no on-screen pricing, no unaccompanied minors...',
      hint: 'Only hard constraints that change what gets made.',
      allowUpload: true,
    },
    {
      id: 'reference',
      title: 'Reference',
      prompt: 'One link to what great looks like.',
      placeholder: 'e.g., Link to reference reel, plus delivery split and owner...',
      hint: 'A single best reference. Include delivery split or named owner if the materials give one.',
      allowUpload: true,
    },
    {
      id: 'deliverables',
      title: 'Deliverables',
      prompt: 'Format(s) and quantity.',
      placeholder: 'e.g., Bundle 1: 14 reels · Bundle 2: 14 reels',
      hint: 'Counts and formats. Break out per bundle where the materials do.',
      allowUpload: true,
      required: true,
    },
    {
      id: 'posting_window',
      title: 'Posting window',
      prompt: 'When does this go live?',
      placeholder: 'e.g., Rolling, Aug 6–31, 3× per week',
      hint: 'Dates and cadence.',
    },
    {
      id: 'group_chat_test',
      title: 'Group-chat test',
      prompt: 'Would someone actually send this to a friend? If not, rework.',
      placeholder: 'e.g., Yes — the reveal shot is the reason to send it. / No — needs a sharper hook.',
      hint: 'An honest yes or no with the one-line reason. Do not default to yes.',
    },
  ],
};
