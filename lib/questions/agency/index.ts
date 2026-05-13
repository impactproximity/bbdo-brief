import { bigIdeaConfig } from './big-idea';
import { taskConfig } from './task';
import { socialConfig } from './social';
import { productionConfig } from './production';
import type { AgencyBriefConfig, BriefType } from './types';

export type { AgencyQuestion, AgencyBriefConfig, PrefillAnswer, PrefillResult } from './types';
export type { BriefType } from './types';

const configs: Record<string, AgencyBriefConfig> = {
  'big-idea': bigIdeaConfig,
  task: taskConfig,
  social: socialConfig,
  production: productionConfig,
};

export const AGENCY_BRIEF_TYPES: BriefType[] = Object.values(configs).map((c) => c.type);

export function getAgencyBriefConfig(tierId: string): AgencyBriefConfig | undefined {
  return configs[tierId];
}
