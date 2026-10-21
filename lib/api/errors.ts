import { NextResponse } from 'next/server';

/**
 * One error envelope for every /api/v1 response, so a consumer can write a single error
 * handler. Shape: { "error": { "code": "...", "message": "..." } }
 *
 * The existing session-backed routes use a bare { error: string }. They are deliberately
 * left alone — their only consumer is our own UI, and changing that shape would be a
 * breaking change to a working feature for no benefit.
 */

export type ApiErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'idempotency_conflict'
  | 'payload_too_large'
  | 'validation_failed'
  | 'rate_limited'
  | 'upstream_error'
  | 'upstream_timeout'
  | 'internal_error';

const STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  idempotency_conflict: 409,
  payload_too_large: 413,
  validation_failed: 422,
  rate_limited: 429,
  upstream_error: 502,
  upstream_timeout: 504,
  internal_error: 500,
};

export function apiError(code: ApiErrorCode, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message } }, { status: STATUS[code], headers });
}

/** Thrown inside handlers and converted by withApiErrorHandling. */
export class ApiFailure extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
  }
}

/**
 * Wrap a handler so an unexpected throw becomes a clean JSON 500 rather than an HTML
 * error page — a consuming platform parsing JSON should never receive markup.
 */
export async function withApiErrorHandling(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (err) {
    if (err instanceof ApiFailure) return apiError(err.code, err.message, err.headers);

    const message = err instanceof Error ? err.message : String(err);

    // The Anthropic SDK surfaces timeouts and overloads as its own error shapes; map the
    // ones a caller can act on rather than flattening everything to 500.
    if (/timeout|ETIMEDOUT|aborted/i.test(message)) {
      return apiError('upstream_timeout', 'The model did not respond in time. Retry with the same Idempotency-Key.');
    }
    if (/overloaded|rate.?limit|429/i.test(message)) {
      return apiError('upstream_error', 'The model provider is temporarily unavailable. Retry shortly.');
    }

    console.error('[api/v1] unhandled error:', err);
    return apiError('internal_error', 'An unexpected error occurred.');
  }
}
