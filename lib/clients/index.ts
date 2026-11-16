import type { ClientConfig } from './types';
import { starbucksConfig } from './starbucks';
import { sadiaConfig } from './sadia';
import { internalImpactConfig } from './internal-impact-bbdo';
import { socialImpactConfig } from './social-impact-bbdo';
import { pandoConfig } from './p-and-o';
import { googleGeminiConfig } from './google-gemini';
import { mcvitiesConfig } from './mcvities';

export type { ClientConfig } from './types';

const clients: Record<string, ClientConfig> = {
  starbucks: starbucksConfig,
  sadia: sadiaConfig,
  'internal-impact-bbdo': internalImpactConfig,
  'social-impact-bbdo': socialImpactConfig,
  'p-and-o': pandoConfig,
  'google-gemini': googleGeminiConfig,
  mcvities: mcvitiesConfig,
};

// For the dashboard cards (parallels AGENCY_BRIEF_TYPES).
export const CLIENTS: ClientConfig[] = Object.values(clients);

export function getClientConfig(id: string): ClientConfig | undefined {
  return clients[id];
}

/**
 * Build the always-on brand context block injected into the prefill/chat system prompt.
 * Returns null when the client has no authored content yet, so a placeholder client
 * config produces zero change to AI behaviour (fully backward compatible).
 */
export function buildClientContextBlock(c: ClientConfig): string | null {
  const parts: string[] = [];
  if (c.proposition?.trim()) parts.push(`<proposition>\n${c.proposition.trim()}\n</proposition>`);
  if (c.brandGuidelines?.trim()) parts.push(`<brand_guidelines>\n${c.brandGuidelines.trim()}\n</brand_guidelines>`);
  if (c.promptGuidance?.trim()) parts.push(`<prompt_guidance>\n${c.promptGuidance.trim()}\n</prompt_guidance>`);
  // Last, and labelled as source documents rather than as guidelines. It is distilled from an
  // admin's upload, so it is the least authoritative of the four — and placing it after the
  // guidelines means the brand's own authored positioning is read first.
  if (c.documentContext?.trim()) {
    parts.push(
      `<brand_documents>\nBrand context drawn from documents supplied for this client. Where it conflicts with the guidelines above, the guidelines win.\n\n${c.documentContext.trim()}\n</brand_documents>`,
    );
  }
  if (parts.length === 0) return null;
  return `CLIENT CONTEXT — always-on brand context for ${c.label}. Tailor every answer to this brand: its proposition, voice and guidelines. Do not contradict it.\n\n${parts.join('\n\n')}`;
}
