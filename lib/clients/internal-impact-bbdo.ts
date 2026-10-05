import type { ClientConfig } from './types';

export const internalImpactConfig: ClientConfig = {
  id: 'internal-impact-bbdo',
  label: 'Internal — Impact BBDO',
  description: 'Internal agency briefs for Pitches and Special projects.',
  icon: 'Building2',
  color: 'red',
  logo: 'impact-bbdo-logo.png', // stacked black+red lockup, also used in the page header
  logoWidth: 72,
  logoHeight: 30, // 1575×654 aspect

  // Authored later from internal guidelines + proposition + prompts document.
  proposition: '',
  brandGuidelines: '',
  promptGuidance: '',
};
