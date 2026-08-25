import type { AgencyBriefConfig } from '../types';
import { BTIM_SYSTEM_PROMPT, sharedHeaderQuestions } from './shared';

const TRACK_LABEL = 'Campaign';

export const socialCampaignConfig: AgencyBriefConfig = {
  systemPrompt: `${BTIM_SYSTEM_PROMPT}

TRACK 2 — Campaign / Hero Brief. Milestone-based. Written by the AM together with the Strategist. This is the big idea, and strategy and craft are expected on every line. Push harder here than on the always-on track: the proposition must be single-minded, the insight must be a real human truth rather than a restated audience description, and the platform plan must give each platform a distinct job. Name risks and dependencies rather than assuming them away.`,
  type: {
    id: 'social-campaign',
    label: 'Campaign / Hero Brief',
    description: 'The big idea. Strategy and craft, on every line. Milestone-based.',
    icon: 'Megaphone',
    color: 'purple',
  },
  documentTitle: 'Campaign & Hero Brief', // no "/" — documentTitle lands in the download filename
  questions: [
    ...sharedHeaderQuestions(TRACK_LABEL),
    {
      id: 'business_problem',
      title: 'Business problem',
      prompt: 'What are we actually solving — not "raise awareness"?',
      placeholder: 'e.g., Shoulder-season occupancy is flat while direct-booking share is falling.',
      hint: 'A commercial problem with a direction of travel. Reject awareness framing.',
      required: true,
    },
    {
      id: 'audience',
      title: 'Audience',
      prompt: 'Who they are, and the tension or truth about them.',
      placeholder: 'e.g., Time-rich, decision-poor travellers who research for months and book in a night.',
      hint: 'Behaviour and tension, not demographics.',
      required: true,
    },
    {
      id: 'cultural_insight',
      title: 'Cultural insight',
      prompt: 'The human truth we’re playing on.',
      placeholder: 'e.g., People no longer post the holiday — they post the decision to go.',
      hint: 'A truth that is arguable and specific. Not a category observation.',
      required: true,
    },
    {
      id: 'the_ask',
      title: 'The ask',
      prompt: 'What do we want them to think, feel and do?',
      placeholder: 'e.g., Think: this is bookable now. Feel: permission. Do: share the shortlist.',
      hint: 'All three, one clause each.',
      required: true,
    },
    {
      id: 'single_minded_proposition',
      title: 'Single-minded proposition',
      prompt: 'The one thing. If it’s two things, it’s not done.',
      placeholder: 'e.g., The shortlist is the holiday.',
      hint: 'One sentence, one idea. Collapse any "and" into a single thought.',
      required: true,
    },
    {
      id: 'platform_roles',
      title: 'Platform roles',
      prompt: 'What does each platform do in the system — not "post everywhere"?',
      placeholder: 'e.g., TikTok recruits · Reels converts · X carries the conversation...',
      hint: 'One distinct job per platform. Drop any platform without a job.',
      required: true,
    },
    {
      id: 'why_it_moves_natively',
      title: 'Why it moves natively',
      prompt: 'The social mechanic — where’s the participation?',
      placeholder: 'e.g., The shortlist is a duet-able format; people reply with their own.',
      hint: 'Name the mechanic and the thing the audience makes or sends.',
      required: true,
    },
    {
      id: 'mandatories_guardrails',
      title: 'Mandatories + guardrails',
      prompt: 'Legal, IP, brand and claims.',
      placeholder: 'e.g., Music must be cleared for paid; no competitor property in frame...',
      hint: 'Only constraints that materially change the work.',
      allowUpload: true,
    },
    {
      id: 'success_measures',
      title: 'Success measures',
      prompt: 'What we’ll judge it on, agreed up front.',
      placeholder: 'e.g., Share rate, saves, UGC volume, direct-booking assists...',
      hint: 'Specific and social-native. Reach alone does not count.',
      required: true,
    },
    {
      id: 'budget_scope',
      title: 'Budget / scope',
      prompt: 'What is the budget and what does it cover?',
      placeholder: 'e.g., Production + 2 creators + paid amplification...',
      hint: 'Figure plus what it does and does not include.',
      allowUpload: true,
    },
    {
      id: 'timings_milestones',
      title: 'Timings + milestones',
      prompt: 'Key dates and the milestones between them.',
      placeholder: 'e.g., Concepts Sep 2 · Shoot Sep 18–20 · Live Oct 6',
      hint: 'Dated milestones, not a duration.',
    },
    {
      id: 'risks_dependencies',
      title: 'Risks + dependencies',
      prompt: 'Legal, IP, Arabic/dialect copy, client sign-offs — named, not assumed.',
      placeholder: 'e.g., Arabic copy needs Gulf-dialect review; talent contracts pending...',
      hint: 'Each risk with the named owner or blocker.',
    },
  ],
};
