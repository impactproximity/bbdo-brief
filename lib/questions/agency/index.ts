import { bigIdeaConfig } from './big-idea';
import { taskConfig } from './task';
import { socialConfig } from './social';
import { productionConfig } from './production';
import { socialAlwaysOnConfig, socialCampaignConfig, socialLiveConfig } from './social-impact';
import { getClientConfig } from '@/lib/clients';
import type { AgencyBriefConfig, BriefType } from './types';

export type { AgencyQuestion, AgencyBriefConfig, PrefillAnswer, PrefillResult } from './types';
export type { BriefType } from './types';

// Registering a tier here does NOT make it visible anywhere. Visibility comes from
// DEFAULT_AGENCY_BRIEF_TYPE_IDS below, or from an explicit ClientConfig.briefTypes allow-list.
const configs: Record<string, AgencyBriefConfig> = {
  'big-idea': bigIdeaConfig,
  task: taskConfig,
  social: socialConfig,
  production: productionConfig,

  // Client-scoped — Impact BBDO Social (BTIM) tracks. Reachable only via ClientConfig.briefTypes.
  'social-always-on': socialAlwaysOnConfig,
  'social-campaign': socialCampaignConfig,
  'social-live': socialLiveConfig,
};

/**
 * The tiers every client gets unless its ClientConfig declares a `briefTypes` allow-list.
 * ADD NEW *GLOBAL* TIERS HERE. Anything omitted is client-scoped and cannot leak.
 */
export const DEFAULT_AGENCY_BRIEF_TYPE_IDS: string[] = ['big-idea', 'task', 'social', 'production'];

/** The default (unscoped) tier list. Prefer getBriefTypesForClient when a client is known. */
export const AGENCY_BRIEF_TYPES: BriefType[] = DEFAULT_AGENCY_BRIEF_TYPE_IDS.map((id) => configs[id].type);

export function getAgencyBriefConfig(tierId: string): AgencyBriefConfig | undefined {
  return configs[tierId];
}

/** Brief types a client may raise, in the order declared. Empty for an unknown client. */
export function getBriefTypesForClient(clientId: string | undefined): BriefType[] {
  if (!clientId) return [];
  const client = getClientConfig(clientId);
  if (!client) return [];
  return (client.briefTypes ?? DEFAULT_AGENCY_BRIEF_TYPE_IDS)
    .map((id) => configs[id]?.type)
    .filter((t): t is BriefType => Boolean(t));
}

/** Guard for hand-typed /agency/brief/<tier>?client=<id> URLs. */
export function isBriefTypeAllowedForClient(tierId: string, clientId: string | undefined): boolean {
  return getBriefTypesForClient(clientId).some((t) => t.id === tierId);
}
