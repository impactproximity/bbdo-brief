/**
 * The shapes Impact BBDO Pulse's partner API returns.
 *
 * Mirrors bbdo-trends-platform/docs/PARTNER-BRAND-API.md and the composition in their
 * apps/web/lib/partnerBrandContext.js. Hand-written rather than generated: there is no
 * shared package between the two repos and adding one to carry five interfaces would be a
 * build-system change for both sides.
 *
 * ONLY THE STABLE SECTIONS ARE TYPED. Their /context endpoint serves ten; we request five.
 * The other four — recentIdeas, topTrends, reviewSignal, socialListening — are 30- and
 * 45-day rolling windows. Stored at onboarding they would freeze, and a brief written
 * months later would present them as current fact. They are deliberately not requested and
 * deliberately not typed, so adding one is a visible decision rather than a quiet widening.
 *
 * Every section is independently optional on their side: a null, an empty array or an
 * absent key means "nothing to say about this", never an error. Hence the nullable types —
 * and hence compose.ts omitting a section rather than emitting an empty heading.
 */

/** One row of GET /api/partner/brands. */
export interface PulseBrandSummary {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  /** Brand.brief_client_id — their optional override naming OUR client id. Usually null. */
  briefClientId: string | null;
  homeIndustryLabel: string | null;
  industries: string[];
  regions: string[];
  badgeText: string | null;
  /** Their card colour, as a hex string. Unusable here — see 0007_pulse_clients.sql. */
  selectorBg: string | null;
  hasLogo: boolean;
  /** MAX(version) of their append-only brand_guidelines. Null, never 0, when none exists. */
  guidelineVersion: number | null;
  /** The createdAt OF the max-version row, not an independent maximum. */
  guidelineCreatedAt: string | null;
  createdAt: string;
}

export interface PulseGuideline {
  version: number;
  /** The column Pulse added for us, so positioning is a field rather than Markdown to parse. */
  proposition: string | null;
  content: string;
  voiceNotes: string[];
  avoidTopics: string[];
  systemPromptOverride: string | null;
  createdAt: string;
}

export interface PulseCompetitor {
  name: string;
  /** A dormant column on their side — their admin form accepts only `name`. Usually null. */
  notes: string | null;
}

export interface PulseConversationTheme {
  label: string;
  keywords: string[];
}

export interface PulseOpportunityTheme {
  id: string;
  key: string;
  name: string;
  description: string | null;
  /** 'brand' = derived from this brand's own approved ideas; 'global' = the shared six. */
  scope: 'brand' | 'global';
  approvedIdeaCount: number;
}

export interface PulseTrackingTerm {
  channel: string;
  channelLabel: string;
  /**
   * NOT always a country code. Their region columns have no FK to a country table and
   * Reddit stores a subreddit name here (observed live: region 'bahrain' on a reddit row).
   * brand.regions is clean; this is not — which is why compose.ts presents these as tracked
   * vocabulary and never as markets.
   */
  region: string | null;
  /**
   * A per-channel config OBJECT, not a flat list — it was typed as `string[]` here first and
   * that was wrong: `.map()` on it throws, which would have 500'd every preview for any brand
   * with tracking terms. Verified live against five brands; the shapes seen were
   * `{keywords}`, `{hashtags, broadSeeds}`, `{domains, keywords}`, `{tiktokIndustryId}` and
   * `{}` (five empty rows on Bahrain EDB alone).
   *
   * Deliberately loose. The keys are whatever each scraper channel needs, so a future channel
   * will add more; compose.ts whitelists the keys that actually carry brand vocabulary rather
   * than flattening everything, because `tiktokIndustryId` is an opaque numeric id and
   * `domains` are news source URLs — neither is language a brief should borrow.
   */
  queries: Record<string, unknown> | null;
}

/** GET /api/partner/brands/{id}/context, narrowed to the five stable sections. */
export interface PulseBrandContext {
  /** Always present — identity, not an optional enrichment. */
  brand: PulseBrandSummary & {
    regionLabels: Record<string, string>;
    excludedTrendTerms: string[];
    excludeOwnName: boolean;
  };
  guideline?: PulseGuideline | null;
  competitors?: PulseCompetitor[] | null;
  conversationThemes?: PulseConversationTheme[] | null;
  opportunityThemes?: PulseOpportunityTheme[] | null;
  trackingTerms?: PulseTrackingTerm[] | null;
}

export interface PulseLogo {
  base64: string;
  contentType: string;
}
