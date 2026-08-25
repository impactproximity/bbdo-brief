import type { AgencyBriefConfig } from '../types';
import { BTIM_SYSTEM_PROMPT, sharedHeaderQuestions } from './shared';

const TRACK_LABEL = 'Live';

export const socialLiveConfig: AgencyBriefConfig = {
  systemPrompt: `${BTIM_SYSTEM_PROMPT}

TRACK 3 — Live / Reactive Capture Card. SLA same day to 48 hours. Flagged by the client or the Strategist, then written up by the AM. Fast and lightweight: speed beats polish, but it still gets triaged. Keep every answer to the minimum a crew needs to move. Names and clock times matter more than reasoning here — an unnamed approver or an open-ended window means the card is not ready. The go/no-go exists to stop a campaign jumping the queue by calling itself Live.`,
  type: {
    id: 'social-live',
    label: 'Live / Reactive Capture Card',
    description: 'Fast and lightweight. Speed beats polish — but it still gets triaged. SLA same day–48hr.',
    icon: 'Radio',
    color: 'red',
  },
  documentTitle: 'Live & Reactive Capture Card', // no "/" — documentTitle lands in the download filename
  questions: [
    ...sharedHeaderQuestions(TRACK_LABEL),
    {
      id: 'the_moment',
      title: 'The moment',
      prompt: 'What’s happening, and why is it relevant now?',
      placeholder: 'e.g., Chef receives the award on stage tonight — first time for the region.',
      hint: 'The event plus the reason it matters to this brand today.',
      required: true,
    },
    {
      id: 'window',
      title: 'Window',
      prompt: 'When does it expire — the clock.',
      placeholder: 'e.g., Live by 11pm tonight; worthless after tomorrow noon.',
      hint: 'A hard expiry time, not "ASAP".',
      required: true,
    },
    {
      id: 'platform_format',
      title: 'Platform + format',
      prompt: 'Where does this go and in what format?',
      placeholder: 'e.g., IG Stories, 9:16, vertical, 3 frames',
      hint: 'Platform, placement and ratio.',
      required: true,
    },
    {
      id: 'shot_list',
      title: 'Shot list',
      prompt: 'What are we capturing?',
      placeholder: 'e.g., Walk-up, the handover, the room reaction, one clean piece to camera',
      hint: 'A short ordered list of shots the crew can work from.',
      required: true,
    },
    {
      id: 'on_site_approver',
      title: 'On-site approver',
      prompt: 'Named person — required before we shoot.',
      placeholder: 'e.g., Layla Haddad, on site from 7pm',
      hint: 'An actual name and how to reach them. A role title alone is not enough.',
      required: true,
    },
    {
      id: 'approval_route',
      title: 'Real-time approval route',
      prompt: 'Who signs, how, and how fast?',
      placeholder: 'e.g., WhatsApp group, client-side within 20 min, escalate to Tala after that',
      hint: 'Channel, named approver and the response time expected.',
      required: true,
    },
    {
      id: 'caption_direction',
      title: 'Caption / copy direction',
      prompt: 'What should the copy do?',
      placeholder: 'e.g., Understated, one line, no exclamation marks, Arabic first',
      hint: 'Direction and language, not finished copy.',
    },
    {
      id: 'go_no_go',
      title: 'Go / no-go',
      prompt: 'Confirm this is genuinely Live — not a campaign jumping the queue.',
      placeholder: 'e.g., Go — the moment is unrepeatable and expires tonight.',
      hint: 'A clear go or no-go with the one-line reason it qualifies as Live.',
    },
  ],
};
