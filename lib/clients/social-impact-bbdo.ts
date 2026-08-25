import type { ClientConfig } from './types';

export const socialImpactConfig: ClientConfig = {
  id: 'social-impact-bbdo',
  label: 'Social — Impact BBDO',
  description: 'Social briefs on the Big Things in Motion standard — one template per track.',
  icon: 'Share2', // fallback only; the card renders the logo when one is set
  color: 'purple',
  logo: 'impact-bbdo-logo.png', // shared black+red lockup. Must stay .png — the DOCX
  logoWidth: 100, //             ImageRun labels every non-jpg as png, so .webp corrupts the header.
  logoHeight: 15, // 4640×674 aspect

  // Scoped: this client sees ONLY the three social tracks, never the four standard tiers.
  briefTypes: ['social-always-on', 'social-campaign', 'social-live'],

  // Authored later from the BTIM guidelines, as with internal-impact-bbdo.
  proposition: '',
  brandGuidelines: '',
  promptGuidance: '',
};
