import type { PulseBrandContext } from './types';

/**
 * Turns a Pulse context bundle into the three prose fields a ClientConfig carries.
 *
 * PURE, NO I/O, ON PURPOSE. Composition is the one part of this feature most likely to be
 * revised once a few brands have been onboarded and someone reads the briefs they produce.
 * Keeping it a pure function of the stored `pulse_payload` means a better composition can
 * be re-run over every onboarded brand without re-pulling from Pulse, and can be reasoned
 * about without a database or a network.
 *
 * OMISSION, NOT EMPTY HEADINGS. Pulse's contract is that a null, an empty array or an
 * absent key means "nothing to say about this". So every section below is dropped when it
 * has no content, and the whole field returns '' when nothing at all survived.
 * buildClientContextBlock() then drops an empty field from the prompt entirely, so a thin
 * brand produces a short block rather than a scaffold of empty labelled sections — which a
 * model will otherwise dutifully try to fill.
 *
 * The output is Markdown because that is what Pulse's own `content` already is, and what
 * the hand-authored configs in lib/clients/ are in practice.
 */

/** Trim, and treat whitespace-only as absent. Pulse's text columns are unvalidated. */
function text(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function list(values: string[] | null | undefined): string[] {
  return (values ?? []).map((v) => text(v)).filter(Boolean);
}

/**
 * The keys of a trackingTerms `queries` object that actually carry brand vocabulary.
 *
 * A WHITELIST, not a flatten-everything. Observed live: `keywords`, `hashtags` and
 * `broadSeeds` are search terms a brief can legitimately borrow, while `domains` holds news
 * source URLs and `tiktokIndustryId` is an opaque numeric id. Injecting either into a brand
 * prompt as "the brand's tracked vocabulary" would be feeding the model noise it cannot tell
 * from signal — and an unknown key added by a future scraper channel is far more likely to be
 * another id than another term, so omitting it is the safe default.
 */
const VOCABULARY_KEYS = ['keywords', 'hashtags', 'broadSeeds'];

/** Keeps the prompt bounded. Bahrain EDB alone has 28 rows, most of them duplicates. */
const MAX_TRACKED_TERMS = 60;

/** Every vocabulary string in one `queries` object, ignoring non-vocabulary keys. */
function vocabularyFrom(queries: Record<string, unknown> | null | undefined): string[] {
  if (!queries || typeof queries !== 'object') return [];
  const out: string[] = [];
  for (const key of VOCABULARY_KEYS) {
    const value = queries[key];
    if (Array.isArray(value)) {
      for (const v of value) if (typeof v === 'string' && v.trim()) out.push(v.trim());
    } else if (typeof value === 'string' && value.trim()) {
      out.push(value.trim());
    }
  }
  return out;
}

/** Joins the sections that produced content. Returns '' when none did. */
function assemble(sections: Array<string | null>): string {
  return sections.filter((s): s is string => Boolean(s && s.trim())).join('\n\n').trim();
}

/**
 * The positioning line, injected as its own labelled block.
 *
 * Straight from their `proposition` column and NEVER parsed out of `content`. The original
 * ask was explicit about this: `content` is unvalidated free text with no enforced
 * structure, so looking for a `## Strategic positioning` heading would silently yield an
 * empty block for any brand authored without that exact wording — a failure that looks like
 * working software. Pulse added the column rather than have us guess.
 */
export function composeProposition(ctx: PulseBrandContext): string {
  return text(ctx.guideline?.proposition);
}

/**
 * The brand's own guidelines: their authored Markdown, plus the two array columns that sit
 * beside it and are consumed the same way by their idea generation.
 */
export function composeBrandGuidelines(ctx: PulseBrandContext): string {
  const guideline = ctx.guideline;
  if (!guideline) return '';

  const voiceNotes = list(guideline.voiceNotes);
  const avoidTopics = list(guideline.avoidTopics);

  return assemble([
    text(guideline.content),
    voiceNotes.length ? `## Voice notes\n\n${voiceNotes.map((n) => `- ${n}`).join('\n')}` : null,
    // Named as a constraint, not as subject matter. These are topics never to raise for the
    // brand ("politics", "alcohol"), and a heading like "Topics" alone reads to a model as
    // territory to write about.
    avoidTopics.length
      ? `## Never reference these topics for this brand\n\n${avoidTopics.map((t) => `- ${t}`).join('\n')}`
      : null,
  ]);
}

/**
 * Everything else Pulse holds that shapes how a brief for this brand should be written.
 *
 * Lands in `promptGuidance` rather than `brandGuidelines` because that is the field whose
 * contract is "the per-client prompt doc, applied across all four brief categories" — this
 * is guidance derived from the brand's operating context, not the brand's own authored
 * guidelines document.
 */
export function composePromptGuidance(ctx: PulseBrandContext): string {
  const brand = ctx.brand;

  // `guideline.systemPromptOverride` is DELIBERATELY NOT USED. It reads like brand guidance
  // and is not: read live, all four brands that have one carry a prompt for PULSE'S OWN idea
  // generation. Bahrain EDB's opens "Apply the analyst frame from the shared system prompt to
  // the cached trend data. Every trend cited in source_trends must come from that block
  // exactly" — instructions about a different task, naming fields that do not exist in a
  // brief. Each one then continues into genuine brand voice ("read like an experienced
  // investment advisor", "avoid unverified economic claims"), so the field is a mix with no
  // delimiter, and `content` is unvalidated free text we will not try to split on.
  //
  // The usable half is already covered: every voice instruction in it also appears in
  // `voiceNotes` (10 for this brand) and every prohibition in `avoidTopics` (8, including
  // "direct comparisons to other countries" and "unverified economic figures"). So dropping it
  // loses nothing and avoids telling the model to cite a `source_trends` block that is not there.

  const regions = list(brand.regions);
  const regionLine = regions.length
    ? regions.map((code) => {
        const label = text(brand.regionLabels?.[code]);
        return label ? `${label} (${code})` : code;
      })
    : [];
  // `industries` only. `homeIndustryLabel` is NOT a category: it is admin-entered free text
  // and on P&O it holds "A DP World Company", a corporate tagline. Labelling that as the
  // brand's category would put a confident falsehood in the prompt. It is still used for the
  // icon and description SUGGESTIONS at onboarding, where an admin reads it and can correct it.
  const industries = list(brand.industries);

  const marketBits: string[] = [];
  if (regionLine.length) marketBits.push(`- Markets: ${regionLine.join(', ')}`);
  if (industries.length) marketBits.push(`- Category: ${industries.join(', ')}`);
  if (brand.clientName) marketBits.push(`- Agency client: ${brand.clientName}`);

  const competitors = (ctx.competitors ?? [])
    .map((c) => ({ name: text(c.name), notes: text(c.notes) }))
    .filter((c) => c.name);

  const themes = (ctx.conversationThemes ?? [])
    .map((t) => ({ label: text(t.label), keywords: list(t.keywords) }))
    .filter((t) => t.label);

  const opportunities = (ctx.opportunityThemes ?? [])
    .map((t) => ({ name: text(t.name), description: text(t.description), count: t.approvedIdeaCount ?? 0 }))
    .filter((t) => t.name);
  // Their rows are either brand-derived or the shared global six. Saying which matters: a
  // global territory is not evidence about THIS brand, and a reader (or a model) weighing
  // "strategic territories for Etihad" should know the difference.
  const opportunityScope = ctx.opportunityThemes?.[0]?.scope === 'brand'
    ? 'derived from this brand\'s own approved ideas'
    : 'the platform-wide set, not specific to this brand';

  // One deduplicated list, not a row per channel and region.
  //
  // Their rows are per channel PER REGION, so the same vocabulary repeats: 16 of Bahrain EDB's
  // 28 rows carry the identical ten keywords, once for each of six markets. Rendering them as
  // written would put the same ten terms into the prompt sixteen times — bulk that teaches the
  // model nothing and crowds out the guidelines. The channel and region are dropped with them:
  // which platform a term is tracked on does not change how a brief should use the brand's
  // language, and `region` is not reliably a market anyway (reddit rows hold a subreddit name).
  const trackedTerms: string[] = [];
  const seenTerms = new Set<string>();
  for (const row of ctx.trackingTerms ?? []) {
    for (const term of vocabularyFrom(row.queries)) {
      const key = term.toLowerCase();
      if (seenTerms.has(key)) continue;
      seenTerms.add(key);
      trackedTerms.push(term);
    }
  }
  const trackedShown = trackedTerms.slice(0, MAX_TRACKED_TERMS);

  const excluded = list(brand.excludedTrendTerms);

  return assemble([
    marketBits.length ? `## Market context\n\n${marketBits.join('\n')}` : null,

    competitors.length
      ? `## Competitive set\n\nThe brands this one is measured against. Use for framing; do not name a competitor in brief copy unless the brief is explicitly comparative.\n\n${competitors
          // `notes` is a dormant column upstream — their admin form accepts only a name — so
          // this renders as a bare list today and gains substance the day someone fills it in.
          .map((c) => (c.notes ? `- **${c.name}** — ${c.notes}` : `- ${c.name}`))
          .join('\n')}`
      : null,

    themes.length
      ? `## What audiences talk about for this brand\n\n${themes
          .map((t) => (t.keywords.length ? `- **${t.label}**: ${t.keywords.join(', ')}` : `- **${t.label}**`))
          .join('\n')}`
      : null,

    opportunities.length
      ? `## Strategic territories\n\nOpportunity themes ${opportunityScope}.\n\n${opportunities
          .map((t) => (t.description ? `- **${t.name}** — ${t.description}` : `- **${t.name}**`))
          .join('\n')}`
      : null,

    trackedShown.length
      ? `## Tracked vocabulary\n\nThe terms and hashtags this brand is actively monitored on — brand-specific language a brief can borrow. These are search terms, not markets or audiences.\n\n${trackedShown.join(', ')}${
          trackedTerms.length > trackedShown.length ? `\n\n(${trackedTerms.length - trackedShown.length} further terms not listed.)` : ''
        }`
      : null,

    excluded.length
      ? `## Never cite these as trends\n\n${excluded.map((t) => `- ${t}`).join('\n')}`
      : null,

    // excludeOwnName is a real instruction and cheap to carry: a "trend" that is just the
    // brand's own name is not evidence of cultural momentum.
    brand.excludeOwnName
      ? '## Own-name exclusion\n\nDo not treat mentions of the brand\'s own name as an external trend or as cultural proof.'
      : null,
  ]);
}

export interface ComposedBrandContext {
  proposition: string;
  brandGuidelines: string;
  promptGuidance: string;
}

/** All three fields at once — what the onboard and preview routes both want. */
export function composeBrandContext(ctx: PulseBrandContext): ComposedBrandContext {
  return {
    proposition: composeProposition(ctx),
    brandGuidelines: composeBrandGuidelines(ctx),
    promptGuidance: composePromptGuidance(ctx),
  };
}

/**
 * A url-safe slug from a Pulse brand name, in the same namespace as the compile-time ids.
 *
 * Matches how the existing ids were chosen by hand ("McVitie's" -> mcvities, "P&O Ferries"
 * -> p-and-o is the one that does NOT follow, which is exactly why this is only a
 * suggestion the admin can overwrite rather than the id itself).
 */
export function suggestClientId(brandName: string): string {
  return brandName
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * The brand's uploaded documents, as one labelled block.
 *
 * Only documents an admin has reviewed and included reach this — the store's
 * listIncludedDocumentsFor() filters on is_included, so an un-reviewed distillation cannot
 * arrive here even if a caller forgets to check.
 *
 * Each document keeps its filename as a heading. That matters for a reason beyond tidiness:
 * this text is model-written (distilled from the upload), and naming its source document is
 * the only thing in the prompt that distinguishes it from the brand's own authored guidelines.
 */
export function composeDocumentContext(
  documents: { filename: string; distilled_text: string }[] | undefined | null,
): string {
  const parts = (documents ?? [])
    .map((d) => ({ filename: text(d.filename) || 'Untitled document', body: text(d.distilled_text) }))
    .filter((d) => d.body)
    // `#`, not `##`: the distillation's own sections are `## Positioning`, `## Tone of voice`
    // and so on, so a `##` filename would sit at the same level as the content under it and
    // the hierarchy would read flat.
    .map((d) => `# ${d.filename}\n\n${d.body}`);

  return parts.join('\n\n');
}

/**
 * Pulse's text with the admin's additions appended under their own heading.
 *
 * Appended rather than merged, and headed rather than run together, so the two are
 * distinguishable in the prompt: the first half is maintained upstream and will change under
 * our feet on the next Refresh, the second half is ours. Returns Pulse's text unchanged when
 * there are no notes, which keeps a brand that has never been edited byte-identical to before
 * this feature existed.
 */
export function withLocalNotes(pulseText: string, localNotes: string): string {
  const base = text(pulseText);
  const notes = text(localNotes);
  if (!notes) return base;
  const addition = `## Our additions\n\n${notes}`;
  return base ? `${base}\n\n${addition}` : addition;
}
