import { NextResponse } from 'next/server';
import { getAgencyBriefConfig } from '@/lib/questions/agency';
import { generateBriefAnswers } from '@/lib/briefs/generate';
import { anthropicUsage, recordUsage } from '@/lib/usage/record';
import { requireApiKey, assertClientAndTierAllowed, stampKeyUsed } from '@/lib/api/auth';
import { checkApiRateLimit, recordApiRequest } from '@/lib/api/rate-limit';
import { buildCorpusFromDocuments } from '@/lib/api/documents';
import { resolveClientId } from '@/lib/clients/resolve';
import { composeIdeaPrompt, parseIdea, IDEA_SCALE_TO_BRIEF_TYPE } from '@/lib/api/idea-prompt';
import { createApiBrief, findByIdempotencyKey } from '@/lib/api/briefs-store';
import { ApiFailure, apiError, withApiErrorHandling } from '@/lib/api/errors';

// Node: the API-key lookup and the usage ledger both need the database, and hashing needs
// node crypto. 300s because a Big Idea brief against the live model takes minutes — this
// endpoint is synchronous by design, so the function must outlive the model call.
export const runtime = 'nodejs';
export const maxDuration = 300;

const ROUTE = 'api/v1/briefs';

interface BriefRequestBody {
  clientId?: unknown;
  briefType?: unknown;
  prompt?: unknown;
  textNotes?: unknown;
  voiceTranscript?: unknown;
  documents?: unknown;
  externalId?: unknown;
  idea?: unknown;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiFailure('validation_failed', `"${field}" is required and must be a non-empty string.`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new ApiFailure('validation_failed', `"${field}" must be a string.`);
  }
  return value;
}

export async function POST(req: Request) {
  return withApiErrorHandling(async () => {
    const key = await requireApiKey(req);

    // Required, not optional. The endpoint is synchronous and a brief takes minutes, so a
    // consumer that times out will retry; without a stable key every retry would re-spend
    // model tokens on work we have already done and stored.
    const idempotencyKey = req.headers.get('idempotency-key')?.trim();
    if (!idempotencyKey) {
      throw new ApiFailure(
        'invalid_request',
        'Missing "Idempotency-Key" header. Send a unique value per brief so retries are safe.',
      );
    }

    let body: BriefRequestBody;
    try {
      body = (await req.json()) as BriefRequestBody;
    } catch {
      throw new ApiFailure('invalid_request', 'Request body must be valid JSON.');
    }

    // Consumers identify brands by their own display names ("McVitie's", "P&O"), so accept
    // those as well as our slugs. Everything downstream — scope check, persistence,
    // metering — uses the resolved canonical id, so the data has one spelling per client.
    const requestedClient = requiredString(body.clientId, 'clientId');
    const clientId = resolveClientId(requestedClient);
    if (!clientId) {
      throw new ApiFailure(
        'not_found',
        `Unknown client: "${requestedClient}". Call GET /api/v1/catalog for the clients this key may use and the names it accepts.`,
      );
    }

    // An Idea carries its own scale, which implies the tier — so a trend-led consumer can
    // post the Idea alone. An explicit briefType always wins.
    const idea = body.idea === undefined || body.idea === null ? null : parseIdea(body.idea);
    const explicitBriefType = body.briefType === undefined || body.briefType === null ? '' : requiredString(body.briefType, 'briefType');
    const briefType = explicitBriefType || (idea?.scale ? IDEA_SCALE_TO_BRIEF_TYPE[idea.scale] ?? '' : '');

    if (!briefType) {
      throw new ApiFailure(
        'validation_failed',
        idea
          ? `"briefType" is required: idea.scale ${idea.scale ? `"${idea.scale}" is not a recognised scale` : 'was not supplied'}. See ideaScaleMap in GET /api/v1/catalog.`
          : '"briefType" is required and must be a non-empty string.',
      );
    }

    // 404 for unknown, 403 for out-of-scope — see assertClientAndTierAllowed.
    assertClientAndTierAllowed(key, clientId, briefType);

    const config = getAgencyBriefConfig(briefType);
    if (!config) throw new ApiFailure('not_found', `Unknown brief type: ${briefType}`);

    // Before the quota check: replaying a stored result is nearly free, and a consumer
    // retrying after a timeout should not be punished with a 429.
    const existing = await findByIdempotencyKey(key.id, idempotencyKey);
    if (existing) {
      stampKeyUsed(key.id);
      return NextResponse.json(
        {
          briefId: existing.id,
          clientId: existing.client_id,
          briefType: existing.tier,
          documentTitle: config.documentTitle,
          title: existing.title,
          externalId: existing.external_id,
          answers: existing.answers,
          createdAt: existing.created_at,
          idempotentReplay: true,
        },
        { headers: { 'Idempotency-Replayed': 'true' } },
      );
    }

    const verdict = await checkApiRateLimit(key);
    if (!verdict.allowed) {
      return apiError('rate_limited', `Rate limit of ${verdict.limit} requests/hour exceeded for this API key.`, {
        'Retry-After': String(verdict.retryAfter),
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ApiFailure('internal_error', 'Brief generation is not configured on this deployment.');
    }

    // `prompt` is the friendly name for what the UI calls textNotes; accept either. An
    // Idea composes into the same field, ahead of any free text the caller also sent.
    const freeText = optionalString(body.prompt, 'prompt') || optionalString(body.textNotes, 'textNotes');
    const textNotes = [idea ? composeIdeaPrompt(idea) : '', freeText].filter((s) => s.trim()).join('\n\n');
    const voiceTranscript = optionalString(body.voiceTranscript, 'voiceTranscript');
    const externalId = body.externalId === undefined || body.externalId === null ? null : requiredString(body.externalId, 'externalId');
    const corpus = await buildCorpusFromDocuments(body.documents);

    if (!corpus.trim() && !textNotes.trim() && !voiceTranscript.trim()) {
      throw new ApiFailure('validation_failed', 'Provide at least one of "prompt", "idea", "documents" or "voiceTranscript".');
    }

    recordApiRequest(key.id, ROUTE);

    const { answers, response } = await generateBriefAnswers({
      config,
      clientId,
      corpus,
      voiceTranscript,
      textNotes,
    });

    // Metered exactly like the UI path, plus the two fields that keep machine spend
    // attributable in the admin report.
    recordUsage({
      route: ROUTE,
      provider: 'anthropic',
      session: null,
      apiKeyId: key.id,
      actorLabel: `api:${key.name}`,
      clientId,
      tier: briefType,
      ...anthropicUsage(response),
    });

    stampKeyUsed(key.id);

    if (!answers) {
      return apiError('upstream_error', 'The model did not return structured answers. Retry with the same Idempotency-Key.');
    }

    // questions[0].id is always brief_name and always required, so this is reliable —
    // same assumption the briefs table makes for its denormalised title.
    const title = answers.brief_name?.value?.trim() || 'Untitled brief';

    const stored = await createApiBrief({
      apiKeyId: key.id,
      clientId,
      tier: briefType,
      title,
      answers,
      corpus,
      voiceTranscript,
      textNotes,
      externalId,
      idempotencyKey,
    });

    return NextResponse.json({
      // Null only if persistence failed; the brief itself is still returned, because the
      // model work is done and losing the audit row is the smaller failure.
      briefId: stored?.id ?? null,
      clientId,
      briefType,
      documentTitle: config.documentTitle,
      title,
      externalId,
      model: response.model,
      questions: config.questions.map((q) => ({ id: q.id, title: q.title, required: Boolean(q.required) })),
      answers,
      createdAt: stored?.created_at ?? new Date().toISOString(),
      idempotentReplay: false,
    });
  });
}
