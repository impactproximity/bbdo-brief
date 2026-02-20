import { strategyConfig } from './strategy';
import { socialCampaignConfig } from './social-campaign';
import { socialStrategyConfig } from './social-strategy';
import { contentConfig } from './content';
import { brandConfig } from './brand';
import { tacticalConfig } from './tactical';
import { adhocConfig } from './adhoc';
import { pressReleaseConfig } from './press-release';
import { websiteConfig } from './website';
import { BriefConfig, BriefType } from './types';

export type { Question, BriefType, BriefConfig, QuestionResponse } from './types';

const configs: Record<string, BriefConfig> = {
  strategy: strategyConfig,
  'social-campaign': socialCampaignConfig,
  'social-strategy': socialStrategyConfig,
  content: contentConfig,
  brand: brandConfig,
  tactical: tacticalConfig,
  adhoc: adhocConfig,
  'press-release': pressReleaseConfig,
  website: websiteConfig,
};

export const BRIEF_TYPES: BriefType[] = Object.values(configs).map(c => c.type);

export function getBriefConfig(typeId: string): BriefConfig | undefined {
  return configs[typeId];
}
