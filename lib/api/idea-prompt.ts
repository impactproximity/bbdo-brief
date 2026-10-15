import { ApiFailure } from './errors';

/**
 * Compose the prompt text for a brief generated from a trend "Idea".
 *
 * Impact BBDO Pulse surfaces AI-generated Idea Concepts — a trend, why it matters to the
 * brand, and the opportunity — and the integration turns one into a brief with the user
 * filling in nothing. Consumers send the structured object they already hold and this
 * module decides the wording the model sees.
 *
 * That split is deliberate. If each consumer flattened the Idea into a string themselves,
 * prompt quality would vary per platform and improving it would need their release, not
 * ours.
 */

/** Idea.scale in Pulse maps onto our brief tiers. Published in the catalog response. */
export const IDEA_SCALE_TO_BRIEF_TYPE: Record<string, string> = {
  social_play: 'social',
  bigger_territory: 'big-idea',
};

export interface IdeaSourceTrend {
  name?: unknown;
  channel?: unknown;
  region?: unknown;
  exampleUrl?: unknown;
}

export interface IdeaInput {
  title?: unknown;
  trendSummary?: unknown;
  whyRelevant?: unknown;
  opportunity?: unknown;
  scale?: unknown;
  region?: unknown;
  sourceTrends?: unknown;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Validate and normalise the inbound object. Throws ApiFailure the route renders as JSON. */
export function parseIdea(raw: unknown): {
  title: string;
  trendSummary: string;
  whyRelevant: string;
  opportunity: string;
  scale: string;
  region: string;
  sourceTrends: { name: string; channel: string; region: string; exampleUrl: string }[];
} {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ApiFailure('validation_failed', '"idea" must be an object.');
  }
  const idea = raw as IdeaInput;

  const title = str(idea.title);
  if (!title) {
    throw new ApiFailure('validation_failed', '"idea.title" is required.');
  }

  const trendSummary = str(idea.trendSummary);
  const whyRelevant = str(idea.whyRelevant);
  const opportunity = str(idea.opportunity);

  // A title alone is not a brief. Require something with actual substance in it.
  if (!trendSummary && !whyRelevant && !opportunity) {
    throw new ApiFailure(
      'validation_failed',
      '"idea" needs at least one of "trendSummary", "whyRelevant" or "opportunity".',
    );
  }

  const sourceTrends = Array.isArray(idea.sourceTrends)
    ? (idea.sourceTrends as IdeaSourceTrend[]).slice(0, 10).map((t) => ({
        name: str(t?.name),
        channel: str(t?.channel),
        region: str(t?.region),
        exampleUrl: str(t?.exampleUrl),
      }))
    : [];

  return {
    title,
    trendSummary,
    whyRelevant,
    opportunity,
    scale: str(idea.scale),
    region: str(idea.region),
    sourceTrends,
  };
}

/**
 * Render the Idea as labelled prose.
 *
 * Each part is named so the model knows what it is reading: an observed cultural signal is
 * not the same kind of input as a stated brand opportunity, and flattening them into one
 * paragraph loses that. The closing instruction keeps the model from treating the Idea as a
 * finished answer to be reformatted — it is raw material for a brief.
 */
export function composeIdeaPrompt(idea: ReturnType<typeof parseIdea>): string {
  const parts: string[] = [`TREND-LED IDEA: ${idea.title}`];

  if (idea.region) parts.push(`MARKET: ${idea.region}`);
  if (idea.trendSummary) parts.push(`THE TREND (observed in culture)\n${idea.trendSummary}`);
  if (idea.whyRelevant) parts.push(`WHY IT IS RELEVANT TO THIS BRAND\n${idea.whyRelevant}`);
  if (idea.opportunity) parts.push(`THE OPPORTUNITY\n${idea.opportunity}`);

  if (idea.sourceTrends.length) {
    const lines = idea.sourceTrends
      .map((t) => {
        const where = [t.channel, t.region].filter(Boolean).join(', ');
        return `- ${t.name || 'unnamed signal'}${where ? ` (${where})` : ''}${t.exampleUrl ? ` — ${t.exampleUrl}` : ''}`;
      })
      .join('\n');
    parts.push(`SOURCE SIGNALS\n${lines}`);
  }

  parts.push(
    'This Idea is the starting point, not the finished brief. Build the brief around it: ' +
      'interrogate the trend, ground it in the brand context above, and develop the thinking ' +
      'rather than restating the Idea back.',
  );

  return parts.join('\n\n');
}
