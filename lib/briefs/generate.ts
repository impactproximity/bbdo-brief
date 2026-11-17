import Anthropic from '@anthropic-ai/sdk';
import { buildClientContextBlock, type ClientConfig } from '@/lib/clients';
import type { AgencyBriefConfig, PrefillResult } from '@/lib/questions/agency';

/**
 * The brief generation core, shared by every entry point.
 *
 * Extracted verbatim from app/api/agency/prefill/route.ts so that the human UI and the
 * public API (app/api/v1/briefs) cannot drift into producing different briefs from the
 * same inputs. Nothing here knows about HTTP, sessions, API keys or usage metering —
 * callers own all of that, which is why the two routes can meter and authenticate
 * completely differently while still sending the model an identical request.
 *
 * If you change a prompt string here you change it for BOTH surfaces. That is the point.
 */

export const BRIEF_MODEL = 'claude-sonnet-4-6';
export const BRIEF_MAX_OUTPUT_TOKENS = 8192;

export interface GenerateBriefInput {
  config: AgencyBriefConfig;
  /**
   * The RESOLVED client, not an id.
   *
   * It used to be an id that this module looked up in the compile-time registry, which meant
   * a brand onboarded from Pulse silently generated a brief with no brand context at all —
   * the worst possible failure, because the output still looks like a brief. Resolution is
   * now the caller's job (lib/clients/registry.resolveClientConfig), and it is async, which
   * is exactly why it does not belong in here: everything in this file stays synchronous and
   * free of I/O so that both entry points provably assemble the same prompt.
   */
  client?: ClientConfig | null;
  corpus?: string;
  voiceTranscript?: string;
  textNotes?: string;
}

export interface GenerateBriefResult {
  /** Null when the model returned no tool_use block — callers map this to a 502. */
  answers: PrefillResult | null;
  response: Anthropic.Message;
}

/** One line per question, as presented to the model under "QUESTIONS TO FILL". */
export function buildQuestionSchema(config: AgencyBriefConfig): string {
  return config.questions
    .map((q) => {
      const hint = q.hint ? ` — Hint: ${q.hint}` : '';
      const required = q.required ? ' [required]' : '';
      return `- ${q.id}${required}: ${q.title}. ${q.prompt}${hint}`;
    })
    .join('\n');
}

/** The per-question JSON schema handed to the submit_brief_answers tool. */
export function buildAnswerProperties(config: AgencyBriefConfig): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const q of config.questions) {
    properties[q.id] = {
      type: 'object',
      properties: {
        value: { type: 'string', description: `Drafted answer for "${q.title}". Empty string if nothing is in the corpus.` },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        missing: { type: 'boolean', description: 'true when the corpus has no clear signal for this question.' },
        suggestion: { type: 'string', description: 'Optional good-to-have improvement or what is missing.' },
      },
      required: ['value', 'confidence', 'missing'],
    };
  }
  return properties;
}

/**
 * The three-block system array: strategy, then the always-on client brand context, then the
 * operational rules. The first two carry cache_control because they are stable across every
 * call for a given tier and client; the rules block closes the prefix.
 */
export function buildSystemBlocks(config: AgencyBriefConfig, client?: ClientConfig | null): Anthropic.TextBlockParam[] {
  const questionSchema = buildQuestionSchema(config);

  const baseStrategicPrompt = config.systemPrompt
    ?? `You are an expert agency brief writer at IMPACT BBDO. You are pre-filling a "${config.documentTitle}" from supporting materials.`;

  // Questions the template wants WRITTEN, not extracted. Empty for every tier that does not
  // use the flag, and the interpolation below then contributes nothing — so the prompt stays
  // byte-identical for the seven tiers that predate this. Asserted, not assumed: a hash of
  // every tier's blocks was taken before this change and compared after.
  const generatedIds = config.questions.filter((q) => q.generated).map((q) => q.id);
  const generatedRules = generatedIds.length === 0 ? '' : `

QUESTIONS YOU WRITE RATHER THAN EXTRACT
Rule 1 does not apply to these ids: ${generatedIds.join(', ')}.

The corpus is not expected to contain these answers. Write them from your own knowledge of the
subject. Never set "missing": true on them and never leave them empty.

a. Prefer what stays true: climate and seasonality, the character and rhythm of a place,
   long-established landmarks, staple dishes. Avoid what goes stale or is easily wrong — prices,
   opening hours, event dates, "best" or "newest" anything, and named restaurants and hotels.
b. Write as a strategist briefing a creative team, not as a travel listicle.
c. Set "confidence" honestly. Lower it where you are working from general impression rather than
   well-established fact: a human verifies this section, and "confidence" is how they know where
   to look first. Uniform "high" across all of them is a failure, not a success.
d. If you do not know the subject well enough to be useful, say exactly that in "value" instead
   of inventing specifics.`;

  const operationalRules = `OPERATIONAL RULES FOR THIS PRE-FILL TASK
You will pre-fill answers for the "${config.documentTitle}" using the submit_brief_answers tool exactly once.

1. Extract verbatim from the corpus where possible. Do not fabricate facts, names, dates, budgets or commitments.
2. Where the corpus is thin, you may interpret and elevate per the strategic principles above — but mark such answers with confidence "medium" or "low".
3. If the corpus has no signal at all for a question, set "missing": true and "value": "" (empty string).
4. Use confidence "high" only when the corpus is explicit. Use "medium" when inferred. Use "low" for thin signal.
5. In "suggestion", flag good-to-have additions or missing inputs (e.g. "Add success metrics", "No budget specified", "Push the reframe further").
6. Keep each "value" concise and brief-ready (2-6 sentences). Sharp, not bloated.${generatedRules}

QUESTIONS TO FILL:
${questionSchema}`;

  // Always-on, prompt-cached client brand context (omitted when no client / no authored
  // content). A synced brand reaches here already composed, so a Pulse-onboarded client and
  // a hand-authored one produce the same block.
  const clientContext = client ? buildClientContextBlock(client) : null;

  return [
    { type: 'text', text: baseStrategicPrompt, cache_control: { type: 'ephemeral' } },
    ...(clientContext ? [{ type: 'text' as const, text: clientContext, cache_control: { type: 'ephemeral' as const } }] : []),
    { type: 'text', text: operationalRules },
  ];
}

/** The cached user block carrying everything the caller supplied. */
export function buildCorpusBlock(corpus?: string, voiceTranscript?: string, textNotes?: string): string {
  return `<corpus>\n${corpus || '(no documents uploaded)'}\n</corpus>\n\n<voice_transcript>\n${voiceTranscript || '(none)'}\n</voice_transcript>\n\n<text_notes>\n${textNotes || '(none)'}\n</text_notes>`;
}

/**
 * Run the prefill. Throws whatever the Anthropic SDK throws — callers decide the status code.
 * Requires ANTHROPIC_API_KEY; the UI route short-circuits to mock answers before calling this.
 */
export async function generateBriefAnswers({
  config,
  client,
  corpus,
  voiceTranscript,
  textNotes,
}: GenerateBriefInput): Promise<GenerateBriefResult> {
  // `anthropic`, not `client` — `client` is the brand now, and the two would shadow.
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: BRIEF_MODEL,
    max_tokens: BRIEF_MAX_OUTPUT_TOKENS,
    system: buildSystemBlocks(config, client),
    tools: [
      {
        name: 'submit_brief_answers',
        description: `Submit the pre-filled answers for the ${config.documentTitle}. You MUST call this tool exactly once with all questions answered.`,
        input_schema: {
          type: 'object',
          properties: {
            answers: { type: 'object', properties: buildAnswerProperties(config), required: config.questions.map((q) => q.id) },
          },
          required: ['answers'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_brief_answers' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildCorpusBlock(corpus, voiceTranscript, textNotes),
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: `Pre-fill every question for the ${config.documentTitle} now. Call submit_brief_answers exactly once.`,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    return { answers: null, response };
  }

  const input = toolUse.input as { answers?: PrefillResult };
  return { answers: input?.answers ?? {}, response };
}
