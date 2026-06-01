import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAgencyBriefConfig, type PrefillResult } from '@/lib/questions/agency';
import { getClientConfig, buildClientContextBlock } from '@/lib/clients';

const MODEL = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 8192;

export async function POST(req: Request) {
  try {
    const { briefType, clientId, corpus, voiceTranscript, textNotes } = await req.json();

    const config = getAgencyBriefConfig(briefType);
    if (!config) {
      return NextResponse.json({ error: `Unknown agency brief type: ${briefType}` }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      // Mock response so the UI is testable without a key.
      const answers: PrefillResult = {};
      for (const q of config.questions) {
        answers[q.id] = {
          value: `[mock] No ANTHROPIC_API_KEY configured. ${q.title} would be drafted from the uploaded corpus.`,
          confidence: 'low',
          missing: true,
          suggestion: 'Add ANTHROPIC_API_KEY to enable real pre-fill.',
        };
      }
      return NextResponse.json({ answers });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const questionSchema = config.questions
      .map((q) => {
        const hint = q.hint ? ` — Hint: ${q.hint}` : '';
        const required = q.required ? ' [required]' : '';
        return `- ${q.id}${required}: ${q.title}. ${q.prompt}${hint}`;
      })
      .join('\n');

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

    const baseStrategicPrompt = config.systemPrompt
      ?? `You are an expert agency brief writer at IMPACT BBDO. You are pre-filling a "${config.documentTitle}" from supporting materials.`;

    const operationalRules = `OPERATIONAL RULES FOR THIS PRE-FILL TASK
You will pre-fill answers for the "${config.documentTitle}" using the submit_brief_answers tool exactly once.

1. Extract verbatim from the corpus where possible. Do not fabricate facts, names, dates, budgets or commitments.
2. Where the corpus is thin, you may interpret and elevate per the strategic principles above — but mark such answers with confidence "medium" or "low".
3. If the corpus has no signal at all for a question, set "missing": true and "value": "" (empty string).
4. Use confidence "high" only when the corpus is explicit. Use "medium" when inferred. Use "low" for thin signal.
5. In "suggestion", flag good-to-have additions or missing inputs (e.g. "Add success metrics", "No budget specified", "Push the reframe further").
6. Keep each "value" concise and brief-ready (2-6 sentences). Sharp, not bloated.

QUESTIONS TO FILL:
${questionSchema}`;

    // Always-on, prompt-cached client brand context (omitted when no client / no authored content).
    const clientConfig = clientId ? getClientConfig(clientId) : undefined;
    const clientContext = clientConfig ? buildClientContextBlock(clientConfig) : null;

    const systemBlocks: Anthropic.TextBlockParam[] = [
      { type: 'text', text: baseStrategicPrompt, cache_control: { type: 'ephemeral' } },
      ...(clientContext ? [{ type: 'text' as const, text: clientContext, cache_control: { type: 'ephemeral' as const } }] : []),
      { type: 'text', text: operationalRules },
    ];

    const corpusBlock = `<corpus>\n${corpus || '(no documents uploaded)'}\n</corpus>\n\n<voice_transcript>\n${voiceTranscript || '(none)'}\n</voice_transcript>\n\n<text_notes>\n${textNotes || '(none)'}\n</text_notes>`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemBlocks,
      tools: [
        {
          name: 'submit_brief_answers',
          description: `Submit the pre-filled answers for the ${config.documentTitle}. You MUST call this tool exactly once with all questions answered.`,
          input_schema: {
            type: 'object',
            properties: {
              answers: { type: 'object', properties, required: config.questions.map((q) => q.id) },
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
              text: corpusBlock,
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
      return NextResponse.json({ error: 'Model did not return structured answers.' }, { status: 502 });
    }

    const input = toolUse.input as { answers?: PrefillResult };
    const answers = input?.answers ?? {};

    return NextResponse.json({ answers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Agency prefill error:', error);
    return NextResponse.json({ error: 'Prefill failed', detail: message }, { status: 500 });
  }
}
