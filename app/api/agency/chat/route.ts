import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAgencyBriefConfig } from '@/lib/questions/agency';

const MODEL = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 2048;

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: Request) {
  try {
    const {
      briefType,
      questionId,
      currentAnswer,
      corpus,
      history,
      userMessage,
    } = (await req.json()) as {
      briefType: string;
      questionId: string;
      currentAnswer: string;
      corpus: string;
      history: HistoryMessage[];
      userMessage: string;
    };

    const config = getAgencyBriefConfig(briefType);
    if (!config) {
      return NextResponse.json({ error: `Unknown agency brief type: ${briefType}` }, { status: 400 });
    }

    const question = config.questions.find((q) => q.id === questionId);
    if (!question) {
      return NextResponse.json({ error: `Unknown question: ${questionId}` }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        message: `[mock] No ANTHROPIC_API_KEY configured. You asked: "${userMessage}". I would refine the answer for "${question.title}" using the uploaded corpus.`,
      });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const baseStrategicPrompt = config.systemPrompt
      ?? `You are helping an IMPACT BBDO strategist refine a single answer in a "${config.documentTitle}". Be confident, sharp, culturally fluent.`;

    const chatRules = `REFINE TASK CONTEXT
You are refining a single answer inside the "${config.documentTitle}".

Question being refined:
- ID: ${question.id}
- Title: ${question.title}
- Prompt: ${question.prompt}
${question.hint ? `- Extraction hint: ${question.hint}` : ''}

Interaction rules:
1. Stay grounded in the corpus. Do not fabricate facts, names, budgets or commitments.
2. Be concise and concrete. Replies are 1-4 short paragraphs unless the user asks for more.
3. When the user asks for a rewrite, an alternative, or to sharpen/expand the answer, call the propose_update tool with the suggested replacement text. The replacement must follow the strategic principles above.
4. When the user is just asking a question or thinking out loud, reply normally without calling the tool.`;

    const systemBlocks: Anthropic.TextBlockParam[] = [
      { type: 'text', text: baseStrategicPrompt, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: chatRules },
    ];

    const corpusContext: Anthropic.TextBlockParam = {
      type: 'text',
      text: `<corpus>\n${corpus || '(no documents)'}\n</corpus>\n\n<current_answer>\n${currentAnswer || '(empty)'}\n</current_answer>`,
      cache_control: { type: 'ephemeral' },
    };

    const messages: Anthropic.MessageParam[] = [];

    // First user turn carries the cached corpus + current answer context.
    if (history.length === 0) {
      messages.push({
        role: 'user',
        content: [corpusContext, { type: 'text', text: userMessage }],
      });
    } else {
      messages.push({ role: 'user', content: [corpusContext, { type: 'text', text: history[0].content }] });
      for (let i = 1; i < history.length; i++) {
        messages.push({ role: history[i].role, content: history[i].content });
      }
      messages.push({ role: 'user', content: userMessage });
    }

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemBlocks,
      tools: [
        {
          name: 'propose_update',
          description: 'Propose a replacement answer for the question being refined. Call this only when the user asks for a rewrite, alternative, or sharper version.',
          input_schema: {
            type: 'object',
            properties: {
              suggestedAnswer: { type: 'string', description: 'The full replacement text for the question.' },
              rationale: { type: 'string', description: 'One sentence explaining the change.' },
            },
            required: ['suggestedAnswer'],
          },
        },
      ],
      messages,
    });

    let message = '';
    let suggestedAnswer: string | undefined;

    for (const block of response.content) {
      if (block.type === 'text') {
        message += block.text;
      } else if (block.type === 'tool_use' && block.name === 'propose_update') {
        const input = block.input as { suggestedAnswer?: string; rationale?: string };
        suggestedAnswer = input.suggestedAnswer;
        if (input.rationale && !message) {
          message = input.rationale;
        }
      }
    }

    if (!message && !suggestedAnswer) {
      message = '(no response)';
    }

    return NextResponse.json({ message: message.trim(), suggestedAnswer });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Agency chat error:', error);
    return NextResponse.json({ error: 'Chat failed', detail: message }, { status: 500 });
  }
}
