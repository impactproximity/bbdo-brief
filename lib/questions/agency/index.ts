import { bigIdeaConfig } from './big-idea';
import { taskConfig } from './task';
import { socialConfig } from './social';
import { productionConfig } from './production';
import { socialAlwaysOnConfig, socialCampaignConfig, socialLiveConfig } from './social-impact';
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

/**
 * The minimum a caller must know about a client to decide its tiers. Structural rather than
 * `ClientConfig`, so this module stays free of any dependency on lib/clients.
 */
export interface ClientTierScope {
  briefTypes?: string[];
}

/**
 * Brief types a client may raise, in the order declared. Empty for no client.
 *
 * TAKES THE RESOLVED CLIENT, NOT AN ID. It used to call getClientConfig(clientId), which
 * only ever saw the compile-time registry — so every brand onboarded from Pulse would have
 * resolved to "unknown client" and been offered no tiers at all. The caller now resolves
 * (lib/clients/registry.resolveClientConfig, which is async) and passes the result down.
 *
 * The two absent cases are genuinely different and both still work: no client at all means
 * no tiers, while a client that declares no `briefTypes` gets the four defaults. That
 * distinction is why this takes an object and not a bare `string[] | undefined`.
 */
export function getBriefTypesForClient(client: ClientTierScope | undefined | null): BriefType[] {
  if (!client) return [];
  return (client.briefTypes ?? DEFAULT_AGENCY_BRIEF_TYPE_IDS)
    .map((id) => configs[id]?.type)
    .filter((t): t is BriefType => Boolean(t));
}

/** Guard for hand-typed /agency/brief/<tier>?client=<id> URLs. */
export function isBriefTypeAllowedForClient(tierId: string, client: ClientTierScope | undefined | null): boolean {
  return getBriefTypesForClient(client).some((t) => t.id === tierId);
}
