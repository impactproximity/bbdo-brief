import { NextResponse } from 'next/server';
import { PulseError } from './client';

/**
 * One mapping from a Pulse failure to an admin-facing response, shared by every
 * /api/admin/pulse-brands route.
 *
 * The bare `{ error, detail }` envelope, not the nested /api/v1 one: these routes are
 * session-backed and their only consumer is our own admin UI, which already renders
 * `body.detail || body.error`.
 *
 * The messages are written to be read by the one admin who will see them, because every
 * failure here is a configuration or connectivity problem they are the person to fix —
 * there is no end user to shield from the detail.
 */
export function pulseErrorResponse(err: unknown): NextResponse {
  if (err instanceof PulseError) {
    switch (err.kind) {
      case 'not_configured':
        // 503, not 500: the feature is switched off, not broken.
        return NextResponse.json({ error: 'Pulse is not configured.', detail: err.message }, { status: 503 });
      case 'unauthorized':
        // 502 rather than 401/403 — the caller IS authorised here; it is our own outbound
        // credential that Pulse rejected. A 401 would read as "sign in again".
        return NextResponse.json({ error: 'Pulse rejected our credentials.', detail: err.message }, { status: 502 });
      case 'not_found':
        return NextResponse.json({ error: 'That brand is no longer live on Pulse.', detail: err.message }, { status: 404 });
      case 'timeout':
        return NextResponse.json({ error: 'Pulse timed out.', detail: err.message }, { status: 504 });
      case 'malformed':
      case 'upstream':
      default:
        return NextResponse.json({ error: 'Pulse returned an unexpected response.', detail: err.message }, { status: 502 });
    }
  }

  // Anything else is ours — a failed database read, a bug. Logged with the stack; the admin
  // gets the message because they are the person who would act on it.
  const message = err instanceof Error ? err.message : String(err);
  console.error('[admin/pulse-brands] failed:', err);
  return NextResponse.json({ error: 'Something went wrong on our side.', detail: message }, { status: 500 });
}
