import Anthropic from '@anthropic-ai/sdk';

/**
 * Turns an uploaded brand document into brand context.
 *
 * THE FIRST SUMMARISATION CALL IN THIS REPO. Everything in lib/clients/ was written by a
 * person reading a client document; this writes that material with a model instead. That is
 * why the output is never used directly: the row it lands in is stored with
 * `is_included = false` and contributes nothing to any prompt until an admin has read it,
 * edited it and ticked it (db/supabase/0008_brand_context_local.sql).
 *
 * Conventions follow lib/briefs/generate.ts deliberately: the SDK is constructed inside the
 * function (never a module singleton), the local is named `anthropic`, the system block
 * carries cache_control, and the raw response comes back so the CALLER meters it — this module
 * knows nothing about sessions, routes or the usage ledger.
 */

export const DISTIL_MODEL = 'claude-sonnet-4-6';
export const DISTIL_MAX_OUTPUT_TOKENS = 4096;

/**
 * How much extracted text the model is given.
 *
 * A 15 MB PDF can extract well past a million characters, and the spreadsheet parser already
 * self-caps at 100 k (lib/uploads/spreadsheet.ts). Truncation is recorded on the row rather
 * than inferred, so an admin is told they are reading a partial distillation instead of
 * quietly being handed one.
 */
export const MAX_DISTIL_INPUT_CHARS = 150_000;

export interface DistilResult {
  text: string;
  truncated: boolean;
  /** The resolved model id, or null when the mock path ran. */
  model: string | null;
  /** Null on the mock path, so the caller knows there is nothing to meter. */
  response: Anthropic.Message | null;
}

/** True when a real distillation is possible. Probe, so callers can degrade rather than throw. */
export function isDistilConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * The instruction. Worth reading before changing — three of these rules exist because of
 * specific ways this output can be wrong in a way that looks right.
 */
const SYSTEM_PROMPT = `You are a brand strategist at IMPACT BBDO. You are reading one document supplied for a client and extracting the brand context a creative brief writer would need from it.

Produce Markdown using only these headings, and ONLY those for which the document genuinely has content:

## Positioning
## Brand pillars
## Tone of voice
## Audience
## Guardrails
## Other brand facts

RULES

1. Extract, do not invent. Every statement must be supported by the document. If the document says nothing about a heading, omit that heading entirely — do not write "not specified", and do not fill it from general knowledge of the brand or its category. This text becomes always-on brand context presented to another model as fact, so an invented line is indistinguishable from a real one forever after.
2. Quote verbatim where the wording is the point. Propositions, taglines, brand lines, slogans and pillar names must appear exactly as written, in quotation marks. Paraphrasing a tagline destroys the thing it was written to be.
3. Ignore document furniture: cover pages, contents lists, page numbers, running headers and footers, slide numbers, legal and copyright boilerplate, print specifications, and any index. They carry no brand meaning and will otherwise dominate a long document.
4. Guardrails means what the brand must not do or say — prohibited topics, tone to avoid, claims that cannot be made, competitor rules. Keep them as constraints, phrased as prohibitions.
5. Be concise and concrete. Short bullets, no preamble, no closing summary, and no commentary about the document itself. Do not describe what the document is or how it is structured.
6. If the document turns out not to be about the brand at all — an invoice, a schedule, a contract, a media plan — say so in one line under "## Other brand facts" and extract nothing else.`;

/**
 * Distil one document. Throws whatever the Anthropic SDK throws; the route maps it.
 *
 * Returns the mock path, not an error, when ANTHROPIC_API_KEY is unset: the extracted text is
 * stored as-is with a visible marker. Same reasoning as the mock short-circuit in
 * app/api/agency/prefill/route.ts — a keyless environment stays usable, and because the
 * returned `response` is null the caller records no usage for a call it never made.
 */
export async function distilBrandDocument({
  brandLabel,
  filename,
  extractedText,
}: {
  brandLabel: string;
  filename: string;
  extractedText: string;
}): Promise<DistilResult> {
  const truncated = extractedText.length > MAX_DISTIL_INPUT_CHARS;
  const input = truncated ? extractedText.slice(0, MAX_DISTIL_INPUT_CHARS) : extractedText;

  if (!isDistilConfigured()) {
    return {
      text:
        `[not distilled — ANTHROPIC_API_KEY is not configured. The raw extracted text is below ` +
        `and has NOT been reviewed or shortened.]\n\n${input}`,
      truncated,
      model: null,
      response: null,
    };
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: DISTIL_MODEL,
    max_tokens: DISTIL_MAX_OUTPUT_TOKENS,
    system: [
      // Cached: identical for every document and every brand, so a run of uploads pays for
      // this prefix once.
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              `<document filename="${filename}" brand="${brandLabel}">\n${input}\n</document>` +
              (truncated
                ? `\n\n[This document was longer than ${MAX_DISTIL_INPUT_CHARS} characters and has been truncated. Extract only from what is above; do not speculate about the remainder.]`
                : ''),
          },
          {
            type: 'text',
            text: `Extract the brand context for ${brandLabel} from this document, following the rules exactly.`,
          },
        ],
      },
    ],
  });

  // Plain text, not a forced tool. A brand toolkit does not reliably fit a fixed schema — a
  // tool with named fields would quietly drop whatever did not match one, and what it dropped
  // would be invisible. Concatenate every text block in case the model emits more than one.
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  return { text, truncated, model: response.model ?? DISTIL_MODEL, response };
}
